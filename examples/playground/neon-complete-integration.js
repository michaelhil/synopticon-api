/**
 * Complete Neon Eye Tracker Integration Example
 * This is YOUR APPLICATION - the bridge between Neon and the distribution system
 */

// ==============================================================================
// PART 1: YOUR APPLICATION SETUP (This runs on your computer/server)
// ==============================================================================

import { createDistributionSessionManager } from '../../src/core/distribution/distribution-session-manager.js';
import { createDistributionConfigManager } from '../../src/core/distribution/distribution-config-manager.js';

/**
 * This is YOUR MAIN APPLICATION that:
 * 1. Receives data from Neon eye tracker
 * 2. Configures where to send it
 * 3. Distributes it to various systems
 */
class NeonIntegrationApp {
  constructor() {
    this.sessionManager = createDistributionSessionManager();
    this.configManager = createDistributionConfigManager();
    this.currentSession = null;
    this.config = null;
  }

  /**
   * Initialize your application with configuration
   * This runs ONCE when you start your app
   */
  async initialize() {
    console.log('🚀 Starting Neon Integration Application');
    
    // ==============================================================
    // THIS IS WHERE THE CONFIG LIVES - Created at runtime
    // ==============================================================
    
    // Option 1: Load from config file
    this.config = await this.loadConfigFromFile();
    
    // Option 2: Load from environment variables
    // this.config = await this.loadConfigFromEnvironment();
    
    // Option 3: Load from command line arguments
    // this.config = await this.loadConfigFromArgs();
    
    // Option 4: Load from database
    // this.config = await this.loadConfigFromDatabase();
    
    // Create the session with this config
    this.currentSession = await this.sessionManager.createSession(
      'neon-session-001', 
      this.config
    );
    
    console.log('✅ Application initialized and ready to receive Neon data');
  }

  /**
   * Load configuration from a JSON file
   * This is NOT hardcoded - it's loaded at runtime
   */
  async loadConfigFromFile() {
    // In real app, you'd read from actual file
    // For example: config/neon-config.json
    const configFile = {
      distributors: {
        mqtt: {
          broker: 'mqtt://localhost:1883',  // Can be changed in config file
          clientId: 'neon-tracker-001',
          topics: {
            gaze: 'eyetracking/neon/gaze',
            events: 'eyetracking/neon/events'
          }
        },
        websocket: {
          port: 8080
        }
      },
      eventRouting: {
        'neon_gaze_data': ['mqtt', 'websocket'],
        'neon_fixation': ['mqtt'],
        'neon_blink': ['mqtt']
      }
    };
    
    return this.configManager.createSessionConfig(configFile);
  }

  /**
   * Load configuration from environment variables
   * This allows different configs for different deployments
   */
  async loadConfigFromEnvironment() {
    return this.configManager.createSessionConfig({
      distributors: {
        mqtt: {
          broker: process.env.MQTT_BROKER || 'mqtt://localhost:1883',
          username: process.env.MQTT_USERNAME,
          password: process.env.MQTT_PASSWORD,
          clientId: process.env.MQTT_CLIENT_ID || 'neon-default'
        }
      },
      eventRouting: {
        'neon_gaze_data': (process.env.GAZE_DISTRIBUTORS || 'mqtt').split(','),
        'neon_fixation': (process.env.FIXATION_DISTRIBUTORS || 'mqtt,http').split(',')
      }
    });
  }

  /**
   * This method is called whenever you receive data from Neon
   * This is the BRIDGE between Neon and the distribution system
   */
  async handleNeonData(dataFromNeon) {
    // Determine what type of data this is
    const dataType = this.identifyDataType(dataFromNeon);
    
    // Route it to the appropriate distributors based on config
    switch (dataType) {
      case 'gaze':
        await this.sessionManager.routeEvent(
          'neon-session-001',
          'neon_gaze_data',  // This matches eventRouting in config
          dataFromNeon
        );
        break;
        
      case 'fixation':
        await this.sessionManager.routeEvent(
          'neon-session-001',
          'neon_fixation',
          dataFromNeon
        );
        break;
        
      case 'blink':
        await this.sessionManager.routeEvent(
          'neon-session-001',
          'neon_blink',
          dataFromNeon
        );
        break;
    }
  }

  identifyDataType(data) {
    // Logic to determine what type of Neon data this is
    if (data.gaze_point) return 'gaze';
    if (data.fixation) return 'fixation';
    if (data.blink) return 'blink';
    return 'unknown';
  }

  /**
   * Change configuration at runtime (not hardcoded!)
   */
  async updateConfiguration(newBroker) {
    console.log('🔄 Updating MQTT broker at runtime');
    
    // Reconfigure the MQTT distributor with new broker
    await this.sessionManager.reconfigureDistributor(
      'neon-session-001',
      'mqtt',
      {
        broker: newBroker,  // New broker address
        clientId: 'neon-tracker-updated'
      }
    );
  }

  /**
   * Clean shutdown
   */
  async shutdown() {
    await this.sessionManager.cleanup();
    console.log('👋 Application shut down');
  }
}

// ==============================================================================
// PART 2: EXAMPLE CONFIG FILES (These live on your filesystem)
// ==============================================================================

/**
 * Example: config/development.json
 */
const developmentConfig = {
  "distributors": {
    "mqtt": {
      "broker": "mqtt://localhost:1883",
      "clientId": "neon-dev"
    },
    "websocket": {
      "port": 8080
    }
  },
  "eventRouting": {
    "neon_gaze_data": ["mqtt", "websocket"],
    "neon_fixation": ["websocket"]
  }
};

