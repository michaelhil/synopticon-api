/**
 * @fileoverview File-based configuration loader
 * Loads configuration from JSON/YAML files with validation
 */

import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import type { SynopticonConfig, EnvironmentType } from '../schema/config-types.js';

/**
 * Configuration file formats
 */
export type ConfigFileFormat = 'json' | 'yaml' | 'js';

/**
 * File loader options
 */
export interface FileLoaderOptions {
  configDir?: string;
  format?: ConfigFileFormat;
  encoding?: BufferEncoding;
  required?: boolean;
}

/**
 * Create file-based configuration loader
 */
export const createFileLoader = (options: FileLoaderOptions = {}) => {
  const {
    configDir = './config',
    format = 'json',
    encoding = 'utf8',
    required = false
  } = options;

  /**
   * Load configuration from file
   */
  const loadFromFile = (filename: string): Partial<SynopticonConfig> | null => {
    const filePath = resolve(configDir, filename);
    
    if (!existsSync(filePath)) {
      if (required) {
        throw new Error(`Required configuration file not found: ${filePath}`);
      }
      return null;
    }

    try {
      const content = readFileSync(filePath, encoding);
      
      switch (format) {
      case 'json':
        return JSON.parse(content);
      case 'js':
        // Dynamic import for JS files
        delete require.cache[filePath];
        const moduleExports = require(filePath);
        return moduleExports.default || moduleExports;
      case 'yaml':
        throw new Error('YAML support not implemented. Use JSON or JS format.');
      default:
        throw new Error(`Unsupported configuration format: ${format}`);
      }
    } catch (error) {
      throw new Error(
        `Failed to load configuration from ${filePath}: ${error.message}`
      );
    }
  };

  /**
   * Load environment-specific configuration
   */
  const loadEnvironmentConfig = (environment: EnvironmentType): Partial<SynopticonConfig> | null => {
    const filename = `${environment}.${format}`;
    return loadFromFile(filename);
  };

  /**
   * Load base configuration
   */
  const loadBaseConfig = (): Partial<SynopticonConfig> | null => {
    const filename = `default.${format}`;
    return loadFromFile(filename);
  };

  /**
   * Load local override configuration
   */
  const loadLocalConfig = (): Partial<SynopticonConfig> | null => {
    const filename = `local.${format}`;
    return loadFromFile(filename);
  };

  /**
   * Load complete configuration chain
   */
  const loadConfigurationChain = (environment: EnvironmentType): Partial<SynopticonConfig>[] => {
    const configs: Partial<SynopticonConfig>[] = [];

    // Load base configuration
    const baseConfig = loadBaseConfig();
    if (baseConfig) {
      configs.push(baseConfig);
    }

    // Load environment-specific configuration
    const envConfig = loadEnvironmentConfig(environment);
    if (envConfig) {
      configs.push(envConfig);
    }

    // Load local overrides (should never be committed)
    const localConfig = loadLocalConfig();
    if (localConfig) {
      configs.push(localConfig);
    }

    return configs;
  };

  /**
   * Check if configuration directory exists
   */
  const validateConfigDirectory = (): boolean => {
    return existsSync(resolve(configDir));
  };

  /**
   * List available configuration files
   */
  const listAvailableConfigs = (): string[] => {
    if (!validateConfigDirectory()) {
      return [];
    }

    try {
      const fs = require('fs');
      return fs.readdirSync(resolve(configDir))
        .filter((file: string) => file.endsWith(`.${format}`))
        .sort();
    } catch {
      return [];
    }
  };

  return {
    loadFromFile,
    loadEnvironmentConfig,
    loadBaseConfig,
    loadLocalConfig,
    loadConfigurationChain,
    validateConfigDirectory,
    listAvailableConfigs,
    
    // Configuration metadata
    configDir: resolve(configDir),
    format,
    encoding,
    required
  };
};

/**
 * Default file loader instance
 */
export const fileLoader = createFileLoader();
