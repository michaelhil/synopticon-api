/**
 * Runtime Configuration Validation System
 * Provides comprehensive validation for all configuration objects
 */

import { ErrorCategory, ErrorSeverity, handleError } from '../../shared/utils/error-handler.js'
import {
  PROTECTED_KEYS,
  SecurityRules,
  ValidationTypes,
  validateConstraints,
  validateRequired,
  validateSecurity,
  validateType,
  type ValidationRule,
  type ValidationResult
} from './validation-helpers.js'
import { sanitizeConfig, validateAndThrow, type ValidateFn } from './validation-utilities.js'

// Extended validation rule interface for config validator
export interface ConfigValidationRule extends ValidationRule {
  regex?: RegExp;
  security?: string[];
  validate?: (value: unknown, path?: string) => boolean | string;
  properties?: Record<string, ConfigValidationRule>;
  _strictMode?: boolean;
}

export interface ConfigValidationSchema {
  [key: string]: ConfigValidationRule;
}

export interface ValidatorState {
  schema: ConfigValidationSchema;
  errors: string[];
  warnings: string[];
  securityViolations: string[];
}

export interface ConfigValidator {
  validate: (config: unknown, basePath?: string) => ValidationResult;
  validateValue: (value: unknown, rule: ConfigValidationRule, path?: string) => ValidationResult;
  sanitizeConfig: <T>(config: T) => T;
  validateAndThrow: (config: unknown, throwOnWarnings?: boolean) => ValidationResult;
  getSchema: () => ConfigValidationSchema;
  updateSchema: (updates: Partial<ConfigValidationSchema>) => void;
  ValidationTypes: typeof ValidationTypes;
  SecurityRules: typeof SecurityRules;
}

/**
 * Create configuration validator
 */
export const createConfigValidator = (schema: ConfigValidationSchema = {}): ConfigValidator => {
  const state: ValidatorState = {
    schema,
    errors: [],
    warnings: [],
    securityViolations: []
  };

  /**
   * Validate a single value against a rule
   */
  const validateValue = (
    value: unknown, 
    rule: ConfigValidationRule, 
    path: string = ''
  ): ValidationResult => {
    const result: ValidationResult = {
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
    if (rule.regex && typeof value === 'string' && !rule.regex.test(value)) {
      result.valid = false;
      result.errors.push(`${path}: Does not match required pattern`);
    }

    // Security validations
    if (rule.security) {
      const securityResult = validateSecurity(value, rule.security);
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
        const errorMessage = error instanceof Error ? error.message : String(error);
        result.errors.push(`${path}: Custom validation failed: ${errorMessage}`);
      }
    }

    return result;
  };

  /**
   * Validate an object against the schema
   */
  const validateObject = (config: unknown, basePath: string = ''): ValidationResult => {
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

    const configObj = config as Record<string, unknown>;

    // Check for prototype pollution attempt
    // Only flag directly assigned properties, not inherited ones
    for (const key of PROTECTED_KEYS) {
      if (configObj.hasOwnProperty(key)) {
        state.securityViolations.push(`Blocked attempt to set protected property: ${key}`);
        handleError(
          `Security violation: Attempted to set ${key}`,
          ErrorCategory.VALIDATION,
          ErrorSeverity.ERROR,
          { key, config: Object.keys(configObj) }
        );
      }
    }

    // Validate each property against schema rules
    for (const [property, rule] of Object.entries(state.schema)) {
      const fullPath = basePath ? `${basePath}.${property}` : property;
      const value = configObj[property];
      
      const result = validateValue(value, rule, fullPath);
      
      state.errors.push(...result.errors);
      state.warnings.push(...result.warnings);
      state.securityViolations.push(...result.securityViolations);

      // Validate nested objects
      if (value && typeof value === 'object' && rule.properties) {
        const nestedValidator = createConfigValidator(rule.properties);
        const nestedResult = nestedValidator.validate(value, fullPath);
        state.errors.push(...nestedResult.errors);
        state.warnings.push(...nestedResult.warnings);
        state.securityViolations.push(...nestedResult.securityViolations);
      }
    }

    // Check for unknown properties if strictMode is enabled
    if (state.schema._strictMode !== false) {
      for (const key of Object.keys(configObj)) {
        if (!state.schema[key] && !PROTECTED_KEYS.includes(key)) {
          state.warnings.push(`Unknown property: ${basePath ? `${basePath}.` : ''}${key}`);
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
  const sanitizeConfigWrapper = <T>(config: T): T => sanitizeConfig(config);
  const validateAndThrowWrapper = validateAndThrow(validateObject as ValidateFn);

  return {
    validate: validateObject,
    validateValue,
    sanitizeConfig: sanitizeConfigWrapper,
    validateAndThrow: validateAndThrowWrapper,
    getSchema: (): ConfigValidationSchema => ({ ...state.schema }),
    updateSchema: (updates: Partial<ConfigValidationSchema>): void => {
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
      range: [0, 1] as const
    },
    timeout: {
      type: ValidationTypes.NUMBER,
      range: [100, 300000] as const // 100ms to 5 minutes
    },
    enableDebug: {
      type: ValidationTypes.BOOLEAN
    },
    allowEval: {
      type: ValidationTypes.BOOLEAN,
      validate: (value: unknown): boolean | string => 
        value !== true || 'eval() is not allowed for security reasons'
    }
  } as const,

  // Server configuration schema
  SERVER: {
    port: {
      type: ValidationTypes.NUMBER,
      range: [1024, 65535] as const
    },
    cors: {
      type: ValidationTypes.OBJECT,
      properties: {
        origin: {
          type: ValidationTypes.ARRAY,
          validate: (origins: unknown): boolean | string => {
            if (Array.isArray(origins) && origins.includes('*')) {
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
          range: [1, 1000] as const
        },
        windowMs: {
          type: ValidationTypes.NUMBER,
          range: [60000, 3600000] as const // 1 minute to 1 hour
        }
      }
    }
  } as const,

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
      values: ['anonymous', 'use-credentials'] as const
    },
    fallback: {
      type: ValidationTypes.STRING,
      security: [SecurityRules.SAFE_PATH]
    }
  } as const
} as const;

// Pre-configured validators for common use cases
export const createPipelineValidator = (
  additionalRules: Partial<ConfigValidationSchema> = {}
): ConfigValidator => {
  return createConfigValidator({
    ...CommonSchemas.PIPELINE,
    ...additionalRules
  });
};

export const createServerValidator = (
  additionalRules: Partial<ConfigValidationSchema> = {}
): ConfigValidator => {
  return createConfigValidator({
    ...CommonSchemas.SERVER,
    ...additionalRules
  });
};

export const createDependencyValidator = (
  additionalRules: Partial<ConfigValidationSchema> = {}
): ConfigValidator => {
  return createConfigValidator({
    ...CommonSchemas.DEPENDENCY,
    ...additionalRules
  });
};