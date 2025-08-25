/**
 * Unified Configuration System - TypeScript Native
 * Standardizes configuration across all pipelines and modules
 * Strict type safety with validation and immutability
 */

import type { CapabilityType, PerformanceProfile } from './types';

// Base configuration types
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export type ErrorHandling = 'strict' | 'graceful';
export type CanvasContext = '2d' | 'webgl' | 'webgl2';
export type ModelComplexity = 0 | 1 | 2;

// System configuration interface
export interface SystemConfig {
  readonly performanceMonitoring: boolean;
  readonly errorHandling: ErrorHandling;
  readonly logLevel: LogLevel;
  readonly enableMetrics: boolean;
  readonly maxConcurrentRequests?: number;
  readonly requestTimeout?: number;
}

// Canvas configuration interface
export interface CanvasConfig {
  readonly width: number;
  readonly height: number;
  readonly context: CanvasContext;
  readonly preserveDrawingBuffer: boolean;
  readonly antialias?: boolean;
  readonly alpha?: boolean;
}

// MediaPipe specific configuration
export interface MediaPipeConfig {
  readonly modelComplexity: ModelComplexity;
  readonly enableSegmentation: boolean;
  readonly smoothSegmentation: boolean;
  readonly minDetectionConfidence: number;
  readonly minTrackingConfidence: number;
  readonly maxNumFaces: number;
  readonly refineLandmarks?: boolean;
  readonly enableFaceGeometry?: boolean;
}

// Pipeline configuration interfaces
export interface DetectionPipelineConfig {
  readonly enabled: boolean;
  readonly primary: 'mediapipe-face' | 'mediapipe-face-mesh';
  readonly fallback?: string;
  readonly mediapipe: MediaPipeConfig;
  readonly timeout?: number;
  readonly retryAttempts?: number;
}

export interface PosePipelineConfig {
  readonly enabled: boolean;
  readonly mode: '3dof' | '6dof' | 'both';
  readonly calibrationEnabled: boolean;
  readonly smoothingEnabled: boolean;
  readonly smoothingFactor: number;
  readonly outlierDetection: boolean;
  readonly outlierThreshold: number;
  readonly coordinateSystem: 'camera' | 'world';
}

export interface EyeTrackingConfig {
  readonly enabled: boolean;
  readonly trackingMode: 'gaze' | 'pupil' | 'both';
  readonly calibrationRequired: boolean;
  readonly smoothingEnabled: boolean;
  readonly blinkDetection: boolean;
  readonly gazeSmoothing: number;
  readonly pupilDetection: boolean;
}

export interface EmotionAnalysisConfig {
  readonly enabled: boolean;
  readonly model: 'fer2013' | 'affectnet' | 'custom';
  readonly emotions: ReadonlyArray<string>;
  readonly confidenceThreshold: number;
  readonly smoothingWindow: number;
  readonly realTimeAnalysis: boolean;
}

export interface AgeEstimationConfig {
  readonly enabled: boolean;
  readonly model: 'age_net' | 'vgg_face' | 'custom';
  readonly ageRanges: boolean;
  readonly confidenceThreshold: number;
  readonly smoothingEnabled: boolean;
}

export interface SpeechAnalysisConfig {
  readonly enabled: boolean;
  readonly language: string;
  readonly realTimeTranscription: boolean;
  readonly emotionAnalysis: boolean;
  readonly speakerDiarization: boolean;
  readonly noiseReduction: boolean;
  readonly audioQualityThreshold: number;
  readonly vadThreshold: number;
}

// Performance and monitoring configuration
export interface PerformanceConfig {
  readonly targetFPS: number;
  readonly maxLatency: number;
  readonly memoryLimit: number;
  readonly gcThreshold: number;
  readonly profileQueries: boolean;
  readonly enableProfiling: boolean;
  readonly metricsInterval: number;
}

export interface CacheConfig {
  readonly enabled: boolean;
  readonly maxSize: number;
  readonly ttl: number;
  readonly strategy: 'lru' | 'lfu' | 'ttl';
  readonly persistToDisk: boolean;
  readonly compressionEnabled: boolean;
}

// Distribution system configuration
export interface DistributionConfig {
  readonly enabled: boolean;
  readonly protocols: ReadonlyArray<'mqtt' | 'udp' | 'websocket' | 'http' | 'sse'>;
  readonly defaultProtocol: 'mqtt' | 'udp' | 'websocket' | 'http' | 'sse';
  readonly bufferSize: number;
  readonly compressionEnabled: boolean;
  readonly encryptionEnabled: boolean;
  readonly rateLimiting: {
    readonly enabled: boolean;
    readonly maxRequests: number;
    readonly window: number;
  };
}

