/**
 * Configuration Validation Utilities
 * Extracted utility functions to reduce main validator complexity
 */

import { PROTECTED_KEYS } from './validation-helpers.js';

/**
 * Create a safe copy of config object, filtering out dangerous properties
 * @param {Object} config - Configuration object
 * @returns {Object} - Sanitized configuration object
 */
export const sanitizeConfig = (config) => {
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
 * @param {Function} validateFn - Validation function
 * @param {Object} config - Configuration to validate
 * @param {boolean} throwOnWarnings - Whether to throw on warnings
 */
export const validateAndThrow = (validateFn) => (config, throwOnWarnings = false) => {
  const result = validateFn(config);
  
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