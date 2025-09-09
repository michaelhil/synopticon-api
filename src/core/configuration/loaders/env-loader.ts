/**
 * @fileoverview Environment variable configuration loader
 * Maps environment variables to configuration structure
 */

import type { SynopticonConfig, EnvironmentType } from '../schema/config-types.js';

/**
 * Environment variable mapping configuration
 */
export interface EnvMappingConfig {
  prefix?: string;
  separator?: string;
  parseTypes?: boolean;
  required?: string[];
}

/**
 * Create environment variable loader
 */
export const createEnvLoader = (options: EnvMappingConfig = {}) => {
  const {
    prefix = 'SYNOPTICON_',
    separator = '_',
    parseTypes = true,
    required = []
  } = options;

  /**
   * Parse environment variable value to appropriate type
   */
  const parseValue = (value: string): any => {
    if (!parseTypes) return value;

    // Handle boolean values
    if (value.toLowerCase() === 'true') return true;
    if (value.toLowerCase() === 'false') return false;

    // Handle null/undefined
    if (value.toLowerCase() === 'null') return null;
    if (value.toLowerCase() === 'undefined') return undefined;

    // Handle numbers
    if (/^\d+$/.test(value)) {
      const num = parseInt(value, 10);
      return !isNaN(num) ? num : value;
    }
    if (/^\d+\.\d+$/.test(value)) {
      const num = parseFloat(value);
      return !isNaN(num) ? num : value;
    }

    // Handle arrays (comma-separated)
    if (value.includes(',')) {
      return value.split(',').map(item => item.trim()).filter(Boolean);
    }

    // Handle JSON objects
    if ((value.startsWith('{') && value.endsWith('}')) || 
        (value.startsWith('[') && value.endsWith(']'))) {
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    }

    return value;
  };

  /**
   * Convert environment variable name to config path
   */
  const envToConfigPath = (envName: string): string => {
    if (!envName.startsWith(prefix)) {
      return '';
    }

    return envName
      .slice(prefix.length)
      .toLowerCase()
      .replace(new RegExp(separator, 'g'), '.');
  };

  /**
   * Convert config path to environment variable name
   */
  const configPathToEnv = (path: string): string => {
    return prefix + path
      .toUpperCase()
      .replace(/\./g, separator);
  };

  /**
   * Set nested object property by path
   */
  const setNestedProperty = (obj: any, path: string, value: any): void => {
    const keys = path.split('.');
    let current = obj;

    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!(key in current) || typeof current[key] !== 'object' || Array.isArray(current[key])) {
        current[key] = {};
      }
      current = current[key];
    }

    current[keys[keys.length - 1]] = value;
  };

  /**
   * Load configuration from environment variables
   */
  const loadFromEnv = (): Partial<SynopticonConfig> => {
    const config: Partial<SynopticonConfig> = {};

    // Check required environment variables
    const missingRequired: string[] = [];
    for (const requiredPath of required) {
      const envName = configPathToEnv(requiredPath);
      if (!process.env[envName]) {
        missingRequired.push(envName);
      }
    }

    if (missingRequired.length > 0) {
      throw new Error(
        `Missing required environment variables: ${missingRequired.join(', ')`
      );
    }

    // Load all environment variables with the prefix
    for (const [envName, envValue] of Object.entries(process.env)) {
      if (!envName.startsWith(prefix) || !envValue) {
        continue;
      }

      const configPath = envToConfigPath(envName);
      if (!configPath) {
        continue;
      }

      try {
        const parsedValue = parseValue(envValue);
        setNestedProperty(config, configPath, parsedValue);
      } catch (error) {
        throw new Error(
          `Failed to parse environment variable ${envName}: ${error.message}`
        );
      }
    }

    return config;
  };

  /**
   * Get specific environment variable
   */
  const getEnvValue = (configPath: string): any => {
    const envName = configPathToEnv(configPath);
    const envValue = process.env[envName];
    return envValue ? parseValue(envValue) : undefined;
  };

  /**
   * Check if environment variable exists
   */
  const hasEnvValue = (configPath: string): boolean => {
    const envName = configPathToEnv(configPath);
    return envName in process.env;
  };

  /**
   * Load environment-specific settings
   */
  const loadEnvironmentSettings = (): {
    environment: EnvironmentType;
    debug?: boolean;
    port?: number;
  } => {
    const environment = (process.env.NODE_ENV as EnvironmentType) || 'development';
    const debug = getEnvValue('environment.debug');
    const port = getEnvValue('server.port');

    return {
      environment,
      ...(debug !== undefined && { debug }),
      ...(port !== undefined && { port })
    };
  };

  /**
   * Generate environment variable documentation
   */
  const generateEnvDocs = (sampleConfig: Partial<SynopticonConfig>): string[] => {
    const docs: string[] = [];
    
    const addDocs = (obj: any, prefix: string = ''): void => {
      for (const [key, value] of Object.entries(obj)) {
        const path = prefix ? `${prefix}.${key}` : key;
        const envName = configPathToEnv(path);
        
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          addDocs(value, path);
        } else {
          const type = Array.isArray(value) ? 'array' : typeof value;
          const example = Array.isArray(value) 
            ? `"${value.join('\n'),')}"` 
            : JSON.stringify(value);
          
          docs.push(`${envName}=${example} # ${type}`);
        }
      }
    };

    docs.push('# Synopticon Configuration Environment Variables');
    docs.push('# Format: SYNOPTICON_SECTION_PROPERTY=value');
    docs.push('');
    
    addDocs(sampleConfig);
    
    return docs;
  };

  /**
   * List all loaded environment variables
   */
  const listLoadedEnvVars = (): Record<string, any> => {
    const loaded: Record<string, any> = {};
    
    for (const [envName, envValue] of Object.entries(process.env)) {
      if (envName.startsWith(prefix) && envValue) {
        const configPath = envToConfigPath(envName);
        if (configPath) {
          loaded[envName] = parseValue(envValue);
        }
      }
    }
    
    return loaded;
  };

  return {
    loadFromEnv,
    getEnvValue,
    hasEnvValue,
    loadEnvironmentSettings,
    generateEnvDocs,
    listLoadedEnvVars,
    configPathToEnv,
    envToConfigPath,
    
    // Configuration metadata
    prefix,
    separator,
    parseTypes,
    required
  };
};

/**
 * Default environment loader instance
 */
export const envLoader = createEnvLoader();
