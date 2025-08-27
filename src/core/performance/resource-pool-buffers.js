/**
 * Buffer Resource Management
 * Handles image buffers and typed arrays pooling
 */

export const createBufferManager = (state, poolConfig) => {
  const getImageBuffer = (width, height, channels = 4) => {
    const size = width * height * channels;
    const sizeKey = `${width}x${height}x${channels}`;
    const bufferPool = state.imageBufferPool.get(sizeKey) || [];
    
    let buffer = bufferPool.pop();
    
    if (!buffer) {
      buffer = new Uint8Array(size);
      state.metricsData.buffersCreated++;
    } else {
      // Clear buffer data
      buffer.fill(0);
      state.metricsData.buffersReused++;
    }
    
    state.metricsData.totalAllocations++;
    return buffer;
  };
  
  const returnImageBuffer = (buffer, width, height, channels = 4) => {
    if (!buffer) return;
    
    const sizeKey = `${width}x${height}x${channels}`;
    const bufferPool = state.imageBufferPool.get(sizeKey) || [];
    
    if (bufferPool.length < poolConfig.maxImageBuffers) {
      bufferPool.push(buffer);
      state.imageBufferPool.set(sizeKey, bufferPool);
    }
    
    state.metricsData.totalDeallocations++;
  };
  
  const getTypedArray = (type = 'Float32Array', size) => {
    const poolKey = `${type}_${size}`;
    const arrayPool = state.typedArrayPool.get(poolKey) || [];
    
    let array = arrayPool.pop();
    
    if (!array) {
      const ArrayConstructor = globalThis[type];
      if (!ArrayConstructor) {
        throw new Error(`Unknown typed array type: ${type}`);
      }
      array = new ArrayConstructor(size);
      state.metricsData.buffersCreated++;
    } else {
      // Clear array data
      array.fill(0);
      state.metricsData.buffersReused++;
    }
    
    state.metricsData.totalAllocations++;
    return array;
  };
  
  const returnTypedArray = (array, type) => {
    if (!array) return;
    
    const poolKey = `${type}_${array.length}`;
    const arrayPool = state.typedArrayPool.get(poolKey) || [];
    
    if (arrayPool.length < poolConfig.maxTypedArrays) {
      arrayPool.push(array);
      state.typedArrayPool.set(poolKey, arrayPool);
    }
    
    state.metricsData.totalDeallocations++;
  };
  
  return { 
    getImageBuffer, 
    returnImageBuffer, 
    getTypedArray, 
    returnTypedArray 
  };
};