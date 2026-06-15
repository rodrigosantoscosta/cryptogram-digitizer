declare const cv: any;

let loaded = false;
let loading: Promise<void> | null = null;

export async function loadOpenCV(): Promise<void> {
  if (loaded && typeof cv !== 'undefined' && cv.Mat) return;
  if (loading) return loading;

  loading = new Promise<void>((resolve, reject) => {
    if (typeof cv !== 'undefined' && cv.Mat) {
      loaded = true;
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = '/opencv-js/dist/opencv.js';
    script.async = true;

    script.onload = () => {
      const check = () => {
        if (typeof cv !== 'undefined' && cv.Mat) {
          loaded = true;
          resolve();
        } else {
          setTimeout(check, 50);
        }
      };
      check();
    };

    script.onerror = () => {
      loading = null;
      reject(new Error('Failed to load OpenCV.js'));
    };

    document.head.appendChild(script);
  });

  return loading;
}

export function isOpenCVLoaded(): boolean {
  return loaded && typeof cv !== 'undefined' && cv.Mat;
}
