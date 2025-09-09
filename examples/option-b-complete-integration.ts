/**
 * @fileoverview Complete Option B Integration Example
 * 
 * Demonstrates the complete integration of all Option B advanced features:
 * 1. Advanced Tobii 5 attention prediction
 * 2. Multi-user eye tracking support  
 * 3. Machine learning pipelines for cognitive analysis
 * 4. Enterprise integration features
 * 5. Integration with existing human factors components
 * 
 * This example shows a comprehensive enterprise-ready system with
 * real-time cognitive analysis, multi-user collaboration, and 
 * enterprise system integration.
 * 
 * @version 1.0.0
 * @author Synopticon Development Team
 */

import { createTobii5AttentionPredictionEngine } from '../src/features/eye-tracking/tobii5/attention-prediction-engine.js';
import { createTobii5MultiUserSessionManager } from '../src/features/eye-tracking/tobii5/multi-user-session-manager.js';
import { createCognitiveMLPipeline } from '../src/core/ml/cognitive-ml-pipeline.js';
import { createEnterpriseAPIGateway } from '../src/core/enterprise/api-gateway.js';
import { createEnterpriseDataConnectors } from '../src/core/enterprise/data-connectors.js';
import { createInformationFusionEngine } from '../src/core/cognitive/fusion-engine.js';
import { createDistributionManager } from '../src/core/distribution/distribution-manager.js';
import type { GazeDataPoint } from '../src/core/sensors/eye-tracking/index.js';

/**
 * Complete system configuration
 */
const SYSTEM_CONFIG = {
  tobii5: {
    predictionHorizon: 2000,
    samplingRate: 90,
    roiUpdateInterval: 1000,
    adaptiveLearning: true
  },
  multiUser: {
    maxConcurrentUsers: 20,
    sessionTimeout: 30 * 60 * 1000,
    enableCollaboration: true,
    calibrationRequired: true
  },
  ml: {
    learningRate: 0.01,
    batchSize: 32,
    maxFeatures: 50,
    normalizeFeatures: true
  },
  enterprise: {
    maxConcurrentConnections: 500,
    enableMetrics: true,
    enableDocumentation: true,
    corsEnabled: true
  }
};

/**
 * Enterprise connector configurations
 */
const ENTERPRISE_CONNECTORS = [
  {
    id: 'salesforce-crm',
    name: 'Salesforce CRM Integration',
    type: 'salesforce' as const,
    enabled: true,
    authentication: {
      type: 'oauth2' as const,
      credentials: {
        clientId: process.env.SALESFORCE_CLIENT_ID || 'demo-client',
        clientSecret: process.env.SALESFORCE_CLIENT_SECRET || 'demo-secret'
      },
      tokenEndpoint: 'https://login.salesforce.com/services/oauth2/token',
      scopes: ['api', 'refresh_token']
    },
    endpoints: [
      {
        name: 'contacts',
        url: 'https://your-instance.salesforce.com/services/data/v52.0',
        method: 'POST' as const,
        timeout: 10000,
        retries: 3
      }
    ],
    dataMapping: {
      inputMapping: [],
      outputMapping: [
        { source: 'name', target: 'Name', type: 'string', required: true },
        { source: 'email', target: 'Email', type: 'string', required: true },
        { source: 'cognitiveLoad', target: 'Cognitive_Load__c', type: 'number', required: false },
        { source: 'attentionScore', target: 'Attention_Score__c', type: 'number', required: false }
      ],
      transformations: [],
      validation: []
    },
    syncSettings: {
      enabled: true,
      direction: 'unidirectional' as const,
      schedule: { type: 'interval' as const, value: 300000 }, // 5 minutes
      batchSize: 50,
      conflictResolution: 'source-wins' as const
    },
    rateLimiting: {
      requestsPerMinute: 100,
      burstLimit: 10,
      backoffStrategy: 'exponential' as const,
      maxDelay: 30000
    },
    errorHandling: {
      maxRetries: 3,
      retryDelay: 1000,
      failureThreshold: 5,
      alerting: { enabled: true, channels: ['email'], thresholds: { errorRate: 0.1, responseTime: 5000 } }
    }
  },
  {
    id: 'teams-collaboration',
    name: 'Microsoft Teams Integration',
    type: 'microsoft-teams' as const,
    enabled: true,
    authentication: {
      type: 'oauth2' as const,
      credentials: {
        clientId: process.env.TEAMS_CLIENT_ID || 'demo-teams-client',
        clientSecret: process.env.TEAMS_CLIENT_SECRET || 'demo-teams-secret'
      },
      tokenEndpoint: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
      scopes: ['https://graph.microsoft.com/ChatMessage.Send']
    },
    endpoints: [
      {
        name: 'chat',
        url: 'https://graph.microsoft.com/v1.0/chats',
        method: 'POST' as const,
        timeout: 15000,
        retries: 2
      }
    ],
    dataMapping: {
      inputMapping: [],
      outputMapping: [
        { source: 'message', target: 'body.content', type: 'string', required: true },
        { source: 'chatId', target: 'chatId', type: 'string', required: true },
        { source: 'insights', target: 'attachments[0].content', type: 'object', required: false }
      ],
      transformations: [],
      validation: []
    },
    syncSettings: {
      enabled: true,
      direction: 'unidirectional' as const,
      schedule: { type: 'webhook' as const, value: 'realtime' },
      batchSize: 1,
      conflictResolution: 'source-wins' as const
    },
    rateLimiting: {
      requestsPerMinute: 60,
      burstLimit: 5,
      backoffStrategy: 'linear' as const,
      maxDelay: 10000
    },
    errorHandling: {
      maxRetries: 2,
      retryDelay: 500,
      failureThreshold: 3,
      alerting: { enabled: true, channels: ['teams'], thresholds: { errorRate: 0.05, responseTime: 3000 } }
    }
  }
];

