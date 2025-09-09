/**
 * @fileoverview Configuration loaders index
 * Exports all configuration loaders and creates unified loader
 */

export { createFileLoader, fileLoader } from './file-loader.js';
export { createEnvLoader, envLoader } from './env-loader.js';
export { createRuntimeLoader, runtimeLoader } from './runtime-loader.js';
export type { ConfigFileFormat, FileLoaderOptions } from './file-loader.js';
export type { EnvMappingConfig } from './env-loader.js';
export type { RuntimeLoaderOptions, ConfigChangeEvent } from './runtime-loader.js';

import { createFileLoader } from './file-loader.js';
import { createEnvLoader } from './env-loader.js';
import { createRuntimeLoader } from './runtime-loader.js';
import type { SynopticonConfig, EnvironmentType } from '../schema/config-types.js';

/**
 * Unified loader options
 */
export interface UnifiedLoaderOptions {
  configDir?: string;
  enableFileConfig?: boolean;
  enableEnvConfig?: boolean;
  enableHotReload?: boolean;
  envPrefix?: string;
  requiredEnvVars?: string[];
}

/**
 * Create unified configuration loader that combines all loading strategies
 */
export const createUnifiedLoader = (options: UnifiedLoaderOptions = {}) => {
  const {
    configDir = './config',
    enableFileConfig = true,
    enableEnvConfig = true,
    enableHotReload = false,
    envPrefix = 'SYNOPTICON_',
    requiredEnvVars = []
  } = options;

  const fileLoader = enableFileConfig ? createFileLoader({ configDir }) : null;
  const envLoader = enableEnvConfig ? createEnvLoader({ 
    prefix: envPrefix,
    required: requiredEnvVars 
  }) : null;
  const runtimeLoader = enableHotReload ? createRuntimeLoader({ enableHotReload }) : null;

  /**
   * Deep merge configuration objects
   */
  const deepMerge = (target: any, ...sources: any[]): any => {
    if (!sources.length) return target;
    const source = sources.shift();

    if (source === null || source === undefined) {
      return deepMerge(target, ...sources);
    }

    if (typeof target === 'object' && typeof source === 'object') {
      for (const key in source) {
        if (source[key] === null || source[key] === undefined) {
          target[key] = source[key];
        } else if (typeof source[key] === 'object' && !Array.isArray(source[key])) {
          if (!target[key] || typeof target[key] !== 'object') {
            target[key] = {};
          }
          target[key] = deepMerge({...target[key]}, source[key]);
        } else {
          target[key] = source[key];
        }
      }
    }

    return deepMerge(target, ...sources);
  };

  /**
   * Load complete configuration from all sources
   */
  const loadConfiguration = (environment: EnvironmentType): Partial<SynopticonConfig> => {
    const configs: Partial<SynopticonConfig>[] = [];

    // 1. Load from configuration files (lowest priority)
    if (fileLoader) {
      try {
        const fileConfigs = fileLoader.loadConfigurationChain(environment);
        configs.push(...fileConfigs);
      } catch (error) {
        console.warn(`Failed to load file configuration: ${error.message}`);
      }
    }

    // 2. Load from environment variables (highest priority)
    if (envLoader) {
      try {
        const envConfig = envLoader.loadFromEnv();
        if (Object.keys(envConfig).length > 0) {
          configs.push(envConfig);
        }
      } catch (error) {
        console.warn(`Failed to load environment configuration: ${error.message}`);
      }
    }

    // Merge all configurations
    const mergedConfig = deepMerge({}, ...configs);

    // Initialize runtime loader if enabled
    if (runtimeLoader && Object.keys(mergedConfig).length > 0) {
      runtimeLoader.initialize(mergedConfig);
      
      // Setup file watching for hot reload
      if (fileLoader) {
        const configFiles = [
          `${configDir}/default.json`,
          `${configDir}/${environment}.json`,
          `${configDir}/local.json`
        ];

        for (const filePath of configFiles) {
          try {
            runtimeLoader.watchConfigFile(filePath, () => {
              return fileLoader.loadConfigurationChain(environment)
                .reduce((merged, config) => deepMerge(merged, config), {});
            });
          } catch (error) {
            console.warn(`Failed to setup file watching for ${filePath}: ${error.message}`);
          }
        }
      }
    }

    return mergedConfig;
  };

  /**
   * Get configuration from specific source
   */
  const loadFromSource = (source: 'file' | 'env' | 'runtime', environment: EnvironmentType): Partial<SynopticonConfig> | null => {
    switch (source) {
    case 'file':
      return fileLoader?.loadConfigurationChain(environment).reduce(
        (merged, config) => deepMerge(merged, config), {}
      ) || null;
      
    case 'env':
      return envLoader?.loadFromEnv() || null;
      
    case 'runtime':
      return runtimeLoader?.getCurrentConfig() || null;
      
    default:
      return null;
    }
  };

  /**
   * Generate configuration documentation
   */
  const generateDocs = (sampleConfig: Partial<SynopticonConfig>): {
    envVars: string[];
    fileStructure: string[];
    examples: string[];
  } => {
    const docs = {
      envVars: [],
      fileStructure: [],
      examples: []
    };

    if (envLoader) {
      docs.envVars = envLoader.generateEnvDocs(sampleConfig);
    }

    if (fileLoader) {
      docs.fileStructure = [
        '# File-based configuration structure:',
        `${configDir}/`,
        '├── default.json        # Base configuration',
        '├── development.json    # Development overrides',
        '├── staging.json        # Staging overrides',  
        '├── production.json     # Production overrides',
        '└── local.json          # Local overrides (not committed)'
      ];

      docs.examples = [
        '# Example default.json:',
        JSON.stringify(sampleConfig, null, 2),
        '',
        '# Example development.json:',
        JSON.stringify({
          server: { port: 8081 },
          logging: { level: 'debug' }
        }, null, 2)
      ];
    }

    return docs;
  };

  /**
   * Validate loader configuration
   */
  const validateLoaders = (): { valid: boolean; errors: string[]; warnings: string[] } => {
    const result = { valid: true, errors: [], warnings: [] };

    if (enableFileConfig && fileLoader && !fileLoader.validateConfigDirectory()) {
      result.warnings.push(`Configuration directory does not exist: ${configDir}`);
    }

    if (enableEnvConfig && requiredEnvVars.length > 0 && envLoader) {
      try {
        envLoader.loadFromEnv();
      } catch (error) {
        result.valid = false;
        result.errors.push(error.message);
      }
    }

    if (!enableFileConfig && !enableEnvConfig) {
      result.warnings.push('No configuration sources enabled');
    }

    return result;
  };

  /**
   * Get loader status and statistics
   */
  const getLoaderStats = () => ({
    fileLoader: fileLoader ? {
      enabled: true,
      configDir: fileLoader.configDir,
      format: fileLoader.format,
      availableConfigs: fileLoader.listAvailableConfigs()
    } : { enabled: false },
    
    envLoader: envLoader ? {
      enabled: true,
      prefix: envLoader.prefix,
      loadedVars: Object.keys(envLoader.listLoadedEnvVars()).length
    } : { enabled: false },
    
    runtimeLoader: runtimeLoader ? {
      enabled: true,
      ...runtimeLoader.getStats()
    } : { enabled: false }
  });

  /**
   * Cleanup all loaders
   */
  const cleanup = () => {
    runtimeLoader?.cleanup();
  };

  return {
    loadConfiguration,
    loadFromSource,
    generateDocs,
    validateLoaders,
    getLoaderStats,
    cleanup,
    
    // Direct access to loaders
    fileLoader,
    envLoader,
    runtimeLoader,
    
    // Configuration
    options: {
      configDir,
      enableFileConfig,
      enableEnvConfig,
      enableHotReload,
      envPrefix,
      requiredEnvVars
    }
  };
};

/**
 * Default unified loader instance
 */
export const unifiedLoader = createUnifiedLoader();
