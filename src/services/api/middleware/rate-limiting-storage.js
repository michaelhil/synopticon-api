/**
 * Storage management for rate limiting
 */

export const createRateLimitStorage = (windowMs) => {
  // Storage for different algorithms
  const storage = {
    fixedWindow: new Map(),    // key -> { count, resetTime }
    slidingWindow: new Map(),  // key -> { requests: Array<timestamp> }
    tokenBucket: new Map()     // key -> { tokens, lastRefill }
  };

  /**
   * Remove rate limit data for a client
   * @param {string} key - Client identifier
   */
  const resetClient = (key) => {
    storage.fixedWindow.delete(key);
    storage.slidingWindow.delete(key);
    storage.tokenBucket.delete(key);
    console.log(`🧹 Reset rate limit data for client: ${key}`);
  };

  /**
   * Clean up old rate limit data
   */
  const cleanup = (maxRequests) => {
    const now = Date.now();
    let cleaned = 0;
    
    // Clean fixed window storage
    for (const [key, record] of storage.fixedWindow.entries()) {
      if (now > record.resetTime + windowMs) {
        storage.fixedWindow.delete(key);
        cleaned++;
      }
    }
    
    // Clean sliding window storage
    for (const [key, record] of storage.slidingWindow.entries()) {
      record.requests = record.requests.filter(
        timestamp => timestamp > now - windowMs
      );
      if (record.requests.length === 0) {
        storage.slidingWindow.delete(key);
        cleaned++;
      }
    }
    
    // Clean token bucket storage (remove buckets with full tokens and no recent activity)
    for (const [key, bucket] of storage.tokenBucket.entries()) {
      if (bucket.tokens >= maxRequests && 
          now - bucket.lastRefill > windowMs * 2) {
        storage.tokenBucket.delete(key);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      console.log(`🧹 Cleaned up ${cleaned} old rate limit records`);
    }
  };

  /**
   * Get storage size information
   * @returns {Object} Storage sizes
   */
  const getStorageSize = () => {
    return {
      fixedWindow: storage.fixedWindow.size,
      slidingWindow: storage.slidingWindow.size,
      tokenBucket: storage.tokenBucket.size
    };
  };

  return {
    storage,
    resetClient,
    cleanup,
    getStorageSize
  };
};