/**
 * Distribution Configuration Manager - Main Interface
 * Unified configuration management with validation and runtime switching
 */

import { createLogger } from '../../../shared/utils/logger.js';
import { createHttpValidator } from './validators/http-validator.js';
import { createWebSocketValidator } from './validators/websocket-validator.js';
import { createMqttValidator } from './validators/mqtt-validator.js';
import { createUdpValidator } from './validators/udp-validator.js';
import { createSseValidator } from './validators/sse-validator.js';
import { createTemplateFactory } from './templates/template-factory.js';
import { createSessionConfigManager } from './session/session-config.js';
import { createRuntimeSwitcher } from './session/runtime-switcher.js';

const logger = createLogger({ level: 2 });

// Re-export types from validators
export type { 
  HttpDistributorConfig,
  WebSocketDistributorConfig, 
  MqttDistributorConfig,
  UdpDistributorConfig,
  SseDistributorConfig,
  DistributorConfig,
  ValidationResult
} from './validators/validator-types.js';

export interface ConfigTemplate {
  http?: any;
  websocket?: any;
  mqtt?: any;
  udp?: any;
  sse?: any;
}

export interface SessionConfig {
  distributors: Record<string, any>;
  eventRouting?: Record<string, string[]>;
  enabledDistributors?: string[] | null;
  sessionId?: string | null;
  [key: string]: any;
}

export interface ConfigManagerOptions {
  enableTemplates?: boolean;
  enableRuntimeSwitching?: boolean;
  validateOnSet?: boolean;
  cacheTemplates?: boolean;
  logLevel?: number;
}

/**
 * Creates the main distribution configuration manager
 */
