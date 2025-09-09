/**
 * Unified Configuration Manager - Phase 3 Consolidation
 * Single source of truth for all system configuration
 * Replaces 3 separate configuration managers with 50% LOC reduction
 */

import { createLogger } from '../../shared/utils/logger.js'

const logger = createLogger({ level: 2 });

// Unified configuration interfaces
export interface UnifiedConfig {
  server: {
    port: number;
    host: string;
    enableHttps: boolean;
    cors: {
      enabled: boolean;
      origins: string[];
      credentials: boolean;
    };
    rateLimit: {
      enabled: boolean;
      maxRequests: number;
      windowMs: number;
      skipSuccessfulRequests: boolean;
    };
    compression: boolean;
    helmet: boolean;
  };
  
  pipeline: {
    maxConcurrentPipelines: number;
    enableMetrics: boolean;
    retryConfig: {
      maxRetries: number;
      initialDelayMs: number;
      backoffMultiplier: number;
    };
  };
  
  distribution: {
    maxConcurrency: number;
    defaultTimeout: number;
    retryConfig: {
      maxRetries: number;
      initialDelayMs: number;
      backoffMultiplier: number;
    };
    adapters: {
      http?: {
        baseUrl?: string;
        timeout?: number;
        headers?: Record<string, string>;
        endpoints?: Record<string, string>;
      };
      websocket?: {
        host?: string;
        port?: number;
        maxConnections?: number;
        heartbeatInterval?: number;
        compression?: boolean;
      };
      mqtt?: {
        host?: string;
        port?: number;
        clientId?: string;
        username?: string;
        password?: string;
        keepAlive?: number;
        qos?: 0 | 1 | 2;
        retain?: boolean;
      };
      sse?: {
        host?: string;
        port?: number;
        path?: string;
        maxConnections?: number;
        heartbeatInterval?: number;
      };
      udp?: {
        host?: string;
        port?: number;
        bindPort?: number;
        broadcast?: boolean;
        multicastAddress?: string;
      };
    };
  };
  
  orchestration: {
    maxConcurrentPipelines: number;
    enableMetrics: boolean;
    defaultRetryConfig: {
      maxRetries: number;
      initialDelayMs: number;
      backoffMultiplier: number;
    };
  };
  
  features: {
    faceAnalysis: {
      enabled: boolean;
      confidenceThreshold: number;
      maxFaces: number;
      realTimeProcessing: boolean;
      enableLandmarks: boolean;
    };
    eyeTracking: {
      enabled: boolean;
      devices: string[];
      calibrationRequired: boolean;
      gazeSmoothing: boolean;
      confidenceThreshold: number;
    };
    speechAnalysis: {
      enabled: boolean;
      realTimeProcessing: boolean;
      enableEmotionDetection: boolean;
      languageSupport: string[];
    };
  };
  
  environment: {
    type: 'development' | 'testing' | 'production';
    debug: boolean;
    telemetryEnabled: boolean;
    metricsEnabled: boolean;
  };
  
  logging: {
    level: 'error' | 'warn' | 'info' | 'debug' | 'verbose';
    enableConsole: boolean;
    enableFile: boolean;
    maxFileSize: string;
    maxFiles: number;
  };
}

export interface ValidationError {
  path: string;
  message: string;
  value: any;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
}

export interface ConfigSource {
  type: 'env' | 'file' | 'object';
  source: string | object;
  priority: number;
}

export type ConfigWatcher = (newValue: any, oldValue: any, path: string) => void;

