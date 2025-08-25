/**
 * Dynamic Distributor Control Demo
 * Comprehensive examples showing session-based distributor management,
 * runtime configuration changes, and flexible initialization
 */

import { createDistributionSessionManager } from '../../src/core/distribution/distribution-session-manager.js';
import { createDistributionConfigManager } from '../../src/core/distribution/distribution-config-manager.js';

/**
 * Simulate a research study with changing requirements
 */
const simulateResearchStudyWithDynamicControl = async () => {
  console.log('🧪 Research Study with Dynamic Distributor Control');
  console.log('='.repeat(60));

  // Create session manager and config manager
  const sessionManager = createDistributionSessionManager();
  const configManager = createDistributionConfigManager();

  // Register default configurations for different distributor types
  sessionManager.registerDistributorConfig('http', {
    baseUrl: 'http://localhost:3001',
    timeout: 10000,
    retryCount: 3
  });

  sessionManager.registerDistributorConfig('websocket', {
    port: 8080,
    host: 'localhost',
    compression: true
  });

  sessionManager.registerDistributorConfig('mqtt', {
    broker: 'mqtt://localhost:1883',
    qos: 1
  });

  // Scenario 1: Pilot Study (Limited distributors)
  console.log('\n📋 Phase 1: Pilot Study Setup');
  console.log('-'.repeat(40));
  
  const pilotConfig = configManager.createSessionConfig({
    template: 'local_testing',
    enabledDistributors: ['http', 'websocket'], // Only these two for pilot
    eventRouting: {
      'participant_joined': ['http'],
      'task_completed': ['http', 'websocket'],
      'error_occurred': ['websocket'] // Real-time for pilot monitoring
    }
  });

  const pilotSession = await sessionManager.createSession('pilot-study-001', pilotConfig);
  
  // Simulate pilot study events
  console.log('📊 Running pilot study events...');
  await sessionManager.routeEvent('pilot-study-001', 'participant_joined', {
    participantId: 'PILOT_P001',
    timestamp: Date.now()
  });

  await sessionManager.routeEvent('pilot-study-001', 'task_completed', {
    task: 'stroop_test',
    duration: 120000,
    accuracy: 0.85
  });

  const pilotStatus = await sessionManager.getSessionStatus('pilot-study-001');
  console.log(`✅ Pilot phase: ${pilotStatus.activeDistributors.length} distributors active`);

  // Scenario 2: Main Study (Add MQTT for IoT sensors mid-session)
  console.log('\n📋 Phase 2: Main Study - Adding IoT Integration');
  console.log('-'.repeat(40));

  // Add MQTT distributor dynamically during the session
  await sessionManager.enableDistributor('pilot-study-001', 'mqtt', {
    broker: 'mqtt://lab-sensors.local:1883',
    clientId: 'main-study-iot',
    topics: {
      prefix: 'lab/main-study',
      sensors: 'lab/main-study/sensors',
      alerts: 'lab/main-study/alerts'
    }
  });

  // Update event routing to include IoT data
  sessionManager.updateEventRouting('pilot-study-001', {
    'participant_joined': ['http'],
    'task_completed': ['http', 'websocket'],
    'error_occurred': ['websocket'],
    // New IoT events
    'physiological_data': ['mqtt', 'websocket'],
    'environment_alert': ['mqtt', 'websocket', 'http'],
    'sensor_calibration': ['mqtt']
  });

  console.log('🔌 MQTT distributor added for IoT integration');
  
  // Simulate IoT events
  await sessionManager.routeEvent('pilot-study-001', 'physiological_data', {
    heartRate: 75,
    skinConductance: 0.8,
    temperature: 36.7,
    participantId: 'MAIN_P001'
  });

  // Scenario 3: High-Frequency Data Collection Phase
  console.log('\n📋 Phase 3: High-Frequency Data Collection');
  console.log('-'.repeat(40));

  // Create new session for high-frequency data
  const highFreqConfig = configManager.createSessionConfig({
    template: 'high_frequency',
    sessionId: 'high-freq-001',
    distributors: {
      udp: {
        port: 9999,
        targets: [
          { host: '127.0.0.1', port: 9999 },
          { host: '192.168.1.100', port: 9999 } // Analysis server
        ]
      },
      websocket: {
        port: 8081, // Different port to avoid conflicts
        compression: true
      },
      http: {
        baseUrl: 'http://localhost:3001',
        endpoints: {
          high_freq_batch: '/api/high-frequency-batch'
        }
      }
    },
    eventRouting: {
      'gaze_data': ['udp'], // Ultra-low latency
      'pupil_data': ['udp'], // Ultra-low latency  
      'batch_summary': ['http'], // Reliable delivery
      'quality_alert': ['websocket'] // Real-time notification
    }
  });

  const highFreqSession = await sessionManager.createSession('high-freq-session', highFreqConfig);

  // Simulate high-frequency events
  console.log('⚡ Simulating high-frequency data collection...');
  for (let i = 0; i < 5; i++) {
    await sessionManager.routeEvent('high-freq-session', 'gaze_data', {
      x: Math.random(),
      y: Math.random(),
      timestamp: Date.now(),
      confidence: 0.95
    });
    
    await new Promise(resolve => setTimeout(resolve, 10)); // 10ms intervals
  }

  await sessionManager.routeEvent('high-freq-session', 'batch_summary', {
    totalSamples: 5,
    averageConfidence: 0.95,
    dataQuality: 'excellent'
  });

  // Scenario 4: Runtime Configuration Changes
  console.log('\n📋 Phase 4: Runtime Configuration Changes');
  console.log('-'.repeat(40));

  // Change MQTT broker during session (e.g., failover)
  console.log('🔄 Switching MQTT broker for failover...');
  await sessionManager.reconfigureDistributor('pilot-study-001', 'mqtt', {
    broker: 'mqtt://backup-broker.local:1883',
    clientId: 'main-study-iot-backup',
    topics: {
      prefix: 'lab/main-study-backup',
      sensors: 'lab/main-study-backup/sensors'
    }
  });

  // Update WebSocket port (e.g., port conflict resolution)
  console.log('🔄 Updating WebSocket port...');
  await sessionManager.reconfigureDistributor('pilot-study-001', 'websocket', {
    port: 8082, // New port
    host: 'localhost',
    compression: true,
    maxConnections: 200
  });

  // Scenario 5: Selective Distributor Control
  console.log('\n📋 Phase 5: Selective Distributor Control');
  console.log('-'.repeat(40));

  // Create session with only specific distributors enabled
  const selectiveConfig = configManager.createSessionConfig({
    template: 'research_lab',
    distributors: {
      http: { baseUrl: 'http://database.lab.local:3000' },
      mqtt: { broker: 'mqtt://sensors.lab.local:1883' },
      websocket: { port: 8080 },
      sse: { port: 3002 }
    },
    // Only enable HTTP and MQTT initially
    enabledDistributors: ['http', 'mqtt'],
    eventRouting: {
      'session_start': ['http'],
      'sensor_data': ['mqtt'],
      'participant_response': ['http', 'mqtt']
    }
  });

  const selectiveSession = await sessionManager.createSession('selective-001', selectiveConfig);
  
  console.log('📊 Initial selective session state:');
  const initialStatus = await sessionManager.getSessionStatus('selective-001');
  console.log(`   Active distributors: ${initialStatus.activeDistributors.join(', ')}`);
  
  // Add WebSocket for real-time monitoring when needed
  console.log('➕ Adding WebSocket for real-time monitoring...');
  await sessionManager.enableDistributor('selective-001', 'websocket');
  
  // Update routing to include WebSocket
  sessionManager.updateEventRouting('selective-001', {
    'session_start': ['http'],
    'sensor_data': ['mqtt'],
    'participant_response': ['http', 'mqtt'],
    'real_time_alert': ['websocket'] // New real-time events
  });

  // Remove MQTT when not needed (e.g., lab sensors offline)
  console.log('➖ Temporarily disabling MQTT (lab sensors maintenance)...');
  await sessionManager.disableDistributor('selective-001', 'mqtt');

  const finalStatus = await sessionManager.getSessionStatus('selective-001');
  console.log(`   Final active distributors: ${finalStatus.activeDistributors.join(', ')}`);

  // Scenario 6: Multi-Session Management
  console.log('\n📋 Phase 6: Multi-Session Management');  
  console.log('-'.repeat(40));

  // Create multiple concurrent sessions with different configs
  const sessions = [
    {
      id: 'participant-A-session',
      config: configManager.createSessionConfig({
        template: 'mobile_remote',
        sessionId: 'participant-A',
        distributors: {
          http: { baseUrl: 'http://mobile-api.study.com/participant-A' }
        }
      })
    },
    {
      id: 'participant-B-session', 
      config: configManager.createSessionConfig({
        template: 'research_lab',
        sessionId: 'participant-B',
        distributors: {
          mqtt: { 
            broker: 'mqtt://lab.study.com:1883',
            clientId: 'participant-B-sensors'
          }
        }
      })
    },
    {
      id: 'analysis-session',
      config: configManager.createSessionConfig({
        template: 'production',
        distributors: {
          http: { baseUrl: 'http://analysis-cluster.study.com:3000' },
          websocket: { port: 8083 }
        }
      })
    }
  ];

  // Create all sessions
  for (const { id, config } of sessions) {
    await sessionManager.createSession(id, config);
    console.log(`✅ Created session: ${id}`);
  }

  // List all active sessions
  const activeSessions = sessionManager.listSessions();
  console.log('\n📋 Active Sessions Summary:');
  activeSessions.forEach(session => {
    console.log(`   ${session.sessionId}: ${session.activeDistributors.join(', ')}`);
  });

  // Test cross-session event distribution
  console.log('\n📤 Testing cross-session event distribution...');
  
  await sessionManager.routeEvent('participant-A-session', 'task_completed', {
    participantId: 'A',
    task: 'mobile_survey',
    completion: 'success'
  });

  await sessionManager.routeEvent('participant-B-session', 'sensor_reading', {
    participantId: 'B', 
    heartRate: 68,
    timestamp: Date.now()
  });

  // Configuration validation example
  console.log('\n📋 Phase 7: Configuration Validation');
  console.log('-'.repeat(40));

  try {
    // This should fail validation
    const invalidConfig = configManager.createSessionConfig({
      distributors: {
        http: { baseUrl: 'invalid-url' }, // Invalid URL
        websocket: { port: 99999 }, // Invalid port
        mqtt: {} // Missing broker
      }
    });
  } catch (error) {
    console.log(`✅ Configuration validation working: ${error.message}`);
  }

  // Runtime information
  console.log('\n📊 Runtime Information:');
  const runtimeInfo = configManager.getRuntimeInfo();
  console.log(`   Platform: ${runtimeInfo.platform}`);
  console.log(`   Environment: ${runtimeInfo.environment}`);
  console.log(`   Available templates: ${runtimeInfo.availableTemplates.join(', ')}`);

  // Cleanup all sessions
  console.log('\n🧹 Cleaning up all sessions...');
  await sessionManager.cleanup();
  
  console.log('✅ Dynamic distributor control demo completed');
  return {
    sessionsCreated: activeSessions.length,
    distributorReconfigurations: 3,
    dynamicEnabling: 2,
    runtimeInfo
  };
};

