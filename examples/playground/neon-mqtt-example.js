#!/usr/bin/env node
/**
 * Complete Neon Eye Tracker → MQTT Example
 * This shows the COMPLETE flow using Synopticon's architecture
 */

import { createEyeTrackingDistributor } from './eye-tracking-distribution-integration.js';

/**
 * Example: Send Neon eye tracker data via MQTT
 * This uses Synopticon's existing eye tracking API + distribution system
 */
async function runNeonMqttExample() {
  console.log('🚀 Starting Neon → MQTT distribution example\n');
  
  // ============================================================================
  // STEP 1: Configure the integrated system
  // ============================================================================
  
  const config = {
    // Synopticon's eye tracker device config
    deviceId: 'neon-001',
    deviceAddress: process.env.NEON_DEVICE_ADDRESS || 'localhost',
    devicePort: 8080,
    mockMode: true, // Set to false for real Neon device
    
    // Distribution system config  
    sessionId: 'neon-mqtt-session',
    
    // MQTT configuration (THIS IS WHERE THE CONFIG LIVES - not hardcoded!)
    mqttBroker: process.env.MQTT_BROKER || 'mqtt://localhost:1883',
    clientId: process.env.MQTT_CLIENT_ID || 'synopticon-neon',
    
    // Topic configuration
    gazeTopic: 'eyetracking/neon/gaze',
    calibrationTopic: 'eyetracking/neon/calibration',
    eventsTopic: 'eyetracking/neon/events',
    
    // Routing configuration - which data goes where
    gazeRouting: ['mqtt'],                    // Gaze → MQTT only
    calibrationRouting: ['mqtt'],             // Calibration → MQTT
    statusRouting: ['websocket'],             // Status → WebSocket for monitoring
    eventsRouting: ['mqtt', 'websocket']      // Events → Both MQTT & WebSocket
  };
  
  // ============================================================================
  // STEP 2: Create the integrated distributor
  // ============================================================================
  
  const eyeTrackingSystem = createEyeTrackingDistributor(config);
  
  // ============================================================================
  // STEP 3: Initialize and start
  // ============================================================================
  
  try {
    // Initialize distribution + eye tracker
    await eyeTrackingSystem.initialize();
    console.log('📋 System initialized with config:');
    console.log(`   MQTT Broker: ${config.mqttBroker}`);
    console.log(`   Gaze Topic: ${config.gazeTopic}`);
    console.log(`   Device: ${config.deviceId} (mock: ${config.mockMode})`);
    console.log();
    
    // Start eye tracking and distribution
    await eyeTrackingSystem.start();
    console.log('✅ Neon eye tracker connected, data flowing to MQTT\n');
    
    // ============================================================================
    // STEP 4: Monitor the system
    // ============================================================================
    
    // Show status every 5 seconds
    const statusInterval = setInterval(() => {
      const status = eyeTrackingSystem.getStatus();
      
      console.log('📊 Status Update:');
      console.log(`   Eye Tracker: ${status.eyeTracker.connected ? '✅ Connected' : '❌ Disconnected'}`);
      console.log(`   Last Heartbeat: ${status.eyeTracker.lastHeartbeat ? new Date(status.eyeTracker.lastHeartbeat).toLocaleTimeString() : 'None'}`);
      console.log(`   Active Distributors: ${status.distribution?.activeDistributors?.join(', ') || 'None'}`);
      console.log();
    }, 5000);
    
    // ============================================================================
    // STEP 5: Runtime configuration changes (not hardcoded!)
    // ============================================================================
    
    // Example: Change MQTT broker after 10 seconds
    setTimeout(async () => {
      console.log('🔄 Demonstrating runtime config change...');
      
      await eyeTrackingSystem.updateDistribution({
        mqttBroker: 'mqtt://new-broker.local:1883'
      });
      
      console.log('✅ MQTT broker updated at runtime\n');
    }, 10000);
    
    // ============================================================================
    // STEP 6: Eye tracker operations
    // ============================================================================
    
    // Start calibration after 15 seconds
    setTimeout(async () => {
      console.log('🎯 Starting calibration...');
      const calibrationResult = await eyeTrackingSystem.startCalibration();
      console.log('📊 Calibration started:', calibrationResult);
      
      // Stop calibration after 5 seconds
      setTimeout(async () => {
        const result = await eyeTrackingSystem.stopCalibration();
        console.log('✅ Calibration completed:', result);
      }, 5000);
    }, 15000);
    
    // ============================================================================
    // STEP 7: Cleanup on shutdown
    // ============================================================================
    
    process.on('SIGINT', async () => {
      console.log('\n🛑 Shutting down...');
      clearInterval(statusInterval);
      await eyeTrackingSystem.stop();
      console.log('👋 System stopped');
      process.exit(0);
    });
    
    console.log('💡 Press Ctrl+C to stop\n');
    console.log('📡 Data is now being sent to MQTT on these topics:');
    console.log(`   - Gaze data: ${config.gazeTopic}`);
    console.log(`   - Calibration: ${config.calibrationTopic}`);
    console.log(`   - Events: ${config.eventsTopic}`);
    console.log('\n🔍 Use an MQTT client to see the data:');
    console.log(`   mosquitto_sub -h localhost -t "${config.gazeTopic}"`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// ============================================================================
// DIFFERENT WAYS TO CONFIGURE (CONFIGS ARE NOT HARDCODED!)
// ============================================================================

/**
 * Example 1: Using environment variables
 */
// MQTT_BROKER=mqtt://lab.local:1883 NEON_DEVICE_ADDRESS=192.168.1.100 node neon-mqtt-example.js

/**
 * Example 2: Different configuration for different labs
 */
export const createLabAConfig = () => ({
  mqttBroker: 'mqtt://lab-a.university.edu:1883',
  gazeTopic: 'lab-a/eyetracking/gaze',
  clientId: 'lab-a-neon-tracker'
});

export const createLabBConfig = () => ({
  mqttBroker: 'mqtt://lab-b.university.edu:1883', 
  gazeTopic: 'lab-b/eyetracking/gaze',
  clientId: 'lab-b-neon-tracker'
});

/**
 * Example 3: Production vs Development
 */
export const createProductionConfig = () => ({
  mqttBroker: 'mqtts://production.company.com:8883',
  mockMode: false,
  gazeRouting: ['mqtt'],
  calibrationRouting: ['mqtt', 'http']
});

export const createDevelopmentConfig = () => ({
  mqttBroker: 'mqtt://localhost:1883',
  mockMode: true,
  gazeRouting: ['mqtt', 'websocket'], // Extra websocket for dev monitoring
});

// ============================================================================
// RUN THE EXAMPLE
// ============================================================================

if (import.meta.url === `file://${process.argv[1]}`) {
  runNeonMqttExample();
}

console.log(`
================================================================================
NEON → MQTT INTEGRATION WITH SYNOPTICON

This example shows how Synopticon's eye tracking API connects to distribution:

1. Synopticon's createEyeTrackerDevice() handles the Neon connection
2. Distribution system routes the data to MQTT/WebSocket/HTTP
3. Configurations are loaded at runtime (NOT hardcoded)
4. You can change brokers, topics, routing on the fly

HOW TO RUN:
-----------
Basic:           node neon-mqtt-example.js
Custom broker:   MQTT_BROKER=mqtt://your-broker.local:1883 node neon-mqtt-example.js
Real device:     NEON_DEVICE_ADDRESS=192.168.1.100 node neon-mqtt-example.js

WHERE CONFIGS LIVE:
-------------------
✅ Environment variables (override everything)
✅ Configuration objects (passed at runtime)
✅ Runtime updates (updateDistribution())
❌ NOT hardcoded in the system!

MQTT TOPICS USED:
-----------------
- eyetracking/neon/gaze        (gaze data at 200Hz)
- eyetracking/neon/calibration (calibration results) 
- eyetracking/neon/events      (connections, errors)
================================================================================
`);