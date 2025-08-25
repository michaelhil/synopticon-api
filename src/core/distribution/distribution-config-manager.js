/**
 * Distribution Configuration Manager
 * Handles dynamic configuration validation, templates, and runtime switching
 */

import { validatePreset } from './configs/distribution-presets.js';

/**
 * Configuration templates for common scenarios
 */
export const CONFIG_TEMPLATES = {
  // Development/Testing
  local_testing: {
    http: {
      baseUrl: 'http://localhost:3001',
      timeout: 5000,
      retryCount: 1
    },
    websocket: {
      port: 8080,
      host: 'localhost',
      compression: false // Easier debugging
    }
  },

  // Production environments
  production: {
    http: {
      baseUrl: process.env.HTTP_ENDPOINT || 'https://api.research-platform.com',
      timeout: 15000,
      retryCount: 5,
      headers: {
        'Authorization': `Bearer ${process.env.API_TOKEN || ''}`,
        'Content-Type': 'application/json'
      }
    },
    websocket: {
      port: parseInt(process.env.WS_PORT) || 8080,
      host: '0.0.0.0',
      compression: true,
      maxConnections: 1000
    },
    mqtt: {
      broker: process.env.MQTT_BROKER || 'mqtts://broker.research-platform.com:8883',
      username: process.env.MQTT_USERNAME,
      password: process.env.MQTT_PASSWORD,
      qos: 1,
      retain: true
    }
  },

  // Research lab setup
  research_lab: {
    http: {
      baseUrl: process.env.LAB_DATABASE_URL || 'http://lab-server.local:3000',
      timeout: 10000,
      endpoints: {
        participants: '/api/participants',
        sessions: '/api/sessions',
        events: '/api/events'
      }
    },
    websocket: {
      port: 8080,
      host: '0.0.0.0',
      compression: true,
      maxConnections: 50 // Typical lab size
    },
    mqtt: {
      broker: process.env.LAB_MQTT_BROKER || 'mqtt://lab-iot.local:1883',
      clientId: process.env.LAB_ID || 'research-lab',
      topics: {
        prefix: `lab/${process.env.LAB_ID || 'default'}`,
        sensors: `lab/${process.env.LAB_ID || 'default'}/sensors`,
        participants: `lab/${process.env.LAB_ID || 'default'}/participants`
      }
    },
    sse: {
      port: 3002,
      endpoint: '/lab/events',
      maxConnections: 20
    }
  },

  // High-frequency data collection
  high_frequency: {
    udp: {
      port: parseInt(process.env.UDP_PORT) || 9999,
      host: '0.0.0.0',
      maxPayload: 2048,
      targets: (process.env.UDP_TARGETS || '127.0.0.1:9999').split(',').map(target => {
        const [host, port] = target.split(':');
        return { host, port: parseInt(port) };
      })
    },
    websocket: {
      port: parseInt(process.env.WS_PORT) || 8080,
      compression: true,
      maxConnections: 100
    }
  },

  // Mobile/Remote studies
  mobile_remote: {
    http: {
      baseUrl: process.env.MOBILE_API_URL || 'https://mobile-api.research-platform.com',
      timeout: 8000,
      compression: true,
      headers: {
        'User-Agent': 'SynopticonAPI-Mobile/1.0'
      }
    },
    websocket: {
      port: parseInt(process.env.WS_PORT) || 8080,
      compression: true,
      maxPayload: 512 * 1024, // 512KB for mobile
      heartbeatInterval: 60000 // Battery optimization
    }
  }
};

/**
 * Create configuration manager for dynamic config handling
 */
