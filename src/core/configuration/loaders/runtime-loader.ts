/**
 * @fileoverview Runtime configuration loader and hot-reload system
 * Enables dynamic configuration updates without server restart
 */

import { EventEmitter } from 'events';
import { watchFile, unwatchFile, existsSync } from 'fs';
import type { SynopticonConfig } from '../schema/config-types.js';

/**
 * Runtime loader options
 */
export interface RuntimeLoaderOptions {
  enableHotReload?: boolean;
  reloadInterval?: number;
  maxRetries?: number;
  debounceMs?: number;
}

/**
 * Configuration change event
 */
export interface ConfigChangeEvent {
  path: string;
  oldValue: unknown;
  newValue: unknown;
  timestamp: number;
  source: 'file' | 'api' | 'env' | 'manual';
}

/**
 * Create runtime configuration loader with hot-reload capabilities
 */
export const createRuntimeLoader = (options: RuntimeLoaderOptions = {}) => {
  const {
    enableHotReload = false,
    reloadInterval = 1000,
    maxRetries = 3,
    debounceMs = 500
  } = options;

  const events = new EventEmitter();
  const watchedFiles = new Set<string>();
  const debounceTimers = new Map<string, NodeJS.Timeout>();

  let currentConfig: Partial<SynopticonConfig> = {};
  let isReloading = false;

  /**
   * Deep compare two configuration objects
   */
  const deepCompare = (obj1: any, obj2: any): boolean => {
    if (obj1 === obj2) return true;
    if (obj1 == null || obj2 == null) return false;
    if (typeof obj1 !== typeof obj2) return false;
    
    if (typeof obj1 === 'object') {
      const keys1 = Object.keys(obj1);
      const keys2 = Object.keys(obj2);
      
      if (keys1.length !== keys2.length) return false;
      
      for (const key of keys1) {
        if (!keys2.includes(key)) return false;
        if (!deepCompare(obj1[key], obj2[key])) return false;
      }
      return true;
    }
    
    return obj1 === obj2;
  };

  /**
   * Extract differences between configurations
   */
  const extractChanges = (oldConfig: any, newConfig: any, basePath = ''): ConfigChangeEvent[] => {
    const changes: ConfigChangeEvent[] = [];
    const allKeys = new Set([...Object.keys(oldConfig || {}), ...Object.keys(newConfig || {})]);

    for (const key of allKeys) {
      const path = basePath ? `${basePath}.${key}` : key;
      const oldValue = oldConfig?.[key];
      const newValue = newConfig?.[key];

      if (!deepCompare(oldValue, newValue)) {
        if (typeof oldValue === 'object' && typeof newValue === 'object' && 
            oldValue !== null && newValue !== null &&
            !Array.isArray(oldValue) && !Array.isArray(newValue)) {
          changes.push(...extractChanges(oldValue, newValue, path));
        } else {
          changes.push({
            path,
            oldValue,
            newValue,
            timestamp: Date.now(),
            source: 'file'
          });
        }
      }
    }

    return changes;
  };

  /**
   * Update configuration with change tracking
   */
  const updateConfiguration = (newConfig: Partial<SynopticonConfig>, source: ConfigChangeEvent['source'] = 'manual') => {
    const changes = extractChanges(currentConfig, newConfig);
    
    if (changes.length > 0) {
      const oldConfig = { ...currentConfig };
      currentConfig = { ...newConfig };

      // Emit individual change events
      for (const change of changes) {
        events.emit('configChange', { ...change, source });
      }

      // Emit batch change event
      events.emit('configBatchChange', {
        changes,
        oldConfig,
        newConfig: currentConfig,
        timestamp: Date.now()
      });
    }

    return changes;
  };

  /**
   * Watch file for changes with debouncing
   */
  const watchConfigFile = (filePath: string, loader: () => Partial<SynopticonConfig>) => {
    if (!enableHotReload || !existsSync(filePath)) {
      return;
    }

    if (watchedFiles.has(filePath)) {
      return; // Already watching
    }

    watchedFiles.add(filePath);

    const debouncedReload = () => {
      if (debounceTimers.has(filePath)) {
        clearTimeout(debounceTimers.get(filePath)!);
      }

      debounceTimers.set(filePath, setTimeout(async () => {
        if (isReloading) return;
        
        isReloading = true;
        let retries = 0;

        while (retries < maxRetries) {
          try {
            const newConfig = loader();
            const changes = updateConfiguration(newConfig, 'file');
            
            if (changes.length > 0) {
              events.emit('fileReload', {
                filePath,
                changes,
                attempt: retries + 1,
                success: true
              });
            }
            
            break;
          } catch (error) {
            retries++;
            if (retries >= maxRetries) {
              events.emit('reloadError', {
                filePath,
                error: error.message,
                attempts: retries
              });
            } else {
              await new Promise(resolve => setTimeout(resolve, 1000 * retries));
            }
          }
        }

        isReloading = false;
        debounceTimers.delete(filePath);
      }, debounceMs));
    };

    watchFile(filePath, { interval: reloadInterval }, debouncedReload);
  };

  /**
   * Stop watching a file
   */
  const unwatchConfigFile = (filePath: string) => {
    if (watchedFiles.has(filePath)) {
      unwatchFile(filePath);
      watchedFiles.delete(filePath);
      
      if (debounceTimers.has(filePath)) {
        clearTimeout(debounceTimers.get(filePath)!);
        debounceTimers.delete(filePath);
      }
    }
  };

  /**
   * Stop watching all files
   */
  const unwatchAllFiles = () => {
    for (const filePath of watchedFiles) {
      unwatchConfigFile(filePath);
    }
  };

  /**
   * Get current configuration
   */
  const getCurrentConfig = (): Partial<SynopticonConfig> => {
    return { ...currentConfig };
  };

  /**
   * Set configuration value by path
   */
  const setConfigValue = (path: string, value: any, source: ConfigChangeEvent['source'] = 'api') => {
    const keys = path.split('.');
    const newConfig = { ...currentConfig };
    let current = newConfig;

    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!(key in current) || typeof current[key] !== 'object') {
        current[key] = {};
      }
      current = current[key];
    }

    current[keys[keys.length - 1]] = value;
    return updateConfiguration(newConfig, source);
  };

  /**
   * Get configuration value by path
   */
  const getConfigValue = (path: string): any => {
    const keys = path.split('.');
    let current: any = currentConfig;

    for (const key of keys) {
      if (current === null || current === undefined || typeof current !== 'object') {
        return undefined;
      }
      current = current[key];
    }

    return current;
  };

  /**
   * Event listener helpers
   */
  const onConfigChange = (callback: (change: ConfigChangeEvent) => void) => {
    events.on('configChange', callback);
    return () => events.off('configChange', callback);
  };

  const onBatchChange = (callback: (event: any) => void) => {
    events.on('configBatchChange', callback);
    return () => events.off('configBatchChange', callback);
  };

  const onReloadError = (callback: (error: any) => void) => {
    events.on('reloadError', callback);
    return () => events.off('reloadError', callback);
  };

  const onFileReload = (callback: (event: any) => void) => {
    events.on('fileReload', callback);
    return () => events.off('fileReload', callback);
  };

  /**
   * Configuration statistics
   */
  const getStats = () => ({
    watchedFiles: Array.from(watchedFiles),
    isReloading,
    hotReloadEnabled: enableHotReload,
    debounceMs,
    reloadInterval,
    maxRetries,
    configSize: Object.keys(currentConfig).length,
    lastUpdate: Math.max(...Object.values(currentConfig).map(() => Date.now()))
  });

  /**
   * Initialize with configuration
   */
  const initialize = (config: Partial<SynopticonConfig>) => {
    currentConfig = { ...config };
    events.emit('initialized', { config: currentConfig, timestamp: Date.now() });
  };

  /**
   * Cleanup resources
   */
  const cleanup = () => {
    unwatchAllFiles();
    events.removeAllListeners();
    debounceTimers.forEach(timer => clearTimeout(timer));
    debounceTimers.clear();
  };

  return {
    // Configuration management
    getCurrentConfig,
    updateConfiguration,
    setConfigValue,
    getConfigValue,
    initialize,

    // File watching
    watchConfigFile,
    unwatchConfigFile,
    unwatchAllFiles,

    // Event listeners
    onConfigChange,
    onBatchChange,
    onReloadError,
    onFileReload,

    // Utilities
    getStats,
    cleanup,

    // Configuration metadata
    enableHotReload,
    reloadInterval,
    maxRetries,
    debounceMs
  };
};

/**
 * Default runtime loader instance
 */
export const runtimeLoader = createRuntimeLoader();
