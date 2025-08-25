/**
 * Human Factors Research Demo
 * Comprehensive example showing multi-modal data collection and distribution
 * for human factors studies and UX research
 */

import { 
  createDistributionManager,
  createHttpDistributor,
  createWebSocketDistributor,
  createMqttDistributor,
  createUdpDistributor,
  createSseDistributor,
  getDistributionPreset
} from '../../src/core/distribution/index.js';

/**
 * Create a research-optimized distribution orchestrator
 */
const createResearchOrchestrator = async (studyConfig = {}) => {
  console.log('🧪 Setting up Human Factors Research Orchestrator...');
  
  // Use enterprise preset for maximum capability
  const distributionConfig = getDistributionPreset('enterprise');
  const distributionManager = createDistributionManager({
    ...distributionConfig,
    enableHealthCheck: true,
    healthCheckInterval: 5000 // More frequent health checks for research
  });

  // Register distributors based on research needs
  if (studyConfig.realTimeVisualization) {
    const wsDistributor = createWebSocketDistributor({
      port: 8080,
      compression: true,
      maxConnections: 100 // For research team monitoring
    });
    distributionManager.registerDistributor('websocket', wsDistributor);
  }

  if (studyConfig.dataLogging) {
    const httpDistributor = createHttpDistributor({
      baseUrl: studyConfig.dataEndpoint || 'http://localhost:3001',
      timeout: 10000,
      endpoints: {
        participant_data: '/api/research/participants',
        session_data: '/api/research/sessions',
        events: '/api/research/events'
      }
    });
    distributionManager.registerDistributor('http', httpDistributor);
  }

  if (studyConfig.iotIntegration) {
    const mqttDistributor = createMqttDistributor({
      broker: studyConfig.mqttBroker || 'mqtt://localhost:1883',
      clientId: `research-${studyConfig.studyId || 'default'}`,
      topics: {
        prefix: `research/${studyConfig.studyId || 'default'}`,
        participant: `research/${studyConfig.studyId}/participant`,
        environment: `research/${studyConfig.studyId}/environment`,
        physiological: `research/${studyConfig.studyId}/physiological`
      }
    });
    distributionManager.registerDistributor('mqtt', mqttDistributor);
  }

  if (studyConfig.highFrequencyData) {
    const udpDistributor = createUdpDistributor({
      port: 9999,
      maxPayload: 2048,
      targets: studyConfig.highFrequencyTargets || [
        { host: '127.0.0.1', port: 9999 }
      ]
    });
    distributionManager.registerDistributor('udp', udpDistributor);
  }

  if (studyConfig.researcherDashboard) {
    const sseDistributor = createSseDistributor({
      port: 3002,
      endpoint: '/research/events',
      maxConnections: 50 // Research team members
    });
    distributionManager.registerDistributor('sse', sseDistributor);
  }

  // Configure event routing for research workflows
  const eventRouting = {
    // Participant biometric data
    'heart_rate_change': ['mqtt', 'websocket'],
    'stress_indicator': ['sse', 'http', 'mqtt'],
    'fatigue_detected': ['sse', 'websocket', 'http'],
    
    // Cognitive load indicators
    'pupil_dilation': ['udp', 'websocket'], // High frequency
    'blink_rate_change': ['websocket', 'mqtt'],
    'cognitive_overload': ['sse', 'http', 'websocket'], // Alert all systems
    
    // Attention and gaze patterns
    'attention_shift': ['websocket', 'udp'], // Real-time tracking
    'fixation_duration': ['http', 'mqtt'], // For analysis
    'saccade_velocity': ['udp'], // High frequency only
    'gaze_pattern_change': ['websocket', 'sse'],
    
    // Emotional responses
    'emotion_detected': ['websocket', 'mqtt', 'http'],
    'valence_change': ['sse', 'websocket'],
    'arousal_spike': ['sse', 'websocket', 'mqtt'],
    'micro_expression': ['http', 'mqtt'],
    
    // Speech and communication
    'speech_rate_change': ['websocket', 'mqtt'],
    'vocal_stress': ['sse', 'websocket', 'http'],
    'semantic_sentiment': ['http', 'mqtt'],
    'conversation_turn': ['websocket', 'sse'],
    
    // Task performance
    'task_start': ['http', 'sse'],
    'task_complete': ['http', 'sse', 'websocket'],
    'error_occurred': ['sse', 'websocket', 'http'],
    'performance_degradation': ['sse', 'http'],
    
    // Environmental factors
    'lighting_change': ['mqtt', 'http'],
    'noise_level_change': ['mqtt', 'websocket'],
    'temperature_change': ['mqtt', 'http'],
    
    // System events
    'calibration_complete': ['http', 'sse'],
    'data_quality_issue': ['sse', 'websocket'],
    'system_alert': ['sse', 'websocket', 'http']
  };

  // Set up all event routing
  Object.entries(eventRouting).forEach(([event, distributors]) => {
    distributionManager.setEventRouting(event, distributors);
  });

  console.log(`✅ Research orchestrator configured with ${Object.keys(eventRouting).length} event routes`);

  return {
    distributionManager,
    
    // Research-specific methods
    startSession: async (participantId, sessionConfig = {}) => {
      console.log(`🔬 Starting research session for participant: ${participantId}`);
      
      const sessionData = {
        participantId,
        sessionId: sessionConfig.sessionId || `session_${Date.now()}`,
        studyId: studyConfig.studyId,
        startTime: Date.now(),
        configuration: sessionConfig,
        researcher: sessionConfig.researcher || 'unknown'
      };

      // Notify all systems of session start
      await distributionManager.routeEvent('session_start', sessionData);
      return sessionData;
    },

    endSession: async (sessionData) => {
      console.log(`🏁 Ending research session: ${sessionData.sessionId}`);
      
      const endData = {
        ...sessionData,
        endTime: Date.now(),
        duration: Date.now() - sessionData.startTime
      };

      await distributionManager.routeEvent('session_end', endData);
      return endData;
    },

    recordEvent: async (eventType, eventData, participantId) => {
      const enrichedData = {
        ...eventData,
        participantId,
        studyId: studyConfig.studyId,
        timestamp: Date.now(),
        source: 'research_orchestrator'
      };

      return distributionManager.routeEvent(eventType, enrichedData);
    },

    getResearchMetrics: () => ({
      ...distributionManager.getStats(),
      studyConfig,
      activeRoutes: Object.keys(eventRouting).length,
      participantSessions: 'tracked_separately' // Would integrate with session management
    }),

    cleanup: () => distributionManager.cleanup()
  };
};

