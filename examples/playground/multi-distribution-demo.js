/**
 * Multi-Distribution Demo
 * Demonstrates how to use the distribution system with existing pipelines
 */

import { createOrchestrator } from '../../src/core/orchestrator.js';
import { 
  createDistributionManager, 
  createHttpDistributor, 
  createWebSocketDistributor,
  getDistributionPreset 
} from '../../src/core/distribution/index.js';

/**
 * Enhanced orchestrator with distribution capabilities
 */
const createDistributedOrchestrator = async (config = {}) => {
  const orchestrator = createOrchestrator(config);
  
  // Setup distribution based on preset or custom config
  const distributionConfig = config.distributionPreset ? 
    getDistributionPreset(config.distributionPreset) : 
    config.distribution || getDistributionPreset('basic');
  
  const distributionManager = createDistributionManager(distributionConfig);
  
  // Register distributors based on configuration
  if (distributionConfig.config.http?.enabled) {
    const httpDistributor = createHttpDistributor(distributionConfig.config.http);
    distributionManager.registerDistributor('http', httpDistributor);
  }
  
  if (distributionConfig.config.websocket?.enabled) {
    const wsDistributor = createWebSocketDistributor(distributionConfig.config.websocket);
    distributionManager.registerDistributor('websocket', wsDistributor);
  }
  
  // Setup event routing from configuration
  if (distributionConfig.eventRouting) {
    for (const [event, distributors] of Object.entries(distributionConfig.eventRouting)) {
      distributionManager.setEventRouting(event, distributors);
    }
  }
  
  // Enhanced process analysis with distribution
  const originalProcessAnalysis = orchestrator.processAnalysis;
  
  const processAnalysis = async (requirements, metadata = {}) => {
    const result = await originalProcessAnalysis(requirements, metadata);
    
    // Distribute results based on analysis type
    if (result.success && result.data) {
      const distributionEvents = [];
      
      // Determine events to distribute based on analysis results
      if (result.data.faces && result.data.faces.length > 0) {
        distributionEvents.push('face_detected');
      }
      
      if (result.data.emotions && result.data.emotions.length > 0) {
        distributionEvents.push('emotion_analyzed');
      }
      
      if (result.data.age && result.data.age.length > 0) {
        distributionEvents.push('age_estimated');
      }
      
      // Distribute each event type
      for (const eventType of distributionEvents) {
        try {
          await distributionManager.routeEvent(eventType, {
            ...result.data,
            metadata: {
              ...metadata,
              timestamp: Date.now(),
              processingTime: result.processingTime
            }
          });
        } catch (error) {
          console.error(`Failed to distribute ${eventType}:`, error);
        }
      }
    }
    
    return result;
  };
  
  return {
    ...orchestrator,
    processAnalysis,
    distributionManager,
    
    // Additional distribution methods
    distribute: (event, data, targets) => distributionManager.distribute(event, data, targets),
    broadcast: (event, data) => distributionManager.broadcast(event, data),
    getDistributionHealth: () => distributionManager.performHealthCheck(),
    getDistributionStats: () => distributionManager.getStats()
  };
};

/**
 * Demo usage examples
 */
