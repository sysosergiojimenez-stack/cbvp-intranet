import { useState, useRef, useEffect } from 'react';
import { X, Check } from 'lucide-react';
import { cargarImagen, liberarImagen, detectarEsquinas, extraerConEsquinas, type EsquinasDocumento, type Punto } from '@/lib/documentScan';

interface Props {
  file: File;
  onConfirm: (file: File) => void;
  onUsarOriginal: () => void;
  onCancel: () => void;
}

type NombreEsquina = 'topLeftCorner' | 'topRightCorner' | 'bottomLeftCorner' | 'bottomRightCorner';
const ORDEN_ESQUINAS: NombreEsquina[] = ['topLeftCorner', 'topRightCorner', 'bottomRightCorner', 'bottomLeftCorner'];

export default function DocumentScanModal({ file, onConfirm, onUsarOriginal, onCancel }: Props) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [corners, setCorners] = useState<EsquinasDocumento | null>(null);
  const [cargando, setCargando] = useState(true);
  const [procesando, setProcesando] = useState(false);
  const [arrastrando, setArrastrando] = useState<NombreEsquina | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelado = false;
    let imagenCargada: HTMLImageElement | null = null;
    (async () => {
      const imagen = await cargarImagen(file);
      if (cancelado) { liberarImagen(imagen); return; }
      imagenCargada = imagen;
      setImg(imagen);
      const esquinas = await detectarEsquinas(imagen);
      if (cancelado) return;
      setCorners(esquinas);
      setCargando(false);
    })();
    return () => {
      cancelado = true;
      if (imagenCargada) liberarImagen(imagenCargada);
    };
  }, [file]);

  const pantallaANatural = (clientX: number, clientY: number): Punto => {
    const wrapper = wrapperRef.current!;
    const rect = wrapper.getBoundingClientRect();
    const nx = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const ny = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
    return { x: nx * img!.naturalWidth, y: ny * img!.naturalHeight };
  };

  const naturalAPorcentaje = (p: Punto): { xPct: number; yPct: number } => ({
    xPct: (p.x / img!.naturalWidth) * 100,
    yPct: (p.y / img!.naturalHeight) * 100,
  });

  const handlePointerDown = (esquina: NombreEsquina) => (e: React.PointerEvent) => {
    e.preventDefault();
    setArrastrando(esquina);
  };

  useEffect(() => {
    if (!arrastrando) return;
    const handleMove = (e: PointerEvent) => {
      const punto = pantallaANatural(e.clientX, e.clientY);
      setCorners((prev) => (prev ? { ...prev, [arrastrando]: punto } : prev));
    };
    const handleUp = () => setArrastrando(null);
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arrastrando]);

  const handleConfirmar = async () => {
    if (!img || !corners) return;
    setProcesando(true);
    try {
      const resultado = await extraerConEsquinas(img, corners, file.name);
      onConfirm(resultado);
    } catch (err) {
      console.error(err);
      onUsarOriginal();
    } finally {
      setProcesando(false);
    }
  };

  const puntosPolygon = corners
    ? ORDEN_ESQUINAS.map((k) => {
        const { xPct, yPct } = naturalAPorcentaje(corners[k]);
        return `${xPct},${yPct}`;
      }).join(' ')
    : '';

  return (
    <div className="fixed inset-0 bg-black/90 z-[100] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-lg flex flex-col gap-3">
        <div className="flex items-center justify-between text-white">
          <h3 className="text-sm font-semibold">Ajustar esquinas del documento</h3>
          <button onClick={onCancel} className="p-2 rounded-lg hover:bg-white/10"><X size={20} /></button>
        </div>

        {cargando ? (
          <div className="aspect-[3/4] flex items-center justify-center text-white/60 text-sm bg-white/5 rounded-lg">
            Detectando documento...
          </div>
        ) : (
          <div ref={wrapperRef} className="relative select-none touch-none" style={{ lineHeight: 0 }}>
            <img src={img?.src} alt="documento" className="max-w-full max-h-[65vh] rounded-lg block" draggable={false} />
            {corners && (
              <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full pointer-events-none">
                <polygon points={puntosPolygon} fill="rgba(239, 68, 68, 0.15)" stroke="#ef4444" strokeWidth="0.5" vectorEffect="non-scaling-stroke" />
              </svg>
            )}
            {corners && ORDEN_ESQUINAS.map((esquina) => {
              const { xPct, yPct } = naturalAPorcentaje(corners[esquina]);
              return (
                <div
                  key={esquina}
                  onPointerDown={handlePointerDown(esquina)}
                  className="absolute w-9 h-9 -ml-[18px] -mt-[18px] rounded-full bg-cbvp-red/90 border-2 border-white shadow-lg cursor-grab active:cursor-grabbing touch-none"
                  style={{ left: `${xPct}%`, top: `${yPct}%` }}
                />
              );
            })}
          </div>
        )}

        <p className="text-white/40 text-xs text-center">Arrastra los circulos rojos para ajustar las 4 esquinas del documento</p>

        <div className="flex gap-2">
          <button onClick={onUsarOriginal} className="flex-1 py-3 sm:py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-sm transition-colors">
            Usar foto original
          </button>
          <button onClick={handleConfirmar} disabled={cargando || procesando} className="flex-1 py-3 sm:py-2.5 bg-cbvp-red hover:bg-cbvp-red/80 disabled:opacity-50 text-white font-semibold rounded-xl text-sm flex items-center justify-center gap-2 transition-colors">
            {procesando ? 'Procesando...' : <><Check size={16} /> Confirmar</>}
          </button>
        </div>
      </div>
    </div>
  );
}
