import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { trpc } from '@/providers/trpc';
import {
  ArrowLeft, FileSpreadsheet, Plus, Trash2, Save, X, Pencil, Check, ShoppingCart, GitCompare,
  ClipboardList, Download, Ban, ChevronDown, ChevronRight as ChevronRightIcon, Link2, ExternalLink, AlertTriangle,
} from 'lucide-react';
import { exportarOrdenIndividualPdf } from '@/lib/exportarOrdenCompraPdf';
import { exportarComparativoComprasPdf } from '@/lib/exportarComparativoComprasPdf';

interface OrdenCompraItem {
  // Id del item original (ItemLocal.id) para poder bloquear su seleccion
  // mientras la orden siga activa (pendiente o ejecutada).
  itemId: string;
  cotizacionId: string;
  grupo: string;
  item: string;
  cantidad: number;
  precioUnitario: number;
  subtotal: number;
}

interface OrdenCompraRegistro {
  id: string;
  numero: number;
  proveedor: string;
  proveedorRuc: string;
  proveedorTelefono: string;
  proveedorDireccion: string;
  proveedorContacto: string;
  monto: number;
  fechaGeneracion: string;
  estado: 'pendiente' | 'ejecutada' | 'anulada';
  items: OrdenCompraItem[];
}

interface CotizacionLocal {
  id: string;
  proveedor: string;
  ruc: string;
  telefono: string;
  direccion: string;
  contacto: string;
  codigoProducto: string;
  nombreProducto: string;
  precio: string;
  url: string;
}

interface ItemLocal {
  id: string;
  item: string;
  cantidad: string;
  // Cantidad libre de cotizaciones de proveedor para este item (no hay
  // columnas fijas de proveedor por pestaña como en el comparativo original).
  cotizaciones: CotizacionLocal[];
  seleccionada: string | null;
}

interface HojaLocal {
  id: string;
  nombre: string;
  items: ItemLocal[];
}

interface CotizacionServidor {
  id: string;
  proveedor?: string;
  ruc?: string;
  telefono?: string;
  direccion?: string;
  contacto?: string;
  codigoProducto?: string;
  nombreProducto?: string;
  precio: number | null;
  url?: string;
}

interface ItemServidor {
  id: string;
  item: string;
  cantidad: number | null;
  cotizaciones?: CotizacionServidor[];
  seleccionada?: string | null;
}

interface HojaServidor {
  id: string;
  nombre: string;
  items: ItemServidor[];
}

// Columnas fijas de proveedor por item (Proveedor 1 / 2 / 3), cada una
// desplegable por separado.
const CANTIDAD_PROVEEDORES = 3;

// Limite de compra directa por proveedor y por mes: por encima de este
// monto se advierte en el subtotal, ya que puede requerir otro
// procedimiento de contratacion.
const LIMITE_COMPRA_DIRECTA = 2798000;

