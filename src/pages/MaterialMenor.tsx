import { useState, Fragment } from 'react';
import { trpc } from '@/providers/trpc';
import { useAuth } from '@/context/AuthContext';
import { compressImage } from '@/lib/imageCompress';
import { CATEGORIAS_MATERIAL_MENOR, type CategoriaMaterialMenor } from '@contracts/materialMenor';
import { Package, Plus, Save, Trash2, RotateCcw, ExternalLink, Camera, Image as ImageIcon, X } from 'lucide-react';

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

interface MaterialForm {
  fecha: string;
  item: string;
  marca: string;
  modelo: string;
  cantidad: string;
  precioUnitario: string;
  especificaciones: string;
  serialCodigo: string;
  ubicacion: string;
  observaciones: string;
}

const materialVacio: MaterialForm = {
  fecha: '', item: '', marca: '', modelo: '', cantidad: '', precioUnitario: '',
  especificaciones: '', serialCodigo: '', ubicacion: '', observaciones: '',
};

const CAMPOS: { key: keyof MaterialForm; label: string }[] = [
  { key: 'fecha', label: 'Fecha' },
  { key: 'item', label: 'Item' },
  { key: 'marca', label: 'Marca' },
  { key: 'modelo', label: 'Modelo' },
  { key: 'cantidad', label: 'Cantidad' },
  { key: 'precioUnitario', label: 'Precio Unitario' },
  { key: 'serialCodigo', label: 'Serial / Codigo de Identificacion' },
  { key: 'ubicacion', label: 'Ubicacion' },
  { key: 'especificaciones', label: 'Especificaciones' },
  { key: 'observaciones', label: 'Observaciones' },
];

function ImagenPicker({ inputId, preview, onFile }: { inputId: string; preview: string; onFile: (file: File) => void }) {
  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const comprimido = await compressImage(file);
    onFile(comprimido);
  };

  return (
    <div>
      <label className="text-xs text-white/40 mb-1 block">Imagen</label>
      <div className="flex items-center gap-3">
        {preview && <img src={preview} alt="preview" className="w-14 h-14 object-cover rounded-lg border border-white/10" />}
        <div className="flex gap-2">
          <button type="button" onClick={() => document.getElementById(`${inputId}-camara`)?.click()} className="px-3 py-2 bg-cbvp-red/10 hover:bg-cbvp-red/20 text-cbvp-red rounded-lg text-xs flex items-center gap-2 transition-colors">
            <Camera className="w-3.5 h-3.5" /> Tomar Foto
          </button>
          <button type="button" onClick={() => document.getElementById(`${inputId}-galeria`)?.click()} className="px-3 py-2 bg-white/5 hover:bg-white/10 text-white/60 rounded-lg text-xs flex items-center gap-2 transition-colors">
            <ImageIcon className="w-3.5 h-3.5" /> Galeria
          </button>
        </div>
      </div>
      <input id={`${inputId}-camara`} type="file" accept="image/*" capture="environment" onChange={handleChange} className="hidden" />
      <input id={`${inputId}-galeria`} type="file" accept="image/*" onChange={handleChange} className="hidden" />
    </div>
  );
}

