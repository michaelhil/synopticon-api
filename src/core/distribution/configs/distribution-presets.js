/**
 * Distribution Presets
 * Pre-configured distribution patterns for common use cases
 */

/**
 * Get predefined distribution configurations
 * @returns {Object} Available distribution presets
 */
export const getDistributionPresets = () => ({
  
  /**
   * Basic setup - HTTP REST only
   * Good for: Simple API integrations, testing
   */
  basic: {
    distributors: ['http'],
    eventRouting: {
      'face_detected': ['http'],
      'system_health': ['http'],
      'error': ['http']
    },
    config: {
      http: {
        enabled: true,
        baseUrl: process.env.HTTP_WEBHOOK_URL || 'http://localhost:3000',
        timeout: 10000,
        retryCount: 3
      }
    }
  },

  /**
   * Real-time setup - HTTP + WebSocket
   * Good for: Dashboards, live monitoring, interactive applications
   */
  realtime: {
    distributors: ['http', 'websocket'],
    eventRouting: {
      'face_detected': ['websocket', 'http'],
      'emotion_analyzed': ['websocket'],
      'gaze_tracking': ['websocket'],
      'system_health': ['http'],
      'error': ['websocket', 'http']
    },
    config: {
      http: {
        enabled: true,
        baseUrl: process.env.HTTP_WEBHOOK_URL || 'http://localhost:3000',
        endpoints: {
          webhook: '/webhook/synopticon',
          health: '/health'
        }
      },
      websocket: {
        enabled: true,
        port: parseInt(process.env.WS_PORT) || 8080,
        host: process.env.WS_HOST || '0.0.0.0',
        compression: true,
        heartbeatInterval: 30000
      }
    }
  },

  /**
   * IoT setup - MQTT + HTTP
   * Good for: IoT devices, distributed systems, pub-sub architecture
   */
  iot: {
    distributors: ['mqtt', 'http'],
    eventRouting: {
      'face_detected': ['mqtt'],
      'emotion_analyzed': ['mqtt'],
      'sensor_data': ['mqtt'],
      'system_health': ['mqtt', 'http'],
      'alert': ['mqtt', 'http'],
      'error': ['mqtt', 'http']
    },
    config: {
      mqtt: {
        enabled: true,
        broker: process.env.MQTT_BROKER || 'mqtt://localhost:1883',
        clientId: process.env.MQTT_CLIENT_ID || 'synopticon-api',
        topics: {
          prefix: 'synopticon',
          faces: 'synopticon/faces',
          emotions: 'synopticon/emotions',
          health: 'synopticon/health',
          alerts: 'synopticon/alerts'
        },
        qos: 1,
        retain: false
      },
      http: {
        enabled: true,
        baseUrl: process.env.HTTP_BACKUP_URL || 'http://localhost:3000',
        endpoints: {
          backup: '/mqtt-backup'
        }
      }
    }
  },

  /**
   * High-performance setup - UDP + WebSocket + HTTP
   * Good for: Real-time analytics, high-frequency data, low-latency requirements
   */
  performance: {
    distributors: ['udp', 'websocket', 'http'],
    eventRouting: {
      'gaze_tracking': ['udp', 'websocket'],        // High-frequency data
      'face_tracking': ['udp', 'websocket'],        // High-frequency data
      'face_detected': ['websocket', 'http'],       // Regular events
      'emotion_analyzed': ['websocket', 'http'],    // Regular events
      'batch_complete': ['http'],                   // Low-frequency events
      'system_health': ['http'],                    // System events
      'error': ['websocket', 'http']                // Error handling
    },
    config: {
      udp: {
        enabled: true,
        port: parseInt(process.env.UDP_PORT) || 9999,
        host: process.env.UDP_HOST || '127.0.0.1',
        compress: true,
        maxPayload: 1024
      },
      websocket: {
        enabled: true,
        port: parseInt(process.env.WS_PORT) || 8080,
        compression: true,
        maxConnections: 500
      },
      http: {
        enabled: true,
        baseUrl: process.env.HTTP_API_URL || 'http://localhost:3000'
      }
    }
  },

  /**
   * Enterprise setup - All protocols with advanced features
   * Good for: Production deployments, enterprise systems, maximum flexibility
   */
  enterprise: {
    distributors: ['http', 'websocket', 'mqtt', 'udp', 'sse'],
    eventRouting: {
      // High-frequency real-time data
      'gaze_tracking': ['udp', 'websocket'],
      'face_tracking': ['udp', 'websocket'],
      
      // Regular analysis events
      'face_detected': ['websocket', 'mqtt', 'http'],
      'emotion_analyzed': ['websocket', 'mqtt', 'http'],
      'age_estimated': ['websocket', 'mqtt', 'http'],
      
      // System events
      'system_health': ['sse', 'mqtt', 'http'],
      'performance_metrics': ['sse', 'http'],
      
      // Alerts and errors
      'alert': ['websocket', 'mqtt', 'http'],
      'error': ['websocket', 'mqtt', 'http'],
      
      // Batch and reporting
      'batch_complete': ['http', 'mqtt'],
      'report_generated': ['http']
    },
    config: {
      http: {
        enabled: true,
        baseUrl: process.env.HTTP_API_URL || 'http://localhost:3000',
        timeout: 15000,
        retryCount: 5,
        endpoints: {
          webhook: '/webhook/synopticon',
          events: '/api/events',
          health: '/api/health',
          reports: '/api/reports'
        }
      },
      websocket: {
        enabled: true,
        port: parseInt(process.env.WS_PORT) || 8080,
        host: '0.0.0.0',
        compression: true,
        maxConnections: 1000,
        heartbeatInterval: 30000
      },
      mqtt: {
        enabled: true,
        broker: process.env.MQTT_BROKER || 'mqtt://localhost:1883',
        clientId: `synopticon-${Date.now()}`,
        username: process.env.MQTT_USERNAME,
        password: process.env.MQTT_PASSWORD,
        qos: 1,
        retain: true,
        topics: {
          prefix: 'enterprise/synopticon',
          faces: 'enterprise/synopticon/faces',
          emotions: 'enterprise/synopticon/emotions',
          health: 'enterprise/synopticon/health',
          alerts: 'enterprise/synopticon/alerts',
          metrics: 'enterprise/synopticon/metrics'
        }
      },
      udp: {
        enabled: true,
        port: parseInt(process.env.UDP_PORT) || 9999,
        host: '0.0.0.0',
        compress: true,
        maxPayload: 2048
      },
      sse: {
        enabled: true,
        endpoint: '/events/stream',
        heartbeatInterval: 30000,
        compression: false
      }
    }
  },

  /**
   * Development setup - All protocols for testing
   * Good for: Development, testing, experimentation
   */
  development: {
    distributors: ['http', 'websocket', 'mqtt'],
    eventRouting: {
      '*': ['http', 'websocket', 'mqtt']  // Send all events to all distributors
    },
    config: {
      enableHealthCheck: true,
      healthCheckInterval: 10000, // More frequent in development
      retryAttempts: 1, // Less retries in development
      http: {
        enabled: true,
        baseUrl: 'http://localhost:3001',
        timeout: 5000
      },
      websocket: {
        enabled: true,
        port: 8080,
        host: 'localhost',
        compression: false // Easier debugging
      },
      mqtt: {
        enabled: true,
        broker: 'mqtt://localhost:1883',
        clientId: 'synopticon-dev',
        qos: 0, // Faster in development
        topics: {
          prefix: 'dev/synopticon'
        }
      }
    }
  },

  /**
   * Mobile-optimized setup - Lightweight for mobile apps
   * Good for: Mobile applications, bandwidth-limited environments
   */
  mobile: {
    distributors: ['http', 'websocket'],
    eventRouting: {
      'face_detected': ['websocket'],     // Real-time for UI
      'emotion_analyzed': ['websocket'],  // Real-time for UI
      'batch_complete': ['http'],         // Reliable delivery
      'error': ['http']                   // Reliable delivery
    },
    config: {
      http: {
        enabled: true,
        baseUrl: process.env.MOBILE_API_URL || 'https://api.yourapp.com',
        timeout: 8000,
        compression: true
      },
      websocket: {
        enabled: true,
        port: parseInt(process.env.WS_PORT) || 8080,
        compression: true,
        maxPayload: 512 * 1024, // 512KB limit for mobile
        heartbeatInterval: 60000 // Less frequent for battery
      }
    }
  }
});

