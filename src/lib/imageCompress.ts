// Comprime una imagen redimensionandola (ancho maximo) y bajando la calidad JPEG,
// para que las fotos de camara (que suelen pesar 3-8 MB) bajen a ~300KB-1.5MB
// antes de subirlas. Ahorra datos moviles y acelera la subida en obra.
export async function compressImage(
  file: File,
  maxWidth: number = 1600,
  quality: number = 0.75
): Promise<File> {
  // Si no es una imagen, la devolvemos tal cual (por si acaso)
  if (!file.type.startsWith('image/')) return file;

  return new Promise((resolve) => {
    const img = new Image();
    const reader = new FileReader();

    reader.onload = (e) => {
      img.onload = () => {
        let { width, height } = img;
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(file);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (blob) {
              const nombreComprimido = file.name.replace(/\.[^.]+$/, '') + '.jpg';
              resolve(new File([blob], nombreComprimido, { type: 'image/jpeg' }));
            } else {
              resolve(file);
            }
          },
          'image/jpeg',
          quality
        );
      };
      img.onerror = () => resolve(file);
      img.src = e.target?.result as string;
    };
    reader.onerror = () => resolve(file);
    reader.readAsDataURL(file);
  });
}
