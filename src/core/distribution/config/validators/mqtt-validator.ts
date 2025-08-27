/**
 * MQTT Distributor Configuration Validator
 */

import { createFieldValidators } from './field-validators.js';
import type { MqttDistributorConfig, ValidationResult, BaseValidator } from './validator-types.js';

/**
 * Creates MQTT distributor configuration validator
 */
export const createMqttValidator = (): BaseValidator<MqttDistributorConfig> => {
  const fieldValidators = createFieldValidators();

  const validate = (config: MqttDistributorConfig): ValidationResult => {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Validate required fields
      const requiredError = fieldValidators.required(config, 'config');
      if (requiredError) {
        errors.push(requiredError);
        return { valid: false, errors, warnings };
      }

      // Validate required broker
      const brokerRequiredError = fieldValidators.required(config.broker, 'broker');
      if (brokerRequiredError) {
        errors.push(brokerRequiredError);
      } else {
        // Broker can be either URL or hostname:port
        if (config.broker.startsWith('mqtt://') || config.broker.startsWith('mqtts://')) {
          const urlError = fieldValidators.url(config.broker, 'broker');
          if (urlError) {
            errors.push(urlError);
          } else {
            try {
              const url = new URL(config.broker);
              if (!['mqtt:', 'mqtts:'].includes(url.protocol)) {
                errors.push('broker URL must use mqtt:// or mqtts:// protocol');
              }
            } catch {
              errors.push('broker is not a valid URL');
            }
          }
        } else {
          // Assume hostname:port format
          const parts = config.broker.split(':');
          if (parts.length !== 2) {
            errors.push('broker must be either a valid URL or hostname:port format');
          } else {
            const hostnameError = fieldValidators.hostname(parts[0], 'broker hostname');
            if (hostnameError) {
              errors.push(hostnameError);
            }
            
            const portNum = parseInt(parts[1], 10);
            const portError = fieldValidators.port(portNum, 'broker port');
            if (portError) {
              errors.push(`broker port: ${portError}`);
            }
          }
        }
      }

      // Validate optional clientId
      if (config.clientId !== undefined) {
        const clientIdError = fieldValidators.clientId(config.clientId, 'clientId');
        if (clientIdError) {
          errors.push(clientIdError);
        }
      }

      // Validate optional username
      if (config.username !== undefined) {
        const usernameError = fieldValidators.nonEmptyString(config.username, 'username');
        if (usernameError) {
          errors.push(usernameError);
        }
      }

      // Validate optional password
      if (config.password !== undefined) {
        if (typeof config.password !== 'string') {
          errors.push('password must be a string');
        } else {
          // Warn if password is provided without username
          if (!config.username) {
            warnings.push('password provided without username');
          }
          
          // Warn about password security
          if (config.password.length < 8) {
            warnings.push('password should be at least 8 characters long');
          }
        }
      }

      // Validate optional qos
      if (config.qos !== undefined) {
        const qosError = fieldValidators.enumValue(config.qos, 'qos', [0, 1, 2] as const);
        if (qosError) {
          errors.push(qosError);
        }
      }

      // Validate optional retain
      if (config.retain !== undefined) {
        if (typeof config.retain !== 'boolean') {
          errors.push('retain must be a boolean');
        }
      }

      // Validate optional topics
      if (config.topics !== undefined) {
        const topicsError = fieldValidators.object(config.topics, 'topics');
        if (topicsError) {
          errors.push(topicsError);
        } else {
          for (const [key, topic] of Object.entries(config.topics)) {
            if (typeof key !== 'string' || !key.trim()) {
              errors.push('topic keys must be non-empty strings');
              break;
            }
            
            if (typeof topic !== 'string') {
              errors.push('topic values must be strings');
              break;
            }
            
            const topicError = fieldValidators.mqttTopic(topic, `topic '${key}'`);
            if (topicError) {
              errors.push(topicError);
            }
          }
        }
      }

      // Type validation
      if (config.type !== 'mqtt') {
        errors.push(`type must be 'mqtt', got '${config.type}'`);
      }

      // Security recommendations
      if (config.username && config.password && 
          config.broker.startsWith('mqtt://')) {
        warnings.push('using authentication over unencrypted connection - consider mqtts://');
      }

      if (!config.clientId) {
        warnings.push('no clientId specified - broker will generate one automatically');
      }

      return { valid: errors.length === 0, errors, warnings };

    } catch (error) {
      errors.push(`Validation error: ${error.message}`);
      return { valid: false, errors, warnings };
    }
  };

  const getSchema = () => ({
    type: 'object',
    required: ['type', 'broker'],
    properties: {
      type: { type: 'string', enum: ['mqtt'] },
      broker: { type: 'string' },
      clientId: { 
        type: 'string',
        pattern: '^[a-zA-Z0-9._-]+$',
        maxLength: 23
      },
      username: { type: 'string', minLength: 1 },
      password: { type: 'string' },
      qos: { type: 'number', enum: [0, 1, 2] },
      retain: { type: 'boolean' },
      topics: {
        type: 'object',
        additionalProperties: { type: 'string' }
      }
    }
  });

  return { validate, getSchema };
};