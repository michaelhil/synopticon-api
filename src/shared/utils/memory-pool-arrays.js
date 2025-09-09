/**
 * Typed array management for memory pool
 */

export const createArrayManager = (state, factoryManager) => {

  // Acquire typed array
  const acquireArray = (type, size) => {
    const key = `${type}_${size}`;
    const pool = state.pools.arrays.get(key) || [];
    
    let array;
    if (pool.length > 0) {
      array = pool.pop();
      state.stats.reuseHits++;
      
      // Clear array for reuse
      array.fill(0);
    } else {
      // Create new array
      const factory = factoryManager.getFactory(type);
      if (!factory) {
        switch (type) {
        case 'Float32Array':
          array = new Float32Array(size);
          break;
        case 'Uint8Array':
          array = new Uint8Array(size);
          break;
        case 'Uint16Array':
          array = new Uint16Array(size);
          break;
        default:
          throw new Error(`Unsupported array type: ${type}`);
        }
      } else {
        array = factory(size);
      }
      
      state.stats.allocations++;
    }
    
    // Track array
    if (state.config.enableTracking) {
      state.objectMetadata.set(array, {
        type: 'Array',
        subtype: type,
        size,
        acquiredAt: Date.now(),
        poolKey: key
      });
    }
    
    return array;
  };

  // Release typed array
  const releaseArray = (array) => {
    if (!array) return;
    
    const metadata = state.objectMetadata.get(array);
    if (!metadata) {
      console.warn('Attempting to release untracked array');
      return;
    }
    
    const { poolKey } = metadata;
    const pool = state.pools.arrays.get(poolKey) || [];
    
    // Check pool size limit
    if (pool.length < state.config.maxPoolSize) {
      pool.push(array);
      
      if (!state.pools.arrays.has(poolKey)) {
        state.pools.arrays.set(poolKey, pool);
      }
      
      state.stats.deallocations++;
    }
    
    // Remove from tracking
    if (state.config.enableTracking) {
      state.objectMetadata.delete(array);
    }
  };

  // Acquire Float32Array (convenience method)
  const acquireFloat32Array = (size) => acquireArray('Float32Array', size);
  
  // Acquire Uint8Array (convenience method)
  const acquireUint8Array = (size) => acquireArray('Uint8Array', size);
  
  // Get array pool statistics
  const getArrayPoolStats = () => {
    const arrayStats = {};
    for (const [key, pool] of state.pools.arrays.entries()) {
      arrayStats[key] = {
        poolSize: pool.length,
        available: pool.length
      };
    }
    return arrayStats;
  };

  return {
    acquireArray,
    releaseArray,
    acquireFloat32Array,
    acquireUint8Array,
    getArrayPoolStats
  };
};
