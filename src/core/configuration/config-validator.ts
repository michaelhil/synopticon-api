/**
 * Runtime Configuration Validation System
 * Provides comprehensive validation for all configuration objects
 * TypeScript implementation with strict type safety
 */

import { handleError, ErrorCategory, ErrorSeverity } from '../../shared/utils/error-handler.js';
import {
  ValidationTypes,
  SecurityRules,
  PROTECTED_KEYS,
  validateRequired,
  validateType,
  validateConstraints,
  validateSecurity,
  type ValidationRule,
  type ValidationResult,
  type SecurityViolation
} from './validation-helpers.js';
import { sanitizeConfig, validateAndThrow } from './validation-utilities.js';

interface ValidationSchema {
  [key: string]: ValidationRule | ValidationSchema;
}

interface ValidatorState {
  schema: ValidationSchema;
  errors: string[];
  warnings: string[];
  securityViolations: SecurityViolation[];
}

interface ValueValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  violations: SecurityViolation[];
  sanitizedValue?: any;
}

interface ConfigValidationOptions {
  allowUnknownKeys?: boolean;
  strictMode?: boolean;
  sanitizeValues?: boolean;
  skipSecurity?: boolean;
}

interface ConfigValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  securityViolations: SecurityViolation[];
  sanitizedConfig?: any;
  summary: {
    totalChecks: number;
    passed: number;
    failed: number;
    warnings: number;
    securityIssues: number;
  };
}

/**
 * Create configuration validator
 */
