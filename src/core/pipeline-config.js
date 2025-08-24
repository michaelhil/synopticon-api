/**
 * Unified Pipeline Configuration Factory
 * Provides standardized configuration patterns for all pipeline types
 * Following functional programming patterns with immutable configurations
 */

import { createPipelineValidator } from './config-validator.js';
import { handleError, ErrorCategory, ErrorSeverity } from '../utils/error-handler.js';

// Base configuration common to all pipelines
const BASE_CONFIG = {
  confidenceThreshold: 0.5,
  smoothingFactor: 0.3,
  enableAdvancedFeatures: true,
  debug: false,
  maxRetries: 3,
  timeout: 5000,
  enablePerformanceMetrics: true
};

// Type-specific configuration defaults
const TYPE_SPECIFIC_CONFIGS = {
  'age-estimation': {
    inputSize: [64, 64],
    enableGenderDetection: true,
    ageRangeMapping: {
      child: [0, 12],
      teen: [13, 19],
      adult: [20, 64],
      senior: [65, 100]
    },
    modelUrl: null,
    batchSize: 1
  },
  
  'emotion-analysis': {
    inputSize: [48, 48],
    enableValenceArousal: true,
    modelUrl: 'https://cdn.jsdelivr.net/gh/oarriaga/face_classification/trained_models/emotion_models/fer2013_mini_XCEPTION.102-0.66.hdf5',
    batchSize: 1,
    emotionLabels: ['angry', 'disgusted', 'fearful', 'happy', 'sad', 'surprised', 'neutral'],
    enableWebGL: true
  },
  
  'mediapipe-face-mesh': {
    maxNumFaces: 1,
    refineLandmarks: true,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5,
    selfieMode: false,
    enableIris: false,
    staticImageMode: false,
    enable6DOF: true
  },
  
  'mediapipe-face': {
    modelSelection: 0,
    minDetectionConfidence: 0.5,
    maxFaces: 1,
    staticImageMode: false,
    enablePoseEstimation: true
  },
  
  'iris-tracking': {
    maxNumFaces: 1,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5,
    refineLandmarks: true,
    enableGazeEstimation: true,
    smoothingFactor: 0.7,
    enablePupilDilation: false,
    gazeCalibrationPoints: 9
  }
};

// Configuration validation rules for each type
const VALIDATION_RULES = {
  'age-estimation': {
    inputSize: { type: 'array', minLength: 2, maxLength: 2 },
    confidenceThreshold: { type: 'number', min: 0, max: 1 },
    smoothingFactor: { type: 'number', min: 0, max: 1 },
    batchSize: { type: 'number', min: 1, max: 32 }
  },
  
  'emotion-analysis': {
    inputSize: { type: 'array', minLength: 2, maxLength: 2 },
    confidenceThreshold: { type: 'number', min: 0, max: 1 },
    smoothingFactor: { type: 'number', min: 0, max: 1 },
    batchSize: { type: 'number', min: 1, max: 32 }
  },
  
  'mediapipe-face-mesh': {
    maxNumFaces: { type: 'number', min: 1, max: 10 },
    minDetectionConfidence: { type: 'number', min: 0, max: 1 },
    minTrackingConfidence: { type: 'number', min: 0, max: 1 }
  },
  
  'mediapipe-face': {
    modelSelection: { type: 'number', min: 0, max: 1 },
    minDetectionConfidence: { type: 'number', min: 0, max: 1 },
    maxFaces: { type: 'number', min: 1, max: 10 }
  },
  
  'iris-tracking': {
    maxNumFaces: { type: 'number', min: 1, max: 5 },
    minDetectionConfidence: { type: 'number', min: 0, max: 1 },
    minTrackingConfidence: { type: 'number', min: 0, max: 1 },
    smoothingFactor: { type: 'number', min: 0, max: 1 },
    gazeCalibrationPoints: { type: 'number', min: 4, max: 25 }
  }
};

/**
 * Validates configuration object against type-specific rules
 * @param {string} type - Pipeline type
 * @param {Object} config - Configuration to validate
 * @returns {boolean} - True if valid
 */
const validateConfig = (type, config) => {
  const rules = VALIDATION_RULES[type];
  if (!rules) return true;
  
  let isValid = true;
  
  Object.entries(rules).forEach(([key, rule]) => {
    if (config.hasOwnProperty(key)) {
      const value = config[key];
      
      // Type validation
      if (rule.type === 'array') {
        if (!Array.isArray(value)) {
          console.error(`Config validation failed: ${key} must be an array`);
          isValid = false;
          return;
        }
        if (rule.minLength && value.length < rule.minLength) {
          console.error(`Config validation failed: ${key} array too short (min: ${rule.minLength})`);
          isValid = false;
        }
        if (rule.maxLength && value.length > rule.maxLength) {
          console.error(`Config validation failed: ${key} array too long (max: ${rule.maxLength})`);
          isValid = false;
        }
      } else if (rule.type && typeof value !== rule.type) {
        console.error(`Config validation failed: ${key} must be ${rule.type}, got ${typeof value}`);
        isValid = false;
        return;
      }
      
      // Range validation for numbers
      if (rule.type === 'number') {
        if (rule.min !== undefined && value < rule.min) {
          console.error(`Config validation failed: ${key} too small (min: ${rule.min})`);
          isValid = false;
        }
        if (rule.max !== undefined && value > rule.max) {
          console.error(`Config validation failed: ${key} too large (max: ${rule.max})`);
          isValid = false;
        }
      }
    }
  });
  
  return isValid;
};

