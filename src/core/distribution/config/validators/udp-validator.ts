/**
 * UDP Distributor Configuration Validator
 */

import { createFieldValidators } from './field-validators.js';
import { ValidationConstraints } from './validator-types.js';
import type { UdpDistributorConfig, ValidationResult, BaseValidator } from './validator-types.js';

/**
 * Creates UDP distributor configuration validator
 */
export const createUdpValidator = (): BaseValidator<UdpDistributorConfig> => {
  const fieldValidators = createFieldValidators();

  const validate = (config: UdpDistributorConfig): ValidationResult => {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Validate required fields
      const requiredError = fieldValidators.required(config, 'config');
      if (requiredError) {
        errors.push(requiredError);
        return { valid: false, errors, warnings };
      }

      // Validate required port
      const portRequiredError = fieldValidators.required(config.port, 'port');
      if (portRequiredError) {
        errors.push(portRequiredError);
      } else {
        const portError = fieldValidators.port(config.port, 'port');
        if (portError) {
          errors.push(portError);
        } else {
          // Check for ports commonly used by other UDP services
          const problematicPorts = [53, 67, 68, 123, 161, 514, 520];
          if (problematicPorts.includes(config.port)) {
            warnings.push(`port ${config.port} is commonly used by other UDP services`);
          }
          
          // Warn about privileged ports
          if (config.port < 1024) {
            warnings.push('ports below 1024 require elevated privileges');
          }
        }
      }

      // Validate optional host
      if (config.host !== undefined) {
        const hostError = fieldValidators.hostname(config.host, 'host');
        if (hostError) {
          errors.push(hostError);
        }
      }

      // Validate optional maxPayload
      if (config.maxPayload !== undefined) {
        const payloadError = fieldValidators.range(
          config.maxPayload,
          'maxPayload',
          ValidationConstraints.MAX_PAYLOAD_MIN,
          Math.min(ValidationConstraints.MAX_PAYLOAD_MAX, 65507) // UDP max payload size
        );
        if (payloadError) {
          errors.push(payloadError);
        } else {
          // UDP-specific payload size warnings
          if (config.maxPayload > 65507) {
            errors.push('maxPayload cannot exceed UDP maximum of 65507 bytes');
          } else if (config.maxPayload > 1472) {
            warnings.push('payloads larger than 1472 bytes may be fragmented');
          } else if (config.maxPayload > 508) {
            warnings.push('payloads larger than 508 bytes may not work on all networks');
          }
        }
      }

      // Validate required targets
      const targetsRequiredError = fieldValidators.required(config.targets, 'targets');
      if (targetsRequiredError) {
        errors.push(targetsRequiredError);
      } else {
        const targetsArrayError = fieldValidators.array(config.targets, 'targets');
        if (targetsArrayError) {
          errors.push(targetsArrayError);
        } else {
          if (config.targets.length === 0) {
            errors.push('targets array cannot be empty');
          } else {
            // Validate each target
            const seenTargets = new Set<string>();
            
            for (let i = 0; i < config.targets.length; i++) {
              const target = config.targets[i];
              
              if (!target || typeof target !== 'object') {
                errors.push(`target[${i}] must be an object`);
                continue;
              }

              // Validate target host
              const hostRequiredError = fieldValidators.required(target.host, `target[${i}].host`);
              if (hostRequiredError) {
                errors.push(hostRequiredError);
              } else {
                const hostError = fieldValidators.hostname(target.host, `target[${i}].host`);
                if (hostError) {
                  errors.push(hostError);
                }
              }

              // Validate target port
              const portRequiredError = fieldValidators.required(target.port, `target[${i}].port`);
              if (portRequiredError) {
                errors.push(portRequiredError);
              } else {
                const portError = fieldValidators.port(target.port, `target[${i}].port`);
                if (portError) {
                  errors.push(portError);
                }
              }

              // Check for duplicate targets
              if (target.host && typeof target.port === 'number') {
                const targetKey = `${target.host}:${target.port}`;
                if (seenTargets.has(targetKey)) {
                  warnings.push(`duplicate target: ${targetKey}`);
                } else {
                  seenTargets.add(targetKey);
                }
              }

              // Check for invalid target combinations
              if (target.host === '0.0.0.0' || target.host === '::') {
                errors.push(`target[${i}].host cannot be a wildcard address`);
              }

              if (target.host === '127.0.0.1' || target.host === 'localhost') {
                warnings.push(`target[${i}] points to localhost`);
              }
            }

            // Performance warnings for large target lists
            if (config.targets.length > 100) {
              warnings.push('large number of targets may impact performance');
            }
          }
        }
      }

      // Type validation
      if (config.type !== 'udp') {
        errors.push(`type must be 'udp', got '${config.type}'`);
      }

      // Network reliability warnings
      warnings.push('UDP is unreliable - consider using TCP-based distributors for critical data');

      return { valid: errors.length === 0, errors, warnings };

    } catch (error) {
      errors.push(`Validation error: ${error.message}`);
      return { valid: false, errors, warnings };
    }
  };

  const getSchema = () => ({
    type: 'object',
    required: ['type', 'port', 'targets'],
    properties: {
      type: { type: 'string', enum: ['udp'] },
      port: { type: 'number', minimum: 1, maximum: 65535 },
      host: { type: 'string' },
      maxPayload: { 
        type: 'number', 
        minimum: ValidationConstraints.MAX_PAYLOAD_MIN,
        maximum: 65507 // UDP maximum
      },
      targets: {
        type: 'array',
        minItems: 1,
        items: {
          type: 'object',
          required: ['host', 'port'],
          properties: {
            host: { type: 'string' },
            port: { type: 'number', minimum: 1, maximum: 65535 }
          }
        }
      }
    }
  });

  return { validate, getSchema };
};