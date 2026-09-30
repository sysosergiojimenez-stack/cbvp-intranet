import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { trpc } from '@/providers/trpc';
import { ArrowLeft, FileSpreadsheet, Plus, Trash2, Save, X, Pencil, Check } from 'lucide-react';

interface ItemLocal {
  id: string;
  item: string;
  cantidad: string;
  precios: [string, string, string];
}

interface HojaLocal {
  id: string;
  nombre: string;
  proveedores: [string, string, string];
  items: ItemLocal[];
}

interface ItemServidor {
  id: string;
  item: string;
  cantidad: number | null;
  precios: (number | null)[];
}

interface HojaServidor {
  id: string;
  nombre: string;
  proveedores: string[];
  items: ItemServidor[];
}

function generarIdLocal(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function itemVacio(): ItemLocal {
  return { id: generarIdLocal(), item: '', cantidad: '', precios: ['', '', ''] };
}

function hojaVaciaLocal(nombre: string): HojaLocal {
  return { id: generarIdLocal(), nombre, proveedores: ['Proveedor 1', 'Proveedor 2', 'Proveedor 3'], items: [] };
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

  const [hojas, setHojas] = useState<HojaLocal[]>([]);
  const [hojaActivaId, setHojaActivaId] = useState<string>('');
  const [huboCambios, setHuboCambios] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  const [mostrarNuevaHoja, setMostrarNuevaHoja] = useState(false);
  const [nombreNuevaHoja, setNombreNuevaHoja] = useState('');

  const [editandoNombreHoja, setEditandoNombreHoja] = useState(false);
  const [nombreHojaForm, setNombreHojaForm] = useState('');

  useEffect(() => {
    if (!data?.exito) return;
    const hojasServidor = data.hojas as HojaServidor[];
    const hojasLocales: HojaLocal[] = hojasServidor.map((h) => ({
      id: h.id,
      nombre: h.nombre,
      proveedores: [h.proveedores?.[0] || 'Proveedor 1', h.proveedores?.[1] || 'Proveedor 2', h.proveedores?.[2] || 'Proveedor 3'],
      items: (h.items || []).map((it) => ({
        id: it.id,
        item: it.item,
        cantidad: it.cantidad === null || it.cantidad === undefined ? '' : String(it.cantidad),
        precios: [
          it.precios?.[0] === null || it.precios?.[0] === undefined ? '' : String(it.precios[0]),
          it.precios?.[1] === null || it.precios?.[1] === undefined ? '' : String(it.precios[1]),
          it.precios?.[2] === null || it.precios?.[2] === undefined ? '' : String(it.precios[2]),
        ],
      })),
    }));
    setHojas(hojasLocales);
    if (hojasLocales.length > 0) setHojaActivaId(hojasLocales[0].id);
    setHuboCambios(false);
  }, [data]);

  const hojaActiva = hojas.find((h) => h.id === hojaActivaId);

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

  const actualizarProveedor = (idx: number, valor: string) => {
    actualizarHojaActiva((h) => {
      const proveedores = [...h.proveedores] as [string, string, string];
      proveedores[idx] = valor;
      return { ...h, proveedores };
    });
  };

  const actualizarItemCampo = (itemId: string, valor: string) => {
    actualizarHojaActiva((h) => ({ ...h, items: h.items.map((it) => (it.id === itemId ? { ...it, item: valor } : it)) }));
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
          .map((it) => ({ id: it.id, item: it.item.trim(), cantidad: parsePrecio(it.cantidad), precios: it.precios.map(parsePrecio) as [number | null, number | null, number | null] })),
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

            <div className="overflow-x-auto">
              <table className="w-full text-xs sm:text-sm border-collapse">
                <thead>
                  <tr className="bg-white/5 border-b border-white/10">
                    <th className="text-left px-2 py-2 font-medium text-white/50 min-w-[200px]">Item</th>
                    <th className="text-left px-2 py-2 font-medium text-white/50 min-w-[36px]">Cantidad</th>
                    {[0, 1, 2].map((idx) => (
                      <th key={idx} className="text-left px-2 py-2 font-medium text-white/50 min-w-[56px]">
                        <input
                          type="text"
                          value={hojaActiva.proveedores[idx]}
                          onChange={(e) => actualizarProveedor(idx, e.target.value)}
                          className="w-full bg-transparent border border-white/10 rounded-lg px-2 py-1 text-white/80 font-medium focus:border-cbvp-red/50 focus:outline-none focus:bg-white/5"
                        />
                      </th>
                    ))}
                    <th className="w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {hojaActiva.items.map((it) => {
                    const valoresNumericos = it.precios.map(parsePrecio);
                    const minimo = valoresNumericos.some((v) => v !== null) ? Math.min(...valoresNumericos.filter((v): v is number => v !== null)) : null;
                    return (
                      <tr key={it.id} className="border-b border-white/5">
                        <td className="px-2 py-1.5">
                          <input type="text" value={it.item} onChange={(e) => actualizarItemCampo(it.id, e.target.value)} placeholder="Nombre del item" className="w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-white focus:border-cbvp-red/50 focus:outline-none" />
                        </td>
                        <td className="px-2 py-1.5">
                          <input type="text" inputMode="decimal" value={it.cantidad} onChange={(e) => actualizarCantidad(it.id, e.target.value)} placeholder="0" className="w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-white text-right focus:border-cbvp-red/50 focus:outline-none" />
                        </td>
                        {[0, 1, 2].map((idx) => {
                          const esMinimo = minimo !== null && valoresNumericos[idx] === minimo;
                          return (
                            <td key={idx} className="px-2 py-1.5">
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
                          );
                        })}
                        <td className="px-2 py-1.5">
                          <button onClick={() => quitarFila(it.id)} className="p-1.5 rounded-lg hover:bg-cbvp-red/20 text-white/40 hover:text-cbvp-red transition-colors" title="Quitar item">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                {hojaActiva.items.length > 0 && (
                  <tfoot>
                    <tr className="bg-white/5 font-semibold border-t border-white/10">
                      <td className="px-2 py-2 text-right text-white/70">TOTAL:</td>
                      <td></td>
                      {[0, 1, 2].map((idx) => {
                        const esMinimo = totalMinimo !== null && totalesPorProveedor[idx] === totalMinimo;
                        return (
                          <td key={idx} className={`px-2 py-2 text-right ${esMinimo ? 'text-cbvp-green' : 'text-white'}`}>
                            {formatearNumero(totalesPorProveedor[idx])}
                          </td>
                        );
                      })}
                      <td></td>
                    </tr>
                  </tfoot>
                )}
              </table>
              {hojaActiva.items.length === 0 && (
                <div className="text-center py-8 text-white/30 text-sm">Todavia no hay items en esta pestaña.</div>
              )}
            </div>

            <button onClick={agregarFila} className="mt-3 px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white/60 rounded-lg text-xs flex items-center gap-2 transition-colors">
              <Plus className="w-3.5 h-3.5" /> Agregar item
            </button>
          </>
        )}
      </div>
    </div>
  );
}
