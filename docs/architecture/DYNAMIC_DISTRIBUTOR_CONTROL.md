# Dynamic Distributor Control & Session Management

**Version:** 0.5.3  
**Status:** ✅ Production Ready  
**Use Case:** Flexible, runtime-configurable distribution systems

---

## Overview

The dynamic distributor control system provides **session-based management** of distribution channels, allowing you to:

- ✅ **Control which distributors are active** per session
- ✅ **Initialize distributors with runtime configuration** (e.g., different MQTT brokers)  
- ✅ **Enable/disable distributors dynamically** during sessions
- ✅ **Switch configurations** between different phases of research
- ✅ **Manage multiple concurrent sessions** with different setups
- ✅ **Validate configurations** before deployment

---

## Quick Start

### Basic Session Management

```javascript
import { createDistributionSessionManager, createDistributionConfigManager } from './src/core/distribution/index.js';

// Create managers
const sessionManager = createDistributionSessionManager();
const configManager = createDistributionConfigManager();

// Create session with specific distributors
const sessionConfig = configManager.createSessionConfig({
  template: 'research_lab',
  enabledDistributors: ['http', 'websocket'], // Only these active
  distributors: {
    http: { baseUrl: 'http://my-lab-server.local:3000' },
    websocket: { port: 8080 },
    mqtt: { broker: 'mqtt://lab-sensors.local:1883' } // Configured but not enabled
  },
  eventRouting: {
    'participant_joined': ['http'],
    'real_time_data': ['websocket']
  }
});

const session = await sessionManager.createSession('my-study-001', sessionConfig);

// Distribute data through the session
await sessionManager.routeEvent('my-study-001', 'participant_joined', {
  participantId: 'P001',
  timestamp: Date.now()
});
```

### Runtime Distributor Control

```javascript
// Add MQTT distributor mid-session
await sessionManager.enableDistributor('my-study-001', 'mqtt', {
  broker: 'mqtt://new-broker.local:1883',
  clientId: 'study-001-sensors'
});

// Switch to different MQTT broker
await sessionManager.reconfigureDistributor('my-study-001', 'mqtt', {
  broker: 'mqtt://backup-broker.local:1883',
  clientId: 'study-001-backup'
});

// Disable distributor when not needed
await sessionManager.disableDistributor('my-study-001', 'mqtt');
```

---

## Configuration Templates

### Built-in Templates

| Template | Description | Distributors | Use Case |
|----------|-------------|--------------|----------|
| `local_testing` | Development/testing | HTTP, WebSocket | Local development |
| `research_lab` | Lab environment | HTTP, WebSocket, MQTT, SSE | Research studies |
| `production` | Production deployment | HTTP, WebSocket, MQTT | Live systems |
| `high_frequency` | High-speed data | UDP, WebSocket, HTTP | Real-time analytics |
| `mobile_remote` | Mobile optimized | HTTP, WebSocket | Remote studies |

### Using Templates

```javascript
// Use template with overrides
const config = configManager.createSessionConfig({
  template: 'research_lab',
  sessionId: 'study-123',
  distributors: {
    mqtt: { 
      broker: 'mqtt://my-lab-broker.local:1883',
      clientId: 'study-123-sensors' // Will be auto-suffixed
    }
  },
  enabledDistributors: ['http', 'mqtt'] // Only these initially
});
```

### Custom Templates

```javascript
// Register your own template
configManager.registerTemplate('my_lab_setup', {
  http: {
    baseUrl: process.env.LAB_DATABASE_URL || 'http://lab-db.local:3000',
    endpoints: {
      participants: '/api/participants',
      sessions: '/api/sessions'
    }
  },
  mqtt: {
    broker: process.env.LAB_MQTT_BROKER || 'mqtt://lab-iot.local:1883',
    topics: {
      sensors: `lab/${process.env.LAB_ID}/sensors`,
      alerts: `lab/${process.env.LAB_ID}/alerts`
    }
  }
});
```

---

## Session-Based Management

### Creating Sessions

```javascript
// Session with only specific distributors
const pilotSession = await sessionManager.createSession('pilot-001', {
  template: 'local_testing',
  enabledDistributors: ['http'], // Only HTTP for pilot
  distributors: {
    http: { baseUrl: 'http://pilot-server.local:3000' }
  }
});

// Full production session
const productionSession = await sessionManager.createSession('prod-001', {
  template: 'production',
  distributors: {
    http: { baseUrl: process.env.PRODUCTION_API_URL },
    mqtt: { broker: process.env.PRODUCTION_MQTT_BROKER }
  }
});
```

### Multi-Session Management

```javascript
// Manage multiple concurrent sessions
const sessions = [
  {
    id: 'participant-A',
    config: { 
      template: 'mobile_remote',
      distributors: { http: { baseUrl: 'http://mobile-api.com/A' }}
    }
  },
  {
    id: 'participant-B', 
    config: {
      template: 'research_lab',
      distributors: { mqtt: { broker: 'mqtt://lab.local/B' }}
    }
  }
];

for (const { id, config } of sessions) {
  await sessionManager.createSession(id, config);
}

// List all active sessions
const activeSessions = sessionManager.listSessions();
console.log('Active sessions:', activeSessions.map(s => s.sessionId));
```