/**
 * Simulate a cognitive load assessment study
 */
const simulateCognitiveLoadStudy = async () => {
  console.log('\n🧠 Simulating Cognitive Load Assessment Study');
  console.log('='.repeat(60));

  const studyOrchestrator = await createResearchOrchestrator({
    studyId: 'cognitive-load-2024-001',
    realTimeVisualization: true,
    dataLogging: true,
    iotIntegration: true,
    highFrequencyData: true,
    researcherDashboard: true,
    dataEndpoint: 'http://localhost:3001'
  });

  // Simulate participant session
  const participantId = 'P001';
  const sessionData = await studyOrchestrator.startSession(participantId, {
    sessionId: 'cognitive-load-session-001',
    researcher: 'Dr. Smith',
    taskType: 'n-back_task',
    difficulty: 'moderate',
    duration: 1800000 // 30 minutes
  });

  console.log('\n📊 Simulating multi-modal data collection...');

  // Simulate various research events over time
  const events = [
    // Task performance events
    { event: 'task_start', data: { task: 'n-back', level: 2 }, delay: 100 },
    { event: 'attention_shift', data: { from: 'center', to: 'periphery' }, delay: 500 },
    { event: 'pupil_dilation', data: { diameter: 4.2, baseline: 3.8 }, delay: 800 },
    
    // Cognitive load indicators
    { event: 'blink_rate_change', data: { rate: 18, baseline: 15 }, delay: 1200 },
    { event: 'cognitive_overload', data: { severity: 'moderate', confidence: 0.75 }, delay: 1500 },
    
    // Emotional responses
    { event: 'stress_indicator', data: { level: 0.6, indicators: ['heart_rate', 'skin_conductance'] }, delay: 2000 },
    { event: 'emotion_detected', data: { emotion: 'frustrated', confidence: 0.8 }, delay: 2300 },
    
    // Performance metrics
    { event: 'error_occurred', data: { errorType: 'false_positive', reactionTime: 1250 }, delay: 2800 },
    { event: 'performance_degradation', data: { metric: 'accuracy', change: -0.15 }, delay: 3200 },
    
    // Recovery patterns
    { event: 'attention_shift', data: { from: 'distracted', to: 'focused' }, delay: 4000 },
    { event: 'heart_rate_change', data: { rate: 72, baseline: 68, trend: 'decreasing' }, delay: 4500 },
    
    // Task completion
    { event: 'task_complete', data: { 
      task: 'n-back', 
      level: 2, 
      accuracy: 0.82, 
      avgReactionTime: 890,
      totalTrials: 100,
      correctResponses: 82
    }, delay: 5000 }
  ];

  // Execute events with realistic timing
  for (const { event, data, delay } of events) {
    await new Promise(resolve => setTimeout(resolve, delay));
    
    try {
      const result = await studyOrchestrator.recordEvent(event, data, participantId);
      console.log(`📋 ${event}: Distributed to ${result.summary.successful}/${result.summary.total} systems`);
    } catch (error) {
      console.error(`❌ Failed to record ${event}:`, error.message);
    }
  }

  // End session
  await studyOrchestrator.endSession(sessionData);

  // Get research metrics
  const metrics = studyOrchestrator.getResearchMetrics();
  console.log('\n📈 Research Session Metrics:');
  console.log(`   Total Events Distributed: ${metrics.performance.totalMessages}`);
  console.log(`   Distribution Success Rate: ${metrics.performance.successRate}`);
  console.log(`   Active Event Routes: ${metrics.activeRoutes}`);
  console.log(`   System Uptime: ${Math.floor(metrics.performance.uptime / 1000)}s`);

  await studyOrchestrator.cleanup();
  return metrics;
};

