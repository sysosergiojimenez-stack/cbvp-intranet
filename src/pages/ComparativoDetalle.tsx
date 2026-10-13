import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { trpc } from '@/providers/trpc';
import { ArrowLeft, FileSpreadsheet, Plus, Trash2, Save, X, Pencil, Check, ShoppingCart, GitCompare, ClipboardList, Download, Ban } from 'lucide-react';
import { exportarOrdenIndividualPdf } from '@/lib/exportarOrdenCompraPdf';
import { exportarComparativoPdf } from '@/lib/exportarComparativoPdf';

interface OrdenCompraItem {
  // Id del item original (ItemLocal.id) para poder bloquear su seleccion
  // mientras la orden siga activa (pendiente o ejecutada).
  itemId: string;
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
  // Datos de contacto del proveedor copiados al momento de generar la
  // orden (quedan fijos aunque despues se editen en la hoja).
  proveedorRuc: string;
  proveedorTelefono: string;
  proveedorDireccion: string;
  proveedorContacto: string;
  monto: number;
  fechaGeneracion: string;
  estado: 'pendiente' | 'ejecutada' | 'anulada';
  items: OrdenCompraItem[];
}

interface ProveedorInfo {
  nombre: string;
  ruc: string;
  telefono: string;
  direccion: string;
  contacto: string;
}

interface ItemLocal {
  id: string;
  item: string;
  // Codigo/descripcion propia de cada proveedor para este item (pueden
  // catalogarlo distinto entre si).
  itemProveedor: [string, string, string];
  cantidad: string;
  precios: [string, string, string];
  seleccionado: number | null;
}

interface HojaLocal {
  id: string;
  nombre: string;
  proveedores: [ProveedorInfo, ProveedorInfo, ProveedorInfo];
  items: ItemLocal[];
}

interface ItemServidor {
  id: string;
  item: string;
  itemProveedor?: string[];
  cantidad: number | null;
  precios: (number | null)[];
  seleccionado: number | null;
}

interface HojaServidor {
  id: string;
  nombre: string;
  proveedores: (string | Partial<ProveedorInfo>)[];
  items: ItemServidor[];
}