/**
 * Example: config/production.json
 */
const productionConfig = {
  "distributors": {
    "mqtt": {
      "broker": "mqtts://production-broker.company.com:8883",
      "username": "neon-prod-user",
      "password": "secure-password",
      "clientId": "neon-prod-001"
    },
    "http": {
      "baseUrl": "https://api.company.com",
      "headers": {
        "Authorization": "Bearer YOUR_API_TOKEN"
      }
    }
  },
  "eventRouting": {
    "neon_gaze_data": ["mqtt"],
    "neon_fixation": ["mqtt", "http"],
    "neon_blink": ["http"]
  }
};

/**
 * Example: config/lab-a.json (different lab, different broker)
 */
const labAConfig = {
  "distributors": {
    "mqtt": {
      "broker": "mqtt://lab-a.university.edu:1883",
      "topics": {
        "prefix": "lab-a/eyetracking"
      }
    }
  }
};

/**
 * Example: config/lab-b.json (different lab, different broker)
 */
const labBConfig = {
  "distributors": {
    "mqtt": {
      "broker": "mqtt://lab-b.university.edu:1883",
      "topics": {
        "prefix": "lab-b/eyetracking"
      }
    }
  }
};

// ==============================================================================
// PART 3: HOW TO RUN YOUR APPLICATION
// ==============================================================================

/**
 * Main entry point - This is what actually runs
 */
async function main() {
  // Create your application instance
  const app = new NeonIntegrationApp();
  
  // Initialize with configuration
  await app.initialize();
  
  // Simulate receiving data from Neon
  // In real app, this would be your Neon SDK/API connection
  setInterval(async () => {
    const mockNeonData = {
      gaze_point: { x: Math.random(), y: Math.random() },
      confidence: 0.95,
      timestamp: Date.now()
    };
    
    await app.handleNeonData(mockNeonData);
  }, 50); // 20Hz for demo
  
  // Example: Change broker after 5 seconds (runtime change!)
  setTimeout(async () => {
    await app.updateConfiguration('mqtt://new-broker.local:1883');
  }, 5000);
  
  // Handle shutdown
  process.on('SIGINT', async () => {
    await app.shutdown();
    process.exit(0);
  });
}

// ==============================================================================
// PART 4: DIFFERENT WAYS TO RUN WITH DIFFERENT CONFIGS
// ==============================================================================

/**
 * Method 1: Using environment variables
 */
// $ MQTT_BROKER=mqtt://lab.local:1883 node neon-app.js

/**
 * Method 2: Using config file
 */
// $ node neon-app.js --config=./config/production.json

/**
 * Method 3: Using command line arguments
 */
// $ node neon-app.js --mqtt-broker=mqtt://custom.local:1883 --mqtt-client=neon-001

/**
 * Method 4: Interactive configuration
 */
async function interactiveSetup() {
  // Could use inquirer or readline to ask user for config
  console.log('Please enter MQTT broker address:');
  // ... get user input
  const broker = 'mqtt://user-provided.local:1883';
  
  return {
    distributors: {
      mqtt: { broker }
    }
  };
}

// ==============================================================================
// PART 5: COMPLETE REAL-WORLD EXAMPLE
// ==============================================================================

/**
 * This is a complete, production-ready Neon integration
 */
class ProductionNeonApp {
  constructor() {
    this.sessionManager = createDistributionSessionManager();
    this.configManager = createDistributionConfigManager();
  }

  async start() {
    // 1. Load configuration based on environment
    const environment = process.env.NODE_ENV || 'development';
    const configPath = `./config/${environment}.json`;
    
    console.log(`📋 Loading config from: ${configPath}`);
    
    // In real app, use fs.readFileSync or import
    const configData = await this.loadConfigFile(configPath);
    
    // 2. Override with environment variables if present
    if (process.env.MQTT_BROKER) {
      configData.distributors.mqtt.broker = process.env.MQTT_BROKER;
      console.log(`🔄 Overriding MQTT broker from env: ${process.env.MQTT_BROKER}`);
    }
    
    // 3. Create session with final config
    const config = this.configManager.createSessionConfig(configData);
    await this.sessionManager.createSession('production-neon', config);
    
    // 4. Connect to actual Neon eye tracker
    await this.connectToNeon();
    
    console.log('✅ Production app ready');
  }

  async loadConfigFile(path) {
    // Simulate loading from file
    // In real app: const data = JSON.parse(fs.readFileSync(path));
    return {
      distributors: {
        mqtt: {
          broker: 'mqtt://production.company.com:1883',
          clientId: `neon-${process.env.HOSTNAME || 'unknown'}`
        }
      },
      eventRouting: {
        'neon_gaze_data': ['mqtt'],
        'neon_events': ['mqtt', 'http']
      }
    };
  }

  async connectToNeon() {
    // This is where you'd connect to actual Neon API/SDK
    console.log('🔌 Connecting to Neon eye tracker...');
    // neonSDK.connect();
    // neonSDK.on('gaze', this.handleGazeData.bind(this));
  }

  async handleGazeData(gazeData) {
    await this.sessionManager.routeEvent(
      'production-neon',
      'neon_gaze_data',
      gazeData
    );
  }
}

// Start the application
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { NeonIntegrationApp, ProductionNeonApp };