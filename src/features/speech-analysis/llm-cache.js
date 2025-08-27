/**
 * Caching system for LLM responses
 */

export const createLLMCache = (maxSize = 100, compressionEnabled = false) => {
  const cache = new Map();
  
  // Generate cache key from prompt components
  const generateCacheKey = (prompt, text, systemPrompt) => {
    const combined = `${prompt}|${text}|${systemPrompt || ''}`;
    
    if (compressionEnabled) {
      // Simple hash function for compression
      let hash = 0;
      for (let i = 0; i < combined.length; i++) {
        const char = combined.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
      }
      return hash.toString(36);
    }
    
    return combined;
  };
  
  // Get cached response
  const get = (prompt, text, systemPrompt) => {
    const key = generateCacheKey(prompt, text, systemPrompt);
    const cached = cache.get(key);
    
    if (cached) {
      // Update access time
      cached.lastAccessed = Date.now();
      return cached.response;
    }
    
    return null;
  };
  
  // Store response in cache
  const set = (prompt, text, systemPrompt, response) => {
    const key = generateCacheKey(prompt, text, systemPrompt);
    
    // If cache is full, remove least recently used item
    if (cache.size >= maxSize) {
      let oldestKey = null;
      let oldestTime = Date.now();
      
      for (const [cacheKey, cacheValue] of cache.entries()) {
        if (cacheValue.lastAccessed < oldestTime) {
          oldestTime = cacheValue.lastAccessed;
          oldestKey = cacheKey;
        }
      }
      
      if (oldestKey) {
        cache.delete(oldestKey);
      }
    }
    
    cache.set(key, {
      response,
      created: Date.now(),
      lastAccessed: Date.now()
    });
  };
  
  // Check if response is cached
  const has = (prompt, text, systemPrompt) => {
    const key = generateCacheKey(prompt, text, systemPrompt);
    return cache.has(key);
  };
  
  // Clear cache
  const clear = () => {
    cache.clear();
  };
  
  // Get cache statistics
  const getStats = () => ({
    size: cache.size,
    maxSize,
    compressionEnabled,
    memoryUsage: cache.size * 200 // Rough estimate in bytes
  });
  
  // Clean old entries
  const cleanOldEntries = (maxAge = 3600000) => { // 1 hour default
    const now = Date.now();
    let cleaned = 0;
    
    for (const [key, value] of cache.entries()) {
      if (now - value.lastAccessed > maxAge) {
        cache.delete(key);
        cleaned++;
      }
    }
    
    return cleaned;
  };
  
  return {
    get,
    set,
    has,
    clear,
    getStats,
    cleanOldEntries,
    generateCacheKey
  };
};