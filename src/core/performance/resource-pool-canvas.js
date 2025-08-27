/**
 * Canvas Resource Management
 * Handles canvas element pooling and lifecycle management
 */

import { ErrorCategory, ErrorSeverity, handleError } from '../../shared/utils/error-handler.js';

export const createMockCanvas = (width, height) => ({
  width,
  height,
  getContext: (type) => {
    if (type === '2d') {
      return {
        clearRect: () => {},
        fillRect: () => {},
        drawImage: () => {},
        getImageData: () => ({ data: new Uint8Array(width * height * 4), width, height }),
        putImageData: () => {}
      };
    }
    return null;
  }
});

export const createCanvasManager = (state, poolConfig) => {
  const getCanvas = (width = 640, height = 480) => {
    let canvas = null;
    
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
  
  const returnCanvas = (canvas) => {
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
        `Error returning canvas to pool: ${error.message}`,
        ErrorCategory.MEMORY,
        ErrorSeverity.WARNING
      );
    }
  };
  
  return { getCanvas, returnCanvas };
};