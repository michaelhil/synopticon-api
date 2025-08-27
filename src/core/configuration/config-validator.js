/**
 * Runtime Configuration Validation System
 * Provides comprehensive validation for all configuration objects
 */

import { ErrorCategory, ErrorSeverity, handleError } from '../../shared/utils/error-handler.js';
import {
  PROTECTED_KEYS,
  SecurityRules,
  ValidationTypes,
  validateConstraints,
  validateRequired,
  validateSecurity,
  validateType
} from './validation-helpers.js';
import { sanitizeConfig, validateAndThrow } from './validation-utilities.js';

/**
 * Create configuration validator
 * @param {Object} schema - Validation schema
 * @returns {Object} - Validator instance
 */
export const createConfigValidator = (schema = {}) => {
  const state = {
    schema,
    errors: [],
    warnings: [],
    securityViolations: []
  };

  /**
   * Validate a single value against a rule
   * @param {*} value - Value to validate
   * @param {Object} rule - Validation rule
   * @param {string} path - Property path for errors
   * @returns {Object} - Validation result
   */
  const validateValue = (value, rule, path = '') => {
    const result = {
      valid: true,
      errors: [],
      warnings: [],
      securityViolations: []
    };

    // Check required field first
    const requiredError = validateRequired(value, rule, path);
    if (requiredError) return requiredError;

    // Skip validation if value is undefined and not required
    if (value === undefined || value === null) {
      return result;
    }

    // Validate type
    const typeError = validateType(value, rule, path);
    if (typeError) {
      result.valid = false;
      result.errors.push(...typeError.errors);
      return result;
    }

    // Validate constraints (range, length, etc.)
    const constraintError = validateConstraints(value, rule, path);
    if (constraintError) {
      result.valid = false;
      result.errors.push(...constraintError.errors);
    }

    // Regex validation
    if (rule.regex && !rule.regex.test(value)) {
      result.valid = false;
      result.errors.push(`${path}: Does not match required pattern`);
    }

    // Security validations
    if (rule.security) {
      const securityResult = validateSecurity(value, rule.security, path);
      result.securityViolations.push(...securityResult.violations);
      if (securityResult.violations.length > 0) {
        result.valid = false;
        result.errors.push(...securityResult.violations.map(v => `${path}: ${v}`));
      }
    }

    // Custom validation function
    if (rule.validate && typeof rule.validate === 'function') {
      try {
        const customResult = rule.validate(value, path);
        if (customResult !== true) {
          result.valid = false;
          result.errors.push(`${path}: ${customResult}`);
        }
      } catch (error) {
        result.valid = false;
        result.errors.push(`${path}: Custom validation failed: ${error.message}`);
      }
    }

    return result;
  };

  /**
   * Validate an object against the schema
   * @param {Object} config - Configuration object to validate
   * @param {string} basePath - Base path for error reporting
   * @returns {Object} - Validation result
   */
  const validateObject = (config, basePath = '') => {
    state.errors = [];
    state.warnings = [];
    state.securityViolations = [];

    if (!config || typeof config !== 'object') {
      return {
        valid: false,
        errors: ['Configuration must be an object'],
        warnings: [],
        securityViolations: []
      };
    }

    // Check for prototype pollution attempt
    // Only flag directly assigned properties, not inherited ones
    for (const key of PROTECTED_KEYS) {
      if (config.hasOwnProperty(key)) {
        state.securityViolations.push(`Blocked attempt to set protected property: ${key}`);
        handleError(
          `Security violation: Attempted to set ${key}`,
          ErrorCategory.VALIDATION,
          ErrorSeverity.ERROR,
          { key, config: Object.keys(config) }
        );
      }
    }

    // Validate each property against schema rules
    for (const [property, rule] of Object.entries(state.schema)) {
      const fullPath = basePath ? `${basePath}.${property}` : property;
      const value = config[property];
      
      const result = validateValue(value, rule, fullPath);
      
      state.errors.push(...result.errors);
      state.warnings.push(...result.warnings);
      state.securityViolations.push(...result.securityViolations);

      // Validate nested objects
      if (value && typeof value === 'object' && rule.properties) {
        const nestedResult = validateObject(value, fullPath);
        state.errors.push(...nestedResult.errors);
        state.warnings.push(...nestedResult.warnings);
        state.securityViolations.push(...nestedResult.securityViolations);
      }
    }

    // Check for unknown properties if strictMode is enabled
    if (state.schema._strictMode !== false) {
      for (const key of Object.keys(config)) {
        if (!state.schema[key] && !PROTECTED_KEYS.includes(key)) {
          state.warnings.push(`Unknown property: ${basePath ? `${basePath  }.` : ''}${key}`);
        }
      }
    }

    return {
      valid: state.errors.length === 0 && state.securityViolations.length === 0,
      errors: [...state.errors],
      warnings: [...state.warnings],
      securityViolations: [...state.securityViolations]
    };
  };

  // Create utility functions with access to validateObject
  const sanitizeConfigWrapper = (config) => sanitizeConfig(config);
  const validateAndThrowWrapper = validateAndThrow(validateObject);

  return {
    validate: validateObject,
    validateValue,
    sanitizeConfig: sanitizeConfigWrapper,
    validateAndThrow: validateAndThrowWrapper,
    getSchema: () => ({ ...state.schema }),
    updateSchema: (updates) => {
      state.schema = { ...state.schema, ...updates };
    },
    // Export validation types and security rules for external use
    ValidationTypes,
    SecurityRules
  };
};

