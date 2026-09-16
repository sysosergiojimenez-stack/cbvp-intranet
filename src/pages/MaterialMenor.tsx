import { useState, Fragment } from 'react';
import { trpc } from '@/providers/trpc';
import { useAuth } from '@/context/AuthContext';
import { compressImage } from '@/lib/imageCompress';
import { CATEGORIAS_MATERIAL_MENOR, type CategoriaMaterialMenor } from '@contracts/materialMenor';
import { Package, Plus, Save, Trash2, RotateCcw, ExternalLink, Camera, Image as ImageIcon, X, Boxes, CornerDownRight, FileSpreadsheet, FileText } from 'lucide-react';
import { exportarInventarioCsv, type FilaInventarioExport } from '@/lib/exportarMaterialMenorCsv';
import { exportarInventarioPdf } from '@/lib/exportarMaterialMenorPdf';
import ImagenLightbox from '@/components/ImagenLightbox';

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function hoyFormateada(): string {
  const hoy = new Date();
  return `${String(hoy.getDate()).padStart(2, '0')}/${String(hoy.getMonth() + 1).padStart(2, '0')}/${hoy.getFullYear()}`;
}

function valoresUnicos(items: { item: string; marca: string; modelo: string }[], campo: 'item' | 'marca' | 'modelo'): string[] {
  return Array.from(new Set(items.map((i) => i[campo]).filter(Boolean))).sort((a, b) => a.localeCompare(b));
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
  esKit: boolean;
  kitPadreId: string;
}

const materialVacio: MaterialForm = {
  fecha: '', item: '', marca: '', modelo: '', cantidad: '', precioUnitario: '',
  especificaciones: '', serialCodigo: '', ubicacion: '', observaciones: '',
  esKit: false, kitPadreId: '',
};

type CampoTexto = Exclude<keyof MaterialForm, 'esKit' | 'kitPadreId'>;

const CAMPOS: { key: CampoTexto; label: string }[] = [
  { key: 'fecha', label: 'Fecha' },
  { key: 'item', label: 'Item' },
  { key: 'marca', label: 'Marca' },
  { key: 'modelo', label: 'Modelo' },
  { key: 'cantidad', label: 'Cantidad' },
  { key: 'precioUnitario', label: 'Precio Unitario' },
  { key: 'serialCodigo', label: 'Serial / Codigo de Identificacion' },
  { key: 'especificaciones', label: 'Especificaciones' },
  { key: 'observaciones', label: 'Observaciones' },
];

interface OpcionUbicacion { value: string; label: string }
interface OpcionKit { id: string; nombre: string; ubicacion: string }

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

const CAMPOS_CON_SUGERENCIAS = new Set<keyof MaterialForm>(['item', 'marca', 'modelo']);