function generarIdLocal(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function proveedorVacioLocal(nombre: string): ProveedorInfo {
  return { nombre, ruc: '', telefono: '', direccion: '', contacto: '' };
}

function itemVacio(): ItemLocal {
  return { id: generarIdLocal(), item: '', itemProveedor: ['', '', ''], cantidad: '', precios: ['', '', ''], seleccionado: null };
}

function hojaVaciaLocal(nombre: string): HojaLocal {
  return {
    id: generarIdLocal(),
    nombre,
    proveedores: [proveedorVacioLocal('Proveedor 1'), proveedorVacioLocal('Proveedor 2'), proveedorVacioLocal('Proveedor 3')],
    items: [],
  };
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

export default function ComparativoDetalle() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const utils = trpc.useUtils();

  const { data, isLoading } = trpc.comparativos.obtener.useQuery({ id: id || '' }, { enabled: !!id });
  const guardarHojasMutation = trpc.comparativos.guardarHojas.useMutation();
  const renombrarMutation = trpc.comparativos.renombrar.useMutation();
  const actualizarPresupuestoMutation = trpc.comparativos.actualizarPresupuesto.useMutation();
  const agregarOrdenesCompraMutation = trpc.comparativos.agregarOrdenesCompra.useMutation();
  const actualizarEstadoOrdenCompraMutation = trpc.comparativos.actualizarEstadoOrdenCompra.useMutation();
  const eliminarOrdenCompraMutation = trpc.comparativos.eliminarOrdenCompra.useMutation();

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

  useEffect(() => {
    if (!data?.exito) return;
    const hojasServidor = data.hojas as HojaServidor[];
    const normalizarProveedor = (p: string | Partial<ProveedorInfo> | undefined, nombrePorDefecto: string): ProveedorInfo => {
      if (!p) return proveedorVacioLocal(nombrePorDefecto);
      if (typeof p === 'string') return proveedorVacioLocal(p || nombrePorDefecto);
      return {
        nombre: p.nombre || nombrePorDefecto,
        ruc: p.ruc || '',
        telefono: p.telefono || '',
        direccion: p.direccion || '',
        contacto: p.contacto || '',
      };
    };
    const hojasLocales: HojaLocal[] = hojasServidor.map((h) => ({
      id: h.id,
      nombre: h.nombre,
      proveedores: [
        normalizarProveedor(h.proveedores?.[0], 'Proveedor 1'),
        normalizarProveedor(h.proveedores?.[1], 'Proveedor 2'),
        normalizarProveedor(h.proveedores?.[2], 'Proveedor 3'),
      ],
      items: (h.items || []).map((it) => ({
        id: it.id,
        item: it.item,
        itemProveedor: [
          it.itemProveedor?.[0] || '',
          it.itemProveedor?.[1] || '',
          it.itemProveedor?.[2] || '',
        ],
        cantidad: it.cantidad === null || it.cantidad === undefined ? '' : String(it.cantidad),
        precios: [
          it.precios?.[0] === null || it.precios?.[0] === undefined ? '' : String(it.precios[0]),
          it.precios?.[1] === null || it.precios?.[1] === undefined ? '' : String(it.precios[1]),
          it.precios?.[2] === null || it.precios?.[2] === undefined ? '' : String(it.precios[2]),
        ],
        seleccionado: typeof it.seleccionado === 'number' ? it.seleccionado : null,
      })),
    }));
    setHojas(hojasLocales);
    if (hojasLocales.length > 0) setHojaActivaId(hojasLocales[0].id);
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
    // Ordenes guardadas antes de agregar la numeracion/bloqueo/datos de
    // contacto no tienen esos campos: se completan con valores por defecto
    // para que no queden en blanco ni rompan el bloqueo.
    setOrdenesCompra(
      crudas.map((o, i) => ({
        ...o,
        numero: typeof o.numero === 'number' ? o.numero : i + 1,
        proveedorRuc: o.proveedorRuc || '',
        proveedorTelefono: o.proveedorTelefono || '',
        proveedorDireccion: o.proveedorDireccion || '',
        proveedorContacto: o.proveedorContacto || '',
        items: (o.items || []).map((it) => ({ ...it, itemId: it.itemId || '' })),
      }))
    );
  }, [data]);

  const guardarPresupuesto = async () => {
    if (!id) return;
    const valor = parsePrecio(presupuestoForm);
    try {
      await actualizarPresupuestoMutation.mutateAsync({ id, presupuesto: valor });
      utils.comparativos.obtener.invalidate({ id });
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

  // Agrupa por proveedor SOLO los items marcados (it.seleccionado) que
  // todavia no estan en una orden activa, que son los que van a entrar en
  // la proxima Orden de Compra que se genere (ver handleExportar). No se
  // muestra en pantalla, solo se usa para armar los registros que se
  // guardan al generar.
  interface ResumenProveedor { proveedor: string; proveedorInfo: ProveedorInfo; cantidadItems: number; total: number; items: OrdenCompraItem[] }
  const resumenProveedores: ResumenProveedor[] = [];
  const indiceProveedores = new Map<string, number>();

  for (const h of hojas) {
    for (const it of h.items) {
      const tieneContenido = it.item.trim() || it.cantidad.trim() || it.precios.some((p) => p.trim());
      if (!tieneContenido) continue;
      if (it.seleccionado === null) continue;
      if (itemsBloqueados.has(it.id)) continue;
      const cantidad = parsePrecio(it.cantidad);
      const precio = parsePrecio(it.precios[it.seleccionado]);
      if (cantidad === null || precio === null) continue;
      const infoProveedor = h.proveedores[it.seleccionado] || proveedorVacioLocal(`Proveedor ${it.seleccionado + 1}`);
      const nombreProveedor = infoProveedor.nombre || `Proveedor ${it.seleccionado + 1}`;
      let i = indiceProveedores.get(nombreProveedor);
      if (i === undefined) {
        i = resumenProveedores.length;
        indiceProveedores.set(nombreProveedor, i);
        resumenProveedores.push({ proveedor: nombreProveedor, proveedorInfo: infoProveedor, cantidadItems: 0, total: 0, items: [] });
      }
      const subtotal = cantidad * precio;
      resumenProveedores[i].cantidadItems += 1;
      resumenProveedores[i].total += subtotal;
      resumenProveedores[i].items.push({ itemId: it.id, grupo: h.nombre, item: it.item || '-', cantidad, precioUnitario: precio, subtotal });
    }
  }
  const presupuestoNumero = parsePrecio(presupuestoForm);

  // Total Presupuestado = suma de las ordenes de compra generadas que siguen
  // activas (pendientes + ejecutadas; las anuladas no cuentan). Total
  // Ejecutado = solo las marcadas como ejecutada. El remanente se calcula
  // contra lo ya ejecutado (lo pendiente todavia no salio de la plata
  // disponible).
  const totalPresupuestado = ordenesCompra.filter((o) => o.estado !== 'anulada').reduce((acc, o) => acc + o.monto, 0);
  const totalEjecutado = ordenesCompra.filter((o) => o.estado === 'ejecutada').reduce((acc, o) => acc + o.monto, 0);
  const remanente = presupuestoNumero !== null ? presupuestoNumero - totalEjecutado : null;

  // Suma, por proveedor, el precio unitario por la cantidad de cada item
  // (items sin cantidad o sin precio cargado no aportan a ese total).
  const totalesPorProveedor = hojaActiva
    ? [0, 1, 2].map((idx) =>
        hojaActiva.items.reduce((acc, it) => {
          const cantidad = parsePrecio(it.cantidad);
          const precio = parsePrecio(it.precios[idx]);
          if (cantidad === null || precio === null) return acc;
          return acc + cantidad * precio;
        }, 0)
      )
    : [0, 0, 0];
  const totalMinimo = totalesPorProveedor.some((t) => t > 0) ? Math.min(...totalesPorProveedor.filter((t) => t > 0)) : null;

  const actualizarHojaActiva = (fn: (hoja: HojaLocal) => HojaLocal) => {
    setHojas((prev) => prev.map((h) => (h.id === hojaActivaId ? fn(h) : h)));
    setHuboCambios(true);
  };

  const actualizarProveedorCampo = (idx: number, campo: keyof ProveedorInfo, valor: string) => {
    actualizarHojaActiva((h) => {
      const proveedores = [...h.proveedores] as [ProveedorInfo, ProveedorInfo, ProveedorInfo];
      proveedores[idx] = { ...proveedores[idx], [campo]: valor };
      return { ...h, proveedores };
    });
  };

  const actualizarItemCampo = (itemId: string, valor: string) => {
    actualizarHojaActiva((h) => ({ ...h, items: h.items.map((it) => (it.id === itemId ? { ...it, item: valor } : it)) }));
  };

  const actualizarItemProveedor = (itemId: string, idx: number, valor: string) => {
    actualizarHojaActiva((h) => ({
      ...h,
      items: h.items.map((it) => {
        if (it.id !== itemId) return it;
        const itemProveedor = [...it.itemProveedor] as [string, string, string];
        itemProveedor[idx] = valor;
        return { ...it, itemProveedor };
      }),
    }));
  };

  const actualizarCantidad = (itemId: string, valor: string) => {
    actualizarHojaActiva((h) => ({ ...h, items: h.items.map((it) => (it.id === itemId ? { ...it, cantidad: valor } : it)) }));
  };

  const actualizarPrecio = (itemId: string, idx: number, valor: string) => {
    actualizarHojaActiva((h) => ({
      ...h,
      items: h.items.map((it) => {
        if (it.id !== itemId) return it;
        const precios = [...it.precios] as [string, string, string];
        precios[idx] = valor;
        return { ...it, precios };
      }),
    }));
  };

  const marcarSeleccion = (itemId: string, idx: number) => {
    actualizarHojaActiva((h) => ({
      ...h,
      items: h.items.map((it) => (it.id === itemId ? { ...it, seleccionado: it.seleccionado === idx ? null : idx } : it)),
    }));
  };

  const agregarFila = () => actualizarHojaActiva((h) => ({ ...h, items: [...h.items, itemVacio()] }));
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
      utils.comparativos.obtener.invalidate({ id });
    } finally {
      setExportando(false);
    }
  };

  const [exportandoComparativo, setExportandoComparativo] = useState(false);

  const handleExportarComparativo = async () => {
    if (!data?.exito) return;
    setExportandoComparativo(true);
    try {
      await exportarComparativoPdf({
        nombre: data.nombre,
        hojas: hojas.map((h) => ({
          nombre: h.nombre,
          proveedores: h.proveedores,
          items: h.items
            .filter((it) => it.item.trim() || it.cantidad.trim() || it.precios.some((p) => p.trim()))
            .map((it) => ({
              item: it.item,
              itemProveedor: it.itemProveedor,
              cantidad: parsePrecio(it.cantidad),
              precios: it.precios.map(parsePrecio),
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
        proveedores: h.proveedores,
        items: h.items
          .filter((it) => it.item.trim() || it.cantidad.trim() || it.precios.some((p) => p.trim()))
          .map((it) => ({
            id: it.id,
            item: it.item.trim(),
            itemProveedor: it.itemProveedor.map((v) => v.trim()) as [string, string, string],
            cantidad: parsePrecio(it.cantidad),
            precios: it.precios.map(parsePrecio) as [number | null, number | null, number | null],
            seleccionado: it.seleccionado,
          })),
      }));
      await guardarHojasMutation.mutateAsync({ id, hojas: hojasParaGuardar });

      // El nombre del comparativo (distinto del nombre de cada pestaña) se
      // guarda por separado solo si hace falta, no aca.
      utils.comparativos.obtener.invalidate({ id });
      utils.comparativos.listado.invalidate();
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
      utils.comparativos.obtener.invalidate({ id });
      utils.comparativos.listado.invalidate();
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
          <ArrowLeft className="w-4 h-4" /> Volver a Comparativos
        </button>
        <div className="bg-white/[0.03] border border-white/5 rounded-xl p-8 text-center text-white/60">Comparativo no encontrado.</div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-6">
      <Link to="/comparativos" className="mb-2 flex items-center gap-2 text-white/50 hover:text-white text-sm transition-colors w-fit">
        <ArrowLeft className="w-4 h-4" /> Volver a Comparativos
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
              <div className="text-center py-8 text-white/30 text-sm">Todavia no hay items en esta pestaña.</div>
            ) : (
              [0, 1, 2].map((idx) => {
                const esMinimoTotal = totalMinimo !== null && totalesPorProveedor[idx] === totalMinimo;
                return (
                  <div key={idx} className="mb-5 bg-white/[0.02] border border-white/10 rounded-xl p-4">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span className="text-xs font-bold text-cbvp-red shrink-0">PROVEEDOR {idx + 1}:</span>
                      <input
                        type="text"
                        value={hojaActiva.proveedores[idx].nombre}
                        onChange={(e) => actualizarProveedorCampo(idx, 'nombre', e.target.value)}
                        placeholder={`Proveedor ${idx + 1}`}
                        className="flex-1 min-w-[160px] bg-transparent border border-white/10 rounded-lg px-2 py-1 text-white font-semibold focus:border-cbvp-red/50 focus:outline-none focus:bg-white/5"
                      />
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
                      <input
                        type="text"
                        value={hojaActiva.proveedores[idx].ruc}
                        onChange={(e) => actualizarProveedorCampo(idx, 'ruc', e.target.value)}
                        placeholder="RUC"
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-white/80 focus:border-cbvp-red/50 focus:outline-none"
                      />
                      <input
                        type="text"
                        value={hojaActiva.proveedores[idx].telefono}
                        onChange={(e) => actualizarProveedorCampo(idx, 'telefono', e.target.value)}
                        placeholder="Telefono"
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-white/80 focus:border-cbvp-red/50 focus:outline-none"
                      />
                      <input
                        type="text"
                        value={hojaActiva.proveedores[idx].direccion}
                        onChange={(e) => actualizarProveedorCampo(idx, 'direccion', e.target.value)}
                        placeholder="Direccion"
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-white/80 focus:border-cbvp-red/50 focus:outline-none"
                      />
                      <input
                        type="text"
                        value={hojaActiva.proveedores[idx].contacto}
                        onChange={(e) => actualizarProveedorCampo(idx, 'contacto', e.target.value)}
                        placeholder="Contacto"
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-white/80 focus:border-cbvp-red/50 focus:outline-none"
                      />
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-xs sm:text-sm border-collapse">
                        <thead>
                          <tr className="bg-white/5 border-b border-white/10">
                            <th className="text-left px-2 py-2 font-medium text-white/50 w-10">Ord</th>
                            <th className="text-left px-2 py-2 font-medium text-white/50 w-[30%]">Item</th>
                            <th className="text-left px-2 py-2 font-medium text-white/50">Cantidad</th>
                            <th className="text-left px-2 py-2 font-medium text-white/50 w-[30%]">Codigo/Desc. Proveedor</th>
                            <th className="text-left px-2 py-2 font-medium text-white/50">Precio Unitario</th>
                            <th className="text-right px-2 py-2 font-medium text-white/50">Costo Total</th>
                            <th className="w-8"></th>
                            <th className="w-8"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {hojaActiva.items.map((it, i) => {
                            const valoresNumericos = it.precios.map(parsePrecio);
                            const minimo = valoresNumericos.some((v) => v !== null) ? Math.min(...valoresNumericos.filter((v): v is number => v !== null)) : null;
                            const esMinimo = minimo !== null && valoresNumericos[idx] === minimo;
                            const esSeleccionado = it.seleccionado === idx;
                            const numeroOrdenBloqueo = itemsBloqueados.get(it.id);
                            const bloqueado = numeroOrdenBloqueo !== undefined;
                            const puedeMarcar = it.precios[idx].trim() !== '' && !bloqueado;
                            const cantidadNum = parsePrecio(it.cantidad);
                            const precioNum = valoresNumericos[idx];
                            const costoTotal = cantidadNum !== null && precioNum !== null ? cantidadNum * precioNum : null;
                            return (
                              <tr key={it.id} className="border-b border-white/5 align-top">
                                <td className="px-2 py-1.5 text-white/40">{i + 1}</td>
                                <td className="px-2 py-1.5">
                                  <textarea
                                    ref={(el) => { if (el) { el.style.height = 'auto'; el.style.height = `${el.scrollHeight}px`; } }}
                                    value={it.item}
                                    onChange={(e) => {
                                      actualizarItemCampo(it.id, e.target.value);
                                      e.target.style.height = 'auto';
                                      e.target.style.height = `${e.target.scrollHeight}px`;
                                    }}
                                    rows={1}
                                    placeholder="Nombre del item"
                                    className="w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-white focus:border-cbvp-red/50 focus:outline-none resize-none overflow-hidden block leading-snug"
                                  />
                                </td>
                                <td className="px-2 py-1.5">
                                  <input type="text" inputMode="decimal" value={it.cantidad} onChange={(e) => actualizarCantidad(it.id, e.target.value)} placeholder="0" className="w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-white text-right focus:border-cbvp-red/50 focus:outline-none" />
                                </td>
                                <td className="px-2 py-1.5">
                                  <textarea
                                    ref={(el) => { if (el) { el.style.height = 'auto'; el.style.height = `${el.scrollHeight}px`; } }}
                                    value={it.itemProveedor[idx]}
                                    onChange={(e) => {
                                      actualizarItemProveedor(it.id, idx, e.target.value);
                                      e.target.style.height = 'auto';
                                      e.target.style.height = `${e.target.scrollHeight}px`;
                                    }}
                                    rows={1}
                                    placeholder="Codigo/descripcion"
                                    className="w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-white focus:border-cbvp-red/50 focus:outline-none resize-none overflow-hidden block leading-snug"
                                  />
                                </td>
                                <td className="px-2 py-1.5">
                                  <input
                                    type="text"
                                    inputMode="decimal"
                                    value={it.precios[idx]}
                                    onChange={(e) => actualizarPrecio(it.id, idx, e.target.value)}
                                    placeholder="0"
                                    className={`w-full border rounded px-2 py-1.5 text-right focus:outline-none ${
                                      esMinimo ? 'bg-cbvp-green/10 border-cbvp-green/30 text-cbvp-green font-semibold' : 'bg-white/5 border-white/10 text-white focus:border-cbvp-red/50'
                                    }`}
                                  />
                                </td>
                                <td className={`px-2 py-1.5 text-right ${esMinimo ? 'text-cbvp-green font-semibold' : 'text-white/80'}`}>
                                  {costoTotal === null ? '-' : formatearNumero(costoTotal)}
                                </td>
                                <td className="px-2 py-1.5">
                                  <button
                                    type="button"
                                    onClick={() => marcarSeleccion(it.id, idx)}
                                    disabled={!puedeMarcar}
                                    title={
                                      bloqueado
                                        ? `Este item ya esta en la Orden de Compra N° ${numeroOrdenBloqueo}. Anula esa orden para poder cambiarlo.`
                                        : esSeleccionado
                                        ? 'Quitar de la orden de compra'
                                        : 'Marcar para la orden de compra'
                                    }
                                    className={`shrink-0 w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${
                                      esSeleccionado
                                        ? bloqueado
                                          ? 'bg-white/20 border-white/20'
                                          : 'bg-cbvp-red border-cbvp-red'
                                        : 'border-white/20 hover:border-white/40 disabled:opacity-20 disabled:cursor-not-allowed disabled:hover:border-white/20'
                                    }`}
                                  >
                                    {esSeleccionado && <Check className="w-2.5 h-2.5 text-white" />}
                                  </button>
                                </td>
                                <td className="px-2 py-1.5">
                                  <button onClick={() => quitarFila(it.id)} className="p-1.5 rounded-lg hover:bg-cbvp-red/20 text-white/40 hover:text-cbvp-red transition-colors" title="Quitar item">
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot>
                          <tr className="bg-white/5 font-semibold border-t border-white/10">
                            <td colSpan={5} className="px-2 py-2 text-right text-white/70">TOTAL:</td>
                            <td className={`px-2 py-2 text-right ${esMinimoTotal ? 'text-cbvp-green' : 'text-white'}`}>
                              {formatearNumero(totalesPorProveedor[idx])}
                            </td>
                            <td></td>
                            <td></td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                );
              })
            )}

            <button onClick={agregarFila} className="mt-1 px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white/60 rounded-lg text-xs flex items-center gap-2 transition-colors">
              <Plus className="w-3.5 h-3.5" /> Agregar item
            </button>
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
          <div className="overflow-x-auto mb-6">
            <table className="w-full text-xs sm:text-sm border-collapse">
              <thead>
                <tr className="bg-white/5 border-b border-white/10">
                  <th className="text-left px-2 py-2 font-medium text-white/50">N°</th>
                  <th className="text-left px-2 py-2 font-medium text-white/50">Fecha</th>
                  <th className="text-left px-2 py-2 font-medium text-white/50">Proveedor</th>
                  <th className="text-right px-2 py-2 font-medium text-white/50">Monto</th>
                  <th className="text-left px-2 py-2 font-medium text-white/50">Estado</th>
                  <th className="w-8"></th>
                  <th className="w-8"></th>
                  <th className="w-8"></th>
                </tr>
              </thead>
              <tbody>
                {ordenesCompra.map((o) => (
                  <tr key={o.id} className={`border-b border-white/5 ${o.estado === 'anulada' ? 'opacity-50' : ''}`}>
                    <td className="px-2 py-1.5 text-white/60">{o.numero}</td>
                    <td className="px-2 py-1.5 text-white/60">{new Date(o.fechaGeneracion).toLocaleDateString('es-PY')}</td>
                    <td className={`px-2 py-1.5 text-white/80 ${o.estado === 'anulada' ? 'line-through' : ''}`}>{o.proveedor}</td>
                    <td className={`px-2 py-1.5 text-right text-white ${o.estado === 'anulada' ? 'line-through' : ''}`}>{formatearNumero(o.monto)}</td>
                    <td className="px-2 py-1.5">
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
                    </td>
                    <td className="px-2 py-1.5">
                      <button
                        onClick={() => descargarOrden(o)}
                        disabled={descargandoOrdenId === o.id}
                        className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition-colors disabled:opacity-40"
                        title="Descargar orden"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                    </td>
                    <td className="px-2 py-1.5">
                      {o.estado !== 'anulada' && (
                        <button
                          onClick={() => anularOrden(o)}
                          className="p-1.5 rounded-lg hover:bg-cbvp-yellow/20 text-white/40 hover:text-cbvp-yellow transition-colors"
                          title="Anular orden"
                        >
                          <Ban className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                    <td className="px-2 py-1.5">
                      <button onClick={() => eliminarOrden(o.id)} className="p-1.5 rounded-lg hover:bg-cbvp-red/20 text-white/40 hover:text-cbvp-red transition-colors" title="Eliminar orden">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
