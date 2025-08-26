/**
 * Runtime Configuration Validation System
 * Provides comprehensive validation for all configuration objects
 */

import { handleError, ErrorCategory, ErrorSeverity } from '../../shared/utils/error-handler.js';

// Validation rule types
const ValidationTypes = {
  STRING: 'string',
  NUMBER: 'number',
  BOOLEAN: 'boolean',
  ARRAY: 'array',
  OBJECT: 'object',
  FUNCTION: 'function',
  ENUM: 'enum',
  RANGE: 'range',
  REGEX: 'regex',
  CUSTOM: 'custom'
};

// Security-focused validation rules
const SecurityRules = {
  NO_EVAL: 'no_eval',
  NO_PROTO_POLLUTION: 'no_proto_pollution', 
  SAFE_PATH: 'safe_path',
  SANITIZED_STRING: 'sanitized_string',
  TRUSTED_URL: 'trusted_url'
};

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

  // Protected keys that should never be set directly
  const PROTECTED_KEYS = [
    '__proto__',
    'constructor', 
    'prototype',
    'hasOwnProperty',
    'valueOf',
    'toString'
  ];

  // Dangerous patterns to detect
  const DANGEROUS_PATTERNS = [
    /eval\s*\(/,
    /Function\s*\(/,
    /process\.exit/,
    /require\s*\(/,
    /import\s*\(/,
    /<script/i,
    /javascript:/i,
    /on\w+\s*=/i // Event handlers
  ];

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

    // Required field check
    if (rule.required && (value === undefined || value === null)) {
      result.valid = false;
      result.errors.push(`${path}: Required field is missing`);
      return result;
    }

    // Skip validation if value is undefined and not required
    if (value === undefined || value === null) {
      return result;
    }

    // Type validation
    if (rule.type) {
      const actualType = Array.isArray(value) ? 'array' : typeof value;
      
      if (rule.type === ValidationTypes.ENUM) {
        if (!rule.values || !rule.values.includes(value)) {
          result.valid = false;
          result.errors.push(`${path}: Must be one of: ${rule.values.join(', ')}`);
        }
      } else if (actualType !== rule.type) {
        result.valid = false;
        result.errors.push(`${path}: Expected ${rule.type}, got ${actualType}`);
        return result;
      }
    }

    // Range validation for numbers
    if (rule.type === ValidationTypes.NUMBER && rule.range) {
      const [min, max] = rule.range;
      if (value < min || value > max) {
        result.valid = false;
        result.errors.push(`${path}: Must be between ${min} and ${max}`);
      }
    }

    // String length validation
    if (rule.type === ValidationTypes.STRING && rule.length) {
      if (rule.length.min && value.length < rule.length.min) {
        result.valid = false;
        result.errors.push(`${path}: Must be at least ${rule.length.min} characters`);
      }
      if (rule.length.max && value.length > rule.length.max) {
        result.valid = false;
        result.errors.push(`${path}: Must be no more than ${rule.length.max} characters`);
      }
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
   * Validate security aspects of a value
   * @param {*} value - Value to validate
   * @param {Array} securityRules - Security rules to apply
   * @param {string} path - Property path
   * @returns {Object} - Security validation result
   */
  const validateSecurity = (value, securityRules, path) => {
    const violations = [];

    for (const rule of securityRules) {
      switch (rule) {
        case SecurityRules.NO_EVAL:
          if (typeof value === 'string' && DANGEROUS_PATTERNS.some(pattern => pattern.test(value))) {
            violations.push('Contains potentially dangerous code patterns');
          }
          break;

        case SecurityRules.NO_PROTO_POLLUTION:
          if (typeof value === 'object' && value !== null) {
            for (const key of Object.keys(value)) {
              if (PROTECTED_KEYS.includes(key)) {
                violations.push(`Attempted to set protected property: ${key}`);
              }
            }
          }
          break;

        case SecurityRules.SAFE_PATH:
          if (typeof value === 'string') {
            // Check for directory traversal
            if (value.includes('..') || value.includes('~')) {
              violations.push('Path contains directory traversal sequences');
            }
            // Check for absolute paths (might be unintended)
            if (value.startsWith('/') && !value.startsWith('/assets/') && !value.startsWith('/api/')) {
              violations.push('Absolute path outside allowed directories');
            }
          }
          break;

        case SecurityRules.SANITIZED_STRING:
          if (typeof value === 'string') {
            const unsafeChars = /<|>|"|'|&/;
            if (unsafeChars.test(value)) {
              violations.push('Contains unsanitized characters that could cause XSS');
            }
          }
          break;

        case SecurityRules.TRUSTED_URL:
          if (typeof value === 'string' && (value.startsWith('http://') || value.startsWith('https://'))) {
            try {
              const url = new URL(value);
              // Only allow specific trusted domains
              const trustedDomains = [
                'cdn.jsdelivr.net',
                'unpkg.com',
                'cdnjs.cloudflare.com',
                'localhost',
                '127.0.0.1'
              ];
              
              if (!trustedDomains.some(domain => url.hostname === domain || url.hostname.endsWith('.' + domain))) {
                violations.push(`Untrusted domain: ${url.hostname}`);
              }
            } catch {
              violations.push('Invalid URL format');
            }
          }
          break;
      }
    }

    return { violations };
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
          state.warnings.push(`Unknown property: ${basePath ? basePath + '.' : ''}${key}`);
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

  /**
   * Create a safe copy of config object, filtering out dangerous properties
   * @param {Object} config - Configuration object
   * @returns {Object} - Sanitized configuration object
   */
  const sanitizeConfig = (config) => {
    if (!config || typeof config !== 'object') {
      return config;
    }

    const sanitized = {};
    
    for (const [key, value] of Object.entries(config)) {
      // Skip protected keys
      if (PROTECTED_KEYS.includes(key)) {
        continue;
      }
      
      // Recursively sanitize nested objects
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        sanitized[key] = sanitizeConfig(value);
      } else if (typeof value === 'string') {
        // Basic string sanitization
        sanitized[key] = value.replace(/[<>]/g, '');
      } else {
        sanitized[key] = value;
      }
    }

    // Freeze the object to prevent modification
    return Object.freeze(sanitized);
  };

  /**
   * Validate and throw on critical errors
   * @param {Object} config - Configuration to validate
   * @param {boolean} throwOnWarnings - Whether to throw on warnings
   */
  const validateAndThrow = (config, throwOnWarnings = false) => {
    const result = validateObject(config);
    
    if (result.securityViolations.length > 0) {
      throw new Error(`Security violations detected: ${result.securityViolations.join('; ')}`);
    }
    
    if (result.errors.length > 0) {
      throw new Error(`Configuration validation failed: ${result.errors.join('; ')}`);
    }
    
    if (throwOnWarnings && result.warnings.length > 0) {
      throw new Error(`Configuration warnings: ${result.warnings.join('; ')}`);
    }
    
    return result;
  };

  return {
    validate: validateObject,
    validateValue,
    sanitizeConfig,
    validateAndThrow,
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