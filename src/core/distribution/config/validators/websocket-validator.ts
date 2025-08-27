/**
 * WebSocket Distributor Configuration Validator
 */

import { createFieldValidators } from './field-validators.js';
import { ValidationConstraints } from './validator-types.js';
import type { WebSocketDistributorConfig, ValidationResult, BaseValidator } from './validator-types.js';

/**
 * Creates WebSocket distributor configuration validator
 */
export const createWebSocketValidator = (): BaseValidator<WebSocketDistributorConfig> => {
  const fieldValidators = createFieldValidators();

  const validate = (config: WebSocketDistributorConfig): ValidationResult => {
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
          // Check for ports commonly used by other services
          const problematicPorts = [22, 23, 25, 53, 80, 110, 143, 443, 993, 995];
          if (problematicPorts.includes(config.port)) {
            warnings.push(`port ${config.port} is commonly used by other services`);
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

      // Validate optional compression
      if (config.compression !== undefined) {
        if (typeof config.compression !== 'boolean') {
          errors.push('compression must be a boolean');
        }
      }

      // Validate optional maxConnections
      if (config.maxConnections !== undefined) {
        const maxConnError = fieldValidators.range(
          config.maxConnections, 
          'maxConnections',
          ValidationConstraints.MAX_CONNECTIONS_MIN,
          ValidationConstraints.MAX_CONNECTIONS_MAX
        );
        if (maxConnError) {
          errors.push(maxConnError);
        } else {
          if (config.maxConnections > 1000) {
            warnings.push('high maxConnections may impact performance');
          }
        }
      }

      // Validate optional maxPayload
      if (config.maxPayload !== undefined) {
        const payloadError = fieldValidators.range(
          config.maxPayload,
          'maxPayload', 
          ValidationConstraints.MAX_PAYLOAD_MIN,
          ValidationConstraints.MAX_PAYLOAD_MAX
        );
        if (payloadError) {
          errors.push(payloadError);
        } else {
          if (config.maxPayload > 10 * 1024 * 1024) { // 10MB
            warnings.push('large maxPayload may cause memory issues');
          }
        }
      }

      // Validate optional heartbeatInterval
      if (config.heartbeatInterval !== undefined) {
        const heartbeatError = fieldValidators.range(
          config.heartbeatInterval,
          'heartbeatInterval',
          ValidationConstraints.HEARTBEAT_MIN,
          ValidationConstraints.HEARTBEAT_MAX
        );
        if (heartbeatError) {
          errors.push(heartbeatError);
        } else {
          if (config.heartbeatInterval < 5000) {
            warnings.push('short heartbeatInterval may increase network overhead');
          }
          if (config.heartbeatInterval > 120000) {
            warnings.push('long heartbeatInterval may delay connection issue detection');
          }
        }
      }

      // Type validation
      if (config.type !== 'websocket') {
        errors.push(`type must be 'websocket', got '${config.type}'`);
      }

      // Configuration compatibility checks
      if (config.compression === true && config.maxPayload && config.maxPayload < 1024) {
        warnings.push('compression with small payloads may not provide benefits');
      }

      return { valid: errors.length === 0, errors, warnings };

    } catch (error) {
      errors.push(`Validation error: ${error.message}`);
      return { valid: false, errors, warnings };
    }
  };

  const getSchema = () => ({
    type: 'object',
    required: ['type', 'port'],
    properties: {
      type: { type: 'string', enum: ['websocket'] },
      port: { type: 'number', minimum: 1, maximum: 65535 },
      host: { type: 'string' },
      compression: { type: 'boolean' },
      maxConnections: { 
        type: 'number', 
        minimum: ValidationConstraints.MAX_CONNECTIONS_MIN, 
        maximum: ValidationConstraints.MAX_CONNECTIONS_MAX 
      },
      maxPayload: { 
        type: 'number', 
        minimum: ValidationConstraints.MAX_PAYLOAD_MIN, 
        maximum: ValidationConstraints.MAX_PAYLOAD_MAX 
      },
      heartbeatInterval: { 
        type: 'number', 
        minimum: ValidationConstraints.HEARTBEAT_MIN, 
        maximum: ValidationConstraints.HEARTBEAT_MAX 
      }
    }
  });

  return { validate, getSchema };
};