---

## Environment Integration

### Environment Variables

The system automatically integrates with environment variables:

```javascript
// These are automatically used from process.env
const config = configManager.createSessionConfig({
  template: 'production',
  distributors: {
    http: {
      baseUrl: process.env.HTTP_ENDPOINT, // Will be used automatically
      headers: { 'Authorization': `Bearer ${process.env.API_TOKEN}` }
    },
    mqtt: {
      broker: process.env.MQTT_BROKER,
      username: process.env.MQTT_USERNAME,
      password: process.env.MQTT_PASSWORD
    }
  }
});

// Check which environment variables are needed
const runtimeInfo = configManager.getRuntimeInfo();
console.log('Environment variables:', runtimeInfo.environmentVariables);
```

### Configuration by Environment

```bash
# Development
export NODE_ENV=development
export HTTP_ENDPOINT=http://localhost:3001
export MQTT_BROKER=mqtt://localhost:1883

# Production  
export NODE_ENV=production
export HTTP_ENDPOINT=https://api.myresearchplatform.com
export MQTT_BROKER=mqtts://mqtt.myresearchplatform.com:8883
export API_TOKEN=your_production_token
```

---

## Runtime Control Examples

### Phase-Based Research Study

```javascript
// Phase 1: Setup/Calibration (minimal distributors)
const setupSession = await sessionManager.createSession('setup', {
  template: 'local_testing',
  enabledDistributors: ['websocket'], // Real-time feedback only
  eventRouting: {
    'calibration_status': ['websocket'],
    'setup_complete': ['websocket']
  }
});

// ... setup phase events ...

// Phase 2: Data Collection (add data logging)
await sessionManager.enableDistributor('setup', 'http', {
  baseUrl: 'http://data-collection-server.local:3000'
});

await sessionManager.enableDistributor('setup', 'mqtt', {
  broker: 'mqtt://sensor-network.local:1883'
});

// Update routing for data collection
sessionManager.updateEventRouting('setup', {
  'participant_data': ['http', 'mqtt'],
  'real_time_feedback': ['websocket'],
  'sensor_reading': ['mqtt']
});
```

### Failover and Recovery

```javascript
// Monitor distributor health
const status = await sessionManager.getSessionStatus('my-session');
const unhealthyDistributors = status.health.distributors.filter(d => d.status !== 'healthy');

// Automatic failover for MQTT broker
if (unhealthyDistributors.some(d => d.name.includes('mqtt'))) {
  console.log('MQTT broker unhealthy, switching to backup...');
  
  await sessionManager.reconfigureDistributor('my-session', 'mqtt', {
    broker: 'mqtt://backup-broker.local:1883',
    clientId: 'backup-connection'
  });
}
```

### Dynamic Scaling

```javascript
// Scale up for high-load periods
if (participantCount > 100) {
  // Add UDP for high-frequency data
  await sessionManager.enableDistributor('high-load-session', 'udp', {
    port: 9999,
    targets: [
      { host: 'analysis-server-1.local', port: 9999 },
      { host: 'analysis-server-2.local', port: 9999 },
      { host: 'analysis-server-3.local', port: 9999 }
    ]
  });
  
  // Route high-frequency events to UDP
  sessionManager.updateEventRouting('high-load-session', {
    'gaze_data': ['udp'],
    'pupil_data': ['udp'],
    'other_events': ['websocket', 'http']
  });
}
```

---

## Configuration Validation

### Automatic Validation

```javascript
try {
  const config = configManager.createSessionConfig({
    distributors: {
      http: { baseUrl: 'invalid-url' }, // ❌ Invalid URL
      websocket: { port: 99999 }, // ❌ Invalid port  
      mqtt: {} // ❌ Missing broker
    }
  });
} catch (error) {
  console.error('Configuration error:', error.message);
  // "Invalid session configuration: HTTP baseUrl must start with http:// or https://; 
  //  WebSocket distributor requires valid port (1-65535); 
  //  MQTT distributor requires broker URL"
}
```

### Manual Validation

```javascript
// Validate individual distributor config
const httpValidation = configManager.validateDistributorConfig('http', {
  baseUrl: 'https://api.example.com',
  timeout: 10000
});

if (!httpValidation.valid) {
  console.error('HTTP config errors:', httpValidation.errors);
}

if (httpValidation.warnings.length > 0) {
  console.warn('HTTP config warnings:', httpValidation.warnings);
}
```

---

## Advanced Use Cases

### Research Study Workflow