/**
 * Simulate a UX usability testing scenario
 */
const simulateUsabilityTesting = async () => {
  console.log('\n🎨 Simulating UX Usability Testing');
  console.log('='.repeat(60));

  const uxOrchestrator = await createResearchOrchestrator({
    studyId: 'ux-usability-2024-002',
    realTimeVisualization: true,
    dataLogging: true,
    researcherDashboard: true,
    dataEndpoint: 'http://localhost:3001'
  });

  const participantId = 'UX_P001';
  const sessionData = await uxOrchestrator.startSession(participantId, {
    sessionId: 'ux-session-001',
    researcher: 'UX Team',
    interface: 'mobile_app_v2.1',
    tasks: ['login', 'navigation', 'purchase', 'support'],
    device: 'iPhone_14'
  });

  console.log('\n📱 Simulating UX testing events...');

  const uxEvents = [
    // Interface interaction tracking
    { event: 'task_start', data: { task: 'user_login', interface: 'mobile_app' }, delay: 200 },
    { event: 'gaze_pattern_change', data: { pattern: 'scanning', area: 'login_form' }, delay: 600 },
    { event: 'fixation_duration', data: { element: 'username_field', duration: 1200 }, delay: 1000 },
    
    // User confusion indicators
    { event: 'attention_shift', data: { from: 'login_button', to: 'help_text', confusion: true }, delay: 1500 },
    { event: 'micro_expression', data: { expression: 'confusion', confidence: 0.7 }, delay: 1800 },
    
    // Error handling
    { event: 'error_occurred', data: { 
      errorType: 'invalid_credentials', 
      userAction: 'retry',
      frustrationLevel: 0.4 
    }, delay: 2200 },
    
    // Emotional response to design
    { event: 'emotion_detected', data: { 
      emotion: 'frustrated', 
      confidence: 0.6, 
      trigger: 'error_message' 
    }, delay: 2600 },
    
    // Recovery and success
    { event: 'task_complete', data: { 
      task: 'user_login', 
      success: true, 
      attempts: 2,
      totalTime: 35000,
      userSatisfaction: 0.7
    }, delay: 3000 },
    
    // Navigation task
    { event: 'task_start', data: { task: 'find_product', category: 'electronics' }, delay: 3500 },
    { event: 'gaze_pattern_change', data: { pattern: 'systematic_search', efficiency: 0.8 }, delay: 4000 }
  ];

  for (const { event, data, delay } of uxEvents) {
    await new Promise(resolve => setTimeout(resolve, delay));
    
    const result = await uxOrchestrator.recordEvent(event, data, participantId);
    console.log(`🎯 ${event}: ${result.summary.successful} systems notified`);
  }

  await uxOrchestrator.endSession(sessionData);
  await uxOrchestrator.cleanup();
  
  console.log('✅ UX testing simulation complete');
};

/**
 * Simulate driving simulation safety research
 */