/**
 * Get a specific preset configuration
 * @param {string} presetName - Name of the preset to retrieve
 * @returns {Object|null} Preset configuration or null if not found
 */
export const getDistributionPreset = (presetName) => {
  const presets = getDistributionPresets();
  return presets[presetName] || null;
};

/**
 * List available preset names
 * @returns {string[]} Array of available preset names
 */
export const getAvailablePresets = () => {
  return Object.keys(getDistributionPresets());
};

/**
 * Validate a preset configuration
 * @param {Object} preset - Preset configuration to validate
 * @returns {Object} Validation result with isValid boolean and errors array
 */
export const validatePreset = (preset) => {
  const errors = [];
  
  if (!preset.distributors || !Array.isArray(preset.distributors)) {
    errors.push('Preset must have distributors array');
  }
  
  if (!preset.config || typeof preset.config !== 'object') {
    errors.push('Preset must have config object');
  }
  
  // Check that all distributors in routing are defined
  if (preset.eventRouting) {
    for (const [event, distributors] of Object.entries(preset.eventRouting)) {
      if (Array.isArray(distributors)) {
        for (const distributor of distributors) {
          if (!preset.distributors.includes(distributor)) {
            errors.push(`Event ${event} routes to undefined distributor: ${distributor}`);
          }
        }
      }
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

export default getDistributionPresets;