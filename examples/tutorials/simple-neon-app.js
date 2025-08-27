#!/usr/bin/env node
/**
 * SIMPLE NEON EYE TRACKER APP
 * This is the actual application you would run
 */

import { createDistributionConfigManager, createDistributionSessionManager } from '../../src/core/distribution/index.js';

// ==============================================================================
// THIS IS YOUR ACTUAL APPLICATION
// You would save this as "neon-app.js" and run it with: node neon-app.js
// ==============================================================================

class NeonApp {
  constructor() {
    this.sessionManager = createDistributionSessionManager();
    this.configManager = createDistributionConfigManager();
    this.session = null;
  }

  /**
   * Start the application
   */
  async start() {
    console.log('Starting Neon Eye Tracker Application\n');
    
    // =========================================================================
    // WHERE CONFIGS LIVE - OPTION 1: External JSON file
    // =========================================================================
    
    // Check if config file exists
    const configFile = './neon-config.json';
    let config;
    
    const configExists = await Bun.file(configFile).exists();
    
    if (configExists) {
      // Load from file using Bun.file()
      console.log(`📋 Loading config from ${configFile}`);
      config = await Bun.file(configFile).json();
    } else {
      // Use default config
      console.log('📋 Using default configuration');
      config = this.getDefaultConfig();
      
      // Save it for next time using Bun.write()
      await Bun.write(configFile, JSON.stringify(config, null, 2));
      console.log(`💾 Saved config to ${configFile} for future use\n`);
    }
    
    // =========================================================================
    // WHERE CONFIGS LIVE - OPTION 2: Override with environment variables
    // =========================================================================
    
    if (process.env.MQTT_BROKER) {
      console.log(`🔄 Overriding MQTT broker from environment: ${process.env.MQTT_BROKER}`);
      config.distributors.mqtt.broker = process.env.MQTT_BROKER;
    }
    
    if (process.env.PARTICIPANT_ID) {
      console.log(`🔄 Setting participant ID from environment: ${process.env.PARTICIPANT_ID}`);
      config.distributors.mqtt.clientId = `neon-${process.env.PARTICIPANT_ID}`;
    }
    
    // =========================================================================
    // WHERE CONFIGS LIVE - OPTION 3: Command line arguments
    // =========================================================================
    
    const args = process.argv.slice(2);
    for (const arg of args) {
      if (arg.startsWith('--mqtt-broker=')) {
        const broker = arg.split('=')[1];
        console.log(`🔄 Overriding MQTT broker from CLI: ${broker}`);
        config.distributors.mqtt.broker = broker;
      }
      if (arg.startsWith('--websocket-port=')) {
        const port = parseInt(arg.split('=')[1]);
        console.log(`🔄 Setting WebSocket port from CLI: ${port}`);
        config.distributors.websocket.port = port;
      }
    }
    
    // Create the session with final config
    console.log('\n📡 Final Configuration:');
    console.log(`   MQTT Broker: ${config.distributors.mqtt.broker}`);
    console.log(`   Client ID: ${config.distributors.mqtt.clientId}`);
    console.log(`   WebSocket Port: ${config.distributors.websocket?.port || 'disabled'}`);
    console.log(`   HTTP Endpoint: ${config.distributors.http?.baseUrl || 'disabled'}`);
    console.log('');
    
    const sessionConfig = this.configManager.createSessionConfig(config);
    this.session = await this.sessionManager.createSession('neon-session', sessionConfig);
    
    console.log('✅ Application ready to receive Neon data\n');
    
    // Start processing Neon data
    this.startNeonProcessing();
  }

  /**
   * Default configuration (NOT hardcoded - this is just the fallback)
   */
  getDefaultConfig() {
    return {
      distributors: {
        mqtt: {
          broker: 'mqtt://localhost:1883',
          clientId: 'neon-default',
          topics: {
            gaze: 'eyetracking/gaze',
            events: 'eyetracking/events'
          }
        },
        websocket: {
          port: 8080,
          compression: true
        }
      },
      eventRouting: {
        'gaze': ['mqtt', 'websocket'],
        'fixation': ['mqtt'],
        'blink': ['mqtt']
      }
    };
  }

  /**
   * This simulates receiving and processing Neon data
   */
  startNeonProcessing() {
    console.log('👁️ Processing Neon eye tracker data...\n');
    
    // In a real app, this would be your Neon SDK connection
    // For demo, we'll simulate data
    let sampleCount = 0;
    
    setInterval(async () => {
      // Simulated Neon data
      const gazeData = {
        x: 0.5 + Math.sin(Date.now() / 1000) * 0.3,
        y: 0.5 + Math.cos(Date.now() / 1000) * 0.3,
        confidence: 0.85 + Math.random() * 0.15,
        timestamp: Date.now()
      };
      
      // Send to configured distributors
      await this.sessionManager.routeEvent('neon-session', 'gaze', gazeData);
      
      sampleCount++;
      if (sampleCount % 20 === 0) {
        console.log(`📊 Processed ${sampleCount} gaze samples`);
      }
      
      // Occasionally send events
      if (Math.random() < 0.05) {
        await this.sessionManager.routeEvent('neon-session', 'fixation', {
          x: gazeData.x,
          y: gazeData.y,
          duration: 200 + Math.random() * 300,
          timestamp: Date.now()
        });
        console.log('🎯 Fixation detected');
      }
      
    }, 50); // 20Hz
  }

  /**
   * Shutdown gracefully
   */
  async shutdown() {
    console.log('\n🛑 Shutting down...');
    await this.sessionManager.cleanup();
    process.exit(0);
  }
}

// ==============================================================================
// RUN THE APPLICATION
// ==============================================================================

const app = new NeonApp();

// Start the app
app.start().catch(error => {
  console.error('❌ Failed to start:', error);
  process.exit(1);
});

// Handle shutdown
process.on('SIGINT', () => {
  app.shutdown();
});

// ==============================================================================
// HOW TO RUN THIS APPLICATION:
// ==============================================================================

console.log(`
================================================================================
NEON EYE TRACKER APPLICATION

This is YOUR application that bridges Neon data to distribution systems.

HOW TO RUN:
-----------
1. Basic:
   $ node simple-neon-app.js

2. With custom MQTT broker:
   $ node simple-neon-app.js --mqtt-broker=mqtt://my-broker.local:1883

3. With environment variables:
   $ MQTT_BROKER=mqtt://lab.local:1883 PARTICIPANT_ID=P001 node simple-neon-app.js

4. Edit neon-config.json to change settings permanently

WHERE CONFIGS LIVE:
-------------------
1. ./neon-config.json (created automatically on first run)
2. Environment variables (override file config)
3. Command line arguments (override everything)

The config is NOT hardcoded - it's loaded at runtime from these sources!
================================================================================
`);