/**
 * Environment-specific configuration example
 */
const demonstrateEnvironmentConfiguration = async () => {
  console.log('\n🌍 Environment-Specific Configuration Demo');
  console.log('='.repeat(60));

  const configManager = createDistributionConfigManager();

  // Register custom template for cloud deployment
  configManager.registerTemplate('cloud_production', {
    http: {
      baseUrl: process.env.CLOUD_API_ENDPOINT || 'https://api.cloud-platform.com',
      timeout: 30000,
      headers: {
        'Authorization': `Bearer ${process.env.API_TOKEN}`,
        'X-Environment': process.env.NODE_ENV || 'development'
      }
    },
    websocket: {
      port: parseInt(process.env.WS_PORT) || 8080,
      host: '0.0.0.0',
      compression: true
    },
    mqtt: {
      broker: process.env.MQTT_BROKER || 'mqtts://cloud-mqtt.platform.com:8883',
      username: process.env.MQTT_USERNAME,
      password: process.env.MQTT_PASSWORD,
      clientId: `cloud-${process.env.HOSTNAME || 'unknown'}`
    }
  });

  // Show different configurations for different environments
  const environments = ['local_testing', 'research_lab', 'cloud_production'];
  
  console.log('📋 Configuration Templates by Environment:');
  environments.forEach(env => {
    try {
      const config = configManager.createSessionConfig({
        template: env,
        sessionId: `demo-${env}`
      });
      
      const distributorCount = Object.keys(config.distributors).length;
      console.log(`   ${env}: ${distributorCount} distributors configured`);
    } catch (error) {
      console.log(`   ${env}: ❌ ${error.message}`);
    }
  });

  // Show runtime info
  const runtimeInfo = configManager.getRuntimeInfo();
  console.log('\n🔧 Environment Variables Status:');
  Object.entries(runtimeInfo.environmentVariables || {}).forEach(([name, info]) => {
    const status = info.set ? '✅' : '❌';
    console.log(`   ${status} ${name}: ${info.value}`);
  });
};