// Main configuration interface
export interface SynopticonConfig {
  readonly system: SystemConfig;
  readonly canvas: CanvasConfig;
  readonly pipelines: {
    readonly detection: DetectionPipelineConfig;
    readonly pose: PosePipelineConfig;
    readonly eyeTracking: EyeTrackingConfig;
    readonly emotion: EmotionAnalysisConfig;
    readonly ageEstimation: AgeEstimationConfig;
    readonly speechAnalysis: SpeechAnalysisConfig;
  };
  readonly performance: PerformanceConfig;
  readonly cache: CacheConfig;
  readonly distribution: DistributionConfig;
  readonly metadata?: Record<string, unknown>;
}

// Default configuration
export const DEFAULT_CONFIG: SynopticonConfig = {
  system: {
    performanceMonitoring: true,
    errorHandling: 'graceful',
    logLevel: 'info',
    enableMetrics: true,
    maxConcurrentRequests: 10,
    requestTimeout: 30000
  },

  canvas: {
    width: 640,
    height: 480,
    context: '2d',
    preserveDrawingBuffer: true,
    antialias: true,
    alpha: false
  },

  pipelines: {
    detection: {
      enabled: true,
      primary: 'mediapipe-face',
      fallback: 'mediapipe-face-mesh',
      mediapipe: {
        modelComplexity: 1,
        enableSegmentation: false,
        smoothSegmentation: true,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
        maxNumFaces: 1,
        refineLandmarks: true,
        enableFaceGeometry: false
      },
      timeout: 5000,
      retryAttempts: 2
    },

    pose: {
      enabled: true,
      mode: 'both',
      calibrationEnabled: true,
      smoothingEnabled: true,
      smoothingFactor: 0.7,
      outlierDetection: true,
      outlierThreshold: 2.0,
      coordinateSystem: 'camera'
    },

    eyeTracking: {
      enabled: false,
      trackingMode: 'both',
      calibrationRequired: true,
      smoothingEnabled: true,
      blinkDetection: true,
      gazeSmoothing: 0.8,
      pupilDetection: true
    },

    emotion: {
      enabled: false,
      model: 'fer2013',
      emotions: ['happy', 'sad', 'angry', 'surprised', 'neutral', 'fear', 'disgust'],
      confidenceThreshold: 0.6,
      smoothingWindow: 5,
      realTimeAnalysis: true
    },

    ageEstimation: {
      enabled: false,
      model: 'age_net',
      ageRanges: true,
      confidenceThreshold: 0.5,
      smoothingEnabled: true
    },

    speechAnalysis: {
      enabled: false,
      language: 'en-US',
      realTimeTranscription: true,
      emotionAnalysis: false,
      speakerDiarization: false,
      noiseReduction: true,
      audioQualityThreshold: 0.7,
      vadThreshold: 0.5
    }
  },

  performance: {
    targetFPS: 30,
    maxLatency: 100,
    memoryLimit: 512 * 1024 * 1024, // 512MB
    gcThreshold: 0.8,
    profileQueries: false,
    enableProfiling: false,
    metricsInterval: 1000
  },

  cache: {
    enabled: true,
    maxSize: 100 * 1024 * 1024, // 100MB
    ttl: 300000, // 5 minutes
    strategy: 'lru',
    persistToDisk: false,
    compressionEnabled: true
  },

  distribution: {
    enabled: false,
    protocols: ['websocket', 'udp', 'mqtt'],
    defaultProtocol: 'websocket',
    bufferSize: 1024 * 1024, // 1MB
    compressionEnabled: false,
    encryptionEnabled: false,
    rateLimiting: {
      enabled: true,
      maxRequests: 100,
      window: 60000
    }
  }
} as const;

// Configuration validation schema
export interface ConfigValidationRule {
  readonly required?: boolean;
  readonly type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  readonly min?: number;
  readonly max?: number;
  readonly enum?: ReadonlyArray<string | number>;
  readonly pattern?: RegExp;
  readonly validate?: (value: unknown) => boolean;
}

export interface ValidationResult {
  readonly valid: boolean;
  readonly errors: ReadonlyArray<string>;
  readonly warnings: ReadonlyArray<string>;
}

