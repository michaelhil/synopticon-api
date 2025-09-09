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
} as const;

// Security-focused validation rules
export const SecurityRules = {
  NO_EVAL: 'no_eval',
  NO_PROTO_POLLUTION: 'no_proto_pollution', 
  SAFE_PATH: 'safe_path',
  SANITIZED_STRING: 'sanitized_string',
  TRUSTED_URL: 'trusted_url',
  TRUSTED_HOST: 'trusted_host'
} as const;

// Protected keys that should never be set directly
export const PROTECTED_KEYS: readonly string[] = [
  '__proto__',
  'constructor', 
  'prototype',
  'hasOwnProperty',
  'valueOf',
  'toString'
];

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
];

// Type definitions
export type ValidationTypeKey = keyof typeof ValidationTypes;
export type SecurityRuleKey = keyof typeof SecurityRules;

export interface ValidationRule {
  type?: string;
  required?: boolean;
  values?: readonly string[];
  range?: readonly [number, number];
  length?: {
    min?: number;
    max?: number;
  };
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  securityViolations: string[];
}

// Helper: Check if value is required but missing
export const validateRequired = (
  value: unknown, 
  rule: ValidationRule, 
  path: string
): ValidationResult | null => {
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
export const validateType = (
  value: unknown, 
  rule: ValidationRule, 
  path: string
): { errors: string[] } | null => {
  if (!rule.type) return null;
  
  const actualType = Array.isArray(value) ? 'array' : typeof value;
  const errors: string[] = [];
  
  if (rule.type === ValidationTypes.ENUM) {
    if (!rule.values || !rule.values.includes(value as string)) {
      errors.push(`${path}: Must be one of: ${rule.values?.join(', ')`);
    }
  } else if (actualType !== rule.type) {
    errors.push(`${path}: Expected ${rule.type}, got ${actualType}`);
  }
  
  return errors.length > 0 ? { errors } : null;
};

// Helper: Validate numeric and string constraints
export const validateConstraints = (
  value: unknown, 
  rule: ValidationRule, 
  path: string
): { errors: string[] } | null => {
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
  
  return errors.length > 0 ? { errors } : null;
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
      const trustedDomains: readonly string[] = [
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

export const validateTrustedHost = (value: unknown): string[] => {
  const violations: string[] = [];
  if (typeof value === 'string') {
    const trustedHosts: readonly string[] = [
      'localhost',
      '127.0.0.1',
      '0.0.0.0'
    ];
    
    // Check if it's a valid IP address pattern
    const ipPattern = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;
    const isValidHostname = /^[a-zA-Z0-9.-]+$/.test(value);
    
    if (!trustedHosts.includes(value) && !ipPattern.test(value) && !isValidHostname) {
      violations.push(`Invalid host format: ${value}`);
    }
    
    // Additional security: warn about binding to all interfaces in production
    if (value === '0.0.0.0') {
      violations.push('Binding to 0.0.0.0 exposes server to all network interfaces');
    }
  }
  return violations;
};

// Main security validation dispatcher
export const validateSecurity = (
  value: unknown, 
  securityRules: string[]
): { violations: string[] } => {
  const violations: string[] = [];

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
      case SecurityRules.TRUSTED_HOST:
        violations.push(...validateTrustedHost(value));
        break;
    }
  }

  return { violations };
};