/**
 * Creates a standardized pipeline configuration
 * @param {string} type - Pipeline type
 * @param {Object} userConfig - User-provided configuration overrides
 * @returns {Object} - Complete configuration object
 */
export const createPipelineConfig = (type, userConfig = {}) => {
  // Validate pipeline type
  if (!type || typeof type !== 'string') {
    throw new Error('Pipeline type is required and must be a string');
  }
  
  // Check if type is supported
  const typeSpecific = TYPE_SPECIFIC_CONFIGS[type];
  if (!typeSpecific) {
    const supportedTypes = Object.keys(TYPE_SPECIFIC_CONFIGS);
    throw new Error(`Unsupported pipeline type: ${type}. Supported types: ${supportedTypes.join(', ')}`);
  }

  // Create validator for this pipeline type
  const validator = createPipelineValidator();
  
  // Validate user configuration first to catch security issues early
  try {
    const userValidation = validator.validate(userConfig);
    
    if (userValidation.securityViolations.length > 0) {
      handleError(
        `Security violations in pipeline configuration: ${userValidation.securityViolations.join(', ')}`,
        ErrorCategory.VALIDATION,
        ErrorSeverity.ERROR,
        { type, violations: userValidation.securityViolations }
      );
      throw new Error(`Configuration contains security violations: ${userValidation.securityViolations.join('; ')}`);
    }

    if (userValidation.warnings.length > 0) {
      handleError(
        `Configuration warnings for pipeline ${type}: ${userValidation.warnings.join(', ')}`,
        ErrorCategory.VALIDATION,
        ErrorSeverity.WARNING,
        { type, warnings: userValidation.warnings }
      );
    }
  } catch (validationError) {
    handleError(
      `Pipeline configuration validation failed: ${validationError.message}`,
      ErrorCategory.VALIDATION,
      ErrorSeverity.ERROR,
      { type, userConfig }
    );
    throw validationError;
  }

  // Merge configurations in order of precedence
  const mergedConfig = {
    ...BASE_CONFIG,
    ...typeSpecific,
    ...userConfig,
    type // Always preserve the type
  };
  
  // Final validation of merged configuration
  const finalValidation = validator.validate(mergedConfig);
  if (!finalValidation.valid) {
    throw new Error(`Final configuration validation failed: ${finalValidation.errors.join('; ')}`);
  }

  // Sanitize configuration to remove any dangerous properties
  const sanitizedConfig = validator.sanitizeConfig(mergedConfig);
  
  handleError(
    `Pipeline configuration created successfully for type: ${type}`,
    ErrorCategory.INITIALIZATION,
    ErrorSeverity.INFO,
    { type, configKeys: Object.keys(sanitizedConfig) }
  );
  
  return sanitizedConfig;
};

/**
 * Gets default configuration for a pipeline type
 * @param {string} type - Pipeline type
 * @returns {Object} - Default configuration
 */
export const getDefaultConfig = (type) => {
  return createPipelineConfig(type);
};

/**
 * Updates an existing configuration with new values
 * @param {Object} currentConfig - Current configuration
 * @param {Object} updates - Updates to apply
 * @returns {Object} - New configuration object
 */
export const updateConfig = (currentConfig, updates = {}) => {
  if (!currentConfig.type) {
    throw new Error('Cannot update configuration without type information');
  }
  
  return createPipelineConfig(currentConfig.type, {
    ...currentConfig,
    ...updates
  });
};

/**
 * Validates if two configurations are compatible for pipeline switching
 * @param {Object} config1 - First configuration
 * @param {Object} config2 - Second configuration
 * @returns {boolean} - True if compatible
 */
export const areConfigsCompatible = (config1, config2) => {
  if (!config1 || !config2) return false;
  
  // Same type pipelines are always compatible
  if (config1.type === config2.type) return true;
  
  // MediaPipe variants are compatible with each other
  const mediaPipeTypes = ['mediapipe-face-mesh', 'mediapipe-face', 'iris-tracking'];
  if (mediaPipeTypes.includes(config1.type) && mediaPipeTypes.includes(config2.type)) {
    return true;
  }
  
  return false;
};

/**
 * Gets configuration schema for a pipeline type (useful for UI generation)
 * @param {string} type - Pipeline type
 * @returns {Object} - Configuration schema
 */
export const getConfigSchema = (type) => {
  const typeConfig = TYPE_SPECIFIC_CONFIGS[type];
  const validationRules = VALIDATION_RULES[type];
  
  if (!typeConfig) return null;
  
  return {
    base: BASE_CONFIG,
    typeSpecific: typeConfig,
    validation: validationRules,
    supportedTypes: Object.keys(TYPE_SPECIFIC_CONFIGS)
  };
};

// Export supported pipeline types for reference
export const SUPPORTED_PIPELINE_TYPES = Object.keys(TYPE_SPECIFIC_CONFIGS);

// Export configuration constants for external use
export { BASE_CONFIG, TYPE_SPECIFIC_CONFIGS, VALIDATION_RULES };