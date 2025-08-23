/**
 * Unified Configuration System
 * Standardizes configuration across all pipelines and modules
 * Following functional programming patterns with validation
 */

// Default configuration structure
const DEFAULT_CONFIG = {
  // Global system settings
  system: {
    performanceMonitoring: true,
    errorHandling: 'graceful', // 'strict' | 'graceful'
    logLevel: 'info', // 'debug' | 'info' | 'warn' | 'error'
    enableMetrics: true
  },

  // Canvas and rendering settings
  canvas: {
    width: 640,
    height: 480,
    context: '2d', // '2d' | 'webgl' | 'webgl2'
    preserveDrawingBuffer: true
  },

  // Pipeline selection and configuration
  pipelines: {
    // Face detection pipelines
    detection: {
      enabled: true,
      primary: 'blazeface', // 'blazeface' | 'mediapipe-face'
      fallback: 'mediapipe-face',
      
      blazeface: {
        modelUrl: '/models/blazeface/model.json',
        maxFaces: 1,
        inputSize: [128, 128],
        iouThreshold: 0.3,
        scoreThreshold: 0.75,
        returnTensors: false
      },
      
      mediapipe: {
        modelComplexity: 1, // 0 | 1 | 2
        enableSegmentation: false,
        smoothSegmentation: true,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
        maxNumFaces: 1
      }
    },

    // Landmark detection
    landmarks: {
      enabled: true,
      primary: 'mediapipe-face-mesh',
      
      'mediapipe-face-mesh': {
        maxNumFaces: 1,
        refineLandmarks: true,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
        enableFaceGeometry: true
      }
    },

    // Pose estimation
    pose: {
      enabled: true,
      mode: '3dof', // '3dof' | '6dof'
      
      calibration: {
        enabled: true,
        autoCalibrate: true,
        samples: 30,
        stabilityThreshold: 0.1
      },
      
      smoothing: {
        enabled: true,
        factor: 0.7,
        velocityThreshold: 0.5
      }
    },

    // Eye tracking configuration
    eyeTracking: {
      enabled: false,
      primary: 'neon', // 'neon' | 'iris-tracking'
      autoConnect: true,
      autoCalibrate: true,
      
      // Neon device settings
      neon: {
        useMockDevices: true,
        autoStart: true,
        enableSynchronization: true,
        reconnection: {
          enabled: true,
          maxAttempts: 10,
          interval: 5000
        },
        calibration: {
          type: '9-point',
          validationEnabled: true,
          qualityThreshold: 0.7
        },
        streaming: {
          sampleRate: 200,
          bufferSize: 2000,
          enableMemoryOptimization: true,
          enableAdaptiveBatching: true
        }
      },
      
      // Iris tracking settings  
      'iris-tracking': {
        maxNumFaces: 1,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
        smoothing: {
          enabled: true,
          factor: 0.8
        },
        screenProjection: {
          enabled: true,
          screenWidth: 1920,
          screenHeight: 1080
        }
      }
    },

    // Additional analysis pipelines
    emotion: {
      enabled: false,
      model: 'fer2013',
      confidence: 0.7
    },
    
    age: {
      enabled: false,
      model: 'age-net',
      confidence: 0.7
    }
  },

  // Streaming and synchronization
  streaming: {
    enabled: false,
    
    synchronization: {
      enabled: true,
      tolerance: 10, // ms
      strategy: 'hardware_timestamp', // 'hardware_timestamp' | 'software_timestamp' | 'buffer_based'
      bufferSize: 100
    },
    
    transport: {
      protocols: ['websocket', 'http'],
      websocket: {
        port: 8080,
        autoReconnect: true
      },
      http: {
        port: 8080,
        cors: {
          enabled: true,
          origins: ['*']
        }
      }
    }
  },

  // Performance optimization
  performance: {
    targetFrameRate: 30,
    enableGPU: true,
    memoryOptimization: {
      enabled: true,
      gcInterval: 10000,
      memoryPressureThreshold: 0.8
    },
    
    adaptiveBatching: {
      enabled: false, // Enable for high-frequency data
      strategy: 'adaptive',
      maxBatchSize: 20,
      minBatchSize: 1
    }
  },

  // Development and debugging
  development: {
    enableDevTools: false,
    mockData: {
      enabled: false,
      faceDetection: true,
      eyeTracking: true
    },
    
    testing: {
      enablePerformanceBenchmarks: false,
      logDetailedErrors: false
    }
  }
};

