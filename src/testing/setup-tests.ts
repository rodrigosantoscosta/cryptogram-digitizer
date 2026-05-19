import * as matchers from '@testing-library/jest-dom/matchers';
import { expect, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// ─── Polyfill para ResizeObserver (jsdom não fornece nativamente) ─────────────

class ResizeObserverPolyfill {
  private callback: ResizeObserverCallback;
  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
  }
  observe(_target: Element) {
    this.callback([], this);
  }
  unobserve() {}
  disconnect() {}
}

if (typeof globalThis.ResizeObserver === 'undefined') {
  (globalThis as any).ResizeObserver = ResizeObserverPolyfill;
}

// ─── Polyfill para ImageData (jsdom não fornece nativamente) ──────────────────

class ImageDataPolyfill {
  data: Uint8ClampedArray;
  width: number;
  height: number;
  colorSpace: 'srgb' | 'display-p3' = 'srgb';

  constructor(
    sw: number | Uint8ClampedArray | Uint8Array,
    sh?: number,
    settings?: { colorSpace?: 'srgb' | 'display-p3' }
  ) {
    if (typeof sw === 'number') {
      this.width = sw;
      this.height = sh || sw;
      this.data = new Uint8ClampedArray(this.width * this.height * 4);
    } else {
      this.data = new Uint8ClampedArray(sw);
      this.width = sh || Math.sqrt(this.data.length / 4);
      this.height = this.width;
    }
    if (settings?.colorSpace) {
      this.colorSpace = settings.colorSpace;
    }
  }
}

// Injetar no global apenas se não existir (evita sobrescrever em navegador)
if (typeof globalThis.ImageData === 'undefined') {
  (globalThis as any).ImageData = ImageDataPolyfill;
}

// ─── Polyfill para Canvas/DOM APIs usadas nos testes ──────────────────────────

if (typeof globalThis.document !== 'undefined') {
  const originalCreateElement = document.createElement.bind(document);
  document.createElement = (tagName: string, options?: ElementCreationOptions) => {
    const el = originalCreateElement(tagName, options);
    if (tagName.toLowerCase() === 'canvas') {
      (el as any).getContext = (contextId: string) => {
        if (contextId === '2d') {
          return {
            fillRect: () => {},
            fillStyle: '',
            createLinearGradient: () => ({ addColorStop: () => {} }),
            getImageData: (x: number, y: number, w: number, h: number) =>
              new ImageDataPolyfill(w, h),
            createImageData: (w: number, h: number) => new ImageDataPolyfill(w, h),
            putImageData: () => {},
            drawImage: () => {},
            measureText: () => ({ width: 50 }),
            font: '',
            textAlign: '',
            textBaseline: '',
          };
        }
        return null;
      };
      (el as any).width = 100;
      (el as any).height = 100;
      (el as any).toDataURL = () => '';
    }
    return el;
  };
}

// ─── Jest-DOM matchers ────────────────────────────────────────────────────────

expect.extend(matchers);

// Limpar o DOM após cada teste para evitar vazamento de estado
afterEach(() => {
  cleanup();
});
