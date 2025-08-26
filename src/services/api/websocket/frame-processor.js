/**
 * WebSocket Frame Processor
 * Specialized frame decoding and processing utilities for WebSocket streams
 */

/**
 * Enhanced frame processor for WebSocket streams
 * @param {Object} config - Configuration options
 * @returns {Object} Frame processor instance
 */
export const createWebSocketFrameProcessor = (config = {}) => {
  const state = {
    config: {
      maxFrameSize: config.maxFrameSize || 10 * 1024 * 1024, // 10MB
      supportedFormats: config.supportedFormats || ['jpeg', 'png', 'webp'],
      enableCompression: config.enableCompression !== false,
      enableCaching: config.enableCaching !== false,
      cacheSize: config.cacheSize || 50,
      ...config
    },
    frameCache: new Map(), // For frame caching optimization
    stats: {
      framesProcessed: 0,
      bytesProcessed: 0,
      cacheHits: 0,
      cacheMisses: 0,
      errors: 0,
      averageProcessingTime: 0
    }
  };

  /**
   * Generate frame hash for caching
   * @param {ArrayBuffer|Uint8Array} data - Frame data
   * @returns {string} Hash string
   */
  const generateFrameHash = (data) => {
    const bytes = data instanceof ArrayBuffer ? new Uint8Array(data) : data;
    let hash = 0;
    
    // Simple hash for performance - sample every 100th byte for large frames
    const step = Math.max(1, Math.floor(bytes.length / 1000));
    
    for (let i = 0; i < bytes.length; i += step) {
      hash = ((hash << 5) - hash + bytes[i]) & 0xffffffff;
    }
    
    return hash.toString(16);
  };

  /**
   * Decode base64 data URL frame
   * @param {string} dataUrl - Data URL string
   * @returns {Object} Decoded frame data
   */
  const decodeDataUrl = (dataUrl) => {
    try {
      // Extract format and base64 data
      const match = dataUrl.match(/^data:image\/([^;]+);base64,(.+)$/);
      if (!match) {
        throw new Error('Invalid data URL format');
      }

      const [, format, base64Data] = match;
      
      // Validate format
      if (!state.config.supportedFormats.includes(format.toLowerCase())) {
        throw new Error(`Unsupported image format: ${format}`);
      }

      // Decode base64
      const binaryString = atob(base64Data);
      const uint8Array = new Uint8Array(binaryString.length);
      
      for (let i = 0; i < binaryString.length; i++) {
        uint8Array[i] = binaryString.charCodeAt(i);
      }

      // Check size limits
      if (uint8Array.length > state.config.maxFrameSize) {
        throw new Error(`Frame size ${uint8Array.length} exceeds limit ${state.config.maxFrameSize}`);
      }

      return {
        data: uint8Array,
        format,
        size: uint8Array.length,
        width: null, // Will be determined by image processor
        height: null
      };
      
    } catch (error) {
      state.stats.errors++;
      throw new Error(`Data URL decoding failed: ${error.message}`);
    }
  };

  /**
   * Decode binary frame data
   * @param {ArrayBuffer|Uint8Array} binaryData - Binary frame data
   * @param {Object} metadata - Optional metadata
   * @returns {Object} Decoded frame data
   */
  const decodeBinaryFrame = (binaryData, metadata = {}) => {
    try {
      const uint8Array = binaryData instanceof ArrayBuffer ? new Uint8Array(binaryData) : binaryData;
      
      // Check size limits
      if (uint8Array.length > state.config.maxFrameSize) {
        throw new Error(`Frame size ${uint8Array.length} exceeds limit ${state.config.maxFrameSize}`);
      }

      // Try to detect format from magic bytes
      let format = metadata.format || 'unknown';
      if (uint8Array.length >= 4) {
        // JPEG magic bytes
        if (uint8Array[0] === 0xFF && uint8Array[1] === 0xD8) {
          format = 'jpeg';
        }
        // PNG magic bytes
        else if (uint8Array[0] === 0x89 && uint8Array[1] === 0x50 && 
                 uint8Array[2] === 0x4E && uint8Array[3] === 0x47) {
          format = 'png';
        }
        // WebP magic bytes (RIFF...WEBP)
        else if (uint8Array[0] === 0x52 && uint8Array[1] === 0x49 && 
                 uint8Array[2] === 0x46 && uint8Array[3] === 0x46 &&
                 uint8Array[8] === 0x57 && uint8Array[9] === 0x45 && 
                 uint8Array[10] === 0x42 && uint8Array[11] === 0x50) {
          format = 'webp';
        }
      }

      return {
        data: uint8Array,
        format,
        size: uint8Array.length,
        width: metadata.width || null,
        height: metadata.height || null,
        timestamp: metadata.timestamp || Date.now()
      };
      
    } catch (error) {
      state.stats.errors++;
      throw new Error(`Binary frame decoding failed: ${error.message}`);
    }
  };

  /**
   * Process frame with caching
   * @param {*} frameData - Frame data (various formats)
   * @param {Object} options - Processing options
   * @returns {Object} Processed frame data
   */
  const processFrame = (frameData, options = {}) => {
    const startTime = Date.now();
    let processedFrame;
    
    try {
      // Handle different input formats
      if (typeof frameData === 'string') {
        if (frameData.startsWith('data:image')) {
          processedFrame = decodeDataUrl(frameData);
        } else {
          throw new Error('Unsupported string frame format');
        }
      } else if (frameData instanceof ArrayBuffer || frameData instanceof Uint8Array) {
        processedFrame = decodeBinaryFrame(frameData, options);
      } else if (frameData && typeof frameData === 'object') {
        // Already processed frame data
        processedFrame = {
          data: frameData.data,
          format: frameData.format || 'unknown',
          size: frameData.size || (frameData.data ? frameData.data.length : 0),
          width: frameData.width,
          height: frameData.height,
          timestamp: frameData.timestamp || Date.now()
        };
      } else {
        throw new Error('Invalid frame data type');
      }

      // Cache processing if enabled
      if (state.config.enableCaching && processedFrame.data) {
        const hash = generateFrameHash(processedFrame.data);
        
        if (state.frameCache.has(hash)) {
          state.stats.cacheHits++;
          const cached = state.frameCache.get(hash);
          processedFrame.cached = true;
          processedFrame.cacheHit = true;
          processedFrame = { ...processedFrame, ...cached.metadata };
        } else {
          state.stats.cacheMisses++;
          
          // Add to cache if not full
          if (state.frameCache.size < state.config.cacheSize) {
            state.frameCache.set(hash, {
              metadata: {
                format: processedFrame.format,
                size: processedFrame.size,
                processedAt: Date.now()
              }
            });
          }
        }
      }

      // Update statistics
      state.stats.framesProcessed++;
      state.stats.bytesProcessed += processedFrame.size;
      
      const processingTime = Date.now() - startTime;
      state.stats.averageProcessingTime = 
        (state.stats.averageProcessingTime * (state.stats.framesProcessed - 1) + processingTime) / 
        state.stats.framesProcessed;

      return processedFrame;
      
    } catch (error) {
      state.stats.errors++;
      console.error('Frame processing error:', error);
      throw error;
    }
  };

  /**
   * Validate frame data
   * @param {Object} frameData - Frame data to validate
   * @returns {Object} Validation result
   */
  const validateFrame = (frameData) => {
    const issues = [];
    const warnings = [];

    if (!frameData) {
      issues.push('Frame data is null or undefined');
      return { valid: false, issues, warnings };
    }

    if (!frameData.data) {
      issues.push('Frame data missing data property');
    }

    if (!frameData.size || frameData.size <= 0) {
      warnings.push('Frame size is zero or undefined');
    }

    if (frameData.size > state.config.maxFrameSize) {
      issues.push(`Frame size ${frameData.size} exceeds maximum ${state.config.maxFrameSize}`);
    }

    if (frameData.format && !state.config.supportedFormats.includes(frameData.format)) {
      warnings.push(`Frame format '${frameData.format}' may not be supported`);
    }

    return {
      valid: issues.length === 0,
      issues,
      warnings
    };
  };

  /**
   * Clear frame cache
   */
  const clearCache = () => {
    state.frameCache.clear();
    console.log('🧹 Frame cache cleared');
  };

  /**
   * Get processing statistics
   * @returns {Object} Processing statistics
   */
  const getStatistics = () => {
    return {
      ...state.stats,
      cacheSize: state.frameCache.size,
      cacheHitRate: state.stats.cacheHits / Math.max(state.stats.cacheHits + state.stats.cacheMisses, 1),
      averageFrameSize: state.stats.bytesProcessed / Math.max(state.stats.framesProcessed, 1),
      timestamp: Date.now()
    };
  };

  /**
   * Cleanup processor resources
   */
  const cleanup = () => {
    clearCache();
    
    // Reset statistics
    state.stats = {
      framesProcessed: 0,
      bytesProcessed: 0,
      cacheHits: 0,
      cacheMisses: 0,
      errors: 0,
      averageProcessingTime: 0
    };
    
    console.log('🧹 Frame processor cleanup completed');
  };

  return {
    processFrame,
    validateFrame,
    clearCache,
    getStatistics,
    cleanup,
    
    // Direct decoders (for specialized use)
    decodeDataUrl,
    decodeBinaryFrame,
    
    // Configuration access
    getConfig: () => ({ ...state.config }),
    updateConfig: (updates) => {
      state.config = { ...state.config, ...updates };
    }
  };
};