// Configuration validation schemas
const VALIDATION_SCHEMAS = {
  system: {
    performanceMonitoring: 'boolean',
    errorHandling: ['strict', 'graceful'],
    logLevel: ['debug', 'info', 'warn', 'error'],
    enableMetrics: 'boolean'
  },
  
  pipelines: {
    detection: {
      enabled: 'boolean',
      primary: ['blazeface', 'mediapipe-face'],
      fallback: ['blazeface', 'mediapipe-face', null]
    },
    
    eyeTracking: {
      enabled: 'boolean',
      primary: ['neon', 'iris-tracking'],
      autoConnect: 'boolean',
      autoCalibrate: 'boolean'
    }
  }
};

// Configuration manager factory
export const createConfigurationManager = (userConfig = {}) => {
  const state = {
    config: null,
    validated: false,
    errors: [],
    warnings: []
  };

  // Deep merge configurations
  const mergeConfigs = (defaultConfig, userConfig) => {
    const result = { ...defaultConfig };
    
    for (const key in userConfig) {
      if (userConfig[key] && typeof userConfig[key] === 'object' && !Array.isArray(userConfig[key])) {
        result[key] = mergeConfigs(result[key] || {}, userConfig[key]);
      } else {
        result[key] = userConfig[key];
      }
    }
    
    return result;
  };

  // Validate configuration values
  const validateConfig = (config, schema, path = '') => {
    const errors = [];
    const warnings = [];

    for (const key in schema) {
      const fullPath = path ? `${path}.${key}` : key;
      const value = config[key];
      const validator = schema[key];

      if (value === undefined) continue;

      if (typeof validator === 'string') {
        // Type validation
        if (typeof value !== validator) {
          errors.push(`${fullPath}: Expected ${validator}, got ${typeof value}`);
        }
      } else if (Array.isArray(validator)) {
        // Enum validation
        if (!validator.includes(value)) {
          errors.push(`${fullPath}: Invalid value '${value}'. Expected one of: ${validator.join(', ')}`);
        }
      } else if (typeof validator === 'object') {
        // Nested object validation
        if (typeof value === 'object' && value !== null) {
          const nestedResults = validateConfig(value, validator, fullPath);
          errors.push(...nestedResults.errors);
          warnings.push(...nestedResults.warnings);
        }
      }
    }

    return { errors, warnings };
  };

  // Initialize configuration
  const initialize = () => {
    // Merge user config with defaults
    state.config = mergeConfigs(DEFAULT_CONFIG, userConfig);

    // Validate configuration
    const validation = validateConfig(state.config, VALIDATION_SCHEMAS);
    state.errors = validation.errors;
    state.warnings = validation.warnings;
    state.validated = state.errors.length === 0;

    // Log validation results
    if (state.warnings.length > 0) {
      console.warn('Configuration warnings:', state.warnings);
    }

    if (state.errors.length > 0) {
      console.error('Configuration errors:', state.errors);
      throw new Error(`Configuration validation failed: ${state.errors.join(', ')}`);
    }

    return state.config;
  };

  // Get configuration value by path
  const get = (path, defaultValue = undefined) => {
    if (!state.config) return defaultValue;

    const keys = path.split('.');
    let value = state.config;

    for (const key of keys) {
      if (value && typeof value === 'object' && key in value) {
        value = value[key];
      } else {
        return defaultValue;
      }
    }

    return value;
  };

  // Set configuration value by path
  const set = (path, value) => {
    if (!state.config) return false;

    const keys = path.split('.');
    let current = state.config;

    // Navigate to parent object
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!(key in current) || typeof current[key] !== 'object') {
        current[key] = {};
      }
      current = current[key];
    }

    // Set the value
    current[keys[keys.length - 1]] = value;
    return true;
  };

  // Get pipeline-specific configuration
  const getPipelineConfig = (pipelineName) => {
    const pipelineConfig = get(`pipelines.${pipelineName}`, {});
    const systemConfig = get('system', {});
    const performanceConfig = get('performance', {});

    return {
      ...pipelineConfig,
      system: systemConfig,
      performance: performanceConfig
    };
  };

  // Check if pipeline is enabled
  const isPipelineEnabled = (pipelineName) => {
    return get(`pipelines.${pipelineName}.enabled`, false);
  };

  // Get enabled pipelines list
  const getEnabledPipelines = () => {
    const pipelines = get('pipelines', {});
    const enabled = [];

    for (const [name, config] of Object.entries(pipelines)) {
      if (config.enabled === true) {
        enabled.push({
          name,
          primary: config.primary,
          fallback: config.fallback,
          config
        });
      }
    }

    return enabled;
  };

  // Create environment-specific configurations
  const createEnvironmentConfig = (environment) => {
    const envConfigs = {
      development: {
        system: { logLevel: 'debug' },
        development: { 
          enableDevTools: true,
          mockData: { enabled: true }
        },
        pipelines: {
          eyeTracking: {
            neon: { useMockDevices: true }
          }
        }
      },
      
      testing: {
        system: { logLevel: 'warn' },
        development: {
          testing: {
            enablePerformanceBenchmarks: true,
            logDetailedErrors: true
          }
        },
        pipelines: {
          eyeTracking: {
            neon: { useMockDevices: true }
          }
        }
      },
      
      production: {
        system: { 
          logLevel: 'error',
          performanceMonitoring: true
        },
        development: {
          enableDevTools: false,
          mockData: { enabled: false }
        },
        pipelines: {
          eyeTracking: {
            neon: { useMockDevices: false }
          }
        }
      }
    };

    return mergeConfigs(state.config || DEFAULT_CONFIG, envConfigs[environment] || {});
  };

  // Export configuration for debugging
  const exportConfig = () => ({
    config: state.config,
    validated: state.validated,
    errors: [...state.errors],
    warnings: [...state.warnings]
  });

  // Reset to defaults
  const reset = () => {
    state.config = null;
    state.validated = false;
    state.errors = [];
    state.warnings = [];
  };

  return {
    // Core methods
    initialize,
    get,
    set,
    
    // Pipeline-specific methods
    getPipelineConfig,
    isPipelineEnabled,
    getEnabledPipelines,
    
    // Environment methods
    createEnvironmentConfig,
    
    // Utility methods
    exportConfig,
    reset,
    
    // Status
    isValidated: () => state.validated,
    getErrors: () => [...state.errors],
    getWarnings: () => [...state.warnings]
  };
};

// Default configuration instance
export const createDefaultConfig = () => ({
  ...DEFAULT_CONFIG
});

// Environment-aware configuration factory
export const createConfig = (userConfig = {}, environment = 'development') => {
  const manager = createConfigurationManager(userConfig);
  const config = manager.initialize();
  
  // Apply environment-specific overrides
  const envConfig = manager.createEnvironmentConfig(environment);
  return mergeConfigs(config, envConfig);
};

// Validation utilities
export const validatePipelineConfig = (pipelineName, config) => {
  const schema = VALIDATION_SCHEMAS.pipelines?.[pipelineName];
  if (!schema) return { valid: true, errors: [], warnings: [] };
  
  const manager = createConfigurationManager();
  const results = manager.validateConfig(config, schema, pipelineName);
  
  return {
    valid: results.errors.length === 0,
    errors: results.errors,
    warnings: results.warnings
  };
};

export { DEFAULT_CONFIG };