/**
 * API endpoints for enterprise integration
 */
const API_ENDPOINTS = [
  {
    id: 'cognitive-insights',
    path: '/api/v1/cognitive/insights',
    method: ['GET', 'POST'],
    protocol: 'rest' as const,
    authentication: {
      method: 'jwt' as const,
      required: true,
      scopes: ['cognitive.read', 'cognitive.write']
    },
    rateLimiting: {
      requests: 1000,
      window: 60000 // 1 minute
    },
    target: {
      type: 'internal' as const,
      serviceName: 'cognitive-service',
      timeout: 5000,
      retries: 2
    },
    middleware: [
      { name: 'logging', config: {}, order: 1, enabled: true },
      { name: 'validation', config: {}, order: 2, enabled: true }
    ],
    documentation: {
      summary: 'Cognitive insights API',
      description: 'Retrieve and submit cognitive analysis data',
      parameters: [],
      responses: [],
      examples: [],
      tags: ['cognitive', 'insights']
    }
  },
  {
    id: 'multi-user-session',
    path: '/api/v1/sessions/:userId',
    method: ['GET', 'POST', 'DELETE'],
    protocol: 'rest' as const,
    authentication: {
      method: 'api-key' as const,
      required: true,
      scopes: ['sessions.manage']
    },
    rateLimiting: {
      requests: 500,
      window: 60000
    },
    target: {
      type: 'internal' as const,
      serviceName: 'session-service',
      timeout: 3000,
      retries: 1
    },
    middleware: [
      { name: 'auth-validation', config: {}, order: 1, enabled: true },
      { name: 'rate-limiting', config: {}, order: 2, enabled: true }
    ]
  }
];

/**
 * Create and configure the complete Option B system
 */
