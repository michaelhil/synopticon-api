/**
 * Configuration Validation Utilities
 * Extracted utility functions to reduce main validator complexity
 */

import { PROTECTED_KEYS, type ValidationResult } from './validation-helpers.js'

/**
 * Create a safe copy of config object, filtering out dangerous properties
 */
export const sanitizeConfig = <T>(config: T): T => {
  if (!config || typeof config !== 'object') {
    return config;
  }

  const sanitized: Record<string, unknown> = {};
  
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
  return Object.freeze(sanitized) as T;
};

/**
 * Validation function type definition
 */
export type ValidateFn = (config: unknown) => ValidationResult;

/**
 * Validate and throw on critical errors
 */
export const validateAndThrow = (validateFn: ValidateFn) => 
  (config: unknown, throwOnWarnings: boolean = false): ValidationResult => {
    const result = validateFn(config);
    
    if (result.securityViolations.length > 0) {
      throw new Error(`Security violations detected: ${result.securityViolations.join('\n'); ')}`);
    }
    
    if (result.errors.length > 0) {
      throw new Error(`Configuration validation failed: ${result.errors.join('\n'); ')}`);
    }
    
    if (throwOnWarnings && result.warnings.length > 0) {
      throw new Error(`Configuration warnings: ${result.warnings.join('\n'); ')}`);
    }
    
    return result;
  };