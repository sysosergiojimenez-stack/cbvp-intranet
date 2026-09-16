import { X } from 'lucide-react';

export default function ImagenLightbox({ src, onClose }: { src: string; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[200] bg-black/80 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-2.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
        title="Cerrar"
      >
        <X className="w-5 h-5" />
      </button>
      <img
        src={src}
        alt="Imagen del material"
        onClick={(e) => e.stopPropagation()}
        className="max-w-full max-h-full rounded-lg object-contain"
      />
    </div>
  );
}
