/**
 * MCP Parameter Validation Utilities
 * Validation helpers for MCP tool parameters
 */

import { MCPError, MCPErrorCode } from './error-handler.ts';

export interface ValidationRule {
  type?: 'string' | 'number' | 'boolean' | 'object' | 'array';
  required?: boolean;
  min?: number;
  max?: number;
  enum?: readonly string[];
  pattern?: RegExp;
  custom?: (value: unknown) => boolean | string;
}

export interface ValidationSchema {
  [key: string]: ValidationRule;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  sanitized?: Record<string, unknown>;
}

/**
 * Validate parameters against schema
 */
export const validateParameters = (
  params: Record<string, unknown>,
  schema: ValidationSchema
): ValidationResult => {
  const errors: string[] = [];
  const sanitized: Record<string, unknown> = {};

  // Check required fields
  for (const [key, rule] of Object.entries(schema)) {
    if (rule.required && !(key in params)) {
      errors.push(`Missing required parameter: ${key}`);
      continue;
    }

    const value = params[key];
    
    // Skip validation for optional undefined values
    if (value === undefined && !rule.required) {
      continue;
    }

    // Type validation
    if (rule.type && !validateType(value, rule.type)) {
      errors.push(`Parameter '${key}' must be of type ${rule.type}`);
      continue;
    }

    // Enum validation
    if (rule.enum && !rule.enum.includes(value as string)) {
      errors.push(`Parameter '${key}' must be one of: ${rule.enum.join(', ')}`);
      continue;
    }

    // String validations
    if (rule.type === 'string' && typeof value === 'string') {
      if (rule.min !== undefined && value.length < rule.min) {
        errors.push(`Parameter '${key}' must be at least ${rule.min} characters`);
        continue;
      }
      
      if (rule.max !== undefined && value.length > rule.max) {
        errors.push(`Parameter '${key}' must be at most ${rule.max} characters`);
        continue;
      }

      if (rule.pattern && !rule.pattern.test(value)) {
        errors.push(`Parameter '${key}' format is invalid`);
        continue;
      }
    }

    // Number validations
    if (rule.type === 'number' && typeof value === 'number') {
      if (rule.min !== undefined && value < rule.min) {
        errors.push(`Parameter '${key}' must be at least ${rule.min}`);
        continue;
      }
      
      if (rule.max !== undefined && value > rule.max) {
        errors.push(`Parameter '${key}' must be at most ${rule.max}`);
        continue;
      }
    }

    // Custom validation
    if (rule.custom) {
      const customResult = rule.custom(value);
      if (typeof customResult === 'string') {
        errors.push(`Parameter '${key}': ${customResult}`);
        continue;
      }
      if (customResult === false) {
        errors.push(`Parameter '${key}' failed custom validation`);
        continue;
      }
    }

    sanitized[key] = value;
  }

  return {
    valid: errors.length === 0,
    errors,
    sanitized: errors.length === 0 ? sanitized : undefined
  };
};

/**
 * Validate parameter type
 */
const validateType = (value: unknown, expectedType: string): boolean => {
  switch (expectedType) {
    case 'string':
      return typeof value === 'string';
    case 'number':
      return typeof value === 'number' && !isNaN(value);
    case 'boolean':
      return typeof value === 'boolean';
    case 'object':
      return typeof value === 'object' && value !== null && !Array.isArray(value);
    case 'array':
      return Array.isArray(value);
    default:
      return false;
  }
};

/**
 * Create validation decorator for tool functions
 */
export const withValidation = (schema: ValidationSchema) => {
  return <T extends (...args: any[]) => any>(
    target: T
  ): T => {
    return (async (...args: Parameters<T>) => {
      const params = args[0] as Record<string, unknown>;
      const result = validateParameters(params, schema);
      
      if (!result.valid) {
        throw new MCPError(
          MCPErrorCode.VALIDATION_ERROR,
          `Parameter validation failed: ${result.errors.join(', ')}`,
          { errors: result.errors, params }
        );
      }

      return target(result.sanitized, ...args.slice(1));
    }) as T;
  };
};

/**
 * Common validation schemas for reuse
 */
export const CommonSchemas = {
  deviceId: {
    type: 'string' as const,
    pattern: /^[a-zA-Z0-9_-]+$/,
    max: 50
  },
  
  quality: {
    type: 'string' as const,
    enum: ['low', 'medium', 'high'] as const
  },
  
  threshold: {
    type: 'number' as const,
    min: 0,
    max: 1
  },
  
  timeout: {
    type: 'number' as const,
    min: 100,
    max: 30000
  }
} as const;