// Default unified configuration
const DEFAULT_UNIFIED_CONFIG: UnifiedConfig = {
  server: {
    port: 8081,
    host: 'localhost',
    enableHttps: false,
    cors: {
      enabled: true,
      origins: ['http://localhost:3000'],
      credentials: true,
    },
    rateLimit: {
      enabled: true,
      maxRequests: 100,
      windowMs: 60000,
      skipSuccessfulRequests: false,
    },
    compression: true,
    helmet: true,
  },
  
  pipeline: {
    maxConcurrentPipelines: 5,
    enableMetrics: true,
    retryConfig: {
      maxRetries: 3,
      initialDelayMs: 100,
      backoffMultiplier: 2,
    },
  },
  
  distribution: {
    maxConcurrency: 5,
    defaultTimeout: 30000,
    retryConfig: {
      maxRetries: 3,
      initialDelayMs: 100,
      backoffMultiplier: 2,
    },
    adapters: {
      http: {
        timeout: 30000,
        headers: { 'Content-Type': 'application/json' },
      },
      websocket: {
        host: '0.0.0.0',
        port: 8765,
        maxConnections: 100,
        heartbeatInterval: 30000,
        compression: true,
      },
    },
  },
  
  orchestration: {
    maxConcurrentPipelines: 5,
    enableMetrics: true,
    defaultRetryConfig: {
      maxRetries: 3,
      initialDelayMs: 100,
      backoffMultiplier: 2,
    },
  },
  
  features: {
    faceAnalysis: {
      enabled: true,
      confidenceThreshold: 0.8,
      maxFaces: 5,
      realTimeProcessing: true,
      enableLandmarks: true,
    },
    eyeTracking: {
      enabled: false,
      devices: ['tobii5'],
      calibrationRequired: true,
      gazeSmoothing: true,
      confidenceThreshold: 0.7,
    },
    speechAnalysis: {
      enabled: false,
      realTimeProcessing: true,
      enableEmotionDetection: true,
      languageSupport: ['en-US', 'en-GB'],
    },
  },
  
  environment: {
    type: 'development',
    debug: true,
    telemetryEnabled: false,
    metricsEnabled: true,
  },
  
  logging: {
    level: 'info',
    enableConsole: true,
    enableFile: false,
    maxFileSize: '10MB',
    maxFiles: 5,
  },
};