export const createCompleteOptionBSystem = async () => {
  console.log('🚀 Initializing Complete Option B Advanced Feature System');
  console.log('================================================================');

  // 1. Initialize core distribution manager
  const distributionManager = createDistributionManager({
    protocols: ['websocket', 'sse', 'mqtt'],
    enableMetrics: true,
    maxConnections: 1000
  });

  console.log('✅ Distribution Manager initialized');

  // 2. Initialize cognitive fusion engine
  const fusionEngine = createInformationFusionEngine({
    enableTemporalFusion: true,
    adaptiveLearning: true
  });

  console.log('✅ Cognitive Fusion Engine initialized');

  // 3. Initialize Tobii 5 attention prediction engine
  const attentionEngine = createTobii5AttentionPredictionEngine(SYSTEM_CONFIG.tobii5);

  // Define sample ROIs for demonstration
  attentionEngine.defineROI('primary-display', {
    id: 'primary-display',
    shape: 'rectangle',
    bounds: { x: 200, y: 200, width: 800, height: 600 },
    priority: 0.9,
    visitCount: 0,
    averageDwellTime: 0,
    lastVisited: 0
  });

  attentionEngine.defineROI('control-panel', {
    id: 'control-panel',
    shape: 'rectangle', 
    bounds: { x: 50, y: 50, width: 300, height: 150 },
    priority: 0.7,
    visitCount: 0,
    averageDwellTime: 0,
    lastVisited: 0
  });

  console.log('✅ Tobii 5 Attention Prediction Engine initialized with ROIs');

  // 4. Initialize multi-user session manager
  const sessionManager = createTobii5MultiUserSessionManager(
    distributionManager,
    SYSTEM_CONFIG.multiUser
  );

  // Integrate attention engine with session manager
  sessionManager.integrateAttentionEngine(attentionEngine);

  console.log('✅ Multi-User Session Manager initialized');

  // 5. Initialize ML pipeline
  const mlPipeline = createCognitiveMLPipeline(
    distributionManager,
    SYSTEM_CONFIG.ml
  );

  // Initialize ML models
  mlPipeline.initializeModel('attention-prediction', 50, [64, 32], 3);
  mlPipeline.initializeModel('workload-estimation', 50, [32, 16], 1);
  mlPipeline.initializeModel('fatigue-detection', 50, [32, 16], 1);

  console.log('✅ Machine Learning Pipeline initialized with 3 models');

  // 6. Initialize enterprise API gateway
  const apiGateway = createEnterpriseAPIGateway(
    distributionManager,
    SYSTEM_CONFIG.enterprise
  );

  // Register API endpoints
  for (const endpoint of API_ENDPOINTS) {
    apiGateway.registerEndpoint(endpoint);
  }

  console.log('✅ Enterprise API Gateway initialized with endpoints');

  // 7. Initialize enterprise data connectors
  const dataConnectors = createEnterpriseDataConnectors(distributionManager);

  // Register enterprise connectors
  for (const connectorConfig of ENTERPRISE_CONNECTORS) {
    dataConnectors.registerConnector(connectorConfig);
  }

  console.log('✅ Enterprise Data Connectors initialized');

  return {
    distributionManager,
    fusionEngine,
    attentionEngine,
    sessionManager,
    mlPipeline,
    apiGateway,
    dataConnectors
  };
};

/**
 * Demonstrate the complete system with realistic data flow
 */