export const createDistributionConfigManager = (options: ConfigManagerOptions = {}) => {
  const config = {
    enableTemplates: options.enableTemplates !== false,
    enableRuntimeSwitching: options.enableRuntimeSwitching !== false,
    validateOnSet: options.validateOnSet !== false,
    cacheTemplates: options.cacheTemplates !== false,
    logLevel: options.logLevel || 2,
    ...options
  };

  // Initialize validators
  const validators = {
    http: createHttpValidator(),
    websocket: createWebSocketValidator(), 
    mqtt: createMqttValidator(),
    udp: createUdpValidator(),
    sse: createSseValidator()
  };

  // Initialize template factory if enabled
  const templateFactory = config.enableTemplates ? createTemplateFactory() : null;
  
  // Initialize session management
  const sessionConfigManager = createSessionConfigManager(config);
  
  // Initialize runtime switcher if enabled
  const runtimeSwitcher = config.enableRuntimeSwitching 
    ? createRuntimeSwitcher(sessionConfigManager, validators)
    : null;

  const state = {
    currentConfig: null as SessionConfig | null,
    validationCache: new Map<string, ValidationResult>(),
    metrics: {
      validationsPerformed: 0,
      validationErrors: 0,
      configSwitches: 0,
      cacheHits: 0
    }
  };

  // Generate cache key for validation results
  const generateValidationCacheKey = (type: string, config: any): string => {
    return `${type}:${JSON.stringify(config, Object.keys(config).sort())}`;
  };

  // Validate distributor configuration
  const validateDistributorConfig = (type: string, distributorConfig: any): ValidationResult => {
    const cacheKey = generateValidationCacheKey(type, distributorConfig);
    
    // Check cache first
    if (state.validationCache.has(cacheKey)) {
      state.metrics.cacheHits++;
      return state.validationCache.get(cacheKey)!;
    }

    const validator = validators[type as keyof typeof validators];
    if (!validator) {
      const result: ValidationResult = {
        valid: false,
        errors: [`Unknown distributor type: ${type}`],
        warnings: []
      };
      return result;
    }

    state.metrics.validationsPerformed++;
    
    try {
      const result = validator.validate(distributorConfig);
      
      if (!result.valid) {
        state.metrics.validationErrors++;
        logger.warn(`Validation failed for ${type} distributor:`, result.errors);
      }
      
      // Cache result
      state.validationCache.set(cacheKey, result);
      
      // Limit cache size
      if (state.validationCache.size > 100) {
        const firstKey = state.validationCache.keys().next().value;
        state.validationCache.delete(firstKey);
      }
      
      return result;
      
    } catch (error) {
      state.metrics.validationErrors++;
      const result: ValidationResult = {
        valid: false,
        errors: [`Validation error: ${error.message}`],
        warnings: []
      };
      return result;
    }
  };

  // Validate complete session configuration
  const validateSessionConfig = (sessionConfig: SessionConfig): ValidationResult => {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!sessionConfig.distributors || typeof sessionConfig.distributors !== 'object') {
      errors.push('Session config must contain distributors object');
      return { valid: false, errors, warnings };
    }

    // Validate each distributor
    for (const [name, distributorConfig] of Object.entries(sessionConfig.distributors)) {
      if (!distributorConfig || typeof distributorConfig !== 'object') {
        errors.push(`Distributor '${name}' configuration is invalid`);
        continue;
      }

      if (!distributorConfig.type) {
        errors.push(`Distributor '${name}' missing type field`);
        continue;
      }

      const validation = validateDistributorConfig(distributorConfig.type, distributorConfig);
      if (!validation.valid) {
        errors.push(...validation.errors.map(err => `${name}: ${err}`));
      }
      warnings.push(...validation.warnings.map(warn => `${name}: ${warn}`));
    }

    // Validate enabled distributors list
    if (sessionConfig.enabledDistributors) {
      for (const enabledName of sessionConfig.enabledDistributors) {
        if (!sessionConfig.distributors[enabledName]) {
          warnings.push(`Enabled distributor '${enabledName}' not found in configuration`);
        }
      }
    }

    return { valid: errors.length === 0, errors, warnings };
  };

  // Set session configuration
  const setSessionConfig = async (sessionConfig: SessionConfig): Promise<void> => {
    if (config.validateOnSet) {
      const validation = validateSessionConfig(sessionConfig);
      if (!validation.valid) {
        throw new Error(`Invalid session configuration: ${validation.errors.join(', ')}`);
      }
      
      if (validation.warnings.length > 0) {
        logger.warn('Session configuration warnings:', validation.warnings);
      }
    }

    const previousConfig = state.currentConfig;
    state.currentConfig = sessionConfig;
    
    if (previousConfig) {
      state.metrics.configSwitches++;
    }

    // Update session manager
    await sessionConfigManager.setConfig(sessionConfig);
    
    logger.info(`Session configuration updated with ${Object.keys(sessionConfig.distributors).length} distributors`);
  };

  // Get current session configuration
  const getSessionConfig = (): SessionConfig | null => {
    return state.currentConfig ? { ...state.currentConfig } : null;
  };

  // Create configuration from template
  const createConfigFromTemplate = (templateName: string, overrides: Record<string, any> = {}): SessionConfig => {
    if (!templateFactory) {
      throw new Error('Template support is disabled');
    }

    const template = templateFactory.getTemplate(templateName);
    const config = templateFactory.applyOverrides(template, overrides);
    
    return sessionConfigManager.createSessionConfig(config);
  };

  // Get available templates
  const getAvailableTemplates = (): string[] => {
    if (!templateFactory) {
      return [];
    }
    return templateFactory.getAvailableTemplates();
  };

  // Runtime configuration switching
  const switchToConfiguration = async (newConfig: SessionConfig): Promise<void> => {
    if (!runtimeSwitcher) {
      throw new Error('Runtime switching is disabled');
    }

    await runtimeSwitcher.switchConfiguration(newConfig);
    state.currentConfig = newConfig;
    state.metrics.configSwitches++;
  };

  // Get configuration for specific distributor
  const getDistributorConfig = (distributorName: string): any => {
    if (!state.currentConfig) {
      return null;
    }
    return state.currentConfig.distributors[distributorName] || null;
  };

  // Update specific distributor configuration
  const updateDistributorConfig = async (distributorName: string, newConfig: any): Promise<void> => {
    if (!state.currentConfig) {
      throw new Error('No active session configuration');
    }

    if (config.validateOnSet) {
      const validation = validateDistributorConfig(newConfig.type || 'unknown', newConfig);
      if (!validation.valid) {
        throw new Error(`Invalid distributor configuration: ${validation.errors.join(', ')}`);
      }
    }

    const updatedConfig = {
      ...state.currentConfig,
      distributors: {
        ...state.currentConfig.distributors,
        [distributorName]: newConfig
      }
    };

    await setSessionConfig(updatedConfig);
  };

  // Get configuration metrics and statistics
  const getMetrics = () => ({
    ...state.metrics,
    activeDistributors: state.currentConfig ? Object.keys(state.currentConfig.distributors).length : 0,
    enabledDistributors: state.currentConfig?.enabledDistributors?.length || 0,
    cacheSize: state.validationCache.size,
    hasActiveConfig: !!state.currentConfig
  });

  // Clear validation cache
  const clearCache = (): void => {
    state.validationCache.clear();
  };

  // Cleanup resources
  const cleanup = async (): Promise<void> => {
    clearCache();
    await sessionConfigManager.cleanup();
    if (runtimeSwitcher) {
      await runtimeSwitcher.cleanup();
    }
    state.currentConfig = null;
  };

  return {
    // Configuration management
    setSessionConfig,
    getSessionConfig,
    getDistributorConfig,
    updateDistributorConfig,
    
    // Validation
    validateSessionConfig,
    validateDistributorConfig,
    
    // Templates
    createConfigFromTemplate,
    getAvailableTemplates,
    
    // Runtime switching
    switchToConfiguration,
    
    // Utilities
    getMetrics,
    clearCache,
    cleanup,
    
    // Component access
    validators,
    templateFactory,
    sessionConfigManager,
    runtimeSwitcher
  };
};