function FormularioMaterial({
  valor, onChange, inputId, imagenPreview, onImagen,
}: {
  valor: MaterialForm;
  onChange: (campo: keyof MaterialForm, v: string) => void;
  inputId: string;
  imagenPreview: string;
  onImagen: (file: File) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {CAMPOS.map(({ key, label }) => (
          <div key={key} className={key === 'especificaciones' || key === 'observaciones' ? 'col-span-2 md:col-span-4' : ''}>
            <label className="text-xs text-white/40 mb-1 block">{label}</label>
            <input
              type="text"
              value={valor[key]}
              onChange={(e) => onChange(key, e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-cbvp-red/50 focus:outline-none"
            />
          </div>
        ))}
      </div>
      <ImagenPicker inputId={inputId} preview={imagenPreview} onFile={onImagen} />
    </div>
  );
}

export default function MaterialMenor() {
  const { usuario } = useAuth();
  const utils = trpc.useUtils();
  const { data: listadoData, isLoading } = trpc.materialMenor.listado.useQuery();
  const crearMutation = trpc.materialMenor.crear.useMutation();
  const editarMutation = trpc.materialMenor.editar.useMutation();
  const eliminarMutation = trpc.materialMenor.eliminar.useMutation();

  const [tabActiva, setTabActiva] = useState<CategoriaMaterialMenor>(CATEGORIAS_MATERIAL_MENOR[0]);

  const [creando, setCreando] = useState(false);
  const [nuevoItem, setNuevoItem] = useState<MaterialForm>({ ...materialVacio });
  const [nuevaImagen, setNuevaImagen] = useState<File | null>(null);
  const [nuevaImagenPreview, setNuevaImagenPreview] = useState('');

  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<MaterialForm>({ ...materialVacio });
  const [editImagen, setEditImagen] = useState<File | null>(null);
  const [editImagenPreview, setEditImagenPreview] = useState('');

  const [error, setError] = useState('');

  const itemsTab = (listadoData?.items || []).filter((it) => it.categoria === tabActiva);

  const cambiarTab = (cat: CategoriaMaterialMenor) => {
    setTabActiva(cat);
    setCreando(false);
    setEditandoId(null);
  };

  const iniciarEdicion = (it: MaterialForm & { id: string; imagen?: string }) => {
    setEditandoId(it.id);
    setEditForm({
      fecha: it.fecha, item: it.item, marca: it.marca, modelo: it.modelo, cantidad: it.cantidad,
      precioUnitario: it.precioUnitario, especificaciones: it.especificaciones, serialCodigo: it.serialCodigo,
      ubicacion: it.ubicacion, observaciones: it.observaciones,
    });
    setEditImagen(null);
    setEditImagenPreview(it.imagen || '');
  };

  const confirmarCrear = async () => {
    if (!nuevoItem.item.trim()) {
      setError('El campo Item es obligatorio.');
      return;
    }
    setError('');
    try {
      let imagenBase64: string | undefined;
      let imagenMimeType: string | undefined;
      if (nuevaImagen) {
        const buffer = await nuevaImagen.arrayBuffer();
        imagenBase64 = arrayBufferToBase64(buffer);
        imagenMimeType = nuevaImagen.type || 'image/jpeg';
      }
      const resp = await crearMutation.mutateAsync({
        categoria: tabActiva,
        usuario: usuario?.nombreCompleto || '',
        ...nuevoItem,
        imagenBase64,
        imagenMimeType,
      });
      if (!resp.exito) throw new Error('Error al crear');
      setCreando(false);
      setNuevoItem({ ...materialVacio });
      setNuevaImagen(null);
      setNuevaImagenPreview('');
      utils.materialMenor.listado.invalidate();
    } catch (err: unknown) {
      setError('Error: ' + (err instanceof Error ? err.message : 'desconocido'));
    }
  };

  const guardarEdicion = async () => {
    if (editandoId === null) return;
    try {
      let imagenBase64: string | undefined;
      let imagenMimeType: string | undefined;
      if (editImagen) {
        const buffer = await editImagen.arrayBuffer();
        imagenBase64 = arrayBufferToBase64(buffer);
        imagenMimeType = editImagen.type || 'image/jpeg';
      }
      const resp = await editarMutation.mutateAsync({
        id: editandoId,
        categoria: tabActiva,
        usuario: usuario?.nombreCompleto || '',
        ...editForm,
        imagenBase64,
        imagenMimeType,
      });
      if (!resp.exito) throw new Error('Error al guardar');
      setEditandoId(null);
      utils.materialMenor.listado.invalidate();
    } catch (err: unknown) {
      alert('Error: ' + (err instanceof Error ? err.message : 'desconocido'));
    }
  };

  const eliminarItem = async (id: string) => {
    if (!confirm('Eliminar este item?')) return;
    try {
      const resp = await eliminarMutation.mutateAsync({ id });
      if (!resp.exito) throw new Error('Error al eliminar');
      utils.materialMenor.listado.invalidate();
    } catch (err: unknown) {
      alert('Error: ' + (err instanceof Error ? err.message : 'desconocido'));
    }
  };

  return (
    <div className="animate-fade-in space-y-4">
      <div className="flex flex-wrap gap-1 bg-white/[0.03] border border-white/10 rounded-2xl p-2">
        {CATEGORIAS_MATERIAL_MENOR.map((cat) => (
          <button
            key={cat}
            onClick={() => cambiarTab(cat)}
            className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${tabActiva === cat ? 'bg-cbvp-red text-white' : 'text-white/60 hover:bg-white/5 hover:text-white'}`}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider flex items-center gap-2">
            <Package className="w-4 h-4 text-cbvp-red" /> {tabActiva}
          </h2>
          {!creando && (
            <button onClick={() => setCreando(true)} className="px-3 py-2 bg-cbvp-blue/10 hover:bg-cbvp-blue/20 text-cbvp-blue rounded-lg text-xs flex items-center gap-2 transition-colors">
              <Plus className="w-3.5 h-3.5" /> Agregar Item
            </button>
          )}
        </div>

        {creando && (
          <div className="border border-white/10 rounded-xl p-4 mb-4 bg-white/[0.02] space-y-4">
            <FormularioMaterial
              valor={nuevoItem}
              onChange={(campo, v) => setNuevoItem({ ...nuevoItem, [campo]: v })}
              inputId="material-nuevo"
              imagenPreview={nuevaImagenPreview}
              onImagen={(file) => { setNuevaImagen(file); setNuevaImagenPreview(URL.createObjectURL(file)); }}
            />
            {error && <div className="text-sm text-cbvp-red-light">{error}</div>}
            <div className="flex gap-3">
              <button onClick={() => { setCreando(false); setNuevoItem({ ...materialVacio }); setNuevaImagen(null); setNuevaImagenPreview(''); setError(''); }} className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 text-white/60 rounded-lg transition-colors text-sm flex items-center justify-center gap-2"><RotateCcw className="w-4 h-4" /> Cancelar</button>
              <button onClick={confirmarCrear} disabled={crearMutation.isPending} className="flex-1 py-2.5 bg-cbvp-green hover:bg-cbvp-green/80 disabled:opacity-50 text-white font-semibold rounded-lg transition-all text-sm flex items-center justify-center gap-2">
                <Save className="w-4 h-4" /> Guardar Item
              </button>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="p-4 text-sm text-white/40">Cargando...</div>
        ) : itemsTab.length === 0 ? (
          <div className="p-4 text-sm text-white/40">No hay items registrados en {tabActiva} todavia.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm block sm:table">
              <thead className="hidden sm:table-header-group">
                <tr className="bg-white/5 border-b border-white/10">
                  <th className="text-left px-3 py-2 font-medium text-white/50">Item</th>
                  <th className="text-left px-3 py-2 font-medium text-white/50">Marca / Modelo</th>
                  <th className="text-left px-3 py-2 font-medium text-white/50">Cantidad</th>
                  <th className="text-left px-3 py-2 font-medium text-white/50">Ubicacion</th>
                  <th className="text-left px-3 py-2 font-medium text-white/50">Serial</th>
                  <th className="text-left px-3 py-2 font-medium text-white/50">Acciones</th>
                </tr>
              </thead>
              <tbody className="block sm:table-row-group">
                {itemsTab.map((it) => (
                  <Fragment key={it.id}>
                    <tr onClick={() => iniciarEdicion(it as MaterialForm & { id: string; imagen?: string })} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors cursor-pointer block sm:table-row mb-2 sm:mb-0 bg-white/[0.02] sm:bg-transparent rounded-lg sm:rounded-none p-2 sm:p-0">
                      <td className="px-3 py-2 text-white font-medium block sm:table-cell">{it.item || '-'}</td>
                      <td className="px-3 py-2 text-white/70 block sm:table-cell"><span className="text-white/30 sm:hidden">Marca/Modelo: </span>{[it.marca, it.modelo].filter(Boolean).join(' ') || '-'}</td>
                      <td className="px-3 py-2 text-white/70 block sm:table-cell"><span className="text-white/30 sm:hidden">Cantidad: </span>{it.cantidad || '-'}</td>
                      <td className="px-3 py-2 text-white/70 block sm:table-cell"><span className="text-white/30 sm:hidden">Ubicacion: </span>{it.ubicacion || '-'}</td>
                      <td className="px-3 py-2 text-white/70 block sm:table-cell"><span className="text-white/30 sm:hidden">Serial: </span>{it.serialCodigo || '-'}</td>
                      <td className="px-3 py-2 block sm:table-cell" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-2 pt-1.5 sm:pt-0 mt-1 sm:mt-0 border-t border-white/5 sm:border-0">
                          <button onClick={() => eliminarItem(it.id)} className="p-2.5 sm:p-1.5 rounded-lg hover:bg-cbvp-red/20 text-white/40 hover:text-cbvp-red transition-colors" title="Eliminar"><Trash2 className="w-3.5 h-3.5" /></button>
                          {it.imagen && (
                            <a href={it.imagen} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="p-2.5 sm:p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-cbvp-blue transition-colors" title="Ver imagen"><ExternalLink className="w-3.5 h-3.5" /></a>
                          )}
                        </div>
                      </td>
                    </tr>
                    {editandoId === it.id && (
                      <tr className="border-b border-white/5 bg-white/[0.02]">
                        <td colSpan={6} className="px-3 py-4">
                          <FormularioMaterial
                            valor={editForm}
                            onChange={(campo, v) => setEditForm({ ...editForm, [campo]: v })}
                            inputId={`material-editar-${it.id}`}
                            imagenPreview={editImagenPreview}
                            onImagen={(file) => { setEditImagen(file); setEditImagenPreview(URL.createObjectURL(file)); }}
                          />
                          <div className="flex gap-2 mt-3">
                            <button onClick={guardarEdicion} className="px-4 py-2 bg-cbvp-green hover:bg-cbvp-green/80 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"><Save className="w-4 h-4" /> Guardar</button>
                            <button onClick={() => setEditandoId(null)} className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white/60 text-sm rounded-lg transition-colors flex items-center gap-2"><X className="w-4 h-4" /> Cancelar</button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