const runMultiDistributionDemo = async () => {
  console.log('🚀 Starting Multi-Distribution Demo...\n');
  
  try {
    // Example 1: Basic HTTP-only setup
    console.log('📡 Example 1: Basic HTTP Distribution');
    const basicOrchestrator = await createDistributedOrchestrator({
      distributionPreset: 'basic'
    });
    
    // Simulate face detection result
    await basicOrchestrator.distribute('face_detected', {
      faces: [{
        bbox: { x: 100, y: 100, width: 200, height: 200 },
        confidence: 0.95
      }],
      timestamp: Date.now()
    });
    console.log('✅ Basic HTTP distribution sent\n');
    
    // Example 2: Real-time WebSocket + HTTP setup
    console.log('📡 Example 2: Real-time Distribution');
    const realtimeOrchestrator = await createDistributedOrchestrator({
      distributionPreset: 'realtime'
    });
    
    // Start WebSocket server
    await realtimeOrchestrator.distributionManager.getDistributors().forEach(name => {
      const distributor = realtimeOrchestrator.distributionManager._distributors?.get?.(name);
      if (distributor && distributor.connect) {
        distributor.connect();
      }
    });
    
    // Simulate emotion analysis result
    await realtimeOrchestrator.distribute('emotion_analyzed', {
      emotions: [{
        emotion: 'happy',
        confidence: 0.87,
        bbox: { x: 100, y: 100, width: 200, height: 200 }
      }],
      timestamp: Date.now()
    });
    console.log('✅ Real-time distribution sent\n');
    
    // Example 3: Custom distribution configuration
    console.log('📡 Example 3: Custom Distribution Configuration');
    const customOrchestrator = await createDistributedOrchestrator({
      distribution: {
        eventRouting: {
          'custom_event': ['http'],
          'real_time_data': ['websocket']
        },
        config: {
          http: {
            enabled: true,
            baseUrl: 'http://localhost:3001',
            endpoints: {
              custom_event: '/api/custom'
            }
          },
          websocket: {
            enabled: true,
            port: 8081
          }
        }
      }
    });
    
    await customOrchestrator.distribute('custom_event', {
      message: 'Custom event data',
      value: 42
    });
    console.log('✅ Custom distribution sent\n');
    
    // Example 4: Broadcast to all distributors
    console.log('📡 Example 4: Broadcast Distribution');
    await realtimeOrchestrator.broadcast('system_alert', {
      level: 'warning',
      message: 'High CPU usage detected',
      timestamp: Date.now()
    });
    console.log('✅ Broadcast distribution sent\n');
    
    // Example 5: Health monitoring
    console.log('📊 Example 5: Distribution Health Check');
    const healthStatus = await realtimeOrchestrator.getDistributionHealth();
    console.log('Distribution Health:', JSON.stringify(healthStatus, null, 2));
    
    const stats = realtimeOrchestrator.getDistributionStats();
    console.log('Distribution Stats:', JSON.stringify(stats, null, 2));
    
    // Cleanup
    console.log('\n🧹 Cleaning up...');
    await basicOrchestrator.distributionManager.cleanup();
    await realtimeOrchestrator.distributionManager.cleanup();
    await customOrchestrator.distributionManager.cleanup();
    
  } catch (error) {
    console.error('❌ Demo failed:', error);
  }
};

/**
 * Integration with existing pipeline processing
 */
const createPipelineDistributionExample = async () => {
  console.log('🔄 Pipeline Distribution Integration Example\n');
  
  const orchestrator = await createDistributedOrchestrator({
    distributionPreset: 'performance' // High-performance setup
  });
  
  // Example: Process video frame with automatic distribution
  const mockVideoFrame = {
    width: 640,
    height: 480,
    timestamp: Date.now()
  };
  
  const analysisRequirements = {
    capabilities: ['face_detection', 'emotion_analysis'],
    quality: 'balanced',
    metadata: {
      source: 'webcam',
      sessionId: 'demo-session-123'
    }
  };
  
  try {
    // This would automatically distribute results based on configured routing
    const result = await orchestrator.processAnalysis(analysisRequirements, {
      frame: mockVideoFrame
    });
    
    console.log('Analysis completed with automatic distribution');
    console.log('Result:', JSON.stringify(result, null, 2));
    
  } catch (error) {
    console.error('Pipeline processing failed:', error);
  } finally {
    await orchestrator.distributionManager.cleanup();
  }
};

// Export for use in other modules
export { 
  createDistributedOrchestrator,
  runMultiDistributionDemo,
  createPipelineDistributionExample
};

// Run demo if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  await runMultiDistributionDemo();
  await createPipelineDistributionExample();
  console.log('\n🎉 Multi-Distribution Demo Complete!');
  process.exit(0);
}