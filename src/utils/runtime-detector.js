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

// Create appropriate canvas for environment
export const createUniversalCanvas = async (width = 640, height = 480) => {
  const features = checkFeatures();
  
  if (features.hasCanvas) {
    // Browser environment
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas;
  } else if (features.isNode) {
    // Node.js environment - enhanced canvas integration
    try {
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
      console.warn('⚠️ node-canvas not available, using mock canvas:', error.message);
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

// Load appropriate TensorFlow.js for environment
export const loadTensorFlow = async () => {
  const features = checkFeatures();
  
  if (features.isBrowser) {
    // Browser: Use standard TensorFlow.js
    try {
      const tf = await import('@tensorflow/tfjs');
      await tf.ready();
      return tf;
    } catch (error) {
      console.warn('Failed to load TensorFlow.js for browser:', error);
      return null;
    }
  } else if (features.isNode) {
    // Node.js: Use TensorFlow.js Node backend
    try {
      const tf = await import('@tensorflow/tfjs-node');
      await tf.ready();
      return tf;
    } catch (error) {
      console.warn('Failed to load TensorFlow.js for Node:', error);
      // Fallback to CPU backend
      try {
        const tf = await import('@tensorflow/tfjs');
        await tf.setBackend('cpu');
        await tf.ready();
        return tf;
      } catch (fallbackError) {
        console.warn('Failed to load TensorFlow.js CPU backend:', fallbackError);
        return null;
      }
    }
  }
  
  return null;
};

// Convert various image formats to tensor
export const imageToTensor = async (input, tf) => {
  if (!tf) return null;
  
  const features = checkFeatures();
  
  // If input is already a tensor, return it
  if (input instanceof tf.Tensor) {
    return input;
  }
  
  // Browser: Handle ImageData, HTMLImageElement, etc.
  if (features.isBrowser) {
    if (input instanceof ImageData) {
      return tf.browser.fromPixels(input);
    }
    if (input instanceof HTMLImageElement || 
        input instanceof HTMLCanvasElement || 
        input instanceof HTMLVideoElement) {
      return tf.browser.fromPixels(input);
    }
  }
  
  // Node.js: Handle Buffer
  if (features.isNode) {
    if (Buffer.isBuffer(input)) {
      // Decode image buffer
      const decoded = tf.node.decodeImage(input);
      return decoded;
    }
    
    if (typeof input === 'string') {
      // If it's a base64 string, decode it
      if (input.startsWith('data:image')) {
        const base64 = input.split(',')[1];
        const buffer = Buffer.from(base64, 'base64');
        return tf.node.decodeImage(buffer);
      }
    }
  }
  
  // Handle raw pixel data
  if (input.data && input.width && input.height) {
    const { data, width, height } = input;
    return tf.tensor3d(data, [height, width, 4], 'int32');
  }
  
  throw new Error('Unsupported image input format');
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