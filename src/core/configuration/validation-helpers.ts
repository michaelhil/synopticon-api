/**
 * Configuration Validation Helpers
 * Extracted validation helper functions with TypeScript support
 */

import { 
  ValidationTypes, 
  SecurityRules, 
  type ValidationType,
  type SecurityRule,
  type ValidationRule,
  type ValidationResult,
  type SecurityViolation
} from './validation-types.js';

// Protected keys that should never be set directly
export const PROTECTED_KEYS: readonly string[] = [
  '__proto__',
  'constructor', 
  'prototype',
  'hasOwnProperty',
  'valueOf',
  'toString'
] as const;

// Dangerous patterns to detect
export const DANGEROUS_PATTERNS: readonly RegExp[] = [
  /eval\s*\(/,
  /Function\s*\(/,
  /process\.exit/,
  /require\s*\(/,
  /import\s*\(/,
  /<script/i,
  /javascript:/i,
  /on\w+\s*=/i // Event handlers
] as const;

// Helper: Check if value is required but missing
export const validateRequired = (value: unknown, rule: ValidationRule, path: string): ValidationResult | null => {
  if (rule.required && (value === undefined || value === null)) {
    return {
      valid: false,
      errors: [`${path}: Required field is missing`],
      warnings: [],
      securityViolations: []
    };
  }
  return null;
};

// Helper: Validate type constraints
export const validateType = (value: unknown, rule: ValidationRule, path: string): ValidationResult | null => {
  if (!rule.type) return null;
  
  const actualType = Array.isArray(value) ? 'array' : typeof value;
  const errors: string[] = [];
  
  if (rule.type === ValidationTypes.ENUM) {
    if (!rule.values || !rule.values.includes(value)) {
      errors.push(`${path}: Must be one of: ${rule.values?.join(', ') || 'undefined values'}`);
    }
  } else if (actualType !== rule.type) {
    errors.push(`${path}: Expected ${rule.type}, got ${actualType}`);
  }
  
  return errors.length > 0 ? { 
    valid: false, 
    errors, 
    warnings: [], 
    securityViolations: [] 
  } : null;
};

// Helper: Validate numeric and string constraints
export const validateConstraints = (value: unknown, rule: ValidationRule, path: string): ValidationResult | null => {
  const errors: string[] = [];
  
  // Range validation for numbers
  if (rule.type === ValidationTypes.NUMBER && rule.range && typeof value === 'number') {
    const [min, max] = rule.range;
    if (value < min || value > max) {
      errors.push(`${path}: Must be between ${min} and ${max}`);
    }
  }
  
  // String length validation  
  if (rule.type === ValidationTypes.STRING && rule.length && typeof value === 'string') {
    if (rule.length.min && value.length < rule.length.min) {
      errors.push(`${path}: Must be at least ${rule.length.min} characters`);
    }
    if (rule.length.max && value.length > rule.length.max) {
      errors.push(`${path}: Must be at most ${rule.length.max} characters`);
    }
  }
  
  return errors.length > 0 ? { 
    valid: false, 
    errors, 
    warnings: [], 
    securityViolations: [] 
  } : null;
};

// Security validation helpers
export const validateNoEval = (value: unknown): string[] => {
  if (typeof value === 'string' && DANGEROUS_PATTERNS.some(pattern => pattern.test(value))) {
    return ['Contains potentially dangerous code patterns'];
  }
  return [];
};

export const validateNoProtoPollution = (value: unknown): string[] => {
  const violations: string[] = [];
  if (typeof value === 'object' && value !== null) {
    for (const key of Object.keys(value)) {
      if (PROTECTED_KEYS.includes(key)) {
        violations.push(`Attempted to set protected property: ${key}`);
      }
    }
  }
  return violations;
};

export const validateSafePath = (value: unknown): string[] => {
  const violations: string[] = [];
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
  return violations;
};

export const validateSanitizedString = (value: unknown): string[] => {
  const violations: string[] = [];
  if (typeof value === 'string') {
    const unsafeChars = /<|>|"|'|&/;
    if (unsafeChars.test(value)) {
      violations.push('Contains unsanitized characters that could cause XSS');
    }
  }
  return violations;
};

export const validateTrustedUrl = (value: unknown): string[] => {
  const violations: string[] = [];
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
      
      if (!trustedDomains.some(domain => url.hostname === domain || url.hostname.endsWith(`.${domain}`))) {
        violations.push(`Untrusted domain: ${url.hostname}`);
      }
    } catch {
      violations.push('Invalid URL format');
    }
  }
  return violations;
};

// Main security validation dispatcher
export const validateSecurity = (
  value: unknown, 
  securityRules: readonly SecurityRule[], 
  path: string
): { violations: SecurityViolation[]; severity?: 'warning' | 'error' } => {
  const violations: SecurityViolation[] = [];

  for (const rule of securityRules) {
    let ruleViolations: string[] = [];
    
    switch (rule) {
      case SecurityRules.NO_EVAL:
        ruleViolations = validateNoEval(value);
        break;
      case SecurityRules.NO_PROTO_POLLUTION:
        ruleViolations = validateNoProtoPollution(value);
        break;
      case SecurityRules.SAFE_PATH:
        ruleViolations = validateSafePath(value);
        break;
      case SecurityRules.SANITIZED_STRING:
        ruleViolations = validateSanitizedString(value);
        break;
      case SecurityRules.TRUSTED_URL:
        ruleViolations = validateTrustedUrl(value);
        break;
    }
    
    // Convert string violations to structured violations
    for (const violationMessage of ruleViolations) {
      violations.push({
        type: rule,
        message: violationMessage,
        severity: 'error',
        path
      });
    }
  }

  return { 
    violations,
    severity: violations.length > 0 ? 'error' : undefined
  };
};

// Re-export types and constants
export { ValidationTypes, SecurityRules };
export type { ValidationType, SecurityRule, ValidationRule, ValidationResult, SecurityViolation };