export const createDistributionConfigManager = () => {
  const state = {
    templates: new Map(Object.entries(CONFIG_TEMPLATES)),
    validatedConfigs: new Map(), // Cache validated configs
    environmentVars: new Set() // Track which env vars are used
  };

  /**
   * Register a custom configuration template
   */
  const registerTemplate = (name, template) => {
    state.templates.set(name, template);
    console.log(`📋 Registered configuration template: ${name}`);
  };

  /**
   * Get configuration template
   */
  const getTemplate = (name) => {
    return state.templates.get(name);
  };

  /**
   * List available templates
   */
  const listTemplates = () => {
    return Array.from(state.templates.keys());
  };

  /**
   * Validate distributor configuration
   */
  const validateDistributorConfig = (type, config) => {
    const errors = [];
    const warnings = [];

    switch (type) {
      case 'http':
        if (!config.baseUrl) {
          errors.push('HTTP distributor requires baseUrl');
        }
        if (config.baseUrl && !config.baseUrl.startsWith('http')) {
          errors.push('HTTP baseUrl must start with http:// or https://');
        }
        if (config.timeout && config.timeout < 1000) {
          warnings.push('HTTP timeout less than 1000ms may cause issues');
        }
        break;

      case 'websocket':
        if (!config.port || config.port < 1 || config.port > 65535) {
          errors.push('WebSocket distributor requires valid port (1-65535)');
        }
        if (config.maxConnections && config.maxConnections < 1) {
          errors.push('WebSocket maxConnections must be positive');
        }
        break;

      case 'mqtt':
        if (!config.broker) {
          errors.push('MQTT distributor requires broker URL');
        }
        if (config.broker && !config.broker.match(/^mqtts?:\/\//)) {
          errors.push('MQTT broker must start with mqtt:// or mqtts://');
        }
        if (!config.clientId) {
          warnings.push('MQTT clientId not specified, will use default');
        }
        break;

      case 'udp':
        if (!config.port || config.port < 1 || config.port > 65535) {
          errors.push('UDP distributor requires valid port (1-65535)');
        }
        if (!config.targets || config.targets.length === 0) {
          warnings.push('UDP distributor has no targets configured');
        }
        if (config.maxPayload && config.maxPayload > 65507) {
          warnings.push('UDP maxPayload exceeds UDP maximum (65507 bytes)');
        }
        break;

      case 'sse':
        if (!config.port || config.port < 1 || config.port > 65535) {
          errors.push('SSE distributor requires valid port (1-65535)');
        }
        if (!config.endpoint) {
          warnings.push('SSE endpoint not specified, will use default');
        }
        break;

      default:
        errors.push(`Unknown distributor type: ${type}`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  };

  /**
   * Validate complete session configuration
   */
  const validateSessionConfig = (config) => {
    const validation = {
      valid: true,
      errors: [],
      warnings: [],
      distributorResults: {}
    };

    // Check distributors configuration
    if (config.distributors) {
      for (const [type, distributorConfig] of Object.entries(config.distributors)) {
        const result = validateDistributorConfig(type, distributorConfig);
        validation.distributorResults[type] = result;
        
        if (!result.valid) {
          validation.valid = false;
          validation.errors.push(`${type}: ${result.errors.join(', ')}`);
        }
        
        validation.warnings.push(...result.warnings.map(w => `${type}: ${w}`));
      }
    }

    // Check event routing
    if (config.eventRouting) {
      const distributorTypes = Object.keys(config.distributors || {});
      
      for (const [event, distributors] of Object.entries(config.eventRouting)) {
        if (!Array.isArray(distributors)) {
          validation.errors.push(`Event routing for ${event} must be an array`);
          validation.valid = false;
          continue;
        }
        
        // Check if routed distributors are configured
        const unconfiguredDistributors = distributors.filter(d => !distributorTypes.includes(d));
        if (unconfiguredDistributors.length > 0) {
          validation.warnings.push(
            `Event ${event} routes to unconfigured distributors: ${unconfiguredDistributors.join(', ')}`
          );
        }
      }
    }

    // Check enabled distributors
    if (config.enabledDistributors) {
      const distributorTypes = Object.keys(config.distributors || {});
      const invalidEnabled = config.enabledDistributors.filter(d => !distributorTypes.includes(d));
      
      if (invalidEnabled.length > 0) {
        validation.warnings.push(
          `Enabled distributors not configured: ${invalidEnabled.join(', ')}`
        );
      }
    }

    return validation;
  };

  /**
   * Build configuration from template and environment
   */
  const buildConfigFromTemplate = (templateName, overrides = {}) => {
    const template = state.templates.get(templateName);
    if (!template) {
      throw new Error(`Configuration template not found: ${templateName}`);
    }

    // Deep merge template with overrides.distributors (not overrides directly)
    const config = deepMerge(template, overrides.distributors || overrides);
    
    // Track environment variables used
    trackEnvironmentVariables(config);
    
    return config;
  };

  /**
   * Create session configuration with validation
   */
  const createSessionConfig = (options = {}) => {
    const {
      template = 'local_testing',
      distributors = {},
      eventRouting = {},
      enabledDistributors = null,
      sessionId = null,
      ...otherOptions
    } = options;

    let config = {
      distributors: {},
      eventRouting,
      enabledDistributors,
      ...otherOptions
    };

    // Apply template if specified
    if (template) {
      const templateConfig = buildConfigFromTemplate(template, distributors);
      config.distributors = { ...templateConfig, ...distributors };
    } else {
      config.distributors = distributors;
    }

    // Add session-specific configurations
    if (sessionId) {
      // Add session ID to distributor configs where appropriate
      Object.keys(config.distributors).forEach(type => {
        if (type === 'mqtt' && config.distributors[type].clientId) {
          config.distributors[type].clientId = `${config.distributors[type].clientId}-${sessionId}`;
        }
      });
    }

    // Validate the final configuration
    const validation = validateSessionConfig(config);
    
    if (!validation.valid) {
      throw new Error(`Invalid session configuration: ${validation.errors.join('; ')}`);
    }

    if (validation.warnings.length > 0) {
      console.warn('Configuration warnings:', validation.warnings.join('; '));
    }

    // Cache validated config
    const configKey = `${template || 'custom'}_${sessionId || 'default'}`;
    state.validatedConfigs.set(configKey, config);

    console.log(`✅ Created session configuration: ${configKey}`);
    return config;
  };

  /**
   * Update distributor configuration with validation
   */
  const updateDistributorConfig = (sessionConfig, type, newConfig) => {
    const validation = validateDistributorConfig(type, newConfig);
    
    if (!validation.valid) {
      throw new Error(`Invalid ${type} configuration: ${validation.errors.join('; ')}`);
    }

    if (validation.warnings.length > 0) {
      console.warn(`${type} configuration warnings:`, validation.warnings.join('; '));
    }

    // Update configuration
    const updatedConfig = {
      ...sessionConfig,
      distributors: {
        ...sessionConfig.distributors,
        [type]: newConfig
      }
    };

    console.log(`🔄 Updated ${type} distributor configuration`);
    return updatedConfig;
  };

  /**
   * Track environment variables used in configuration
   */
  const trackEnvironmentVariables = (config) => {
    const configString = JSON.stringify(config);
    const envVarRegex = /process\.env\.([A-Z_][A-Z0-9_]*)/g;
    let match;
    
    while ((match = envVarRegex.exec(configString)) !== null) {
      state.environmentVars.add(match[1]);
    }
  };

  /**
   * Get runtime environment information
   */
  const getRuntimeInfo = () => {
    const envInfo = {};
    
    // Check which environment variables are set
    for (const varName of state.environmentVars) {
      envInfo[varName] = {
        set: !!process.env[varName],
        value: process.env[varName] ? '[SET]' : '[NOT SET]'
      };
    }

    return {
      platform: typeof window !== 'undefined' ? 'browser' : 'node',
      environment: process.env.NODE_ENV || 'development',
      environmentVariables: envInfo,
      availableTemplates: Array.from(state.templates.keys()),
      validatedConfigs: state.validatedConfigs.size
    };
  };

  /**
   * Deep merge utility
   */
  const deepMerge = (target, source) => {
    const result = { ...target };
    
    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = deepMerge(target[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }
    
    return result;
  };

  return {
    // Template management
    registerTemplate,
    getTemplate,
    listTemplates,
    
    // Configuration creation
    createSessionConfig,
    buildConfigFromTemplate,
    updateDistributorConfig,
    
    // Validation
    validateDistributorConfig,
    validateSessionConfig,
    
    // Runtime information
    getRuntimeInfo,
    
    // Utilities
    getValidatedConfigs: () => Array.from(state.validatedConfigs.keys()),
    clearConfigCache: () => state.validatedConfigs.clear()
  };
};

export default createDistributionConfigManager;