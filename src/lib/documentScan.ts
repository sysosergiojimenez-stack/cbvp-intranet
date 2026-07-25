// Escaneo tipo "CamScanner": detecta el documento en la foto, permite ajustar
// las esquinas a mano, y corrige la perspectiva (endereza el documento).
// Carga OpenCV.js y jscanify desde CDN como scripts globales (NO como paquete
// de npm: la version de npm de jscanify empaqueta una copia completa de
// OpenCV pensada para Node.js de ~14MB, que rompe el build del cliente).

export interface Punto {
  x: number;
  y: number;
}

export interface EsquinasDocumento {
  topLeftCorner: Punto;
  topRightCorner: Punto;
  bottomLeftCorner: Punto;
  bottomRightCorner: Punto;
}

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

export function cargarLibrerias(): Promise<void> {
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

// IMPORTANTE: no revoca la URL automaticamente porque la imagen puede
// necesitar mostrarse de nuevo en un <img> (ej. el modal de ajuste de
// esquinas). Llamar a liberarImagen() cuando ya no se necesite mas.
export function cargarImagen(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => resolve(img);
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('No se pudo leer la imagen'));
    };
    img.src = url;
  });
}

export function liberarImagen(img: HTMLImageElement): void {
  if (img.src.startsWith('blob:')) {
    URL.revokeObjectURL(img.src);
  }
}

function distancia(a: Punto, b: Punto): number {
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

// Detecta las esquinas del documento automaticamente. Si no logra detectar
// nada (o el area es sospechosamente chica), devuelve un cuadrado por defecto
// con margen del 8% desde cada borde de la foto, para que el usuario ajuste
// las esquinas a mano desde ahi.
export async function detectarEsquinas(img: HTMLImageElement): Promise<EsquinasDocumento> {
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const margenDefecto: EsquinasDocumento = {
    topLeftCorner: { x: w * 0.08, y: h * 0.08 },
    topRightCorner: { x: w * 0.92, y: h * 0.08 },
    bottomLeftCorner: { x: w * 0.08, y: h * 0.92 },
    bottomRightCorner: { x: w * 0.92, y: h * 0.92 },
  };

  try {
    await cargarLibrerias();
    const cv = (window as any).cv;
    const JScanify = (window as any).jscanify;
    const scanner = new JScanify();

    const mat = cv.imread(img);
    const contour = scanner.findPaperContour(mat);
    if (!contour) {
      mat.delete();
      return margenDefecto;
    }
    const corners: EsquinasDocumento = scanner.getCornerPoints(contour);
    mat.delete();

    if (!corners || !corners.topLeftCorner || !corners.topRightCorner || !corners.bottomLeftCorner || !corners.bottomRightCorner) {
      return margenDefecto;
    }

    const anchoArriba = distancia(corners.topLeftCorner, corners.topRightCorner);
    const altoIzq = distancia(corners.topLeftCorner, corners.bottomLeftCorner);
    const areaDetectada = anchoArriba * altoIzq;
    const areaImagenCompleta = w * h;
    if (areaDetectada / areaImagenCompleta < 0.2) {
      return margenDefecto;
    }

    return corners;
  } catch (err) {
    console.warn('Deteccion automatica fallo, se usan esquinas por defecto:', err);
    return margenDefecto;
  }
}

// Aplica la correccion de perspectiva usando las esquinas dadas (ya sea
// detectadas automaticamente o ajustadas a mano por el usuario).
export async function extraerConEsquinas(img: HTMLImageElement, corners: EsquinasDocumento, nombreOriginal: string): Promise<File> {
  await cargarLibrerias();
  const JScanify = (window as any).jscanify;
  const scanner = new JScanify();

  const anchoArriba = distancia(corners.topLeftCorner, corners.topRightCorner);
  const anchoAbajo = distancia(corners.bottomLeftCorner, corners.bottomRightCorner);
  const altoIzq = distancia(corners.topLeftCorner, corners.bottomLeftCorner);
  const altoDer = distancia(corners.topRightCorner, corners.bottomRightCorner);

  const resultWidth = Math.max(50, Math.round(Math.max(anchoArriba, anchoAbajo)));
  const resultHeight = Math.max(50, Math.round(Math.max(altoIzq, altoDer)));

  const resultCanvas: HTMLCanvasElement = scanner.extractPaper(img, resultWidth, resultHeight, corners);
  return await canvasAFile(resultCanvas, nombreOriginal);
}
