// Escaneo tipo "CamScanner": detecta el documento en la foto y corrige la
// perspectiva (endereza el documento). Carga OpenCV.js y jscanify desde CDN
// como scripts globales (NO como paquete de npm: la version de npm de
// jscanify empaqueta una copia completa de OpenCV pensada para Node.js de
// ~14MB, que rompe el build del cliente).
// Si no se detecta un documento con confianza, devuelve la foto original sin tocar.

let librariesLoadPromise: Promise<void> | null = null;

function cargarScript(id: string, src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existente = document.getElementById(id) as HTMLScriptElement | null;
    if (existente) {
      if ((existente as any)._cargado) {
        resolve();
      } else {
        existente.addEventListener('load', () => resolve());
        existente.addEventListener('error', () => reject(new Error('No se pudo cargar ' + src)));
      }
      return;
    }
    const script = document.createElement('script');
    script.id = id;
    script.src = src;
    script.async = true;
    script.onload = () => {
      (script as any)._cargado = true;
      resolve();
    };
    script.onerror = () => reject(new Error('No se pudo cargar ' + src));
    document.head.appendChild(script);
  });
}

function cargarLibrerias(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if ((window as any).jscanify && (window as any).cv && (window as any).cv.Mat) {
    return Promise.resolve();
  }
  if (librariesLoadPromise) return librariesLoadPromise;

  librariesLoadPromise = new Promise((resolve, reject) => {
    cargarScript('opencv-js-script', 'https://docs.opencv.org/4.7.0/opencv.js')
      .then(() => {
        const cv = (window as any).cv;
        const esperarRuntime = () =>
          new Promise<void>((res) => {
            if (cv.Mat) {
              res();
            } else {
              cv.onRuntimeInitialized = () => res();
            }
          });
        return esperarRuntime();
      })
      .then(() => cargarScript(
        'jscanify-script',
        'https://cdn.jsdelivr.net/gh/ColonelParrot/jscanify@master/src/jscanify.min.js'
      ))
      .then(() => resolve())
      .catch(reject);
  });

  return librariesLoadPromise;
}

function cargarImagen(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('No se pudo leer la imagen'));
    };
    img.src = url;
  });
}

function distancia(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.sqrt(Math.pow(b.x - a.x, 2) + Math.pow(b.y - a.y, 2));
}

function canvasAFile(canvas: HTMLCanvasElement, nombreOriginal: string): Promise<File> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('No se pudo generar el archivo escaneado'));
        return;
      }
      const nombre = nombreOriginal.replace(/\.[^.]+$/, '') + '_escaneado.jpg';
      resolve(new File([blob], nombre, { type: 'image/jpeg' }));
    }, 'image/jpeg', 0.9);
  });
}

export async function escanearDocumento(file: File): Promise<File> {
  if (!file.type.startsWith('image/')) return file;

  try {
    await cargarLibrerias();
    const cv = (window as any).cv;
    const JScanify = (window as any).jscanify;
    const scanner = new JScanify();

    const img = await cargarImagen(file);
    const mat = cv.imread(img);
    const contour = scanner.findPaperContour(mat);

    if (!contour) {
      mat.delete();
      return file;
    }

    const corners = scanner.getCornerPoints(contour);
    mat.delete();

    if (!corners || !corners.topLeftCorner || !corners.topRightCorner || !corners.bottomLeftCorner || !corners.bottomRightCorner) {
      return file;
    }

    const anchoArriba = distancia(corners.topLeftCorner, corners.topRightCorner);
    const anchoAbajo = distancia(corners.bottomLeftCorner, corners.bottomRightCorner);
    const altoIzq = distancia(corners.topLeftCorner, corners.bottomLeftCorner);
    const altoDer = distancia(corners.topRightCorner, corners.bottomRightCorner);

    const resultWidth = Math.round(Math.max(anchoArriba, anchoAbajo));
    const resultHeight = Math.round(Math.max(altoIzq, altoDer));

    if (resultWidth < 50 || resultHeight < 50) return file;

    const resultCanvas: HTMLCanvasElement = scanner.extractPaper(img, resultWidth, resultHeight);
    return await canvasAFile(resultCanvas, file.name);
  } catch (err) {
    console.warn('Escaneo de documento fallo, se usa la foto original:', err);
    return file;
  }
}