export const demonstrateCompleteSystem = async () => {
  const system = await createCompleteOptionBSystem();
  
  console.log('\n📊 Starting Complete System Demonstration');
  console.log('==========================================');

  // 1. Create multiple user sessions
  console.log('👥 Creating user sessions...');
  
  const user1Session = await system.sessionManager.createSession(
    'user_001',
    'Alice Johnson',
    { canViewOtherUsers: true, collaborationLevel: 'full' },
    { enableSharedHeatmaps: true, shareAttentionMetrics: true }
  );

  const user2Session = await system.sessionManager.createSession(
    'user_002', 
    'Bob Smith',
    { canViewOtherUsers: true, collaborationLevel: 'full' },
    { enableSharedHeatmaps: true, shareAttentionMetrics: true }
  );

  console.log(`✅ Created sessions: ${user1Session.sessionId}, ${user2Session.sessionId}`);

  // 2. Create group session for collaboration
  system.sessionManager.createGroupSession('meeting_001', ['user_001', 'user_002']);
  console.log('✅ Created collaborative group session');

  // 3. Simulate real-time gaze data processing
  console.log('\n👁️ Processing real-time gaze data...');
  
  const simulateGazeData = (userId: string, sessionId: string) => {
    const baseTime = Date.now();
    
    // Simulate 10 seconds of gaze data at 90Hz
    for (let i = 0; i < 900; i++) {
      const gazePoint: GazeDataPoint = {
        x: 400 + Math.sin(i / 50) * 200 + Math.random() * 50,
        y: 400 + Math.cos(i / 30) * 150 + Math.random() * 50,
        timestamp: baseTime + i * 11, // ~90Hz
        confidence: 0.8 + Math.random() * 0.2,
        pupilDiameter: 3.5 + Math.sin(i / 100) * 0.5,
        leftEye: { x: 0, y: 0, z: 600 },
        rightEye: { x: 0, y: 0, z: 600 }
      };

      // Process through attention engine
      const prediction = system.attentionEngine.processGazeData(gazePoint);
      
      // Process through session manager
      system.sessionManager.processGazeData(sessionId, gazePoint);

      // Extract features and make ML predictions every 10 samples
      if (i % 10 === 0) {
        const recentGaze = Array(5).fill(gazePoint); // Simplified
        system.mlPipeline.processCognitiveData({
          gaze: recentGaze,
          timestamp: gazePoint.timestamp,
          userId
        });
      }
    }
  };

  // Simulate gaze data for both users
  simulateGazeData('user_001', user1Session.sessionId);
  simulateGazeData('user_002', user2Session.sessionId);

  console.log('✅ Processed 900 gaze samples per user with ML predictions');

  // 4. Generate collaborative insights
  console.log('\n🤝 Generating collaborative insights...');
  
  const collaborativeInsights = system.sessionManager.getCollaborativeInsights('meeting_001');
  console.log('Common attention areas:', collaborativeInsights.commonAttentionAreas.length);
  console.log('Attention synchronization:', collaborativeInsights.attentionSynchronization.toFixed(2));
  console.log('Group cognitive load average:', collaborativeInsights.groupCognitiveLoad.average.toFixed(2));

  // Generate shared heatmap
  const heatmap = system.sessionManager.generateSharedHeatmap('meeting_001', 10000);
  console.log('✅ Generated shared attention heatmap');

  // 5. Sync data to enterprise systems
  console.log('\n🏢 Syncing to enterprise systems...');
  
  try {
    // Prepare customer insights for Salesforce
    const customerInsights = [
      {
        name: 'Alice Johnson',
        email: 'alice@company.com',
        cognitiveLoad: collaborativeInsights.groupCognitiveLoad.average,
        attentionScore: collaborativeInsights.attentionSynchronization
      }
    ];

    const salesforceResult = await system.dataConnectors.sync('salesforce-crm', customerInsights);
    console.log('✅ Salesforce sync result:', salesforceResult.success ? 'SUCCESS' : 'FAILED');

    // Send meeting insights to Teams
    const meetingInsights = {
      message: 'Meeting Analysis Complete',
      chatId: 'demo-chat-id',
      insights: {
        duration: '10 minutes',
        participants: 2,
        averageCognitiveLoad: collaborativeInsights.groupCognitiveLoad.average.toFixed(2),
        attentionSynchronization: (collaborativeInsights.attentionSynchronization * 100).toFixed(1) + '%',
        commonAreas: collaborativeInsights.commonAttentionAreas.length
      }
    };

    const teamsResult = await system.dataConnectors.sync('teams-collaboration', [meetingInsights]);
    console.log('✅ Teams sync result:', teamsResult.success ? 'SUCCESS' : 'FAILED');

  } catch (error) {
    console.log('⚠️ Enterprise sync simulation (would connect to real systems in production)');
  }

  // 6. Display comprehensive system metrics
  console.log('\n📈 System Performance Metrics');
  console.log('==============================');

  // Session manager metrics
  const sessionStats = system.sessionManager.getSystemStats();
  console.log('Multi-User System:');
  console.log(`  Active Users: ${sessionStats.activeUsers}`);
  console.log(`  Total Sessions: ${sessionStats.totalActiveSessions}`);
  console.log(`  Data Points Processed: ${sessionStats.totalDataPoints}`);

  // ML Pipeline metrics
  const mlStatus = system.mlPipeline.getSystemStatus();
  console.log('\nMachine Learning Pipeline:');
  console.log(`  Models Initialized: ${mlStatus.modelsInitialized}`);
  console.log(`  Total Predictions: ${mlStatus.totalPredictions}`);
  console.log(`  Average Accuracy: ${(mlStatus.averageModelAccuracy * 100).toFixed(1)}%`);

  // API Gateway metrics
  const gatewayMetrics = system.apiGateway.getMetrics();
  console.log('\nEnterprise API Gateway:');
  console.log(`  Total Requests: ${gatewayMetrics.totalRequests}`);
  console.log(`  Average Response Time: ${gatewayMetrics.averageResponseTime.toFixed(0)}ms`);
  console.log(`  Error Rate: ${(gatewayMetrics.errorRate * 100).toFixed(2)}%`);

  // Data Connectors metrics
  const connectorsStatus = system.dataConnectors.getStatus();
  console.log('\nEnterprise Data Connectors:');
  console.log(`  Registered Connectors: ${connectorsStatus.connectors}`);
  console.log(`  Average Success Rate: ${(connectorsStatus.averageSuccessRate * 100).toFixed(1)}%`);

  // Attention Engine metrics
  const attentionStats = system.attentionEngine.getStats();
  console.log('\nTobii 5 Attention Engine:');
  console.log(`  Gaze Points Processed: ${attentionStats.gazePointsProcessed}`);
  console.log(`  Predictions Generated: ${attentionStats.predictionsGenerated}`);
  console.log(`  Average Confidence: ${(attentionStats.averageConfidence * 100).toFixed(1)}%`);

  console.log('\n🎉 Complete Option B System Demonstration Finished');
  console.log('===================================================');
  
  // Clean up sessions
  await system.sessionManager.endSession(user1Session.sessionId);
  await system.sessionManager.endSession(user2Session.sessionId);
  
  console.log('✅ Sessions cleaned up');

  return system;
};

