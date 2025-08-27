/**
 * Configuration Validation Type Definitions
 * TypeScript interfaces and types for validation system
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

export type ValidationType = typeof ValidationTypes[keyof typeof ValidationTypes];

// Security-focused validation rules
export const SecurityRules = {
  NO_EVAL: 'no_eval',
  NO_PROTO_POLLUTION: 'no_proto_pollution', 
  SAFE_PATH: 'safe_path',
  SANITIZED_STRING: 'sanitized_string',
  TRUSTED_URL: 'trusted_url'
} as const;

export type SecurityRule = typeof SecurityRules[keyof typeof SecurityRules];

// Validation rule interface
export interface ValidationRule {
  type?: ValidationType;
  required?: boolean;
  values?: readonly unknown[];
  range?: readonly [number, number];
  length?: {
    min?: number;
    max?: number;
  };
  regex?: RegExp;
  security?: readonly SecurityRule[];
  validate?: (value: unknown, path: string) => boolean | ValidationResult;
  sanitize?: (value: unknown) => unknown;
  skipSecurity?: boolean;
  properties?: ValidationSchema;
}

// Validation schema interface
export interface ValidationSchema {
  [key: string]: ValidationRule | ValidationSchema;
}

// Validation result interface
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  securityViolations: SecurityViolation[];
  message?: string;
}

// Security violation interface
export interface SecurityViolation {
  type: SecurityRule;
  message: string;
  severity: 'warning' | 'error';
  path: string;
}