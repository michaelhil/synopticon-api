/**
 * Configuration Validation Helpers
 * Extracted validation helper functions to reduce complexity
 */

// Validation rule types
export const ValidationTypes = {
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
export const SecurityRules = {
  NO_EVAL: 'no_eval',
  NO_PROTO_POLLUTION: 'no_proto_pollution', 
  SAFE_PATH: 'safe_path',
  SANITIZED_STRING: 'sanitized_string',
  TRUSTED_URL: 'trusted_url'
};

// Protected keys that should never be set directly
export const PROTECTED_KEYS = [
  '__proto__',
  'constructor', 
  'prototype',
  'hasOwnProperty',
  'valueOf',
  'toString'
];

// Dangerous patterns to detect
export const DANGEROUS_PATTERNS = [
  /eval\s*\(/,
  /Function\s*\(/,
  /process\.exit/,
  /require\s*\(/,
  /import\s*\(/,
  /<script/i,
  /javascript:/i,
  /on\w+\s*=/i // Event handlers
];

// Helper: Check if value is required but missing
export const validateRequired = (value, rule, path) => {
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
export const validateType = (value, rule, path) => {
  if (!rule.type) return null;
  
  const actualType = Array.isArray(value) ? 'array' : typeof value;
  const errors = [];
  
  if (rule.type === ValidationTypes.ENUM) {
    if (!rule.values || !rule.values.includes(value)) {
      errors.push(`${path}: Must be one of: ${rule.values.join(', ')}`);
    }
  } else if (actualType !== rule.type) {
    errors.push(`${path}: Expected ${rule.type}, got ${actualType}`);
  }
  
  return errors.length > 0 ? { errors } : null;
};

// Helper: Validate numeric and string constraints
export const validateConstraints = (value, rule, path) => {
  const errors = [];
  
  // Range validation for numbers
  if (rule.type === ValidationTypes.NUMBER && rule.range) {
    const [min, max] = rule.range;
    if (value < min || value > max) {
      errors.push(`${path}: Must be between ${min} and ${max}`);
    }
  }
  
  // String length validation  
  if (rule.type === ValidationTypes.STRING && rule.length) {
    if (rule.length.min && value.length < rule.length.min) {
      errors.push(`${path}: Must be at least ${rule.length.min} characters`);
    }
    if (rule.length.max && value.length > rule.length.max) {
      errors.push(`${path}: Must be at most ${rule.length.max} characters`);
    }
  }
  
  return errors.length > 0 ? { errors } : null;
};

// Security validation helpers
export const validateNoEval = (value) => {
  if (typeof value === 'string' && DANGEROUS_PATTERNS.some(pattern => pattern.test(value))) {
    return ['Contains potentially dangerous code patterns'];
  }
  return [];
};

export const validateNoProtoPollution = (value) => {
  const violations = [];
  if (typeof value === 'object' && value !== null) {
    for (const key of Object.keys(value)) {
      if (PROTECTED_KEYS.includes(key)) {
        violations.push(`Attempted to set protected property: ${key}`);
      }
    }
  }
  return violations;
};

export const validateSafePath = (value) => {
  const violations = [];
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

export const validateSanitizedString = (value) => {
  const violations = [];
  if (typeof value === 'string') {
    const unsafeChars = /<|>|"|'|&/;
    if (unsafeChars.test(value)) {
      violations.push('Contains unsanitized characters that could cause XSS');
    }
  }
  return violations;
};

export const validateTrustedUrl = (value) => {
  const violations = [];
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
export const validateSecurity = (value, securityRules) => {
  const violations = [];

  for (const rule of securityRules) {
    switch (rule) {
      case SecurityRules.NO_EVAL:
        violations.push(...validateNoEval(value));
        break;
      case SecurityRules.NO_PROTO_POLLUTION:
        violations.push(...validateNoProtoPollution(value));
        break;
      case SecurityRules.SAFE_PATH:
        violations.push(...validateSafePath(value));
        break;
      case SecurityRules.SANITIZED_STRING:
        violations.push(...validateSanitizedString(value));
        break;
      case SecurityRules.TRUSTED_URL:
        violations.push(...validateTrustedUrl(value));
        break;
    }
  }

  return { violations };
};