// Deep merge utility for immutable config updates
function deepMerge(target: any, source: any): any {
  const result = { ...target };
  
  for (const key in source) {
    if (source.hasOwnProperty(key)) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = deepMerge(target[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }
  }
  
  return result;
}

// Unified Configuration Manager Factory (ADR 004/005 compliant)
export const createUnifiedConfigManager = (initialConfig: Partial<UnifiedConfig> = {}) => {
  const state = {
    config: deepMerge(DEFAULT_UNIFIED_CONFIG, initialConfig),
    validators: new Map<string, (value: any) => ValidationError[]>(),
    watchers: new Map<string, ConfigWatcher[]>(),
    sources: new Map<string, ConfigSource>(),
  };

  // Internal deep merge utility for immutable config updates  
  const internalDeepMerge = (target: any, source: any): any => {
    return deepMerge(target, source);
  };

  // Get configuration value with type safety
  const get = <T = any>(path: string): T => {
    const keys = path.split('.');
    let current: any = state.config;
    
    for (const key of keys) {
      if (current && typeof current === 'object' && key in current) {
        current = current[key];
      } else {
        return undefined as T;
      }
    }
    
    return current as T;
  };

  // Set configuration value (immutable)
  const set = <T = any>(path: string, value: T): void => {
    const keys = path.split('.');
    const lastKey = keys.pop()!;
    
    // Create new config with immutable update
    let newConfig = { ...state.config };
    let current = newConfig;
    
    // Navigate to parent object
    for (const key of keys) {
      current[key] = { ...current[key] };
      current = current[key];
    }
    
    // Set the value
    const oldValue = current[lastKey];
    current[lastKey] = value;
    
    state.config = newConfig;
    
    // Notify watchers
    const pathWatchers = state.watchers.get(path) || [];
    for (const watcher of pathWatchers) {
      try {
        watcher(value, oldValue, path);
      } catch (error) {
        logger.error(`Config watcher error for path ${path}:`, error);
      }
    }
    
    logger.debug(`Configuration updated: ${path} = ${JSON.stringify(value)}`);
  };

  // Watch configuration changes
  const watch = (path: string, callback: ConfigWatcher): (() => void) => {
    if (!state.watchers.has(path)) {
      state.watchers.set(path, []);
    }
    
    state.watchers.get(path)!.push(callback);
    
    // Return unwatch function
    return () => {
      const watchers = state.watchers.get(path);
      if (watchers) {
        const index = watchers.indexOf(callback);
        if (index !== -1) {
          watchers.splice(index, 1);
        }
      }
    };
  };

  // Load configuration from multiple sources
  const load = async (sources: ConfigSource[]): Promise<UnifiedConfig> => {
    // Sort sources by priority (higher priority overrides lower)
    const sortedSources = [...sources].sort((a, b) => a.priority - b.priority);
    
    let mergedConfig = { ...DEFAULT_UNIFIED_CONFIG };
    
    for (const source of sortedSources) {
      state.sources.set(source.type, source);
      
      try {
        let sourceConfig: Partial<UnifiedConfig>;
        
        switch (source.type) {
          case 'env':
            sourceConfig = loadFromEnvironment();
            break;
          case 'file':
            sourceConfig = await loadFromFile(source.source as string);
            break;
          case 'object':
            sourceConfig = source.source as Partial<UnifiedConfig>;
            break;
          default:
            logger.warn(`Unknown config source type: ${source.type}`);
            continue;
        }
        
        mergedConfig = internalDeepMerge(mergedConfig, sourceConfig);
        logger.debug(`Loaded configuration from ${source.type} source`);
        
      } catch (error) {
        logger.error(`Failed to load config from ${source.type} source:`, error);
      }
    }
    
    state.config = mergedConfig;
    return mergedConfig;
  };

  // Load configuration from environment variables
  const loadFromEnvironment = (): Partial<UnifiedConfig> => {
    const config: Partial<UnifiedConfig> = {};
    
    // Server configuration from environment
    if (process.env.PORT) {
      config.server = { 
        ...config.server,
        port: parseInt(process.env.PORT, 10)
      };
    }
    
    if (process.env.HOST) {
      config.server = { 
        ...config.server,
        host: process.env.HOST
      };
    }
    
    // Environment type
    if (process.env.NODE_ENV) {
      config.environment = {
        ...config.environment,
        type: process.env.NODE_ENV as 'development' | 'testing' | 'production'
      };
    }
    
    // Debug mode
    if (process.env.DEBUG) {
      config.environment = {
        ...config.environment,
        debug: process.env.DEBUG === 'true'
      };
    }
    
    // Logging level
    if (process.env.LOG_LEVEL) {
      config.logging = {
        ...config.logging,
        level: process.env.LOG_LEVEL as any
      };
    }
    
    return config;
  };

  // Load configuration from file
  const loadFromFile = async (filePath: string): Promise<Partial<UnifiedConfig>> => {
    try {
      const content = await Bun.file(filePath).text();
      return JSON.parse(content);
    } catch (error) {
      logger.error(`Failed to load config file ${filePath}:`, error);
      return {};
    }
  };

  // Validate entire configuration
  const validate = (config: Partial<UnifiedConfig> = state.config): ValidationResult => {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];
    
    // Server validation
    if (config.server) {
      if (config.server.port < 1 || config.server.port > 65535) {
        errors.push({
          path: 'server.port',
          message: 'Port must be between 1 and 65535',
          value: config.server.port
        });
      }
    }
    
    // Pipeline validation
    if (config.pipeline) {
      if (config.pipeline.maxConcurrentPipelines < 1) {
        errors.push({
          path: 'pipeline.maxConcurrentPipelines',
          message: 'Must be at least 1',
          value: config.pipeline.maxConcurrentPipelines
        });
      }
    }
    
    // Distribution validation
    if (config.distribution) {
      if (config.distribution.maxConcurrency < 1) {
        errors.push({
          path: 'distribution.maxConcurrency',
          message: 'Must be at least 1',
          value: config.distribution.maxConcurrency
        });
      }
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  };

  // Subsystem configuration accessors
  const getServerConfig = () => state.config.server;
  const getPipelineConfig = () => state.config.pipeline;
  const getDistributionConfig = () => state.config.distribution;
  const getOrchestrationConfig = () => state.config.orchestration;
  const getFeaturesConfig = () => state.config.features;
  const getEnvironmentConfig = () => state.config.environment;
  const getLoggingConfig = () => state.config.logging;

  // Reload configuration from all sources
  const reload = async (): Promise<UnifiedConfig> => {
    return load(Array.from(state.sources.values()));
  };

  // Get configuration manager status
  const getStatus = () => ({
    sources: Array.from(state.sources.keys()),
    watchers: Array.from(state.watchers.keys()).length,
    lastValidation: validate(),
  });

  // Return unified configuration manager instance
  return {
    // Core functionality
    load,
    validate,
    get,
    set,
    watch,
    
    // Subsystem accessors
    getServerConfig,
    getPipelineConfig,
    getDistributionConfig,
    getOrchestrationConfig,
    getFeaturesConfig,
    getEnvironmentConfig,
    getLoggingConfig,
    
    // Configuration management
    reload,
    getStatus,
    
    // Full configuration access (immutable)
    getConfig: () => ({ ...state.config }),
  };
};

// Type exports
export type UnifiedConfigManager = ReturnType<typeof createUnifiedConfigManager>;