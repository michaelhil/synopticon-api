/**
 * Common field validation utilities
 * Shared validation logic across all distributor validators
 */

import { ValidationConstraints } from './validator-types.js';
import type { FieldValidator } from './validator-types.js';

/**
 * Creates field validation utility functions
 */
export const createFieldValidators = (): FieldValidator => {
  
  const required = (value: any, fieldName: string): string | null => {
    if (value === undefined || value === null) {
      return `${fieldName} is required`;
    }
    return null;
  };

  const url = (value: string, fieldName: string): string | null => {
    if (!value || typeof value !== 'string') {
      return `${fieldName} must be a non-empty string`;
    }

    try {
      new URL(value);
      return null;
    } catch {
      return `${fieldName} must be a valid URL`;
    }
  };

  const port = (value: number, fieldName: string): string | null => {
    if (typeof value !== 'number' || !Number.isInteger(value)) {
      return `${fieldName} must be an integer`;
    }

    if (value < ValidationConstraints.PORT_MIN || value > ValidationConstraints.PORT_MAX) {
      return `${fieldName} must be between ${ValidationConstraints.PORT_MIN} and ${ValidationConstraints.PORT_MAX}`;
    }

    // Check for commonly problematic ports
    const problematicPorts = [22, 23, 25, 53, 110, 143, 993, 995];
    if (problematicPorts.includes(value)) {
      // This is a warning, not an error - return null but caller can check separately
      return null;
    }

    return null;
  };

  const positiveNumber = (value: number, fieldName: string): string | null => {
    if (typeof value !== 'number' || isNaN(value)) {
      return `${fieldName} must be a number`;
    }

    if (value <= 0) {
      return `${fieldName} must be positive`;
    }

    return null;
  };

  const nonEmptyString = (value: string, fieldName: string): string | null => {
    if (typeof value !== 'string') {
      return `${fieldName} must be a string`;
    }

    if (value.trim().length === 0) {
      return `${fieldName} cannot be empty`;
    }

    return null;
  };

  const array = (value: any[], fieldName: string): string | null => {
    if (!Array.isArray(value)) {
      return `${fieldName} must be an array`;
    }

    return null;
  };

  const object = (value: any, fieldName: string): string | null => {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return `${fieldName} must be an object`;
    }

    return null;
  };

  // Additional specialized validators
  const hostname = (value: string, fieldName: string): string | null => {
    const stringError = nonEmptyString(value, fieldName);
    if (stringError) return stringError;

    // Basic hostname validation
    const hostnameRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    
    if (!hostnameRegex.test(value) && !ipRegex.test(value) && value !== 'localhost') {
      return `${fieldName} must be a valid hostname or IP address`;
    }

    return null;
  };

  const range = (value: number, fieldName: string, min: number, max: number): string | null => {
    const numberError = positiveNumber(value, fieldName);
    if (numberError) return numberError;

    if (value < min || value > max) {
      return `${fieldName} must be between ${min} and ${max}`;
    }

    return null;
  };

  const enumValue = (value: any, fieldName: string, allowedValues: readonly any[]): string | null => {
    if (!allowedValues.includes(value)) {
      return `${fieldName} must be one of: ${allowedValues.join(', ')}`;
    }

    return null;
  };

  const mqttTopic = (value: string, fieldName: string): string | null => {
    const stringError = nonEmptyString(value, fieldName);
    if (stringError) return stringError;

    // MQTT topic validation
    if (value.includes('#') && !value.endsWith('#')) {
      return `${fieldName}: wildcard '#' must be the last character`;
    }

    if (value.includes('#') && value.indexOf('#') !== value.lastIndexOf('#')) {
      return `${fieldName}: only one '#' wildcard is allowed`;
    }

    if (value.includes('+')) {
      const segments = value.split('/');
      for (const segment of segments) {
        if (segment.includes('+') && segment !== '+') {
          return `${fieldName}: '+' wildcard must be a complete segment`;
        }
      }
    }

    // Check for null bytes and other problematic characters
    if (/[\x00-\x1F\x7F]/.test(value)) {
      return `${fieldName}: contains invalid control characters`;
    }

    return null;
  };

  const clientId = (value: string, fieldName: string): string | null => {
    const stringError = nonEmptyString(value, fieldName);
    if (stringError) return stringError;

    if (value.length > 23) {
      return `${fieldName}: MQTT client ID should not exceed 23 characters`;
    }

    // Check for valid characters (alphanumeric and basic symbols)
    if (!/^[a-zA-Z0-9._-]+$/.test(value)) {
      return `${fieldName}: should only contain alphanumeric characters, dots, underscores, and hyphens`;
    }

    return null;
  };

  return {
    required,
    url,
    port,
    positiveNumber,
    nonEmptyString,
    array,
    object,
    
    // Extended validators
    hostname,
    range,
    enumValue,
    mqttTopic,
    clientId
  };
};