function generarIdLocal(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function cotizacionVacia(): CotizacionLocal {
  return { id: generarIdLocal(), proveedor: '', ruc: '', telefono: '', direccion: '', contacto: '', codigoProducto: '', nombreProducto: '', precio: '', url: '' };
}

function ajustarCotizaciones(cotizaciones: CotizacionLocal[], n: number): CotizacionLocal[] {
  const arr = cotizaciones.slice(0, n);
  while (arr.length < n) arr.push(cotizacionVacia());
  return arr;
}

function itemVacio(): ItemLocal {
  return { id: generarIdLocal(), item: '', cantidad: '', cotizaciones: ajustarCotizaciones([], CANTIDAD_PROVEEDORES), seleccionada: null };
}

function hojaVaciaLocal(nombre: string): HojaLocal {
  return { id: generarIdLocal(), nombre, items: [] };
}

function parsePrecio(valor: string): number | null {
  const limpio = valor.trim().replace(',', '.');
  if (!limpio) return null;
  const n = parseFloat(limpio);
  return isNaN(n) ? null : n;
}

function formatearNumero(valor: number): string {
  return valor.toLocaleString('es-PY', { maximumFractionDigits: 2 });
}

export default function ComparativoComprasDetalle() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const utils = trpc.useUtils();

  const { data, isLoading } = trpc.comparativoCompras.obtener.useQuery({ id: id || '' }, { enabled: !!id });
  const { data: sugerenciasData } = trpc.comparativoCompras.sugerenciasProveedores.useQuery();
  const proveedoresSugeridos = sugerenciasData?.exito ? sugerenciasData.proveedores : [];
  const guardarHojasMutation = trpc.comparativoCompras.guardarHojas.useMutation();
  const renombrarMutation = trpc.comparativoCompras.renombrar.useMutation();
  const actualizarPresupuestoMutation = trpc.comparativoCompras.actualizarPresupuesto.useMutation();
  const agregarOrdenesCompraMutation = trpc.comparativoCompras.agregarOrdenesCompra.useMutation();
  const actualizarEstadoOrdenCompraMutation = trpc.comparativoCompras.actualizarEstadoOrdenCompra.useMutation();
  const eliminarOrdenCompraMutation = trpc.comparativoCompras.eliminarOrdenCompra.useMutation();

  const [hojas, setHojas] = useState<HojaLocal[]>([]);
  const [hojaActivaId, setHojaActivaId] = useState<string>('');
  const [huboCambios, setHuboCambios] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [exportando, setExportando] = useState(false);
  const [error, setError] = useState('');

  const [mostrarNuevaHoja, setMostrarNuevaHoja] = useState(false);
  const [nombreNuevaHoja, setNombreNuevaHoja] = useState('');

  const [editandoNombreHoja, setEditandoNombreHoja] = useState(false);
  const [nombreHojaForm, setNombreHojaForm] = useState('');

  // Columnas de proveedor con el desplegable de datos extra abierto (solo
  // UI, no se persiste). Clave: "itemId:idxColumna".
  const [columnasExpandidas, setColumnasExpandidas] = useState<Set<string>>(new Set());
  const toggleColumna = (itemId: string, idx: number) => {
    const clave = `${itemId}:${idx}`;
    setColumnasExpandidas((prev) => {
      const next = new Set(prev);
      if (next.has(clave)) next.delete(clave); else next.add(clave);
      return next;
    });
  };

  useEffect(() => {
    if (!data?.exito) return;
    const hojasServidor = data.hojas as HojaServidor[];
    const hojasLocales: HojaLocal[] = hojasServidor.map((h) => ({
      id: h.id,
      nombre: h.nombre,
      items: (h.items || []).map((it) => ({
        id: it.id,
        item: it.item,
        cantidad: it.cantidad === null || it.cantidad === undefined ? '' : String(it.cantidad),
        cotizaciones: ajustarCotizaciones(
          (it.cotizaciones || []).map((c) => ({
            id: c.id,
            proveedor: c.proveedor || '',
            ruc: c.ruc || '',
            telefono: c.telefono || '',
            direccion: c.direccion || '',
            contacto: c.contacto || '',
            codigoProducto: c.codigoProducto || '',
            nombreProducto: c.nombreProducto || '',
            precio: c.precio === null || c.precio === undefined ? '' : String(c.precio),
            url: c.url || '',
          })),
          CANTIDAD_PROVEEDORES
        ),
        seleccionada: it.seleccionada || null,
      })),
    }));
    setHojas(hojasLocales);
    if (hojasLocales.length > 0) setHojaActivaId(hojasLocales[0].id);
    setColumnasExpandidas(new Set());
    setHuboCambios(false);
  }, [data]);

  const [presupuestoForm, setPresupuestoForm] = useState('');
  useEffect(() => {
    if (!data?.exito) return;
    setPresupuestoForm(data.presupuesto === null || data.presupuesto === undefined ? '' : String(data.presupuesto));
  }, [data]);

  const [ordenesCompra, setOrdenesCompra] = useState<OrdenCompraRegistro[]>([]);
  useEffect(() => {
    if (!data?.exito) return;
    const crudas = (data.ordenesCompra as (OrdenCompraRegistro & { numero?: number })[]) || [];
    setOrdenesCompra(
      crudas.map((o, i) => ({
        ...o,
        numero: typeof o.numero === 'number' ? o.numero : i + 1,
        items: (o.items || []).map((it) => ({ ...it, itemId: it.itemId || '', cotizacionId: it.cotizacionId || '' })),
      }))
    );
  }, [data]);

  const guardarPresupuesto = async () => {
    if (!id) return;
    const valor = parsePrecio(presupuestoForm);
    try {
      await actualizarPresupuestoMutation.mutateAsync({ id, presupuesto: valor });
      utils.comparativoCompras.obtener.invalidate({ id });
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error al guardar el presupuesto');
    }
  };

  const alternarEstadoOrden = async (orden: OrdenCompraRegistro) => {
    if (!id) return;
    const nuevoEstado = orden.estado === 'ejecutada' ? 'pendiente' : 'ejecutada';
    setOrdenesCompra((prev) => prev.map((o) => (o.id === orden.id ? { ...o, estado: nuevoEstado } : o)));
    try {
      await actualizarEstadoOrdenCompraMutation.mutateAsync({ id, ordenId: orden.id, estado: nuevoEstado });
    } catch (err: unknown) {
      setOrdenesCompra((prev) => prev.map((o) => (o.id === orden.id ? { ...o, estado: orden.estado } : o)));
      alert(err instanceof Error ? err.message : 'Error al actualizar el estado de la orden');
    }
  };

  const anularOrden = async (orden: OrdenCompraRegistro) => {
    if (!id) return;
    if (!confirm(`Anular la orden N° ${orden.numero} (${orden.proveedor})? Los items que tenia quedaran libres para volver a marcarse.`)) return;
    const anterior = orden.estado;
    setOrdenesCompra((prev) => prev.map((o) => (o.id === orden.id ? { ...o, estado: 'anulada' } : o)));
    try {
      await actualizarEstadoOrdenCompraMutation.mutateAsync({ id, ordenId: orden.id, estado: 'anulada' });
    } catch (err: unknown) {
      setOrdenesCompra((prev) => prev.map((o) => (o.id === orden.id ? { ...o, estado: anterior } : o)));
      alert(err instanceof Error ? err.message : 'Error al anular la orden');
    }
  };

  const [descargandoOrdenId, setDescargandoOrdenId] = useState<string | null>(null);

  const descargarOrden = async (orden: OrdenCompraRegistro) => {
    if (!data?.exito) return;
    setDescargandoOrdenId(orden.id);
    try {
      await exportarOrdenIndividualPdf({
        numero: orden.numero,
        nombreComparativo: data.nombre,
        proveedor: orden.proveedor,
        proveedorRuc: orden.proveedorRuc,
        proveedorTelefono: orden.proveedorTelefono,
        proveedorDireccion: orden.proveedorDireccion,
        proveedorContacto: orden.proveedorContacto,
        fechaGeneracion: orden.fechaGeneracion,
        estado: orden.estado,
        monto: orden.monto,
        items: orden.items,
      });
    } finally {
      setDescargandoOrdenId(null);
    }
  };

  const eliminarOrden = async (ordenId: string) => {
    if (!id) return;
    if (!confirm('Eliminar esta orden de compra generada?')) return;
    const anteriores = ordenesCompra;
    setOrdenesCompra((prev) => prev.filter((o) => o.id !== ordenId));
    try {
      await eliminarOrdenCompraMutation.mutateAsync({ id, ordenId });
    } catch (err: unknown) {
      setOrdenesCompra(anteriores);
      alert(err instanceof Error ? err.message : 'Error al eliminar la orden');
    }
  };

  const hojaActiva = hojas.find((h) => h.id === hojaActivaId);

  // Items que ya forman parte de una orden activa (pendiente o ejecutada):
  // quedan bloqueados para seleccion hasta que esa orden se anule.
  const itemsBloqueados = new Map<string, number>();
  for (const o of ordenesCompra) {
    if (o.estado === 'anulada') continue;
    for (const it of o.items) {
      itemsBloqueados.set(it.itemId, o.numero);
    }
  }

  // Agrupa por NOMBRE de proveedor (no por indice, ya que cada item puede
  // tener proveedores distintos) los items marcados que todavia no estan en
  // una orden activa: son los que entran en la proxima Orden de Compra.
  interface ResumenProveedor {
    proveedor: string;
    proveedorInfo: { ruc: string; telefono: string; direccion: string; contacto: string };
    cantidadItems: number;
    total: number;
    items: OrdenCompraItem[];
  }
  const resumenProveedores: ResumenProveedor[] = [];
  const indiceProveedores = new Map<string, number>();

  for (const h of hojas) {
    for (const it of h.items) {
      if (it.seleccionada === null) continue;
      if (itemsBloqueados.has(it.id)) continue;
      const cot = it.cotizaciones.find((c) => c.id === it.seleccionada);
      if (!cot) continue;
      const cantidad = parsePrecio(it.cantidad);
      const precio = parsePrecio(cot.precio);
      if (cantidad === null || precio === null) continue;
      const nombreProveedor = cot.proveedor.trim() || 'Proveedor sin nombre';
      let i = indiceProveedores.get(nombreProveedor);
      if (i === undefined) {
        i = resumenProveedores.length;
        indiceProveedores.set(nombreProveedor, i);
        resumenProveedores.push({
          proveedor: nombreProveedor,
          proveedorInfo: { ruc: cot.ruc, telefono: cot.telefono, direccion: cot.direccion, contacto: cot.contacto },
          cantidadItems: 0,
          total: 0,
          items: [],
        });
      }
      const subtotal = cantidad * precio;
      const codigoPrefijo = cot.codigoProducto.trim() ? `${cot.codigoProducto.trim()} - ` : '';
      const nombreItem = codigoPrefijo + (it.item.trim() || '-') + (cot.nombreProducto.trim() ? ` - ${cot.nombreProducto.trim()}` : '');
      resumenProveedores[i].cantidadItems += 1;
      resumenProveedores[i].total += subtotal;
      resumenProveedores[i].items.push({ itemId: it.id, cotizacionId: cot.id, grupo: h.nombre, item: nombreItem, cantidad, precioUnitario: precio, subtotal });
    }
  }
  const presupuestoNumero = parsePrecio(presupuestoForm);

  const totalPresupuestado = ordenesCompra.filter((o) => o.estado !== 'anulada').reduce((acc, o) => acc + o.monto, 0);
  const totalEjecutado = ordenesCompra.filter((o) => o.estado === 'ejecutada').reduce((acc, o) => acc + o.monto, 0);
  const remanente = presupuestoNumero !== null ? presupuestoNumero - totalEjecutado : null;

  // Ordenes de Compra Generadas, agrupadas por mes y dentro de cada mes por
  // proveedor, con subtotal por proveedor y total por mes. Las anuladas se
  // siguen mostrando (atenuadas) pero no suman a los subtotales/totales.
  interface GrupoProveedorMes { proveedor: string; subtotal: number; ordenes: OrdenCompraRegistro[] }
  interface GrupoMes { claveMes: string; etiquetaMes: string; totalMes: number; proveedores: GrupoProveedorMes[] }
  const mapaMeses = new Map<string, Map<string, OrdenCompraRegistro[]>>();
  for (const o of ordenesCompra) {
    const fecha = new Date(o.fechaGeneracion);
    const claveMes = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
    if (!mapaMeses.has(claveMes)) mapaMeses.set(claveMes, new Map());
    const mapaProveedores = mapaMeses.get(claveMes)!;
    if (!mapaProveedores.has(o.proveedor)) mapaProveedores.set(o.proveedor, []);
    mapaProveedores.get(o.proveedor)!.push(o);
  }
  const gruposPorMes: GrupoMes[] = Array.from(mapaMeses.keys())
    .sort((a, b) => b.localeCompare(a))
    .map((claveMes) => {
      const mapaProveedores = mapaMeses.get(claveMes)!;
      const proveedores: GrupoProveedorMes[] = Array.from(mapaProveedores.entries())
        .map(([proveedor, ordenes]) => ({
          proveedor,
          ordenes: [...ordenes].sort((a, b) => a.fechaGeneracion.localeCompare(b.fechaGeneracion)),
          subtotal: ordenes.filter((o) => o.estado !== 'anulada').reduce((acc, o) => acc + o.monto, 0),
        }))
        .sort((a, b) => a.proveedor.localeCompare(b.proveedor));
      const [anio, mes] = claveMes.split('-').map(Number);
      const etiquetaMes = new Date(anio, mes - 1, 1).toLocaleDateString('es-PY', { month: 'long', year: 'numeric' });
      return {
        claveMes,
        etiquetaMes,
        totalMes: proveedores.reduce((acc, p) => acc + p.subtotal, 0),
        proveedores,
      };
    });

  // Total de la pestaña activa: suma de los items que tienen una cotizacion
  // marcada (independientemente de si ya entraron en una orden).
  const totalHojaActiva = hojaActiva
    ? hojaActiva.items.reduce((acc, it) => {
        if (it.seleccionada === null) return acc;
        const cot = it.cotizaciones.find((c) => c.id === it.seleccionada);
        if (!cot) return acc;
        const cantidad = parsePrecio(it.cantidad);
        const precio = parsePrecio(cot.precio);
        if (cantidad === null || precio === null) return acc;
        return acc + cantidad * precio;
      }, 0)
    : 0;

  const actualizarHojaActiva = (fn: (hoja: HojaLocal) => HojaLocal) => {
    setHojas((prev) => prev.map((h) => (h.id === hojaActivaId ? fn(h) : h)));
    setHuboCambios(true);
  };

  const actualizarItemCampo = (itemId: string, campo: 'item' | 'cantidad', valor: string) => {
    actualizarHojaActiva((h) => ({ ...h, items: h.items.map((it) => (it.id === itemId ? { ...it, [campo]: valor } : it)) }));
  };

  const actualizarCotizacionCampo = (itemId: string, cotizacionId: string, campo: keyof CotizacionLocal, valor: string) => {
    actualizarHojaActiva((h) => ({
      ...h,
      items: h.items.map((it) => {
        if (it.id !== itemId) return it;
        return { ...it, cotizaciones: it.cotizaciones.map((c) => (c.id === cotizacionId ? { ...c, [campo]: valor } : c)) };
      }),
    }));
  };

  const actualizarCotizacionCampos = (itemId: string, cotizacionId: string, cambios: Partial<CotizacionLocal>) => {
    actualizarHojaActiva((h) => ({
      ...h,
      items: h.items.map((it) => {
        if (it.id !== itemId) return it;
        return { ...it, cotizaciones: it.cotizaciones.map((c) => (c.id === cotizacionId ? { ...c, ...cambios } : c)) };
      }),
    }));
  };

  // Al elegir un proveedor ya guardado (de la sugerencia), completa tambien
  // sus datos de contacto si todavia estan vacios -- sin pisar nada que el
  // usuario ya haya cargado a mano.
  const manejarCambioProveedor = (itemId: string, c: CotizacionLocal, valor: string) => {
    const sugerido = proveedoresSugeridos.find((p) => p.nombre.toLowerCase() === valor.trim().toLowerCase());
    const sinContacto = !c.ruc.trim() && !c.telefono.trim() && !c.direccion.trim() && !c.contacto.trim();
    if (sugerido && sinContacto) {
      actualizarCotizacionCampos(itemId, c.id, {
        proveedor: valor,
        ruc: sugerido.ruc,
        telefono: sugerido.telefono,
        direccion: sugerido.direccion,
        contacto: sugerido.contacto,
      });
    } else {
      actualizarCotizacionCampo(itemId, c.id, 'proveedor', valor);
    }
  };

  const marcarSeleccion = (itemId: string, cotizacionId: string) => {
    actualizarHojaActiva((h) => ({
      ...h,
      items: h.items.map((it) => (it.id === itemId ? { ...it, seleccionada: it.seleccionada === cotizacionId ? null : cotizacionId } : it)),
    }));
  };

  const agregarFila = () => {
    const nuevo = itemVacio();
    actualizarHojaActiva((h) => ({ ...h, items: [...h.items, nuevo] }));
    // Arranca con la primera columna de proveedor abierta para invitar a cargarla.
    setColumnasExpandidas((prev) => new Set(prev).add(`${nuevo.id}:0`));
  };
  const quitarFila = (itemId: string) => actualizarHojaActiva((h) => ({ ...h, items: h.items.filter((it) => it.id !== itemId) }));

  const agregarHoja = () => {
    if (!nombreNuevaHoja.trim()) return;
    const nueva = hojaVaciaLocal(nombreNuevaHoja.trim());
    setHojas((prev) => [...prev, nueva]);
    setHojaActivaId(nueva.id);
    setHuboCambios(true);
    setNombreNuevaHoja('');
    setMostrarNuevaHoja(false);
  };

  const quitarHoja = (hojaId: string) => {
    if (hojas.length <= 1) return;
    const hoja = hojas.find((h) => h.id === hojaId);
    if (!hoja) return;
    if (!confirm(`Eliminar la pestaña "${hoja.nombre}" y todos sus items?`)) return;
    const restantes = hojas.filter((h) => h.id !== hojaId);
    setHojas(restantes);
    if (hojaActivaId === hojaId) setHojaActivaId(restantes[0]?.id || '');
    setHuboCambios(true);
  };

  const iniciarEdicionNombreHoja = () => {
    if (!hojaActiva) return;
    setNombreHojaForm(hojaActiva.nombre);
    setEditandoNombreHoja(true);
  };

  const guardarNombreHoja = () => {
    if (!nombreHojaForm.trim()) { setEditandoNombreHoja(false); return; }
    actualizarHojaActiva((h) => ({ ...h, nombre: nombreHojaForm.trim() }));
    setEditandoNombreHoja(false);
  };

  const handleExportar = async () => {
    if (!data?.exito || !id) return;
    if (resumenProveedores.length === 0) {
      alert('No hay items marcados (y sin una orden activa) para generar una orden de compra.');
      return;
    }
    setExportando(true);
    try {
      const fechaGeneracion = new Date().toISOString();
      const numeroBase = ordenesCompra.reduce((max, o) => Math.max(max, o.numero), 0);
      const nuevasOrdenes: OrdenCompraRegistro[] = resumenProveedores.map((p, i) => ({
        id: generarIdLocal(),
        numero: numeroBase + i + 1,
        proveedor: p.proveedor,
        proveedorRuc: p.proveedorInfo.ruc,
        proveedorTelefono: p.proveedorInfo.telefono,
        proveedorDireccion: p.proveedorInfo.direccion,
        proveedorContacto: p.proveedorInfo.contacto,
        monto: p.total,
        fechaGeneracion,
        estado: 'pendiente',
        items: p.items,
      }));
      await agregarOrdenesCompraMutation.mutateAsync({ id, ordenes: nuevasOrdenes });
      utils.comparativoCompras.obtener.invalidate({ id });
    } finally {
      setExportando(false);
    }
  };

  const [exportandoComparativo, setExportandoComparativo] = useState(false);

  const handleExportarComparativo = async () => {
    if (!data?.exito) return;
    setExportandoComparativo(true);
    try {
      await exportarComparativoComprasPdf({
        nombre: data.nombre,
        hojas: hojas.map((h) => ({
          nombre: h.nombre,
          items: h.items
            .filter((it) => it.item.trim() || it.cantidad.trim() || it.cotizaciones.some((c) => c.proveedor.trim() || c.precio.trim() || c.codigoProducto.trim() || c.nombreProducto.trim()))
            .map((it) => ({
              item: it.item,
              cantidad: parsePrecio(it.cantidad),
              cotizaciones: it.cotizaciones
                .filter((c) => c.proveedor.trim() || c.precio.trim() || c.codigoProducto.trim() || c.nombreProducto.trim())
                .map((c) => ({
                  proveedor: c.proveedor,
                  codigoProducto: c.codigoProducto,
                  nombreProducto: c.nombreProducto,
                  precio: parsePrecio(c.precio),
                  url: c.url,
                })),
            })),
        })),
      });
    } finally {
      setExportandoComparativo(false);
    }
  };

  const handleGuardar = async () => {
    if (!id) return;
    setError('');
    setGuardando(true);
    try {
      const hojasParaGuardar = hojas.map((h) => ({
        id: h.id,
        nombre: h.nombre,
        items: h.items
          .filter((it) => it.item.trim() || it.cantidad.trim() || it.cotizaciones.some((c) => c.proveedor.trim() || c.precio.trim() || c.codigoProducto.trim() || c.nombreProducto.trim() || c.url.trim()))
          .map((it) => ({
            id: it.id,
            item: it.item.trim(),
            cantidad: parsePrecio(it.cantidad),
            // Las 3 columnas de proveedor se guardan siempre (aunque esten
            // vacias), ya que son posiciones fijas (Proveedor 1/2/3).
            cotizaciones: it.cotizaciones.map((c) => ({
              id: c.id,
              proveedor: c.proveedor.trim(),
              ruc: c.ruc.trim(),
              telefono: c.telefono.trim(),
              direccion: c.direccion.trim(),
              contacto: c.contacto.trim(),
              codigoProducto: c.codigoProducto.trim(),
              nombreProducto: c.nombreProducto.trim(),
              precio: parsePrecio(c.precio),
              url: c.url.trim(),
            })),
            seleccionada: it.seleccionada,
          })),
      }));
      await guardarHojasMutation.mutateAsync({ id, hojas: hojasParaGuardar });
      utils.comparativoCompras.obtener.invalidate({ id });
      utils.comparativoCompras.listado.invalidate();
      setHuboCambios(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setGuardando(false);
    }
  };

  const [editandoNombreComparativo, setEditandoNombreComparativo] = useState(false);
  const [nombreComparativoForm, setNombreComparativoForm] = useState('');

  const iniciarEdicionNombreComparativo = () => {
    if (!data?.exito) return;
    setNombreComparativoForm(data.nombre);
    setEditandoNombreComparativo(true);
  };

  const guardarNombreComparativo = async () => {
    if (!id || !nombreComparativoForm.trim()) { setEditandoNombreComparativo(false); return; }
    try {
      await renombrarMutation.mutateAsync({ id, nombre: nombreComparativoForm.trim() });
      utils.comparativoCompras.obtener.invalidate({ id });
      utils.comparativoCompras.listado.invalidate();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error al renombrar');
    } finally {
      setEditandoNombreComparativo(false);
    }
  };

  if (isLoading) {
    return <div className="text-white/60 text-center py-12">Cargando...</div>;
  }

  if (!data?.exito) {
    return (
      <div className="animate-fade-in">
        <button onClick={() => navigate('/comparativos')} className="mb-4 flex items-center gap-2 text-white/50 hover:text-white text-sm transition-colors">
          <ArrowLeft className="w-4 h-4" /> Volver a Comparativo de Compras
        </button>
        <div className="bg-white/[0.03] border border-white/5 rounded-xl p-8 text-center text-white/60">Comparativo no encontrado.</div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-6">
      {/* Compartido por todos los campos "Nombre del proveedor": sugiere
          proveedores ya cargados en cualquier cotizacion de cualquier
          comparativo. */}
      <datalist id="proveedores-sugeridos-datalist">
        {proveedoresSugeridos.map((p) => <option key={p.nombre} value={p.nombre} />)}
      </datalist>
      <Link to="/comparativos" className="mb-2 flex items-center gap-2 text-white/50 hover:text-white text-sm transition-colors w-fit">
        <ArrowLeft className="w-4 h-4" /> Volver a Comparativo de Compras
      </Link>

      <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-cbvp-red shrink-0" />
            {editandoNombreComparativo ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={nombreComparativoForm}
                  onChange={(e) => setNombreComparativoForm(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') guardarNombreComparativo(); if (e.key === 'Escape') setEditandoNombreComparativo(false); }}
                  autoFocus
                  className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-lg font-bold text-white focus:border-cbvp-red/50 focus:outline-none"
                />
                <button onClick={guardarNombreComparativo} className="p-1.5 rounded-lg hover:bg-white/10 text-cbvp-green"><Check className="w-4 h-4" /></button>
              </div>
            ) : (
              <h1 onClick={iniciarEdicionNombreComparativo} className="text-lg font-bold text-white cursor-pointer hover:text-white/80 flex items-center gap-2 group">
                {data.nombre}
                <Pencil className="w-3.5 h-3.5 text-white/20 group-hover:text-white/50" />
              </h1>
            )}
          </div>

          <div className="flex items-center gap-2">
            {huboCambios && <span className="text-xs text-cbvp-yellow">Cambios sin guardar</span>}
            <button onClick={handleExportarComparativo} disabled={exportandoComparativo} className="px-4 py-2 bg-white/5 hover:bg-white/10 disabled:opacity-40 text-white/70 text-sm font-medium rounded-lg transition-colors flex items-center gap-2">
              <GitCompare className="w-4 h-4" /> {exportandoComparativo ? 'Generando PDF...' : 'Generar Comparativo'}
            </button>
            <button onClick={handleExportar} disabled={exportando} className="px-4 py-2 bg-white/5 hover:bg-white/10 disabled:opacity-40 text-white/70 text-sm font-medium rounded-lg transition-colors flex items-center gap-2">
              <ShoppingCart className="w-4 h-4" /> {exportando ? 'Generando...' : 'Generar Orden de Compra'}
            </button>
            <button onClick={handleGuardar} disabled={guardando || !huboCambios} className="px-4 py-2 bg-cbvp-green hover:bg-cbvp-green/80 disabled:opacity-40 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2">
              <Save className="w-4 h-4" /> {guardando ? 'Guardando...' : 'Guardar Cambios'}
            </button>
          </div>
        </div>

        {error && <p className="text-sm text-red-400 mb-3">{error}</p>}

        {/* Pestañas */}
        <div className="flex items-center gap-1 flex-wrap border-b border-white/10 mb-4">
          {hojas.map((h) => (
            <button
              key={h.id}
              onClick={() => setHojaActivaId(h.id)}
              className={`px-3 py-2 text-sm rounded-t-lg border-b-2 transition-colors ${
                h.id === hojaActivaId ? 'border-cbvp-red text-white bg-white/[0.03]' : 'border-transparent text-white/40 hover:text-white/70'
              }`}
            >
              {h.nombre}
            </button>
          ))}
          {mostrarNuevaHoja ? (
            <div className="flex items-center gap-1 px-2 py-1">
              <input
                type="text"
                value={nombreNuevaHoja}
                onChange={(e) => setNombreNuevaHoja(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') agregarHoja(); if (e.key === 'Escape') setMostrarNuevaHoja(false); }}
                placeholder="Nombre de la pestaña"
                autoFocus
                className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-white focus:border-cbvp-red/50 focus:outline-none"
              />
              <button onClick={agregarHoja} className="p-1.5 rounded hover:bg-white/10 text-cbvp-green"><Check className="w-3.5 h-3.5" /></button>
              <button onClick={() => setMostrarNuevaHoja(false)} className="p-1.5 rounded hover:bg-white/10 text-white/40"><X className="w-3.5 h-3.5" /></button>
            </div>
          ) : (
            <button onClick={() => setMostrarNuevaHoja(true)} className="p-2 rounded-t-lg text-white/40 hover:text-white hover:bg-white/[0.03]" title="Agregar pestaña">
              <Plus className="w-4 h-4" />
            </button>
          )}
        </div>

        {hojaActiva && (
          <>
            <div className="flex items-center gap-2 mb-3">
              {editandoNombreHoja ? (
                <>
                  <input
                    type="text"
                    value={nombreHojaForm}
                    onChange={(e) => setNombreHojaForm(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') guardarNombreHoja(); if (e.key === 'Escape') setEditandoNombreHoja(false); }}
                    autoFocus
                    className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-sm text-white focus:border-cbvp-red/50 focus:outline-none"
                  />
                  <button onClick={guardarNombreHoja} className="p-1.5 rounded-lg hover:bg-white/10 text-cbvp-green"><Check className="w-3.5 h-3.5" /></button>
                </>
              ) : (
                <button onClick={iniciarEdicionNombreHoja} className="text-xs text-white/40 hover:text-white/70 flex items-center gap-1">
                  <Pencil className="w-3 h-3" /> Renombrar pestaña
                </button>
              )}
              {hojas.length > 1 && (
                <button onClick={() => quitarHoja(hojaActiva.id)} className="text-xs text-white/40 hover:text-cbvp-red flex items-center gap-1">
                  <Trash2 className="w-3 h-3" /> Eliminar pestaña
                </button>
              )}
            </div>

            {hojaActiva.items.length === 0 ? (
              <div className="text-center py-8 text-white/30 text-sm">
                Todavia no hay items en esta pestaña. Usa "Agregar item" para cargar el primero.
              </div>
            ) : (
              // Lista de items con alto fijo: siempre desborda hacia abajo
              // (scroll interno) en vez de estirar toda la pagina.
              <div className="max-h-[65vh] overflow-y-auto pr-1 space-y-2 mb-3">
                {hojaActiva.items.map((it, i) => {
                  const cantidadNum = parsePrecio(it.cantidad);
                  const preciosValidos = it.cotizaciones.map((c) => parsePrecio(c.precio)).filter((v): v is number => v !== null);
                  const minimo = preciosValidos.length > 0 ? Math.min(...preciosValidos) : null;
                  const cotSeleccionada = it.cotizaciones.find((c) => c.id === it.seleccionada) || null;
                  const precioSeleccionado = cotSeleccionada ? parsePrecio(cotSeleccionada.precio) : null;
                  const costoTotal = cantidadNum !== null && precioSeleccionado !== null ? cantidadNum * precioSeleccionado : null;
                  const numeroOrdenBloqueo = itemsBloqueados.get(it.id);
                  const bloqueado = numeroOrdenBloqueo !== undefined;

                  return (
                    <div key={it.id} className="bg-white/[0.02] border border-white/10 rounded-xl overflow-hidden">
                      {/* Todo en una sola fila: datos del item, las 3 tarjetas
                          de proveedor y el total, sin bajar de linea. Si no
                          entran todas en el ancho disponible, la fila entera
                          se desplaza horizontalmente (scroll) en vez de
                          partirse en varias lineas. */}
                      <div className="flex items-start gap-2 p-3 overflow-x-auto">
                        <span className="text-white/30 text-xs pt-2 shrink-0 w-5">{i + 1}</span>
                        <textarea
                          ref={(el) => { if (el) { el.style.height = 'auto'; el.style.height = `${el.scrollHeight}px`; } }}
                          value={it.item}
                          onChange={(e) => {
                            actualizarItemCampo(it.id, 'item', e.target.value);
                            e.target.style.height = 'auto';
                            e.target.style.height = `${e.target.scrollHeight}px`;
                          }}
                          rows={1}
                          placeholder="Nombre del item"
                          className="flex-1 min-w-[192px] bg-white/5 border border-white/10 rounded px-2 py-1.5 text-sm text-white focus:border-cbvp-red/50 focus:outline-none resize-none overflow-hidden leading-snug"
                        />
                        <input
                          type="text"
                          inputMode="decimal"
                          value={it.cantidad}
                          onChange={(e) => actualizarItemCampo(it.id, 'cantidad', e.target.value)}
                          placeholder="Cant."
                          className="shrink-0 w-16 bg-white/5 border border-white/10 rounded px-2 py-1.5 text-sm text-white text-right focus:border-cbvp-red/50 focus:outline-none"
                        />

                        {it.cotizaciones.map((c, idx) => {
                          const precioNum = parsePrecio(c.precio);
                          const esMinimo = minimo !== null && precioNum === minimo;
                          const esSeleccionada = it.seleccionada === c.id;
                          const puedeMarcar = precioNum !== null && !bloqueado;
                          const columnaExpandida = columnasExpandidas.has(`${it.id}:${idx}`);
                          return (
                            <div key={c.id} className={`shrink-0 w-56 rounded-lg border p-2 space-y-1 ${esSeleccionada ? 'border-cbvp-red/40 bg-cbvp-red/5' : 'border-white/10 bg-white/[0.02]'}`}>
                              {/* Sin etiqueta "PROVEEDOR N": el radio de
                                  seleccion y el desplegable van en la misma
                                  fila que el nombre, para ahorrar espacio. */}
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => marcarSeleccion(it.id, c.id)}
                                  disabled={!puedeMarcar}
                                  title={
                                    bloqueado
                                      ? `Este item ya esta en la Orden de Compra N° ${numeroOrdenBloqueo}. Anula esa orden para poder cambiarlo.`
                                      : esSeleccionada
                                      ? 'Quitar de la orden de compra'
                                      : 'Marcar para la orden de compra'
                                  }
                                  className={`shrink-0 w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${
                                    esSeleccionada
                                      ? bloqueado
                                        ? 'bg-white/20 border-white/20'
                                        : 'bg-cbvp-red border-cbvp-red'
                                      : 'border-white/20 hover:border-white/40 disabled:opacity-20 disabled:cursor-not-allowed disabled:hover:border-white/20'
                                  }`}
                                >
                                  {esSeleccionada && <Check className="w-2.5 h-2.5 text-white" />}
                                </button>
                                <input
                                  type="text"
                                  value={c.proveedor}
                                  onChange={(e) => manejarCambioProveedor(it.id, c, e.target.value)}
                                  placeholder="Nombre del proveedor"
                                  list="proveedores-sugeridos-datalist"
                                  className="flex-1 min-w-0 bg-white/5 border border-white/10 rounded px-2 py-1 text-sm text-white font-medium focus:border-cbvp-red/50 focus:outline-none"
                                />
                                <button type="button" onClick={() => toggleColumna(it.id, idx)} className="shrink-0 p-0.5 text-white/40 hover:text-white transition-colors" title={columnaExpandida ? 'Ocultar datos' : 'Ver codigo, producto y URL'}>
                                  {columnaExpandida ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRightIcon className="w-3.5 h-3.5" />}
                                </button>
                              </div>
                              <input
                                type="text"
                                inputMode="decimal"
                                value={c.precio}
                                onChange={(e) => actualizarCotizacionCampo(it.id, c.id, 'precio', e.target.value)}
                                placeholder="Precio"
                                className={`w-full border rounded px-2 py-1 text-xs text-right focus:outline-none ${
                                  esMinimo ? 'bg-cbvp-green/10 border-cbvp-green/30 text-cbvp-green font-semibold' : 'bg-white/5 border-white/10 text-white focus:border-cbvp-red/50'
                                }`}
                              />
                              {columnaExpandida && (
                                <>
                                  <input
                                    type="text"
                                    value={c.codigoProducto}
                                    onChange={(e) => actualizarCotizacionCampo(it.id, c.id, 'codigoProducto', e.target.value)}
                                    placeholder="Codigo"
                                    className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-white/80 focus:border-cbvp-red/50 focus:outline-none"
                                  />
                                  <input
                                    type="text"
                                    value={c.nombreProducto}
                                    onChange={(e) => actualizarCotizacionCampo(it.id, c.id, 'nombreProducto', e.target.value)}
                                    placeholder="Nombre del producto (segun proveedor)"
                                    className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-white/80 focus:border-cbvp-red/50 focus:outline-none"
                                  />
                                  <div className="flex items-center gap-1">
                                    <Link2 className="w-3 h-3 text-white/20 shrink-0" />
                                    <input
                                      type="text"
                                      value={c.url}
                                      onChange={(e) => actualizarCotizacionCampo(it.id, c.id, 'url', e.target.value)}
                                      placeholder="URL del producto"
                                      className="flex-1 min-w-0 bg-transparent border-b border-white/10 px-1 py-0.5 text-xs text-white/60 focus:border-cbvp-red/50 focus:outline-none"
                                    />
                                    {c.url.trim() && (
                                      <a href={c.url.trim()} target="_blank" rel="noopener noreferrer" className="shrink-0 p-1 rounded hover:bg-cbvp-red/20 text-cbvp-red transition-colors" title="Abrir URL">
                                        <ExternalLink className="w-3 h-3" />
                                      </a>
                                    )}
                                  </div>
                                  <div className="grid grid-cols-2 gap-1">
                                    <input type="text" value={c.ruc} onChange={(e) => actualizarCotizacionCampo(it.id, c.id, 'ruc', e.target.value)} placeholder="RUC" className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-[11px] text-white/60 focus:border-cbvp-red/50 focus:outline-none" />
                                    <input type="text" value={c.telefono} onChange={(e) => actualizarCotizacionCampo(it.id, c.id, 'telefono', e.target.value)} placeholder="Telefono" className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-[11px] text-white/60 focus:border-cbvp-red/50 focus:outline-none" />
                                    <input type="text" value={c.direccion} onChange={(e) => actualizarCotizacionCampo(it.id, c.id, 'direccion', e.target.value)} placeholder="Direccion" className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-[11px] text-white/60 focus:border-cbvp-red/50 focus:outline-none" />
                                    <input type="text" value={c.contacto} onChange={(e) => actualizarCotizacionCampo(it.id, c.id, 'contacto', e.target.value)} placeholder="Contacto" className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-[11px] text-white/60 focus:border-cbvp-red/50 focus:outline-none" />
                                  </div>
                                </>
                              )}
                            </div>
                          );
                        })}

                        <div className="text-right text-sm shrink-0 w-24 pt-2">
                          <span className={costoTotal !== null ? 'text-white font-semibold' : 'text-white/20'}>{costoTotal === null ? '-' : formatearNumero(costoTotal)}</span>
                        </div>
                        <button onClick={() => quitarFila(it.id)} className="p-1.5 rounded-lg hover:bg-cbvp-red/20 text-white/40 hover:text-cbvp-red transition-colors shrink-0" title="Quitar item">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex items-center justify-between flex-wrap gap-2 mt-1">
              <button onClick={agregarFila} className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white/60 rounded-lg text-xs flex items-center gap-2 transition-colors">
                <Plus className="w-3.5 h-3.5" /> Agregar item
              </button>
              <span className="text-xs text-white/40">Total pestaña (items seleccionados): <span className="text-white/70 font-semibold">{formatearNumero(totalHojaActiva)}</span></span>
            </div>
          </>
        )}
      </div>

      <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6">
        <h2 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
          <ClipboardList className="w-4 h-4 text-cbvp-red" /> Ordenes de Compra Generadas
        </h2>

        {ordenesCompra.length === 0 ? (
          <div className="text-center py-6 text-white/30 text-sm mb-4">
            Todavia no se genero ninguna orden de compra. Usa "Generar Orden de Compra" arriba.
          </div>
        ) : (
          <div className="space-y-3 mb-6">
            {gruposPorMes.map((grupoMes) => (
              <div key={grupoMes.claveMes} className="border border-white/10 rounded-lg overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2 bg-white/5">
                  <span className="text-sm font-bold text-white capitalize">{grupoMes.etiquetaMes}</span>
                  <span className="text-sm font-semibold text-cbvp-red">Total del mes: {formatearNumero(grupoMes.totalMes)}</span>
                </div>
                {grupoMes.proveedores.map((grupoProveedor) => (
                  <div key={grupoProveedor.proveedor} className="border-t border-white/5">
                    <div className="flex items-center justify-between px-3 py-1.5 bg-white/[0.02]">
                      <span className="text-xs font-semibold text-white/70">{grupoProveedor.proveedor}</span>
                      <div className="flex items-center gap-2">
                        {grupoProveedor.subtotal > LIMITE_COMPRA_DIRECTA && (
                          <span
                            className="flex items-center gap-1 text-[10px] font-semibold text-cbvp-yellow"
                            title={`Supera el limite de compra directa (${formatearNumero(LIMITE_COMPRA_DIRECTA)}) para este proveedor en el mes`}
                          >
                            <AlertTriangle className="w-3 h-3" /> Supera limite de compra directa
                          </span>
                        )}
                        <span className="text-xs text-white/50">Subtotal: {formatearNumero(grupoProveedor.subtotal)}</span>
                      </div>
                    </div>
                    {grupoProveedor.ordenes.map((o) => (
                      <div key={o.id} className={`flex items-center gap-2 px-3 py-1.5 border-t border-white/5 text-xs sm:text-sm ${o.estado === 'anulada' ? 'opacity-50' : ''}`}>
                        <span className="w-10 text-white/60 shrink-0">N° {o.numero}</span>
                        <span className="w-24 text-white/60 shrink-0">{new Date(o.fechaGeneracion).toLocaleDateString('es-PY')}</span>
                        <span className={`flex-1 text-right text-white ${o.estado === 'anulada' ? 'line-through' : ''}`}>{formatearNumero(o.monto)}</span>
                        <span className="w-24 shrink-0 flex justify-center">
                          {o.estado === 'anulada' ? (
                            <span className="px-2 py-1 rounded-full text-xs font-medium bg-white/10 text-white/50">Anulada</span>
                          ) : (
                            <button
                              onClick={() => alternarEstadoOrden(o)}
                              className={`px-2 py-1 rounded-full text-xs font-medium transition-colors ${
                                o.estado === 'ejecutada'
                                  ? 'bg-cbvp-green/15 text-cbvp-green hover:bg-cbvp-green/25'
                                  : 'bg-cbvp-yellow/15 text-cbvp-yellow hover:bg-cbvp-yellow/25'
                              }`}
                            >
                              {o.estado === 'ejecutada' ? 'Ejecutada' : 'Pendiente'}
                            </button>
                          )}
                        </span>
                        <button
                          onClick={() => descargarOrden(o)}
                          disabled={descargandoOrdenId === o.id}
                          className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition-colors disabled:opacity-40 shrink-0"
                          title="Descargar orden"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                        {o.estado !== 'anulada' && (
                          <button
                            onClick={() => anularOrden(o)}
                            className="p-1.5 rounded-lg hover:bg-cbvp-yellow/20 text-white/40 hover:text-cbvp-yellow transition-colors shrink-0"
                            title="Anular orden"
                          >
                            <Ban className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button onClick={() => eliminarOrden(o.id)} className="p-1.5 rounded-lg hover:bg-cbvp-red/20 text-white/40 hover:text-cbvp-red transition-colors shrink-0" title="Eliminar orden">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-white/[0.03] border border-white/10 rounded-lg px-4 py-3">
            <label className="block text-xs text-white/50 mb-1">Presupuesto disponible</label>
            <input
              type="text"
              inputMode="decimal"
              value={presupuestoForm}
              onChange={(e) => setPresupuestoForm(e.target.value)}
              onBlur={guardarPresupuesto}
              onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
              placeholder="0"
              className="w-full bg-transparent text-lg font-semibold text-white focus:outline-none"
            />
          </div>
          <div className="bg-white/[0.03] border border-white/10 rounded-lg px-4 py-3">
            <span className="block text-xs text-white/50 mb-1">Total Presupuestado</span>
            <span className="text-lg font-semibold text-white">{formatearNumero(totalPresupuestado)}</span>
          </div>
          <div className="bg-white/[0.03] border border-white/10 rounded-lg px-4 py-3">
            <span className="block text-xs text-white/50 mb-1">Total Ejecutado</span>
            <span className="text-lg font-semibold text-white">{formatearNumero(totalEjecutado)}</span>
          </div>
          <div className={`rounded-lg px-4 py-3 border ${remanente !== null && remanente < 0 ? 'bg-cbvp-red/10 border-cbvp-red/30' : 'bg-cbvp-green/10 border-cbvp-green/30'}`}>
            <span className="block text-xs text-white/50 mb-1">{remanente !== null && remanente < 0 ? 'Faltante' : 'Remanente'}</span>
            <span className={`text-lg font-semibold ${remanente !== null && remanente < 0 ? 'text-cbvp-red' : 'text-cbvp-green'}`}>
              {remanente === null ? '-' : formatearNumero(Math.abs(remanente))}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