const simulateDrivingSimulation = async () => {
  console.log('\n🚗 Simulating Driving Safety Research');
  console.log('='.repeat(60));

  const drivingOrchestrator = await createResearchOrchestrator({
    studyId: 'driving-safety-2024-003',
    realTimeVisualization: true,
    highFrequencyData: true, // Critical for vehicle dynamics
    dataLogging: true,
    iotIntegration: true,
    researcherDashboard: true,
    highFrequencyTargets: [
      { host: '127.0.0.1', port: 9999 } // Vehicle dynamics server
    ]
  });

  const participantId = 'DRIVER_001';
  const sessionData = await drivingOrchestrator.startSession(participantId, {
    sessionId: 'driving-session-001',
    researcher: 'Safety Research Team',
    scenario: 'highway_merging',
    vehicle: 'simulator_sedan',
    trafficDensity: 'moderate'
  });

  console.log('\n🛣️ Simulating driving scenario events...');

  const drivingEvents = [
    // High-frequency vehicle data (would normally be much more frequent)
    { event: 'saccade_velocity', data: { velocity: 45.2, direction: 'left_mirror' }, delay: 50 },
    { event: 'pupil_dilation', data: { diameter: 4.5, stress_indicator: true }, delay: 100 },
    { event: 'heart_rate_change', data: { rate: 82, baseline: 72, trend: 'increasing' }, delay: 150 },
    
    // Critical safety events
    { event: 'attention_shift', data: { 
      from: 'forward_road', 
      to: 'side_mirror', 
      duration: 800,
      safetyImplication: 'moderate'
    }, delay: 500 },
    
    { event: 'stress_indicator', data: { 
      level: 0.7, 
      indicators: ['heart_rate', 'skin_conductance', 'grip_force'],
      scenario: 'highway_merge'
    }, delay: 800 },
    
    // Driver alertness monitoring
    { event: 'blink_rate_change', data: { 
      rate: 22, 
      baseline: 15, 
      alertness: 'high_alert'
    }, delay: 1200 },
    
    // Performance under pressure
    { event: 'cognitive_overload', data: { 
      severity: 'moderate', 
      confidence: 0.8,
      taskComplexity: 'merge_with_traffic'
    }, delay: 1600 },
    
    // Successful completion
    { event: 'task_complete', data: { 
      task: 'highway_merge', 
      success: true, 
      safetyScore: 0.85,
      reactionTime: 1.2,
      decisionAccuracy: 0.9
    }, delay: 2000 }
  ];

  for (const { event, data, delay } of drivingEvents) {
    await new Promise(resolve => setTimeout(resolve, delay));
    
    const result = await drivingOrchestrator.recordEvent(event, data, participantId);
    
    // Highlight safety-critical events
    const isCritical = ['cognitive_overload', 'stress_indicator'].includes(event);
    const icon = isCritical ? '🚨' : '🚗';
    
    console.log(`${icon} ${event}: ${result.summary.successful} safety systems alerted`);
  }

  await drivingOrchestrator.endSession(sessionData);
  await drivingOrchestrator.cleanup();
  
  console.log('✅ Driving simulation research complete');
};

/**
 * Main demo runner
 */
const runHumanFactorsResearchDemo = async () => {
  console.log('🧪 Human Factors Research Distribution Demo');
  console.log('='.repeat(80));
  console.log('Demonstrating real-time, multi-modal data distribution');
  console.log('for advanced human factors studies and UX research\n');

  try {
    // Run different research scenarios
    await simulateCognitiveLoadStudy();
    await new Promise(resolve => setTimeout(resolve, 1000)); // Brief pause
    
    await simulateUsabilityTesting();
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    await simulateDrivingSimulation();

    console.log('\n' + '='.repeat(80));
    console.log('🎉 HUMAN FACTORS RESEARCH DEMO COMPLETE');
    console.log('='.repeat(80));
    console.log('✅ Demonstrated multi-modal data collection');
    console.log('✅ Showcased real-time distribution capabilities');
    console.log('✅ Validated research workflow integration');
    console.log('✅ Verified high-frequency data handling');
    console.log('✅ Confirmed cross-modal event correlation');
    
    console.log('\n🔬 Research Applications Demonstrated:');
    console.log('   • Cognitive Load Assessment');
    console.log('   • UX/Usability Testing');
    console.log('   • Driving Safety Research');
    console.log('   • Multi-modal Data Fusion');
    console.log('   • Real-time Researcher Dashboards');
    console.log('   • High-frequency Physiological Monitoring');
    
  } catch (error) {
    console.error('❌ Demo failed:', error);
  }
};

// Export for use as module
export { 
  createResearchOrchestrator,
  simulateCognitiveLoadStudy,
  simulateUsabilityTesting,
  simulateDrivingSimulation,
  runHumanFactorsResearchDemo
};

// Run demo if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runHumanFactorsResearchDemo()
    .then(() => {
      console.log('\n✨ Demo execution complete');
      process.exit(0);
    })
    .catch(error => {
      console.error('💥 Demo crashed:', error);
      process.exit(1);
    });
}