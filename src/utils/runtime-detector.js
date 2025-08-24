/**
 * Runtime Detection Utilities
 * Detects current runtime environment and provides compatibility helpers
 */

// Detect runtime environment
export const detectRuntime = () => {
  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    return 'browser';
  }
  
  if (typeof process !== 'undefined' && process.versions && process.versions.node) {
    return 'node';
  }
  
  if (typeof Bun !== 'undefined') {
    return 'bun';
  }
  
  if (typeof Deno !== 'undefined') {
    return 'deno';
  }
  
  return 'unknown';
};

// Check specific feature availability
export const checkFeatures = () => {
  const runtime = detectRuntime();
  
  return {
    runtime,
    isBrowser: runtime === 'browser',
    isNode: runtime === 'node' || runtime === 'bun',
    isServer: runtime !== 'browser',
    
    // Feature availability
    hasDOM: typeof document !== 'undefined',
    hasCanvas: typeof HTMLCanvasElement !== 'undefined',
    hasWebGL: typeof WebGLRenderingContext !== 'undefined',
    hasWorkers: typeof Worker !== 'undefined',
    hasNodeModules: typeof require !== 'undefined' || typeof import.meta !== 'undefined',
    
    // API availability
    hasFetch: typeof fetch !== 'undefined',
    hasWebSocket: typeof WebSocket !== 'undefined',
    hasFileSystem: runtime === 'node' || runtime === 'bun',
    
    // Performance features
    hasGPU: typeof WebGLRenderingContext !== 'undefined',
    hasWASM: typeof WebAssembly !== 'undefined',
    hasSharedArrayBuffer: typeof SharedArrayBuffer !== 'undefined'
  };
};

// Create appropriate canvas for environment (with optional canvas dependency)
export const createUniversalCanvas = async (width = 640, height = 480) => {
  const features = checkFeatures();
  
  if (features.hasCanvas) {
    // Browser environment
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas;
  } else if (features.isNode) {
    // Node.js environment - optional canvas dependency
    try {
      // Try to load canvas dynamically (optional dependency)
      const { createCanvas, loadImage } = await import('canvas');
      const canvas = createCanvas(width, height);
      
      // Enhance with browser-compatible methods
      canvas.toBlob = (callback, type = 'image/png', quality = 1) => {
        const buffer = canvas.toBuffer(type.replace('image/', ''));
        const blob = new Blob([buffer], { type });
        callback(blob);
      };
      
      canvas.loadImage = loadImage;
      
      return canvas;
    } catch (error) {
      console.warn('⚠️ Optional canvas dependency not available, using lightweight fallback');
      // Enhanced fallback with better compatibility
      return createMockCanvas(width, height);
    }
  } else {
    // Unknown environment - return mock
    return createMockCanvas(width, height);
  }
};

// Create mock canvas for testing/fallback
export const createMockCanvas = (width = 640, height = 480) => {
  return {
    width,
    height,
    getContext: (type) => createMockContext(type),
    toDataURL: () => 'data:image/png;base64,mock',
    toBlob: (callback) => callback(new Blob(['mock'], { type: 'image/png' }))
  };
};

// Create mock context for testing
const createMockContext = (type) => {
  if (type === '2d') {
    return {
      canvas: { width: 640, height: 480 },
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 1,
      fillRect: () => {},
      strokeRect: () => {},
      clearRect: () => {},
      beginPath: () => {},
      closePath: () => {},
      moveTo: () => {},
      lineTo: () => {},
      arc: () => {},
      fill: () => {},
      stroke: () => {},
      drawImage: () => {},
      getImageData: () => ({ data: new Uint8ClampedArray(640 * 480 * 4), width: 640, height: 480 }),
      putImageData: () => {},
      createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }),
      save: () => {},
      restore: () => {},
      scale: () => {},
      rotate: () => {},
      translate: () => {},
      transform: () => {},
      setTransform: () => {}
    };
  }
  
  if (type === 'webgl' || type === 'webgl2') {
    return null; // WebGL not available in Node
  }
  
  return null;
};

// Load appropriate MediaPipe for environment
export const loadMediaPipe = async () => {
  const features = checkFeatures();
  
  if (features.isBrowser) {
    // Browser: Use MediaPipe from CDN or local
    try {
      // Check if MediaPipe is already loaded globally
      if (typeof window !== 'undefined' && window.MediaPipeUtils) {
        return window.MediaPipeUtils;
      }
      
      // Try to load MediaPipe dynamically
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/face_detection@0.4.1646425229/face_detection.js';
      document.head.appendChild(script);
      
      return new Promise((resolve, reject) => {
        script.onload = () => resolve(window.MediaPipeUtils || true);
        script.onerror = () => reject(new Error('Failed to load MediaPipe'));
      });
    } catch (error) {
      console.warn('Failed to load MediaPipe for browser:', error);
      return null;
    }
  } else {
    // Server: MediaPipe not needed for server-side analysis
    console.log('MediaPipe not required in server environment');
    return { serverMode: true };
  }
};

// Convert various image formats to MediaPipe-compatible format
export const imageToMediaPipe = async (input) => {
  const features = checkFeatures();
  
  // MediaPipe works directly with HTML elements and ImageData
  if (features.isBrowser) {
    // Return supported formats directly
    if (input instanceof HTMLImageElement || 
        input instanceof HTMLCanvasElement || 
        input instanceof HTMLVideoElement ||
        input instanceof ImageData) {
      return input;
    }
    
    // Convert other formats to canvas
    if (input instanceof Blob) {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);
          resolve(canvas);
        };
        img.onerror = reject;
        img.src = URL.createObjectURL(input);
      });
    }
  }
  
  // Server environment: Convert to compatible format
  if (features.isNode) {
    // For server-side, return image metadata for processing
    if (Buffer.isBuffer(input)) {
      return {
        type: 'buffer',
        data: input,
        serverMode: true
      };
    }
    
    if (typeof input === 'string' && input.startsWith('data:image')) {
      const base64 = input.split(',')[1];
      const buffer = Buffer.from(base64, 'base64');
      return {
        type: 'base64',
        data: buffer,
        serverMode: true
      };
    }
  }
  
  // Handle raw pixel data
  if (input.data && input.width && input.height) {
    return {
      type: 'imageData',
      width: input.width,
      height: input.height,
      data: input.data
    };
  }
  
  throw new Error('Unsupported image input format for MediaPipe');
};

// Export runtime information
export const getRuntimeInfo = () => {
  const features = checkFeatures();
  
  return {
    ...features,
    version: {
      node: features.isNode ? process.version : null,
      bun: typeof Bun !== 'undefined' ? Bun.version : null,
      browser: features.isBrowser ? navigator.userAgent : null
    },
    platform: features.isNode ? process.platform : 'browser',
    arch: features.isNode ? process.arch : null,
    memory: features.isNode ? process.memoryUsage() : null
  };
};