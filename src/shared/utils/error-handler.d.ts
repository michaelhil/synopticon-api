/**
 * Type declarations for error-handler.js and error-handler.ts
 */

export enum ErrorCategory {
  INITIALIZATION = 'initialization',
  VALIDATION = 'validation',
  NETWORK = 'network',
  PROCESSING = 'processing',
  MEMORY = 'memory'
}

export enum ErrorSeverity {
  DEBUG = 'debug',
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical'
}

export interface ErrorContext {
  [key: string]: any;
}

export function handleError(
  message: string,
  category: ErrorCategory,
  severity: ErrorSeverity,
  context?: ErrorContext
): void;

export function createStandardError(message: string, category: string, severity: string): Error;
