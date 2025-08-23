/**
 * Camera Management - Webcam access and frame processing utilities
 */

export const createCameraManager = () => {
  const state = {
    stream: null,
    video: null,
    canvas: null,
    context: null,
    isInitialized: false,
    frameCallbacks: [],
    animationFrameId: null
  };

  const initialize = async (constraints = {}) => {
    // Default camera constraints optimized for face detection
    const defaultConstraints = {
      video: {
        width: { ideal: 640, max: 1280 },
        height: { ideal: 480, max: 720 },
        frameRate: { ideal: 30, max: 60 },
        facingMode: 'user'
      },
      audio: false
    };

    const finalConstraints = {
      ...defaultConstraints,
      ...constraints
    };

    try {
      // Request camera access
      state.stream = await navigator.mediaDevices.getUserMedia(finalConstraints);
      
      // Create video element
      state.video = document.createElement('video');
      state.video.srcObject = state.stream;
      state.video.playsInline = true;
      state.video.muted = true;
      
      // Wait for video to be ready
      await new Promise((resolve, reject) => {
        state.video.onloadedmetadata = () => {
          console.log(`Video metadata loaded: ${state.video.videoWidth}x${state.video.videoHeight}`);
          state.video.play().then(() => {
            console.log('Video playing, readyState:', state.video.readyState);
            resolve();
          }).catch(reject);
        };
        state.video.onerror = reject;
      });

      // Create canvas for frame extraction
      state.canvas = document.createElement('canvas');
      state.canvas.width = state.video.videoWidth || 640;
      state.canvas.height = state.video.videoHeight || 480;
      state.context = state.canvas.getContext('2d');
      
      if (!state.context) {
        throw new Error('Failed to get 2D canvas context for camera');
      }

      state.isInitialized = true;
      console.log(`Camera initialized: ${state.canvas.width}x${state.canvas.height}`);
      
    } catch (error) {
      throw new Error(`Camera initialization failed: ${error.message}`);
    }
  };

  const getFrame = () => {
    // Performance optimization: Remove expensive console logging
    // Debug logging can be enabled via environment flag if needed
    
    if (!state.isInitialized) {
      throw new Error('Camera not initialized');
    }

    if (!state.context) {
      throw new Error('Canvas context is null - camera not properly initialized');
    }

    if (!state.video || state.video.readyState < 2) {
      throw new Error('Video not ready - readyState: ' + (state.video ? state.video.readyState : 'null'));
    }

    try {
      // Draw current video frame to canvas (optimized)
      state.context.drawImage(state.video, 0, 0, state.canvas.width, state.canvas.height);
      
      // Get image data
      const imageData = state.context.getImageData(0, 0, state.canvas.width, state.canvas.height);
      
      return {
        data: imageData.data,
        width: state.canvas.width,
        height: state.canvas.height,
        canvas: state.canvas
      };
    } catch (error) {
      console.error('Draw image failed:', error);
      throw new Error(`Failed to get frame: ${error.message}`);
    }
  };

  const startFrameProcessing = () => {
    if (state.animationFrameId) {
      return; // Already running
    }

    const processFrame = () => {
      if (state.isInitialized && state.frameCallbacks.length > 0) {
        const frame = getFrame();
        
        // Call all registered callbacks
        state.frameCallbacks.forEach(callback => {
          try {
            callback(frame);
          } catch (error) {
            console.error('Frame callback error:', error);
          }
        });
      }
      
      state.animationFrameId = requestAnimationFrame(processFrame);
    };

    processFrame();
  };

  const stopFrameProcessing = () => {
    if (state.animationFrameId) {
      cancelAnimationFrame(state.animationFrameId);
      state.animationFrameId = null;
    }
  };

  const onFrame = (callback) => {
    state.frameCallbacks.push(callback);
    return () => {
      const index = state.frameCallbacks.indexOf(callback);
      if (index > -1) {
        state.frameCallbacks.splice(index, 1);
      }
    };
  };

  const getVideoElement = () => {
    return state.video;
  };

  const getCanvas = () => {
    return state.canvas;
  };

  const getStreamInfo = () => {
    if (!state.stream) return null;
    
    const videoTrack = state.stream.getVideoTracks()[0];
    if (!videoTrack) return null;
    
    return {
      settings: videoTrack.getSettings(),
      capabilities: videoTrack.getCapabilities(),
      constraints: videoTrack.getConstraints()
    };
  };

  const switchCamera = async (facingMode = 'user') => {
    if (!state.isInitialized) {
      throw new Error('Camera not initialized');
    }

    // Stop current stream
    cleanup();
    
    // Initialize with new facing mode
    await initialize({
      video: { facingMode }
    });
  };

  const cleanup = () => {
    // Stop frame processing
    stopFrameProcessing();
    
    // Stop video stream
    if (state.stream) {
      state.stream.getTracks().forEach(track => {
        track.stop();
      });
      state.stream = null;
    }

    // Clean up video element
    if (state.video) {
      state.video.srcObject = null;
      state.video = null;
    }

    // Clean up canvas
    state.canvas = null;
    state.context = null;
    
    state.isInitialized = false;
    state.frameCallbacks = [];
  };

  return {
    initialize,
    getFrame,
    startFrameProcessing,
    stopFrameProcessing,
    onFrame,
    getVideoElement,
    getCanvas,
    getStreamInfo,
    switchCamera,
    cleanup
  };
};