// Common validation schemas
export const CommonSchemas = {
  // Pipeline configuration schema
  PIPELINE: {
    name: {
      type: ValidationTypes.STRING,
      required: true,
      length: { min: 1, max: 100 },
      regex: /^[a-zA-Z0-9_-]+$/,
      security: [SecurityRules.SANITIZED_STRING]
    },
    confidenceThreshold: {
      type: ValidationTypes.NUMBER,
      range: [0, 1]
    },
    timeout: {
      type: ValidationTypes.NUMBER,
      range: [100, 300000] // 100ms to 5 minutes
    },
    enableDebug: {
      type: ValidationTypes.BOOLEAN
    },
    allowEval: {
      type: ValidationTypes.BOOLEAN,
      validate: (value) => value !== true || 'eval() is not allowed for security reasons'
    }
  },

  // Server configuration schema
  SERVER: {
    port: {
      type: ValidationTypes.NUMBER,
      range: [1024, 65535]
    },
    cors: {
      type: ValidationTypes.OBJECT,
      properties: {
        origin: {
          type: ValidationTypes.ARRAY,
          validate: (origins) => {
            if (origins.includes('*')) {
              return 'Wildcard CORS origin is not recommended for production';
            }
            return true;
          }
        }
      }
    },
    rateLimit: {
      type: ValidationTypes.OBJECT,
      properties: {
        max: {
          type: ValidationTypes.NUMBER,
          range: [1, 1000]
        },
        windowMs: {
          type: ValidationTypes.NUMBER,
          range: [60000, 3600000] // 1 minute to 1 hour
        }
      }
    }
  },

  // External dependency schema
  DEPENDENCY: {
    url: {
      type: ValidationTypes.STRING,
      required: true,
      security: [SecurityRules.TRUSTED_URL]
    },
    integrity: {
      type: ValidationTypes.STRING,
      regex: /^sha(256|384|512)-[A-Za-z0-9+/]+={0,2}$/
    },
    crossorigin: {
      type: ValidationTypes.ENUM,
      values: ['anonymous', 'use-credentials']
    },
    fallback: {
      type: ValidationTypes.STRING,
      security: [SecurityRules.SAFE_PATH]
    }
  }
};

// Pre-configured validators for common use cases
export const createPipelineValidator = (additionalRules = {}) => {
  return createConfigValidator({
    ...CommonSchemas.PIPELINE,
    ...additionalRules
  });
};

export const createServerValidator = (additionalRules = {}) => {
  return createConfigValidator({
    ...CommonSchemas.SERVER,
    ...additionalRules
  });
};

export const createDependencyValidator = (additionalRules = {}) => {
  return createConfigValidator({
    ...CommonSchemas.DEPENDENCY,
    ...additionalRules
  });
};