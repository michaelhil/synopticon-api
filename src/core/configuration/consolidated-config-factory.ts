/**
 * Consolidated Configuration Factory
 * Single factory to replace all scattered configuration factories
 */

import { createConsolidatedDefaults } from './defaults/consolidated-defaults.js';
import { createConsolidatedConfigSchema } from './schema/consolidated-config-schema.js';
import { createConfigValidator } from './config-validator.js'
import { handleError, ErrorCategory, ErrorSeverity } from '../../shared/utils/error-handler.js'
import type { ConsolidatedSynopticonConfig } from './schema/extended-config-types.js';

/**
 * Configuration creation options
 */
export interface ConsolidatedConfigOptions {
  /** Environment override */
  environment?: 'development' | 'staging' | 'production';
  /** Skip security validation (internal use only) */
  skipSecurityValidation?: boolean;
  /** Enable strict validation */
  strictMode?: boolean;
  /** Configuration overrides */
  overrides?: Partial<ConsolidatedSynopticonConfig>;
}

/**
 * Creates consolidated Synopticon configuration
 * Replaces all scattered configuration factories with single unified approach
 */
export const createConsolidatedConfig = (options: ConsolidatedConfigOptions = {}): ConsolidatedSynopticonConfig => {
  const {
    environment = 'development',
    skipSecurityValidation = false,
    strictMode = true,
    overrides = {}
  } = options;

  try {
    // Start with defaults
    const defaults = createConsolidatedDefaults();
    
    // Apply environment-specific overrides
    const environmentOverrides = getEnvironmentOverrides(environment);
    
    // Merge all configurations in order of precedence
    const mergedConfig = {
      ...defaults,
      ...environmentOverrides,
      ...overrides
    } as ConsolidatedSynopticonConfig;

    // Create validator with appropriate settings
    const validator = createConfigValidator({
      _strictMode: strictMode,
      environment
    });

    // Validate configuration if not skipped
    if (!skipSecurityValidation) {
      const validation = validator.validate(mergedConfig);
      
      if (!validation.valid) {
        throw new Error(`Configuration validation failed: ${validation.errors.join('\n'); ')}`);
      }
      
      if (validation.securityViolations.length > 0) {
        throw new Error(`Configuration security violations: ${validation.securityViolations.join('\n'); ')}`);
      }
      
      if (validation.warnings.length > 0) {
        handleError(
          `Configuration warnings: ${validation.warnings.join(', ')`,
          ErrorCategory.VALIDATION,
          ErrorSeverity.WARNING,
          { environment, warnings: validation.warnings }
        );
      }
    }

    // Sanitize final configuration
    const sanitizedConfig = validator.sanitizeConfig(mergedConfig);

    handleError(
      `Consolidated configuration created successfully for ${environment}`,
      ErrorCategory.INITIALIZATION,
      ErrorSeverity.INFO,
      { 
        environment,
        configSections: Object.keys(sanitizedConfig),
        hasOverrides: Object.keys(overrides).length > 0
      }
    );

    return sanitizedConfig as ConsolidatedSynopticonConfig;

  } catch (error) {
    handleError(
      `Failed to create consolidated configuration: ${error.message}`,
      ErrorCategory.INITIALIZATION,
      ErrorSeverity.ERROR,
      { environment, overrides: Object.keys(overrides) }
    );
    throw error;
  }
};

/**
 * Creates pipeline-specific configuration (replaces createPipelineConfig)
 */
export const createPipelineConfig = (
  type: string, 
  userConfig: Record<string, any> = {}, 
  options: ConsolidatedConfigOptions = {}
) => {
  const fullConfig = createConsolidatedConfig(options);
  
  // Extract pipeline configuration for specific type
  const pipelineConfig = {
    ...fullConfig.pipeline,
    ...userConfig,
    type
  };

  // Validate type exists
  if (!fullConfig.pipeline || !(type in fullConfig.pipeline)) {
    const supportedTypes = Object.keys(fullConfig.pipeline || {});
    throw new Error(`Unsupported pipeline type: ${type}. Supported types: ${supportedTypes.join(', ')`);
  }

  return pipelineConfig;
};

/**
 * Creates speech analysis configuration (replaces createSpeechAnalysisConfig)
 */
export const createSpeechAnalysisConfig = (
  userConfig: Record<string, any> = {},
  options: ConsolidatedConfigOptions = {}
) => {
  const fullConfig = createConsolidatedConfig(options);
  
  return {
    ...fullConfig.speechAnalysis,
    ...userConfig
  };
};

/**
 * Creates rate limiting configuration (replaces createRateLimitConfig)
 * Returns a config manager object for compatibility with existing middleware
 */