/**
 * Session handover example (switching between different setups)
 */
const demonstrateSessionHandover = async () => {
  console.log('\n🔄 Session Handover Demo');
  console.log('='.repeat(60));

  const sessionManager = createDistributionSessionManager();
  const configManager = createDistributionConfigManager();

  // Setup default configs
  sessionManager.registerDistributorConfig('http', { baseUrl: 'http://localhost:3001' });
  sessionManager.registerDistributorConfig('websocket', { port: 8080 });

  // Phase 1: Setup phase (minimal distributors)
  console.log('📋 Phase 1: Setup Phase');
  const setupConfig = configManager.createSessionConfig({
    template: 'local_testing',
    enabledDistributors: ['websocket'], // Real-time only for setup
    eventRouting: {
      'calibration_status': ['websocket'],
      'setup_complete': ['websocket']
    }
  });

  const setupSession = await sessionManager.createSession('setup-phase', setupConfig);
  
  await sessionManager.routeEvent('setup-phase', 'calibration_status', {
    component: 'eye_tracker',
    status: 'calibrating',
    progress: 0.5
  });

  // Phase 2: Data collection (full distributors)
  console.log('📋 Phase 2: Data Collection Phase');
  const dataConfig = configManager.createSessionConfig({
    template: 'research_lab',
    distributors: {
      http: { baseUrl: 'http://data-server.lab:3000' },
      websocket: { port: 8080 },
      mqtt: { broker: 'mqtt://sensors.lab:1883' }
    },
    eventRouting: {
      'participant_data': ['http', 'mqtt'],
      'real_time_feedback': ['websocket'],
      'data_quality_check': ['websocket', 'http']
    }
  });

  // Close setup session and start data collection session
  await sessionManager.closeSession('setup-phase');
  const dataSession = await sessionManager.createSession('data-collection', dataConfig);

  console.log('🔄 Handed over from setup to data collection phase');
  
  await sessionManager.routeEvent('data-collection', 'participant_data', {
    participantId: 'P001',
    gazeData: [{ x: 0.5, y: 0.3, timestamp: Date.now() }],
    quality: 'high'
  });

  // Phase 3: Analysis phase (different distributor setup)
  console.log('📋 Phase 3: Analysis Phase');
  const analysisConfig = configManager.createSessionConfig({
    template: 'production',
    distributors: {
      http: { 
        baseUrl: 'http://analysis-cluster:3000',
        endpoints: {
          analysis_results: '/api/analysis',
          reports: '/api/reports'
        }
      }
    },
    eventRouting: {
      'analysis_complete': ['http'],
      'report_generated': ['http']
    }
  });

  await sessionManager.closeSession('data-collection');
  const analysisSession = await sessionManager.createSession('analysis-phase', analysisConfig);

  console.log('🔄 Handed over from data collection to analysis phase');

  await sessionManager.routeEvent('analysis-phase', 'analysis_complete', {
    participantId: 'P001',
    analysisType: 'gaze_pattern_analysis',
    results: { fixationCount: 45, averageFixationDuration: 280 }
  });

  await sessionManager.closeSession('analysis-phase');
  console.log('✅ Session handover demo completed');
};