function FormularioMaterial({
  valor, onChange, onChangeCampos, inputId, imagenPreview, onImagen, sugerencias, opcionesUbicacion, opcionesKit,
}: {
  valor: MaterialForm;
  onChange: (campo: keyof MaterialForm, v: string) => void;
  onChangeCampos: (cambios: Partial<MaterialForm>) => void;
  inputId: string;
  imagenPreview: string;
  onImagen: (file: File) => void;
  sugerencias: { item: string[]; marca: string[]; modelo: string[] };
  opcionesUbicacion: OpcionUbicacion[];
  opcionesKit: OpcionKit[];
}) {
  // Un solo select de Ubicacion: los sitios se listan como siempre, y los
  // kits que hay dentro de cada sitio aparecen como sub-opciones anidadas
  // debajo. Elegir un kit setea kitPadreId (y hereda su sitio); elegir un
  // sitio suelto limpia kitPadreId.
  const valorSelectUbicacion = valor.kitPadreId ? `kit:${valor.kitPadreId}` : valor.ubicacion ? `sitio:${valor.ubicacion}` : '';

  const cambiarUbicacionSelect = (v: string) => {
    if (!v) {
      onChangeCampos({ ubicacion: '', kitPadreId: '' });
    } else if (v.startsWith('kit:')) {
      const kitId = v.slice(4);
      const kit = opcionesKit.find((k) => k.id === kitId);
      onChangeCampos({ kitPadreId: kitId, ubicacion: kit?.ubicacion ?? '', esKit: false });
    } else {
      onChangeCampos({ ubicacion: v.slice(6), kitPadreId: '' });
    }
  };

  const cambiarEsKit = (esKit: boolean) => {
    onChangeCampos(esKit ? { esKit: true, kitPadreId: '' } : { esKit: false });
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="col-span-2">
          <label className="text-xs text-white/40 mb-1 block">Ubicacion</label>
          <select
            value={valorSelectUbicacion}
            onChange={(e) => cambiarUbicacionSelect(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-cbvp-red/50 focus:outline-none"
          >
            <option value="">-- Sin asignar --</option>
            {opcionesUbicacion.map((op) => (
              <Fragment key={op.value}>
                <option value={`sitio:${op.value}`}>{op.label}</option>
                {opcionesKit.filter((k) => k.ubicacion === op.value).map((k) => (
                  <option key={k.id} value={`kit:${k.id}`}>&nbsp;&nbsp;&nbsp;&nbsp;↳ {k.nombre} (kit)</option>
                ))}
              </Fragment>
            ))}
          </select>
          <label className="flex items-center gap-2 mt-2 text-xs text-white/50 cursor-pointer">
            <input
              type="checkbox"
              checked={valor.esKit}
              onChange={(e) => cambiarEsKit(e.target.checked)}
              className="w-3.5 h-3.5 rounded border-white/20 bg-white/5 text-cbvp-red focus:ring-cbvp-red/50"
            />
            Este item es un Kit (bolson/contenedor con materiales adentro)
          </label>
        </div>
        {CAMPOS.map(({ key, label }) => {
          const tieneSugerencias = CAMPOS_CON_SUGERENCIAS.has(key);
          const datalistId = `${inputId}-${key}-opciones`;
          return (
            <div key={key} className={key === 'especificaciones' || key === 'observaciones' ? 'col-span-2 md:col-span-4' : ''}>
              <label className="text-xs text-white/40 mb-1 block">{label}</label>
              <input
                type="text"
                value={valor[key]}
                onChange={(e) => onChange(key, e.target.value)}
                list={tieneSugerencias ? datalistId : undefined}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-cbvp-red/50 focus:outline-none"
              />
              {tieneSugerencias && (
                <datalist id={datalistId}>
                  {sugerencias[key as 'item' | 'marca' | 'modelo'].map((op) => <option key={op} value={op} />)}
                </datalist>
              )}
            </div>
          );
        })}
      </div>
      <ImagenPicker inputId={inputId} preview={imagenPreview} onFile={onImagen} />
    </div>
  );
}

export default function MaterialMenor() {
  const { usuario } = useAuth();
  const utils = trpc.useUtils();
  const { data: listadoData, isLoading } = trpc.materialMenor.listado.useQuery();
  const { data: movilesData } = trpc.moviles.listado.useQuery();
  const { data: sitiosData } = trpc.controlMovil.listadoSitios.useQuery();
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
  const [imagenAmpliada, setImagenAmpliada] = useState<string | null>(null);

  const todosLosItems = listadoData?.items || [];
  // Orden: primero por nombre de Item, y a igual nombre, por Serial/Codigo.
  const compararItemSerial = (a: { item?: string; serialCodigo?: string }, b: { item?: string; serialCodigo?: string }) => {
    const porItem = String(a.item || '').localeCompare(String(b.item || ''));
    return porItem !== 0 ? porItem : String(a.serialCodigo || '').localeCompare(String(b.serialCodigo || ''));
  };
  const itemsTabPlano = todosLosItems.filter((it) => it.categoria === tabActiva).sort(compararItemSerial);
  // Los kits se muestran seguidos de sus materiales (kitPadreId -> id del kit),
  // para que se vean agrupados en vez de mezclados con el resto de la tabla.
  const kitsEnTab = new Set(itemsTabPlano.filter((it) => it.esKit).map((it) => it.id));
  const itemsTab = itemsTabPlano
    .filter((it) => !it.kitPadreId || !kitsEnTab.has(it.kitPadreId))
    .flatMap((it) => (it.esKit ? [it, ...itemsTabPlano.filter((h) => h.kitPadreId === it.id)] : [it]));
  const sugerencias = {
    item: valoresUnicos(todosLosItems, 'item'),
    marca: valoresUnicos(todosLosItems, 'marca'),
    modelo: valoresUnicos(todosLosItems, 'modelo'),
  };

  const moviles = movilesData?.moviles || [];
  const sitios = sitiosData?.sitios || [];
  const movilPorId = new Map(moviles.map((m) => [m.id, m]));
  const opcionesUbicacion: OpcionUbicacion[] = sitios
    .map((s) => ({
      value: s.id,
      label: `${String(movilPorId.get(s.movilId)?.codificacion || '?')} - ${String(s.denominacion || '')}`,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
  const etiquetaUbicacion = (sitioId: string): string =>
    opcionesUbicacion.find((op) => op.value === sitioId)?.label || '';

  const opcionesKit: OpcionKit[] = todosLosItems
    .filter((it) => it.esKit)
    .map((it) => ({
      id: it.id,
      // El serial se incluye para distinguir kits con el mismo nombre
      // (ej. "ARNES ERA 001" vs "ARNES ERA 002").
      nombre: [String(it.item || 'Kit sin nombre'), it.serialCodigo].filter(Boolean).join(' '),
      ubicacion: String(it.ubicacion || ''),
    }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre));
  const kitPorId = new Map(todosLosItems.filter((it) => it.esKit).map((it) => [it.id, it]));

  const filasExport: FilaInventarioExport[] = [...todosLosItems]
    .sort((a, b) => String(a.categoria || '').localeCompare(String(b.categoria || '')) || compararItemSerial(a, b))
    .map((it) => {
    const kit = it.kitPadreId ? kitPorId.get(it.kitPadreId) : undefined;
    const tipo = it.esKit ? 'Kit' : kit ? `Dentro de: ${String(kit.item || '')}` : 'Suelto';
    return {
      categoria: String(it.categoria || ''),
      item: String(it.item || ''),
      marca: String(it.marca || ''),
      modelo: String(it.modelo || ''),
      cantidad: String(it.cantidad || ''),
      precioUnitario: String(it.precioUnitario || ''),
      ubicacion: etiquetaUbicacion(it.ubicacion) || '',
      tipo,
      serialCodigo: String(it.serialCodigo || ''),
      especificaciones: String(it.especificaciones || ''),
      observaciones: String(it.observaciones || ''),
      fecha: String(it.fecha || ''),
    };
  });

  const handleExportarCsv = () => {
    if (filasExport.length === 0) { alert('No hay materiales cargados para exportar.'); return; }
    exportarInventarioCsv(filasExport);
  };

  const handleExportarPdf = async () => {
    if (filasExport.length === 0) { alert('No hay materiales cargados para exportar.'); return; }
    try {
      await exportarInventarioPdf(filasExport);
    } catch {
      alert('Error al generar el PDF.');
    }
  };

  const cambiarTab = (cat: CategoriaMaterialMenor) => {
    setTabActiva(cat);
    setCreando(false);
    setEditandoId(null);
  };

  // Un material dentro de un kit hereda la categoria del kit, para que
  // ambos queden agrupados en la misma pestana sin importar en cual
  // pestana estaba parado el usuario al cargarlo.
  const categoriaParaForm = (form: MaterialForm): CategoriaMaterialMenor =>
    (form.kitPadreId && kitPorId.get(form.kitPadreId)?.categoria as CategoriaMaterialMenor) || tabActiva;

  const iniciarCreacion = () => {
    setNuevoItem({ ...materialVacio, fecha: hoyFormateada() });
    setCreando(true);
  };

  const iniciarEdicion = (it: MaterialForm & { id: string; imagen?: string }) => {
    setEditandoId(it.id);
    setEditForm({
      fecha: it.fecha, item: it.item, marca: it.marca, modelo: it.modelo, cantidad: it.cantidad,
      precioUnitario: it.precioUnitario, especificaciones: it.especificaciones, serialCodigo: it.serialCodigo,
      ubicacion: it.ubicacion, observaciones: it.observaciones,
      esKit: !!it.esKit, kitPadreId: it.kitPadreId || '',
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
        categoria: categoriaParaForm(nuevoItem),
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
        categoria: categoriaParaForm(editForm),
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
    const cantidadHijos = todosLosItems.filter((it) => it.kitPadreId === id).length;
    const mensaje = cantidadHijos > 0
      ? `Este kit tiene ${cantidadHijos} material(es) adentro. Se eliminaran todos. Continuar?`
      : 'Eliminar este item?';
    if (!confirm(mensaje)) return;
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
          <div className="flex items-center gap-2">
            <button onClick={handleExportarCsv} title="Exportar inventario completo a Excel" className="px-3 py-2 bg-white/5 hover:bg-white/10 text-white/60 hover:text-white rounded-lg text-xs flex items-center gap-2 transition-colors">
              <FileSpreadsheet className="w-3.5 h-3.5" /> Excel
            </button>
            <button onClick={handleExportarPdf} title="Exportar inventario completo a PDF" className="px-3 py-2 bg-white/5 hover:bg-white/10 text-white/60 hover:text-white rounded-lg text-xs flex items-center gap-2 transition-colors">
              <FileText className="w-3.5 h-3.5" /> PDF
            </button>
            {!creando && (
              <button onClick={iniciarCreacion} className="px-3 py-2 bg-cbvp-blue/10 hover:bg-cbvp-blue/20 text-cbvp-blue rounded-lg text-xs flex items-center gap-2 transition-colors">
                <Plus className="w-3.5 h-3.5" /> Agregar Item
              </button>
            )}
          </div>
        </div>

        {creando && (
          <div className="border border-white/10 rounded-xl p-4 mb-4 bg-white/[0.02] space-y-4">
            <FormularioMaterial
              valor={nuevoItem}
              onChange={(campo, v) => setNuevoItem({ ...nuevoItem, [campo]: v })}
              onChangeCampos={(cambios) => setNuevoItem({ ...nuevoItem, ...cambios })}
              inputId="material-nuevo"
              imagenPreview={nuevaImagenPreview}
              onImagen={(file) => { setNuevaImagen(file); setNuevaImagenPreview(URL.createObjectURL(file)); }}
              sugerencias={sugerencias}
              opcionesUbicacion={opcionesUbicacion}
              opcionesKit={opcionesKit}
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
                  <th className="text-left px-3 py-2 font-medium text-white/50">Foto</th>
                  <th className="text-left px-3 py-2 font-medium text-white/50">Item</th>
                  <th className="text-left px-3 py-2 font-medium text-white/50">Marca / Modelo</th>
                  <th className="text-left px-3 py-2 font-medium text-white/50">Cantidad</th>
                  <th className="text-left px-3 py-2 font-medium text-white/50">Ubicacion</th>
                  <th className="text-left px-3 py-2 font-medium text-white/50">Serial</th>
                  <th className="text-left px-3 py-2 font-medium text-white/50">Acciones</th>
                </tr>
              </thead>
              <tbody className="block sm:table-row-group">
                {itemsTab.map((it) => {
                  const esHijoDeKit = !!it.kitPadreId && kitsEnTab.has(it.kitPadreId);
                  return (
                  <Fragment key={it.id}>
                    <tr onClick={() => iniciarEdicion(it as MaterialForm & { id: string; imagen?: string })} className={`border-b border-white/5 hover:bg-white/[0.02] transition-colors cursor-pointer block sm:table-row mb-2 sm:mb-0 bg-white/[0.02] sm:bg-transparent rounded-lg sm:rounded-none p-2 sm:p-0 ${esHijoDeKit ? 'sm:bg-white/[0.015]' : ''}`}>
                      <td className="px-3 py-2 block sm:table-cell" onClick={(e) => e.stopPropagation()}>
                        {it.imagen ? (
                          <button onClick={() => setImagenAmpliada(String(it.imagen))} title="Ver imagen">
                            <img src={String(it.imagen)} alt={String(it.item || '')} className="w-10 h-10 object-cover rounded-lg border border-white/10 hover:opacity-80 transition-opacity" />
                          </button>
                        ) : (
                          <div className="w-10 h-10 rounded-lg border border-white/10 bg-white/5 flex items-center justify-center">
                            <ImageIcon className="w-4 h-4 text-white/15" />
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2 text-white font-medium block sm:table-cell">
                        <span className={`inline-flex items-center gap-1.5 ${esHijoDeKit ? 'pl-4 text-white/70 font-normal' : ''}`}>
                          {it.esKit && <Boxes className="w-3.5 h-3.5 text-cbvp-blue shrink-0" />}
                          {esHijoDeKit && <CornerDownRight className="w-3 h-3 text-white/25 shrink-0" />}
                          {it.item || '-'}
                          {it.esKit && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-cbvp-blue/10 text-cbvp-blue">
                              Kit · {todosLosItems.filter((h) => h.kitPadreId === it.id).length} item(s)
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-white/70 block sm:table-cell"><span className="text-white/30 sm:hidden">Marca/Modelo: </span>{[it.marca, it.modelo].filter(Boolean).join(' ') || '-'}</td>
                      <td className="px-3 py-2 text-white/70 block sm:table-cell"><span className="text-white/30 sm:hidden">Cantidad: </span>{it.cantidad || '-'}</td>
                      <td className="px-3 py-2 text-white/70 block sm:table-cell"><span className="text-white/30 sm:hidden">Ubicacion: </span>{etiquetaUbicacion(it.ubicacion) || '-'}</td>
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
                        <td colSpan={7} className="px-3 py-4">
                          <FormularioMaterial
                            valor={editForm}
                            onChange={(campo, v) => setEditForm({ ...editForm, [campo]: v })}
                            onChangeCampos={(cambios) => setEditForm({ ...editForm, ...cambios })}
                            inputId={`material-editar-${it.id}`}
                            imagenPreview={editImagenPreview}
                            onImagen={(file) => { setEditImagen(file); setEditImagenPreview(URL.createObjectURL(file)); }}
                            sugerencias={sugerencias}
                            opcionesUbicacion={opcionesUbicacion}
                            opcionesKit={opcionesKit.filter((k) => k.id !== it.id)}
                          />
                          <div className="flex gap-2 mt-3">
                            <button onClick={guardarEdicion} className="px-4 py-2 bg-cbvp-green hover:bg-cbvp-green/80 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"><Save className="w-4 h-4" /> Guardar</button>
                            <button onClick={() => setEditandoId(null)} className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white/60 text-sm rounded-lg transition-colors flex items-center gap-2"><X className="w-4 h-4" /> Cancelar</button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {imagenAmpliada && <ImagenLightbox src={imagenAmpliada} onClose={() => setImagenAmpliada(null)} />}
    </div>
  );
}
