/**
 * Canvas Resource Management
 * Handles canvas element pooling and lifecycle management
 */

import { ErrorCategory, ErrorSeverity, handleError } from '../../shared/utils/error-handler.js'

export interface MockCanvasContext2D {
  clearRect: (x: number, y: number, width: number, height: number) => void;
  fillRect: (x: number, y: number, width: number, height: number) => void;
  drawImage: (...args: any[]) => void;
  getImageData: (sx: number, sy: number, sw: number, sh: number) => ImageData;
  putImageData: (imageData: ImageData, dx: number, dy: number) => void;
}

export interface MockCanvas {
  width: number;
  height: number;
  getContext: (contextId: '2d') => MockCanvasContext2D | null;
}

export interface CanvasPoolState {
  canvasPool: (HTMLCanvasElement | MockCanvas)[];
  metricsData: {
    canvasCreated: number;
    canvasReused: number;
    totalAllocations: number;
    totalDeallocations: number;
    [key: string]: number;
  };
}

export interface CanvasPoolConfig {
  maxCanvasElements: number;
  [key: string]: unknown;
}

export interface CanvasManager {
  getCanvas: (width?: number, height?: number) => HTMLCanvasElement | MockCanvas;
  returnCanvas: (canvas: HTMLCanvasElement | MockCanvas) => void;
}

export const createMockCanvas = (width: number, height: number): MockCanvas => ({
  width,
  height,
  getContext: (type: '2d'): MockCanvasContext2D | null => {
    if (type === '2d') {
      return {
        clearRect: () => {},
        fillRect: () => {},
        drawImage: () => {},
        getImageData: () => ({ 
          data: new Uint8ClampedArray(width * height * 4), 
          width, 
          height,
          colorSpace: 'srgb'
        }),
        putImageData: () => {}
      };
    }
    return null;
  }
});

export const createCanvasManager = (
  state: CanvasPoolState, 
  poolConfig: CanvasPoolConfig
): CanvasManager => {
  const getCanvas = (width: number = 640, height: number = 480): HTMLCanvasElement | MockCanvas => {
    let canvas: HTMLCanvasElement | MockCanvas | null = null;
    
    // Try to find a suitable canvas in the pool
    for (let i = 0; i < state.canvasPool.length; i++) {
      const pooledCanvas = state.canvasPool[i];
      if (pooledCanvas.width >= width && pooledCanvas.height >= height) {
        // Remove from pool and resize if needed
        canvas = state.canvasPool.splice(i, 1)[0];
        if (canvas.width !== width || canvas.height !== height) {
          canvas.width = width;
          canvas.height = height;
        }
        break;
      }
    }
    
    // Create new canvas if none available
    if (!canvas) {
      if (typeof document !== 'undefined') {
        canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        state.metricsData.canvasCreated++;
      } else {
        // Node.js environment - create mock canvas
        canvas = createMockCanvas(width, height);
        state.metricsData.canvasCreated++;
      }
    } else {
      state.metricsData.canvasReused++;
    }
    
    state.metricsData.totalAllocations++;
    return canvas;
  };
  
  const returnCanvas = (canvas: HTMLCanvasElement | MockCanvas): void => {
    if (!canvas) return;
    
    try {
      // Clear canvas content
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
      
      // Only pool if we haven't exceeded the limit
      if (state.canvasPool.length < poolConfig.maxCanvasElements) {
        state.canvasPool.push(canvas);
      }
      
      state.metricsData.totalDeallocations++;
    } catch (error) {
      handleError(
        `Error returning canvas to pool: ${(error as Error).message}`,
        ErrorCategory.MEMORY,
        ErrorSeverity.WARNING
      );
    }
  };
  
  return { getCanvas, returnCanvas };
};