/**
 * Run performance benchmarks
 */
export const runPerformanceBenchmarks = async () => {
  console.log('\n⚡ Running Performance Benchmarks');
  console.log('================================');

  const system = await createCompleteOptionBSystem();

  // Benchmark 1: Gaze data processing throughput
  const gazeProcessingTest = async () => {
    const startTime = performance.now();
    const sampleCount = 10000;

    for (let i = 0; i < sampleCount; i++) {
      const gazePoint: GazeDataPoint = {
        x: Math.random() * 1920,
        y: Math.random() * 1080,
        timestamp: Date.now() + i,
        confidence: Math.random(),
        pupilDiameter: 3 + Math.random(),
        leftEye: { x: 0, y: 0, z: 600 },
        rightEye: { x: 0, y: 0, z: 600 }
      };

      system.attentionEngine.processGazeData(gazePoint);
    }

    const endTime = performance.now();
    const duration = endTime - startTime;
    const throughput = sampleCount / (duration / 1000);

    console.log(`Gaze Processing: ${throughput.toFixed(0)} samples/sec (${duration.toFixed(0)}ms for ${sampleCount} samples)`);
  };

  // Benchmark 2: ML prediction throughput
  const mlPredictionTest = async () => {
    const startTime = performance.now();
    const predictionCount = 1000;

    for (let i = 0; i < predictionCount; i++) {
      const features = new Float32Array(50);
      for (let j = 0; j < 50; j++) {
        features[j] = Math.random();
      }

      system.mlPipeline.predict('attention-prediction', features);
    }

    const endTime = performance.now();
    const duration = endTime - startTime;
    const throughput = predictionCount / (duration / 1000);

    console.log(`ML Predictions: ${throughput.toFixed(0)} predictions/sec (${duration.toFixed(0)}ms for ${predictionCount} predictions)`);
  };

  // Run benchmarks
  await gazeProcessingTest();
  await mlPredictionTest();

  console.log('✅ Performance benchmarks completed');
  
  return system;
};

// Export for use in other modules
export {
  SYSTEM_CONFIG,
  ENTERPRISE_CONNECTORS,
  API_ENDPOINTS
};

// Run demonstration if executed directly
if (typeof process !== 'undefined' && process.argv[1]?.includes('option-b-complete-integration')) {
  demonstrateCompleteSystem().catch(console.error);
}