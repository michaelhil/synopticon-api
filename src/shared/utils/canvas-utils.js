/**
 * Canvas Utilities for Server-side and Client-side rendering
 * Provides unified canvas creation for both browser and Node.js environments
 */

// Check environment
const isNode = typeof window === 'undefined';
const isBrowser = typeof window !== 'undefined';

export const createCanvas = (width = 640, height = 480) => {
  if (isBrowser) {
    // Browser environment
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas;
  } else {
    // Node.js environment - would need 'canvas' package in production
    // For now, return a mock canvas object
    console.warn('Server-side canvas creation - using mock implementation');
    return {
      width,
      height,
      getContext: (type) => ({
        // Mock 2D context
        fillRect: () => {},
        clearRect: () => {},
        drawImage: () => {},
        getImageData: () => new ImageData(width, height),
        putImageData: () => {},
        // Mock WebGL context  
        useProgram: () => {},
        bindTexture: () => {},
        drawArrays: () => {}
      })
    };
  }
};

export const canvasToBlob = (canvas, type = 'image/png', quality = 0.92) => {
  return new Promise((resolve, reject) => {
    if (canvas.toBlob) {
      canvas.toBlob(resolve, type, quality);
    } else {
      // Fallback for environments without toBlob
      try {
        const dataURL = canvas.toDataURL(type, quality);
        const base64 = dataURL.split(',')[1];
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        resolve(new Blob([bytes], { type }));
      } catch (error) {
        reject(error);
      }
    }
  });
};

export const canvasToDataURL = (canvas, type = 'image/png', quality = 0.92) => {
  if (canvas.toDataURL) {
    return canvas.toDataURL(type, quality);
  } else {
    // Mock implementation for server
    return `data:${type};base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==`;
  }
};

export const loadImageToCanvas = (src, canvas = null) => {
  return new Promise((resolve, reject) => {
    if (isBrowser) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      img.onload = () => {
        const targetCanvas = canvas || createCanvas(img.width, img.height);
        const ctx = targetCanvas.getContext('2d');
        
        targetCanvas.width = img.width;
        targetCanvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        
        resolve(targetCanvas);
      };
      
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = src;
      
    } else {
      // Server-side image loading would require additional packages
      reject(new Error('Server-side image loading not implemented'));
    }
  });
};

export const resizeCanvas = (sourceCanvas, targetWidth, targetHeight, canvas = null) => {
  const targetCanvas = canvas || createCanvas(targetWidth, targetHeight);
  const ctx = targetCanvas.getContext('2d');
  
  targetCanvas.width = targetWidth;
  targetCanvas.height = targetHeight;
  
  // Use high-quality scaling
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  
  ctx.drawImage(sourceCanvas, 0, 0, targetWidth, targetHeight);
  
  return targetCanvas;
};

export const getImageDataFromCanvas = (canvas, x = 0, y = 0, width = null, height = null) => {
  const ctx = canvas.getContext('2d');
  const w = width || canvas.width;
  const h = height || canvas.height;
  
  try {
    return ctx.getImageData(x, y, w, h);
  } catch (error) {
    console.error('Failed to get image data:', error);
    return null;
  }
};

export const createImageDataFromArray = (data, width, height) => {
  if (isBrowser && ImageData) {
    return new ImageData(data, width, height);
  } else {
    // Mock ImageData for server
    return {
      data,
      width,
      height
    };
  }
};

// Utility to check if WebGL is supported
export const isWebGLSupported = () => {
  if (!isBrowser) return false;
  
  try {
    const canvas = createCanvas();
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    return !!gl;
  } catch (error) {
    return false;
  }
};

// Utility to check if WebGL2 is supported
export const isWebGL2Supported = () => {
  if (!isBrowser) return false;
  
  try {
    const canvas = createCanvas();
    const gl = canvas.getContext('webgl2');
    return !!gl;
  } catch (error) {
    return false;
  }
};

export const getCanvasInfo = (canvas) => ({
  width: canvas.width,
  height: canvas.height,
  hasWebGL: isWebGLSupported(),
  hasWebGL2: isWebGL2Supported(),
  environment: isNode ? 'node' : 'browser'
});