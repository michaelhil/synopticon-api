/**
 * Image processing cache and metrics management
 */

export interface ProcessingCacheConfig {
  enableCaching?: boolean;
  cacheSize?: number;
  enableMetrics?: boolean;
}

export interface ProcessingMetrics {
  processedFrames: number;
  cacheHits: number;
  cacheMisses: number;
  totalProcessingTime: number;
  averageProcessingTime: number;
}

export interface CacheMetrics extends ProcessingMetrics {
  cacheSize: number;
  cacheHitRate: number;
}

export interface CacheEntry {
  data: any;
  timestamp: number;
}

export interface ProcessingCache {
  getCached: (operation: string, params: any) => any | null;
  setCached: (operation: string, params: any, result: any) => void;
  recordProcessingTime: (startTime: number, endTime: number) => void;
  getMetrics: () => CacheMetrics;
  clearCache: () => void;
  resetMetrics: () => void;
}

interface ProcessingCacheState {
  cache: Map<string, CacheEntry>;
  metrics: ProcessingMetrics;
  config: Required<ProcessingCacheConfig>;
}

export const createProcessingCache = (config: ProcessingCacheConfig = {}): ProcessingCache => {
  const state: ProcessingCacheState = {
    cache: new Map(),
    metrics: {
      processedFrames: 0,
      cacheHits: 0,
      cacheMisses: 0,
      totalProcessingTime: 0,
      averageProcessingTime: 0
    },
    config: {
      enableCaching: config.enableCaching !== false,
      cacheSize: config.cacheSize ?? 50,
      enableMetrics: config.enableMetrics !== false
    }
  };

  const generateCacheKey = (operation: string, params: any): string => {
    return `${operation}_${JSON.stringify(params)}`;
  };

  const getCached = (operation: string, params: any): any | null => {
    if (!state.config.enableCaching) return null;
    
    const key = generateCacheKey(operation, params);
    const cached = state.cache.get(key);
    
    if (cached) {
      state.metrics.cacheHits++;
      // Move to end (LRU)
      state.cache.delete(key);
      state.cache.set(key, cached);
      return cached.data;
    }
    
    state.metrics.cacheMisses++;
    return null;
  };

  const setCached = (operation: string, params: any, result: any): void => {
    if (!state.config.enableCaching) return;
    
    const key = generateCacheKey(operation, params);
    
    // Implement LRU eviction
    if (state.cache.size >= state.config.cacheSize) {
      const firstKey = state.cache.keys().next().value;
      if (firstKey) {
        state.cache.delete(firstKey);
      }
    }
    
    state.cache.set(key, {
      data: result,
      timestamp: Date.now()
    });
  };

  const recordProcessingTime = (startTime: number, endTime: number): void => {
    if (!state.config.enableMetrics) return;
    
    const processingTime = endTime - startTime;
    state.metrics.processedFrames++;
    state.metrics.totalProcessingTime += processingTime;
    state.metrics.averageProcessingTime = 
      state.metrics.totalProcessingTime / state.metrics.processedFrames;
  };

  const getMetrics = (): CacheMetrics => ({
    ...state.metrics,
    cacheSize: state.cache.size,
    cacheHitRate: state.metrics.cacheHits + state.metrics.cacheMisses > 0 
      ? state.metrics.cacheHits / (state.metrics.cacheHits + state.metrics.cacheMisses)
      : 0
  });

  const clearCache = (): void => {
    state.cache.clear();
  };

  const resetMetrics = (): void => {
    state.metrics = {
      processedFrames: 0,
      cacheHits: 0,
      cacheMisses: 0,
      totalProcessingTime: 0,
      averageProcessingTime: 0
    };
  };

  return {
    getCached,
    setCached,
    recordProcessingTime,
    getMetrics,
    clearCache,
    resetMetrics
  };
};