// Configuration validation rules
const VALIDATION_RULES: Record<string, ConfigValidationRule> = {
  'system.performanceMonitoring': { type: 'boolean' },
  'system.errorHandling': { type: 'string', enum: ['strict', 'graceful'] },
  'system.logLevel': { type: 'string', enum: ['debug', 'info', 'warn', 'error'] },
  'system.enableMetrics': { type: 'boolean' },
  'system.maxConcurrentRequests': { type: 'number', min: 1, max: 100 },
  'system.requestTimeout': { type: 'number', min: 1000, max: 300000 },

  'canvas.width': { type: 'number', min: 1, max: 4096 },
  'canvas.height': { type: 'number', min: 1, max: 4096 },
  'canvas.context': { type: 'string', enum: ['2d', 'webgl', 'webgl2'] },
  'canvas.preserveDrawingBuffer': { type: 'boolean' },

  'pipelines.detection.enabled': { type: 'boolean' },
  'pipelines.detection.primary': { type: 'string', enum: ['mediapipe-face', 'mediapipe-face-mesh'] },
  'pipelines.detection.mediapipe.modelComplexity': { type: 'number', enum: [0, 1, 2] },
  'pipelines.detection.mediapipe.minDetectionConfidence': { type: 'number', min: 0, max: 1 },
  'pipelines.detection.mediapipe.minTrackingConfidence': { type: 'number', min: 0, max: 1 },
  'pipelines.detection.mediapipe.maxNumFaces': { type: 'number', min: 1, max: 10 },

  'performance.targetFPS': { type: 'number', min: 1, max: 120 },
  'performance.maxLatency': { type: 'number', min: 1, max: 5000 },
  'performance.memoryLimit': { type: 'number', min: 64 * 1024 * 1024, max: 4 * 1024 * 1024 * 1024 }
};

/**
 * Configuration factory with type safety and validation
 */
export const createConfiguration = (userConfig: Partial<SynopticonConfig> = {}): SynopticonConfig => {
  // Deep merge with defaults
  const mergedConfig = deepMerge(DEFAULT_CONFIG, userConfig);
  
  // Validate configuration
  const validation = validateConfiguration(mergedConfig);
  if (!validation.valid) {
    throw new Error(`Configuration validation failed: ${validation.errors.join(', ')}`);
  }
  
  // Return frozen configuration for immutability
  return deepFreeze(mergedConfig);
};

/**
 * Validates configuration against schema
 */
export const validateConfiguration = (config: Partial<SynopticonConfig>): ValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Validate each rule
  Object.entries(VALIDATION_RULES).forEach(([path, rule]) => {
    const value = getNestedValue(config, path);
    
    if (rule.required && (value === undefined || value === null)) {
      errors.push(`Required field missing: ${path}`);
      return;
    }
    
    if (value === undefined || value === null) {
      return; // Skip validation for optional missing fields
    }
    
    // Type validation
    const actualType = Array.isArray(value) ? 'array' : typeof value;
    if (actualType !== rule.type) {
      errors.push(`Invalid type for ${path}: expected ${rule.type}, got ${actualType}`);
      return;
    }
    
    // Range validation for numbers
    if (rule.type === 'number' && typeof value === 'number') {
      if (rule.min !== undefined && value < rule.min) {
        errors.push(`Value for ${path} is below minimum: ${value} < ${rule.min}`);
      }
      if (rule.max !== undefined && value > rule.max) {
        errors.push(`Value for ${path} is above maximum: ${value} > ${rule.max}`);
      }
    }
    
    // Enum validation
    if (rule.enum && !rule.enum.includes(value as string | number)) {
      errors.push(`Invalid value for ${path}: must be one of [${rule.enum.join(', ')}]`);
    }
    
    // Pattern validation for strings
    if (rule.pattern && typeof value === 'string' && !rule.pattern.test(value)) {
      errors.push(`Value for ${path} does not match required pattern`);
    }
    
    // Custom validation
    if (rule.validate && !rule.validate(value)) {
      errors.push(`Custom validation failed for ${path}`);
    }
  });
  
  // Configuration-specific warnings
  if (config.system?.performanceMonitoring === false) {
    warnings.push('Performance monitoring is disabled - this may impact debugging');
  }
  
  if (config.performance?.targetFPS && config.performance.targetFPS > 60) {
    warnings.push('High target FPS may impact performance on lower-end devices');
  }
  
  if (config.cache?.enabled === false) {
    warnings.push('Caching is disabled - this may impact performance');
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
};

/**
 * Creates configuration for specific pipeline type
 */