/**
 * Main demo runner
 */
const runDynamicDistributorControlDemo = async () => {
  console.log('🚀 Dynamic Distributor Control & Session Management Demo');
  console.log('='.repeat(80));
  console.log('Demonstrating flexible, runtime-configurable distribution system\n');

  try {
    const studyResults = await simulateResearchStudyWithDynamicControl();
    await demonstrateEnvironmentConfiguration();
    await demonstrateSessionHandover();

    console.log('\n' + '='.repeat(80));
    console.log('🎉 DYNAMIC CONTROL DEMO COMPLETE');
    console.log('='.repeat(80));
    console.log('✅ Session-based distributor management');
    console.log('✅ Runtime configuration changes'); 
    console.log('✅ Selective distributor enabling/disabling');
    console.log('✅ Multi-session concurrent management');
    console.log('✅ Environment-specific templates');
    console.log('✅ Configuration validation');
    console.log('✅ Session handover capabilities');
    
    console.log('\n🔧 Key Features Demonstrated:');
    console.log('   • Dynamic MQTT broker switching');
    console.log('   • Runtime port conflict resolution');
    console.log('   • Selective distributor activation');
    console.log('   • Per-session isolated configurations');
    console.log('   • Environment variable integration');
    console.log('   • Phase-based distributor management');
    
    return studyResults;
    
  } catch (error) {
    console.error('❌ Demo failed:', error);
    return { error: error.message };
  }
};

// Export for use as module
export { 
  runDynamicDistributorControlDemo,
  simulateResearchStudyWithDynamicControl,
  demonstrateEnvironmentConfiguration,
  demonstrateSessionHandover
};

// Run demo if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runDynamicDistributorControlDemo()
    .then(results => {
      console.log('\n✨ Demo execution complete');
      if (results.error) {
        process.exit(1);
      } else {
        console.log(`📊 Sessions created: ${results.sessionsCreated}`);
        console.log(`🔄 Dynamic reconfigurations: ${results.distributorReconfigurations}`);
        process.exit(0);
      }
    })
    .catch(error => {
      console.error('💥 Demo crashed:', error);
      process.exit(1);
    });
}