```javascript
const studyWorkflow = {
  async setupPhase(studyId) {
    return sessionManager.createSession(`${studyId}-setup`, {
      template: 'local_testing',
      enabledDistributors: ['websocket'],
      eventRouting: {
        'calibration_progress': ['websocket'],
        'setup_complete': ['websocket']
      }
    });
  },

  async dataCollectionPhase(studyId, labConfig) {
    // Close setup session
    await sessionManager.closeSession(`${studyId}-setup`);
    
    // Start data collection with full distributors
    return sessionManager.createSession(`${studyId}-data`, {
      template: 'research_lab',
      distributors: {
        http: { baseUrl: labConfig.databaseUrl },
        mqtt: { broker: labConfig.sensorBroker },
        websocket: { port: labConfig.dashboardPort }
      },
      eventRouting: {
        'participant_data': ['http', 'mqtt'],
        'real_time_alert': ['websocket'],
        'sensor_reading': ['mqtt']
      }
    });
  },

  async analysisPhase(studyId, analysisCluster) {
    await sessionManager.closeSession(`${studyId}-data`);
    
    return sessionManager.createSession(`${studyId}-analysis`, {
      template: 'production',
      distributors: {
        http: { baseUrl: analysisCluster.endpoint }
      },
      eventRouting: {
        'analysis_complete': ['http'],
        'report_ready': ['http']
      }
    });
  }
};
```

### Multi-Site Research Coordination

```javascript
// Configure for multi-site study
const sites = [
  { id: 'lab-A', broker: 'mqtt://lab-a.university.edu:1883' },
  { id: 'lab-B', broker: 'mqtt://lab-b.university.edu:1883' },
  { id: 'lab-C', broker: 'mqtt://lab-c.university.edu:1883' }
];

const centralConfig = configManager.createSessionConfig({
  template: 'production',
  distributors: {
    http: { baseUrl: 'https://central-database.study.edu' }
  }
});

const centralSession = await sessionManager.createSession('central-coordination', centralConfig);

// Create site-specific sessions
for (const site of sites) {
  const siteConfig = configManager.createSessionConfig({
    template: 'research_lab',
    sessionId: site.id,
    distributors: {
      mqtt: { 
        broker: site.broker,
        clientId: `central-${site.id}`,
        topics: {
          data: `study/sites/${site.id}/data`,
          status: `study/sites/${site.id}/status`
        }
      },
      http: { baseUrl: 'https://central-database.study.edu' }
    }
  });
  
  await sessionManager.createSession(`site-${site.id}`, siteConfig);
}
```

---

## API Reference

### Session Manager

```javascript
const sessionManager = createDistributionSessionManager(globalConfig);

// Session lifecycle
await sessionManager.createSession(sessionId, config);
const session = sessionManager.getSession(sessionId);
await sessionManager.closeSession(sessionId);
const sessions = sessionManager.listSessions();

// Dynamic distributor control
await sessionManager.enableDistributor(sessionId, type, config);
await sessionManager.disableDistributor(sessionId, type);
await sessionManager.reconfigureDistributor(sessionId, type, newConfig);

// Event routing
sessionManager.updateEventRouting(sessionId, eventRouting);
await sessionManager.distribute(sessionId, event, data, options);
await sessionManager.routeEvent(sessionId, event, data, options);

// Monitoring
const status = await sessionManager.getSessionStatus(sessionId);

// Cleanup
await sessionManager.cleanup();
```

### Config Manager

```javascript
const configManager = createDistributionConfigManager();

// Template management
configManager.registerTemplate(name, template);
const template = configManager.getTemplate(name);
const templates = configManager.listTemplates();

// Configuration creation
const config = configManager.createSessionConfig(options);
const config = configManager.buildConfigFromTemplate(templateName, overrides);
const updatedConfig = configManager.updateDistributorConfig(config, type, newConfig);

// Validation
const validation = configManager.validateDistributorConfig(type, config);
const sessionValidation = configManager.validateSessionConfig(config);

// Runtime info
const runtimeInfo = configManager.getRuntimeInfo();
```

---

## Best Practices

### 1. **Use Templates for Consistency**
```javascript
// ✅ Good: Use templates for consistent setups
const config = configManager.createSessionConfig({
  template: 'research_lab',
  distributors: { mqtt: { broker: labSpecificBroker } }
});

// ❌ Avoid: Manual configuration for common setups
const config = { distributors: { http: { baseUrl: '...' }, websocket: { ... } } };
```

### 2. **Session-Specific Configurations**
```javascript
// ✅ Good: Include session ID for unique identifiers
const config = configManager.createSessionConfig({
  template: 'research_lab',
  sessionId: 'study-001', // Auto-adds to MQTT client ID, etc.
  distributors: { ... }
});
```

### 3. **Environment Variable Integration**
```javascript
// ✅ Good: Use environment variables for deployment flexibility
configManager.registerTemplate('my_deployment', {
  http: { baseUrl: process.env.API_ENDPOINT },
  mqtt: { broker: process.env.MQTT_BROKER }
});
```

### 4. **Validation Before Deployment**
```javascript
// ✅ Good: Always validate configurations
try {
  const config = configManager.createSessionConfig(userConfig);
  await sessionManager.createSession(sessionId, config);
} catch (error) {
  console.error('Configuration invalid:', error.message);
  // Handle gracefully
}
```

### 5. **Graceful Session Cleanup**
```javascript
// ✅ Good: Always cleanup sessions
process.on('SIGINT', async () => {
  console.log('Cleaning up sessions...');
  await sessionManager.cleanup();
  process.exit(0);
});
```

---

This dynamic control system provides complete flexibility for managing distributors across different research phases, environments, and requirements while maintaining type safety and configuration validation.