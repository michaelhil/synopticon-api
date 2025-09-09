/**
 * Configuration System - Phase 3 Unified Configuration
 * Single source of truth for all system configuration
 * Replaces legacy configuration managers with 50% LOC reduction
 */

// Unified Configuration Manager - Primary export
export { 
  createUnifiedConfigManager,
  type UnifiedConfigManager,
  type UnifiedConfig,
  type ValidationError,
  type ValidationResult,
  type ConfigSource,
  type ConfigWatcher
} from './unified-config-manager.js';

// Configuration schema types for specific modules
export type {
  SynopticonConfig,
  EnvironmentType,
  ConfigurationOptions,
  ConfigValidationResult
} from './schema/config-types.js';

// Configuration validator
export { createConfigValidator } from './config-validator.js';

// Configuration schema
export { createUnifiedConfigSchema } from './schema/unified-config-schema.js';

/**
 * Default factory for creating unified configuration with environment loading
 * Replaces createConfigFromEnvironment and getGlobalConfig
 */
export const createDefaultConfiguration = async () => {
  const configManager = createUnifiedConfigManager();
  
  // Load configuration from environment variables
  await configManager.load([
    { type: 'env', source: '', priority: 1 }
  ]);
  
  return configManager;
};

/**
 * Global configuration instance (singleton pattern)
 */
let globalConfigManager: ReturnType<typeof createUnifiedConfigManager> | null = null;

/**
 * Get or create global configuration manager
 */
export const getGlobalConfigManager = async () => {
  if (!globalConfigManager) {
    globalConfigManager = await createDefaultConfiguration();
  }
  return globalConfigManager;
};

/**
 * Reset global configuration (for testing)
 */
export const resetGlobalConfiguration = () => {
  globalConfigManager = null;
};