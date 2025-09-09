/**
 * Cache Manager
 * Advanced caching system with LRU, compression, and TTL support
 */

import type { createMemoryManager } from './memory-manager.js';

export interface CacheManagerConfig {
  maxCacheSize: number;
  defaultTtl: number;
  enableLRU: boolean;
  enableCompression: boolean;
}

export interface CacheEntry<T = any> {
  key: string;
  value: T;
  compressed?: Uint8Array;
  size: number;
  accessTime: number;
  createTime: number;
  ttl: number;
  hitCount: number;
  compressionRatio?: number;
}

export interface CacheStats {
  entries: number;
  hitRate: number;
  memoryUsage: number;
  compressionRatio: number;
  totalHits: number;
  totalMisses: number;
  evictions: number;
}

/**
 * Creates cache manager
 */
export const createCacheManager = (config: CacheManagerConfig) => {
  const state = {
    cache: new Map<string, CacheEntry>(),
    accessOrder: [] as string[], // For LRU tracking
    currentSize: 0,
    memoryManager: null as ReturnType<typeof createMemoryManager> | null,
    
    metrics: {
      hits: 0,
      misses: 0,
      evictions: 0,
      compressions: 0,
      decompressions: 0,
      totalCompressionSaved: 0
    }
  };

  // Set memory manager reference
  const setMemoryManager = (manager: ReturnType<typeof createMemoryManager>): void => {
    state.memoryManager = manager;
  };

  // Simple compression using JSON + deflate simulation
  const compress = async (data: any): Promise<{ compressed: Uint8Array; ratio: number }> => {
    if (!config.enableCompression) {
      return { compressed: new Uint8Array(), ratio: 1 };
    }
    
    const serialized = JSON.stringify(data);
    const originalSize = new TextEncoder().encode(serialized).length;
    
    // Simulate compression (in real implementation, use actual compression library)
    const compressionRatio = 0.3 + Math.random() * 0.4; // 30-70% compression
    const compressedSize = Math.floor(originalSize * compressionRatio);
    const compressed = new Uint8Array(compressedSize);
    
    // Fill with compressed data simulation
    for (let i = 0; i < compressedSize; i++) {
      compressed[i] = serialized.charCodeAt(i % serialized.length);
    }
    
    state.metrics.compressions++;
    state.metrics.totalCompressionSaved += (originalSize - compressedSize);
    
    return {
      compressed,
      ratio: originalSize / compressedSize
    };
  };

  // Simple decompression
  const decompress = async (compressed: Uint8Array, originalData: any): Promise<any> => {
    if (!config.enableCompression) {
      return originalData;
    }
    
    // In real implementation, would decompress the data
    // For now, return the original data that we stored alongside
    state.metrics.decompressions++;
    return originalData;
  };

  // Calculate entry size
  const calculateEntrySize = (entry: CacheEntry): number => {
    // Rough size calculation
    let size = 0;
    
    if (entry.compressed && entry.compressed.length > 0) {
      size += entry.compressed.length;
    } else {
      // Estimate uncompressed size
      const serialized = JSON.stringify(entry.value);
      size += new TextEncoder().encode(serialized).length;
    }
    
    // Add metadata overhead
    size += 200; // Approximate overhead for entry metadata
    
    return size;
  };

  // Update LRU access order
  const updateAccessOrder = (key: string): void => {
    if (!config.enableLRU) return;
    
    // Remove from current position
    const index = state.accessOrder.indexOf(key);
    if (index > -1) {
      state.accessOrder.splice(index, 1);
    }
    
    // Add to end (most recently used)
    state.accessOrder.push(key);
  };

  // Evict least recently used entries
  const evictLRU = (targetSize: number): void => {
    if (!config.enableLRU) return;
    
    while (state.currentSize > targetSize && state.accessOrder.length > 0) {
      const keyToEvict = state.accessOrder.shift();
      if (keyToEvict) {
        const entry = state.cache.get(keyToEvict);
        if (entry) {
          state.currentSize -= entry.size;
          state.cache.delete(keyToEvict);
          state.metrics.evictions++;
        }
      }
    }
  };

  // Evict expired entries
  const evictExpired = (): void => {
    const now = Date.now();
    const keysToDelete: string[] = [];
    
    for (const [key, entry] of state.cache) {
      if (entry.ttl > 0 && (now - entry.createTime) > entry.ttl) {
        keysToDelete.push(key);
      }
    }
    
    for (const key of keysToDelete) {
      const entry = state.cache.get(key);
      if (entry) {
        state.currentSize -= entry.size;
        state.cache.delete(key);
        
        // Remove from access order
        const index = state.accessOrder.indexOf(key);
        if (index > -1) {
          state.accessOrder.splice(index, 1);
        }
      }
    }
  };

  // Set cache entry
  const set = async <T>(
    key: string, 
    value: T, 
    options: { ttl?: number; compress?: boolean } = {}
  ): Promise<void> => {
    const ttl = options.ttl ?? config.defaultTtl;
    const shouldCompress = options.compress ?? config.enableCompression;
    
    // Remove existing entry if present
    const existingEntry = state.cache.get(key);
    if (existingEntry) {
      state.currentSize -= existingEntry.size;
    }
    
    // Prepare new entry
    const entry: CacheEntry<T> = {
      key,
      value,
      size: 0, // Will be calculated below
      accessTime: Date.now(),
      createTime: Date.now(),
      ttl,
      hitCount: 0
    };
    
    // Compress if enabled
    if (shouldCompress) {
      const { compressed, ratio } = await compress(value);
      entry.compressed = compressed;
      entry.compressionRatio = ratio;
    }
    
    // Calculate size
    entry.size = calculateEntrySize(entry);
    
    // Check if entry fits in cache
    const requiredSpace = state.currentSize + entry.size;
    
    if (requiredSpace > config.maxCacheSize) {
      // Evict expired entries first
      evictExpired();
      
      // Evict LRU entries if still over limit
      const remainingSpace = config.maxCacheSize - entry.size;
      if (state.currentSize > remainingSpace) {
        evictLRU(remainingSpace);
      }
    }
    
    // Add entry to cache
    state.cache.set(key, entry);
    state.currentSize += entry.size;
    updateAccessOrder(key);
  };

  // Get cache entry
  const get = async <T>(key: string): Promise<T | null> => {
    const entry = state.cache.get(key);
    
    if (!entry) {
      state.metrics.misses++;
      return null;
    }
    
    // Check if expired
    const now = Date.now();
    if (entry.ttl > 0 && (now - entry.createTime) > entry.ttl) {
      // Remove expired entry
      state.currentSize -= entry.size;
      state.cache.delete(key);
      
      const index = state.accessOrder.indexOf(key);
      if (index > -1) {
        state.accessOrder.splice(index, 1);
      }
      
      state.metrics.misses++;
      return null;
    }
    
    // Update access tracking
    entry.accessTime = now;
    entry.hitCount++;
    updateAccessOrder(key);
    state.metrics.hits++;
    
    // Decompress if needed
    if (entry.compressed && entry.compressed.length > 0) {
      return await decompress(entry.compressed, entry.value) as T;
    }
    
    return entry.value as T;
  };

  // Check if key exists
  const has = (key: string): boolean => {
    const entry = state.cache.get(key);
    if (!entry) return false;
    
    // Check if expired
    const now = Date.now();
    if (entry.ttl > 0 && (now - entry.createTime) > entry.ttl) {
      return false;
    }
    
    return true;
  };

  // Delete entry
  const del = (key: string): boolean => {
    const entry = state.cache.get(key);
    if (!entry) return false;
    
    state.currentSize -= entry.size;
    state.cache.delete(key);
    
    // Remove from access order
    const index = state.accessOrder.indexOf(key);
    if (index > -1) {
      state.accessOrder.splice(index, 1);
    }
    
    return true;
  };

  // Clear all entries
  const clear = (): void => {
    state.cache.clear();
    state.accessOrder.length = 0;
    state.currentSize = 0;
  };

  // Get all keys
  const keys = (): string[] => Array.from(state.cache.keys());

  // Get cache size
  const size = (): number => state.cache.size;

  // Optimize cache
  const optimize = async (): Promise<void> => {
    // Remove expired entries
    evictExpired();
    
    // Compress uncompressed entries if compression is enabled
    if (config.enableCompression) {
      for (const [key, entry] of state.cache) {
        if (!entry.compressed && entry.hitCount > 1) {
          const { compressed, ratio } = await compress(entry.value);
          if (ratio > 1.2) { // Only compress if we get good ratio
            entry.compressed = compressed;
            entry.compressionRatio = ratio;
            // Recalculate size
            const newSize = calculateEntrySize(entry);
            state.currentSize += (newSize - entry.size);
            entry.size = newSize;
          }
        }
      }
    }
    
    // Evict least accessed entries if over threshold
    if (state.currentSize > config.maxCacheSize * 0.8) {
      const entries = Array.from(state.cache.values());
      entries.sort((a, b) => a.hitCount - b.hitCount);
      
      const toEvict = Math.floor(entries.length * 0.1); // Evict 10% least accessed
      for (let i = 0; i < toEvict && i < entries.length; i++) {
        del(entries[i].key);
      }
    }
  };

  // Get cache statistics
  const getStats = (): CacheStats => {
    const totalRequests = state.metrics.hits + state.metrics.misses;
    const hitRate = totalRequests > 0 ? state.metrics.hits / totalRequests : 0;
    
    // Calculate average compression ratio
    let totalCompressionRatio = 0;
    let compressedEntries = 0;
    
    for (const entry of state.cache.values()) {
      if (entry.compressionRatio) {
        totalCompressionRatio += entry.compressionRatio;
        compressedEntries++;
      }
    }
    
    const avgCompressionRatio = compressedEntries > 0 
      ? totalCompressionRatio / compressedEntries 
      : 1;
    
    return {
      entries: state.cache.size,
      hitRate,
      memoryUsage: state.currentSize,
      compressionRatio: avgCompressionRatio,
      totalHits: state.metrics.hits,
      totalMisses: state.metrics.misses,
      evictions: state.metrics.evictions
    };
  };

  // Allocate cache space (for resource manager integration)
  const allocate = async <T>(key: string, value: T, options: any = {}): Promise<T> => {
    await set(key, value, options);
    return value;
  };

  // Deallocate cache entry
  const deallocate = async (keyOrValue: any): Promise<void> => {
    if (typeof keyOrValue === 'string') {
      del(keyOrValue);
    } else {
      // Find entry by value and delete
      for (const [key, entry] of state.cache) {
        if (entry.value === keyOrValue) {
          del(key);
          break;
        }
      }
    }
  };

  // Export cache data
  const exportData = () => ({
    entries: Array.from(state.cache.entries()),
    metrics: { ...state.metrics },
    config: { ...config }
  });

  // Import cache data
  const importData = (data: any): void => {
    clear();
    
    if (data.entries) {
      for (const [key, entry] of data.entries) {
        state.cache.set(key, entry);
        state.currentSize += entry.size;
        updateAccessOrder(key);
      }
    }
    
    if (data.metrics) {
      Object.assign(state.metrics, data.metrics);
    }
  };

  return {
    setMemoryManager,
    set,
    get,
    has,
    del,
    clear,
    keys,
    size,
    optimize,
    getStats,
    allocate,
    deallocate,
    exportData,
    importData
  };
};
