// Utilidades para subir las fotos del Croquis del Lugar de los informes de servicio.
export const ACCEPT_FOTO_CROQUIS = 'image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp';

export function mimeFotoCroquis(file: File): string {
  const raw = (file.type || '').toLowerCase();
  if (raw === 'image/jpeg' || raw === 'image/png' || raw === 'image/webp') return raw;
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  return 'image/jpeg';
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = () => reject(new Error('No se pudo leer el archivo'));
    reader.readAsDataURL(file);
  });
}