export const createPipelineConfiguration = <T extends keyof SynopticonConfig['pipelines']>(
  pipelineType: T,
  userConfig: Partial<SynopticonConfig['pipelines'][T]> = {}
): SynopticonConfig['pipelines'][T] => {
  const defaultPipelineConfig = DEFAULT_CONFIG.pipelines[pipelineType];
  return deepFreeze(deepMerge(defaultPipelineConfig, userConfig));
};

/**
 * Configuration profile presets
 */
export const CONFIG_PROFILES = {
  // High performance configuration
  performance: {
    system: {
      performanceMonitoring: true,
      errorHandling: 'graceful' as const,
      logLevel: 'warn' as const
    },
    performance: {
      targetFPS: 60,
      maxLatency: 50,
      enableProfiling: true
    },
    cache: {
      enabled: true,
      maxSize: 256 * 1024 * 1024,
      strategy: 'lfu' as const
    }
  },
  
  // High accuracy configuration
  accuracy: {
    pipelines: {
      detection: {
        mediapipe: {
          modelComplexity: 2 as const,
          minDetectionConfidence: 0.8,
          minTrackingConfidence: 0.8,
          refineLandmarks: true
        }
      }
    },
    performance: {
      targetFPS: 30,
      maxLatency: 200
    }
  },
  
  // Resource-constrained configuration
  lightweight: {
    system: {
      performanceMonitoring: false,
      enableMetrics: false,
      logLevel: 'error' as const
    },
    pipelines: {
      detection: {
        mediapipe: {
          modelComplexity: 0 as const,
          minDetectionConfidence: 0.3,
          refineLandmarks: false
        }
      }
    },
    performance: {
      targetFPS: 15,
      maxLatency: 500,
      memoryLimit: 128 * 1024 * 1024
    },
    cache: {
      enabled: false
    }
  }
} as const;

/**
 * Creates configuration from a preset
 */
export const createConfigurationFromPreset = (
  preset: keyof typeof CONFIG_PROFILES,
  overrides: Partial<SynopticonConfig> = {}
): SynopticonConfig => {
  const presetConfig = CONFIG_PROFILES[preset];
  const mergedConfig = deepMerge(DEFAULT_CONFIG, presetConfig, overrides);
  return createConfiguration(mergedConfig);
};

// Utility functions
const deepMerge = (...objects: Array<Record<string, any>>): any => {
  const result: Record<string, any> = {};
  
  for (const obj of objects) {
    if (!obj) continue;
    
    for (const [key, value] of Object.entries(obj)) {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        result[key] = deepMerge((result[key] as Record<string, any>) || {}, value);
      } else {
        result[key] = value;
      }
    }
  }
  
  return result;
};

const deepFreeze = <T>(obj: T): T => {
  Object.freeze(obj);
  
  if (obj && typeof obj === 'object') {
    Object.values(obj as Record<string, any>).forEach(value => {
      if (value && typeof value === 'object') {
        deepFreeze(value);
      }
    });
  }
  
  return obj;
};

const getNestedValue = (obj: any, path: string): unknown => {
  return path.split('.').reduce((current, key) => current?.[key], obj);
};

/**
 * Configuration Manager for dynamic configuration management
 * Provides runtime configuration updates and validation
 */
export interface ConfigurationManager {
  getConfig(): SynopticonConfig;
  updateConfig(updates: Partial<SynopticonConfig>): SynopticonConfig;
  resetToDefaults(): SynopticonConfig;
  validateConfig(config: Partial<SynopticonConfig>): ValidationResult;
}

/**
 * Creates a configuration manager with dynamic update capabilities
 */
export const createConfigurationManager = (initialConfig: Partial<SynopticonConfig> = {}): ConfigurationManager => {
  let currentConfig = createConfiguration(initialConfig);
  
  return {
    getConfig: () => currentConfig,
    
    updateConfig: (updates: Partial<SynopticonConfig>) => {
      const mergedConfig = deepMerge(currentConfig, updates);
      const validation = validateConfiguration(mergedConfig);
      
      if (!validation.valid) {
        throw new Error(`Configuration update failed: ${validation.errors.join(', ')}`);
      }
      
      currentConfig = deepFreeze(mergedConfig);
      return currentConfig;
    },
    
    resetToDefaults: () => {
      currentConfig = createConfiguration();
      return currentConfig;
    },
    
    validateConfig: (config: Partial<SynopticonConfig>) => validateConfiguration(config)
  };
};

/**
 * Alias for createConfiguration for backward compatibility
 */
export const createConfig = createConfiguration;

// Type exports (already declared above)