/**
 * Frame processing utilities
 */
export const FrameProcessor = {
  rgbaToTexture: (data, width, height) => {
    // Convert RGBA Uint8ClampedArray to Float32Array for WebGL
    const floatData = new Float32Array(data.length);
    for (let i = 0; i < data.length; i++) {
      floatData[i] = data[i] / 255.0;
    }
    return floatData;
  },

  extractChannel: (data, width, height, channel = 0) => {
    // Extract single channel from RGBA data
    const channelData = new Float32Array(width * height);
    for (let i = 0; i < width * height; i++) {
      channelData[i] = data[i * 4 + channel] / 255.0;
    }
    return channelData;
  },

  rgbToGrayscale: (data, width, height) => {
    // Convert RGB to grayscale using luminance formula
    const grayscaleData = new Float32Array(width * height);
    for (let i = 0; i < width * height; i++) {
      const r = data[i * 4] / 255.0;
      const g = data[i * 4 + 1] / 255.0;
      const b = data[i * 4 + 2] / 255.0;
      grayscaleData[i] = 0.299 * r + 0.587 * g + 0.114 * b;
    }
    return grayscaleData;
  },

  normalizeFrame: (data, width, height) => {
    // Normalize frame data to [0, 1] range
    const normalized = new Float32Array(data.length);
    let min = Infinity;
    let max = -Infinity;
    
    // Find min/max
    for (let i = 0; i < data.length; i++) {
      min = Math.min(min, data[i]);
      max = Math.max(max, data[i]);
    }
    
    // Normalize
    const range = max - min;
    if (range > 0) {
      for (let i = 0; i < data.length; i++) {
        normalized[i] = (data[i] - min) / range;
      }
    }
    
    return normalized;
  },

  resizeFrame: (data, srcWidth, srcHeight, dstWidth, dstHeight) => {
    // Simple bilinear interpolation resize
    const resized = new Float32Array(dstWidth * dstHeight * 4);
    const xRatio = srcWidth / dstWidth;
    const yRatio = srcHeight / dstHeight;
    
    for (let y = 0; y < dstHeight; y++) {
      for (let x = 0; x < dstWidth; x++) {
        const srcX = x * xRatio;
        const srcY = y * yRatio;
        
        const x1 = Math.floor(srcX);
        const y1 = Math.floor(srcY);
        const x2 = Math.min(x1 + 1, srcWidth - 1);
        const y2 = Math.min(y1 + 1, srcHeight - 1);
        
        const dx = srcX - x1;
        const dy = srcY - y1;
        
        const dstIdx = (y * dstWidth + x) * 4;
        
        for (let c = 0; c < 4; c++) {
          const tl = data[(y1 * srcWidth + x1) * 4 + c];
          const tr = data[(y1 * srcWidth + x2) * 4 + c];
          const bl = data[(y2 * srcWidth + x1) * 4 + c];
          const br = data[(y2 * srcWidth + x2) * 4 + c];
          
          const top = tl + (tr - tl) * dx;
          const bottom = bl + (br - bl) * dx;
          resized[dstIdx + c] = top + (bottom - top) * dy;
        }
      }
    }
    
    return resized;
  }
};