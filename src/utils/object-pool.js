/**
 * Object Pool Utility
 * Provides object pooling for performance optimization and memory management
 */

/**
 * Creates an object pool for reusing objects to reduce garbage collection
 * @param {Function} createFn - Function that creates new objects
 * @param {Function} resetFn - Function that resets objects for reuse
 * @param {number} maxSize - Maximum pool size
 * @returns {Object} - Object pool interface
 */
export const createObjectPool = (createFn, resetFn, maxSize = 100) => {
  const pool = [];
  let created = 0;
  let reused = 0;
  let released = 0;

  const acquire = () => {
    if (pool.length > 0) {
      reused++;
      return pool.pop();
    } else {
      created++;
      return createFn();
    }
  };

  const release = (obj) => {
    if (pool.length < maxSize) {
      if (resetFn) {
        resetFn(obj);
      }
      pool.push(obj);
      released++;
    }
  };

  const getStats = () => ({
    poolSize: pool.length,
    created,
    reused,
    released,
    efficiency: reused / (created + reused)
  });

  const clear = () => {
    pool.length = 0;
    created = 0;
    reused = 0;
    released = 0;
  };

  return {
    acquire,
    release,
    getStats,
    clear,
    get size() { return pool.length; }
  };
};