export const createRateLimitConfig = (
  userConfig: Record<string, any> = {},
  options: ConsolidatedConfigOptions = {}
) => {
  const fullConfig = createConsolidatedConfig(options);
  const rateLimitConfig = {
    ...fullConfig.rateLimit,
    ...userConfig
  };

  // Return a manager object with methods for compatibility
  return {
    getRouteConfig: (pathname: string) => {
      // Check for exact match first
      if (rateLimitConfig.routeLimits.has(pathname)) {
        return { ...rateLimitConfig, ...rateLimitConfig.routeLimits.get(pathname) };
      }
      
      // Check for pattern matches
      for (const [pattern, routeConfig] of rateLimitConfig.routeLimits.entries()) {
        if (pattern.includes('*') || pattern.includes('/')) {
          const regex = new RegExp(pattern.replace(/\*/g, '.*'));
          if (regex.test(pathname)) {
            return { ...rateLimitConfig, ...routeConfig };
          }
        }
      }
      
      return rateLimitConfig;
    },
    
    addRouteLimit: (pattern: string, limits: Record<string, any>) => {
      rateLimitConfig.routeLimits.set(pattern, limits);
      console.log(`🚦 Added route rate limit: ${pattern} -> ${limits.maxRequests}/${limits.windowMs}ms`);
    },
    
    updateConfig: (updates: Record<string, any>) => {
      Object.assign(rateLimitConfig, updates);
      console.log('🔧 Rate limiting configuration updated');
    },
    
    getConfig: () => ({ ...rateLimitConfig })
  };
};

/**
 * Creates AGC configuration (replaces createAGCConfig)
 */
export const createAGCConfig = (
  userConfig: Record<string, any> = {},
  options: ConsolidatedConfigOptions = {}
) => {
  const fullConfig = createConsolidatedConfig(options);
  
  return {
    ...fullConfig.speechAnalysis.audio.agc,
    ...userConfig
  };
};

/**
 * Creates VAD configuration (replaces createVADConfig)
 */
export const createVADConfig = (
  userConfig: Record<string, any> = {},
  options: ConsolidatedConfigOptions = {}
) => {
  const fullConfig = createConsolidatedConfig(options);
  
  return {
    ...fullConfig.speechAnalysis.audio.vad,
    ...userConfig
  };
};

/**
 * Creates MCP configuration (replaces MCP config creation)
 */
export const createMCPConfig = (
  userConfig: Record<string, any> = {},
  options: ConsolidatedConfigOptions = {}
) => {
  const fullConfig = createConsolidatedConfig(options);
  
  return {
    ...fullConfig.mcp,
    ...userConfig
  };
};

/**
 * Environment-specific configuration overrides
 */
const getEnvironmentOverrides = (environment: string): Partial<ConsolidatedSynopticonConfig> => {
  switch (environment) {
    case 'production':
      return {
        defaults: {
          timeout: 10000,
          retryAttempts: 3,
          enableCaching: true,
          cacheTimeout: 300000,
          enableMetrics: true,
          enableHealthChecks: true
        }
      } as Partial<ConsolidatedSynopticonConfig>;
      
    case 'staging':
      return {
        defaults: {
          timeout: 15000,
          retryAttempts: 3,
          enableCaching: true,
          cacheTimeout: 300000,
          enableMetrics: true,
          enableHealthChecks: true
        }
      } as Partial<ConsolidatedSynopticonConfig>;
      
    case 'development':
    default:
      return {
        defaults: {
          timeout: 20000,
          retryAttempts: 5,
          enableCaching: true,
          cacheTimeout: 300000,
          enableMetrics: true,
          enableHealthChecks: true
        }
      } as Partial<ConsolidatedSynopticonConfig>;
  }
};

/**
 * Utility: Get default configuration for specific section
 */
export const getDefaultConfig = (section: keyof ConsolidatedSynopticonConfig) => {
  const defaults = createConsolidatedDefaults();
  return defaults[section];
};

/**
 * Utility: Validate configuration compatibility
 */
export const areConfigsCompatible = (config1: any, config2: any): boolean => {
  if (!config1 || !config2) return false;
  
  // Same type configurations are always compatible
  if (config1.type === config2.type) return true;
  
  // MediaPipe variants are compatible with each other
  const mediaPipeTypes = ['mediapipe-face-mesh', 'mediapipe-face', 'iris-tracking'];
  if (mediaPipeTypes.includes(config1.type) && mediaPipeTypes.includes(config2.type)) {
    return true;
  }
  
  return false;
};

/**
 * Export supported types and constants
 */
export { SUPPORTED_PIPELINE_TYPES } from './defaults/consolidated-defaults.js';