export const createConfigValidator = (schema: ValidationSchema = {}) => {
  const state: ValidatorState = {
    schema,
    errors: [],
    warnings: [],
    securityViolations: []
  };

  /**
   * Validate a single value against a rule
   */
  const validateValue = (value: any, rule: ValidationRule, path: string = ''): ValueValidationResult => {
    const result: ValueValidationResult = {
      valid: true,
      errors: [],
      warnings: [],
      violations: []
    };

    try {
      // Required validation
      if (rule.required !== undefined) {
        const requiredResult = validateRequired(value, rule.required);
        if (!requiredResult.valid) {
          result.valid = false;
          result.errors.push(`${path}: ${requiredResult.message}`);
          return result;
        }
      }

      // Skip further validation for undefined optional fields
      if (value === undefined && !rule.required) {
        return result;
      }

      // Type validation
      if (rule.type) {
        const typeResult = validateType(value, rule.type);
        if (!typeResult.valid) {
          result.valid = false;
          result.errors.push(`${path}: ${typeResult.message}`);
          return result;
        }
      }

      // Constraint validation
      if (rule.constraints) {
        const constraintResult = validateConstraints(value, rule.constraints);
        if (!constraintResult.valid) {
          result.valid = false;
          result.errors.push(`${path}: ${constraintResult.message}`);
        }
        if (constraintResult.warnings) {
          result.warnings.push(...constraintResult.warnings);
        }
      }

      // Security validation
      if (rule.security && !rule.skipSecurity) {
        const securityResult = validateSecurity(value, rule.security, path);
        if (securityResult.violations.length > 0) {
          result.violations.push(...securityResult.violations);
          if (securityResult.severity === 'error') {
            result.valid = false;
          }
        }
      }

      // Custom validation function
      if (rule.validate && typeof rule.validate === 'function') {
        try {
          const customResult = rule.validate(value, path);
          if (typeof customResult === 'boolean') {
            if (!customResult) {
              result.valid = false;
              result.errors.push(`${path}: Custom validation failed`);
            }
          } else if (customResult && typeof customResult === 'object') {
            if (!customResult.valid) {
              result.valid = false;
              result.errors.push(`${path}: ${customResult.message || 'Custom validation failed'}`);
            }
            if (customResult.warnings) {
              result.warnings.push(...customResult.warnings);
            }
          }
        } catch (error) {
          result.valid = false;
          result.errors.push(`${path}: Custom validation error - ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      // Sanitization
      if (rule.sanitize && typeof rule.sanitize === 'function') {
        try {
          result.sanitizedValue = rule.sanitize(value);
        } catch (error) {
          result.warnings.push(`${path}: Sanitization failed - ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

    } catch (error) {
      result.valid = false;
      result.errors.push(`${path}: Validation error - ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return result;
  };

  /**
   * Recursively validate configuration object
   */
  const validateObject = (
    config: any, 
    schema: ValidationSchema, 
    path: string = '',
    options: ConfigValidationOptions = {}
  ): ConfigValidationResult => {
    const result: ConfigValidationResult = {
      valid: true,
      errors: [],
      warnings: [],
      securityViolations: [],
      sanitizedConfig: {},
      summary: {
        totalChecks: 0,
        passed: 0,
        failed: 0,
        warnings: 0,
        securityIssues: 0
      }
    };

    if (!config || typeof config !== 'object') {
      result.valid = false;
      result.errors.push(`${path}: Expected object, got ${typeof config}`);
      result.summary.totalChecks = 1;
      result.summary.failed = 1;
      return result;
    }

    const configKeys = Object.keys(config);
    const schemaKeys = Object.keys(schema);

    // Validate each schema property
    for (const key of schemaKeys) {
      const currentPath = path ? `${path}.${key}` : key;
      const schemaRule = schema[key];
      const configValue = config[key];

      result.summary.totalChecks++;

      if (typeof schemaRule === 'object' && !schemaRule.type && !schemaRule.required) {
        // Nested object validation
        const nestedResult = validateObject(configValue, schemaRule as ValidationSchema, currentPath, options);
        result.errors.push(...nestedResult.errors);
        result.warnings.push(...nestedResult.warnings);
        result.securityViolations.push(...nestedResult.securityViolations);
        result.sanitizedConfig[key] = nestedResult.sanitizedConfig;
        
        if (!nestedResult.valid) {
          result.valid = false;
        }

        // Merge summary counts
        result.summary.totalChecks += nestedResult.summary.totalChecks;
        result.summary.passed += nestedResult.summary.passed;
        result.summary.failed += nestedResult.summary.failed;
        result.summary.warnings += nestedResult.summary.warnings;
        result.summary.securityIssues += nestedResult.summary.securityIssues;
      } else {
        // Single value validation
        const valueResult = validateValue(configValue, schemaRule as ValidationRule, currentPath);
        
        if (valueResult.valid) {
          result.summary.passed++;
          result.sanitizedConfig[key] = valueResult.sanitizedValue !== undefined ? valueResult.sanitizedValue : configValue;
        } else {
          result.valid = false;
          result.summary.failed++;
          result.sanitizedConfig[key] = configValue;
        }

        result.errors.push(...valueResult.errors);
        result.warnings.push(...valueResult.warnings);
        result.securityViolations.push(...valueResult.violations);

        if (valueResult.warnings.length > 0) {
          result.summary.warnings += valueResult.warnings.length;
        }
        if (valueResult.violations.length > 0) {
          result.summary.securityIssues += valueResult.violations.length;
        }
      }
    }

    // Check for unknown keys
    if (!options.allowUnknownKeys) {
      for (const key of configKeys) {
        if (!schemaKeys.includes(key)) {
          if (options.strictMode) {
            result.valid = false;
            result.errors.push(`${path ? path + '.' : ''}${key}: Unknown property`);
            result.summary.failed++;
          } else {
            result.warnings.push(`${path ? path + '.' : ''}${key}: Unknown property (allowed in non-strict mode)`);
            result.summary.warnings++;
          }
          result.sanitizedConfig[key] = config[key];
          result.summary.totalChecks++;
        }
      }
    } else {
      // Include unknown keys in sanitized config
      for (const key of configKeys) {
        if (!schemaKeys.includes(key)) {
          result.sanitizedConfig[key] = config[key];
        }
      }
    }

    return result;
  };

  /**
   * Validate configuration against schema
   */
  const validate = (config: any, options: ConfigValidationOptions = {}): ConfigValidationResult => {
    // Reset state
    state.errors = [];
    state.warnings = [];
    state.securityViolations = [];

    try {
      const result = validateObject(config, state.schema, '', options);
      
      // Store in state for legacy compatibility
      state.errors = result.errors;
      state.warnings = result.warnings;
      state.securityViolations = result.securityViolations;

      // Log validation summary
      handleError(
        `Configuration validation completed: ${result.summary.passed}/${result.summary.totalChecks} checks passed`,
        ErrorCategory.VALIDATION,
        result.valid ? ErrorSeverity.INFO : ErrorSeverity.WARNING
      );

      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown validation error';
      return {
        valid: false,
        errors: [message],
        warnings: [],
        securityViolations: [],
        summary: {
          totalChecks: 1,
          passed: 0,
          failed: 1,
          warnings: 0,
          securityIssues: 0
        }
      };
    }
  };

  /**
   * Validate and throw on failure
   */
  const validateStrict = (config: any, options: ConfigValidationOptions = {}): any => {
    const result = validate(config, { ...options, strictMode: true });
    
    if (!result.valid) {
      const errorMessage = `Configuration validation failed:\n${result.errors.join('\n')}`;
      throw new Error(errorMessage);
    }

    return result.sanitizedConfig || config;
  };

  /**
   * Update validation schema
   */
  const updateSchema = (newSchema: ValidationSchema): void => {
    state.schema = { ...state.schema, ...newSchema };
  };

  /**
   * Get validation statistics
   */
  const getStats = () => ({
    errors: state.errors.length,
    warnings: state.warnings.length,
    securityViolations: state.securityViolations.length,
    schemaKeys: Object.keys(state.schema).length
  });

  return {
    validate,
    validateStrict,
    updateSchema,
    getStats,
    getErrors: () => [...state.errors],
    getWarnings: () => [...state.warnings],
    getSecurityViolations: () => [...state.securityViolations],
    isValid: () => state.errors.length === 0,
    reset: () => {
      state.errors = [];
      state.warnings = [];
      state.securityViolations = [];
    }
  };
};