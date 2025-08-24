/**
 * Live demonstration of orchestrator functionality
 * Tests pipeline selection, fallback strategies, and combined processing
 */

import { createOrchestrator } from './src/core/orchestrator.js';
import { createMediaPipeFacePipeline } from './src/pipelines/mediapipe-face-pipeline.js';
import { createEyeTrackingPipeline } from './src/pipelines/eye-tracking-pipeline.js';
import { createMediaPipeFaceMeshPipeline } from './src/pipelines/mediapipe-pipeline.js';
import { createIrisTrackingPipeline } from './src/pipelines/iris-tracking-pipeline.js';
import { createEmotionAnalysisPipeline } from './src/pipelines/emotion-analysis-pipeline.js';
import { createAgeEstimationPipeline } from './src/pipelines/age-estimation-pipeline.js';
import { Capability } from './src/core/types.js';
import { checkSystemCapabilities, isDependencyAvailable } from './src/utils/dependency-loader.js';

// Mock video frame generator
const createMockFrame = (width = 640, height = 480) => {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  
  // Draw a simple face-like pattern for testing
  ctx.fillStyle = '#f0c674';
  ctx.fillRect(width * 0.3, height * 0.3, width * 0.4, height * 0.5); // Face
  
  ctx.fillStyle = '#2d2d2d';
  ctx.fillRect(width * 0.35, height * 0.4, width * 0.08, height * 0.06); // Left eye
  ctx.fillRect(width * 0.55, height * 0.4, width * 0.08, height * 0.06); // Right eye
  
  ctx.fillRect(width * 0.45, height * 0.65, width * 0.1, height * 0.04); // Mouth
  
  return canvas;
};

// Orchestrator demonstration
const demonstrateOrchestrator = async () => {
  console.log('🎭 Face Analysis Engine - Orchestrator Demo');
  console.log('='.repeat(50));
  
  try {
    // 1. System Capabilities Check
    console.log('\n📋 Checking System Capabilities...');
    const capabilities = checkSystemCapabilities();
    
    for (const [dep, info] of Object.entries(capabilities)) {
      const status = info.available ? '✅' : '❌';
      console.log(`  ${status} ${info.name}`);
    }
    
    // 2. Create Orchestrator
    console.log('\n🏗️ Creating Orchestrator...');
    const orchestrator = createOrchestrator({
      defaultRequirements: {
        capabilities: [Capability.FACE_DETECTION],
        strategy: 'performance_first',
        maxLatency: 100,
        targetFPS: 30
      }
    });
    
    // 3. Register Pipelines
    console.log('\n📦 Registering Pipelines...');
    const pipelineResults = new Map();
    
    // Always available pipelines
    const guaranteedPipelines = [
      { name: 'MediaPipe Face', factory: () => createMediaPipeFacePipeline() },
      { name: 'Eye Tracking', factory: () => createEyeTrackingPipeline({ useMockDevices: true, autoConnect: false }) },
      { name: 'Emotion Analysis', factory: () => createEmotionAnalysisPipeline() },
      { name: 'Age Estimation', factory: () => createAgeEstimationPipeline() }
    ];
    
    // Conditional pipelines (require external dependencies)
    const conditionalPipelines = [
      { 
        name: 'MediaPipe Face Mesh', 
        factory: () => createMediaPipeFaceMeshPipeline(),
        check: () => true // Will be checked during initialization
      },
      { 
        name: 'MediaPipe Iris', 
        factory: () => createIrisTrackingPipeline(),
        check: () => true // Will be checked during initialization
      }
    ];
    
    // Register guaranteed pipelines
    for (const { name, factory } of guaranteedPipelines) {
      try {
        const pipeline = factory();
        await orchestrator.registerPipeline(pipeline);
        pipelineResults.set(name, { success: true, pipeline });
        console.log(`  ✅ ${name} registered successfully`);
      } catch (error) {
        pipelineResults.set(name, { success: false, error: error.message });
        console.log(`  ❌ ${name} failed: ${error.message}`);
      }
    }
    
    // Register conditional pipelines
    for (const { name, factory } of conditionalPipelines) {
      try {
        const pipeline = factory();
        await orchestrator.registerPipeline(pipeline);
        pipelineResults.set(name, { success: true, pipeline });
        console.log(`  ✅ ${name} registered successfully`);
      } catch (error) {
        pipelineResults.set(name, { success: false, error: error.message });
        console.log(`  ⚠️ ${name} skipped: ${error.message}`);
      }
    }
    
    // 4. Show Registered Pipelines
    console.log('\n📊 Available Pipelines:');
    const availablePipelines = orchestrator.getAvailablePipelines();
    availablePipelines.forEach(pipeline => {
      console.log(`  • ${pipeline.name} - Capabilities: [${pipeline.capabilities.join(', ')}]`);
    });
    
    // 5. Demonstrate Pipeline Selection
    console.log('\n🎯 Testing Pipeline Selection...');
    
    const testRequirements = [
      {
        name: 'Face Detection Only',
        requirements: {
          capabilities: [Capability.FACE_DETECTION],
          strategy: 'performance_first'
        }
      },
      {
        name: 'Face + Eye Tracking',
        requirements: {
          capabilities: [Capability.FACE_DETECTION, Capability.EYE_TRACKING],
          strategy: 'hybrid'
        }
      },
      {
        name: '6DOF Pose Estimation',
        requirements: {
          capabilities: [Capability.POSE_ESTIMATION_6DOF],
          strategy: 'accuracy_first'
        }
      },
      {
        name: 'All Capabilities',
        requirements: {
          capabilities: [
            Capability.FACE_DETECTION,
            Capability.EYE_TRACKING,
            Capability.LANDMARK_DETECTION,
            Capability.POSE_ESTIMATION_6DOF
          ],
          strategy: 'hybrid'
        }
      }
    ];
    
    for (const { name, requirements } of testRequirements) {
      try {
        const selectedPipelines = await orchestrator.selectOptimalPipelines(requirements);
        console.log(`  ✅ ${name}: [${selectedPipelines.join(', ')}]`);
      } catch (error) {
        console.log(`  ❌ ${name}: ${error.message}`);
      }
    }
    
    // 6. Live Processing Test
    console.log('\n🔄 Testing Live Processing...');
    const mockFrame = createMockFrame();
    
    const processingTests = [
      {
        name: 'Basic Face Detection',
        requirements: {
          capabilities: [Capability.FACE_DETECTION],
          strategy: 'performance_first'
        }
      },
      {
        name: 'Multi-Modal Analysis',
        requirements: {
          capabilities: [Capability.FACE_DETECTION, Capability.EYE_TRACKING],
          strategy: 'hybrid'
        }
      }
    ];
    
    for (const { name, requirements } of processingTests) {
      try {
        const startTime = performance.now();
        const results = await orchestrator.process(mockFrame, requirements);
        const processingTime = performance.now() - startTime;
        
        console.log(`  ✅ ${name}:`);
        console.log(`     Processing time: ${processingTime.toFixed(2)}ms`);
        console.log(`     Results: ${results.faces ? results.faces.length + ' faces' : 'No faces'}, ${results.gazeData ? results.gazeData.length + ' gaze points' : 'No gaze data'}`);
        console.log(`     Source: ${results.source || 'multiple'}`);
        
      } catch (error) {
        console.log(`  ❌ ${name}: ${error.message}`);
      }
    }
    
    // 7. Fallback Strategy Test
    console.log('\n🔄 Testing Fallback Strategies...');
    
    // Get a working pipeline and temporarily break it
    const workingPipelines = availablePipelines.filter(p => 
      p.capabilities.includes(Capability.FACE_DETECTION)
    );
    
    if (workingPipelines.length > 0) {
      const testPipeline = workingPipelines[0];
      const originalProcess = testPipeline.process;
      
      // Temporarily break the pipeline
      testPipeline.process = async () => {
        throw new Error('Simulated pipeline failure');
      };
      
      try {
        const results = await orchestrator.processWithFallback(mockFrame, {
          capabilities: [Capability.FACE_DETECTION],
          strategy: 'performance_first'
        });
        console.log('  ✅ Fallback strategy worked - got results from backup pipeline');
      } catch (error) {
        console.log('  ⚠️ All pipelines failed:', error.message);
      }
      
      // Restore original function
      testPipeline.process = originalProcess;
    }
    
    // 8. Performance Metrics
    console.log('\n📊 Performance Metrics:');
    const metrics = orchestrator.getMetrics();
    console.log(`  • Total requests: ${metrics.totalRequests}`);
    console.log(`  • Successful requests: ${metrics.successfulRequests}`);
    console.log(`  • Failed requests: ${metrics.failedRequests}`);
    console.log(`  • Success rate: ${(metrics.successfulRequests / Math.max(1, metrics.totalRequests) * 100).toFixed(1)}%`);
    console.log(`  • Average latency: ${metrics.averageLatency.toFixed(2)}ms`);
    
    // 9. Health Status
    console.log('\n🏥 System Health:');
    const health = orchestrator.getHealthStatus();
    console.log(`  • Status: ${health.status}`);
    console.log(`  • Last check: ${new Date(health.lastCheck).toLocaleString()}`);
    console.log(`  • Error count: ${health.errorCount}`);
    console.log(`  • Success rate: ${(health.successRate * 100).toFixed(1)}%`);
    
    // 10. Circuit Breaker Status
    console.log('\n⚡ Circuit Breaker Status:');
    const breakerState = orchestrator.getCircuitBreakerState();
    
    if (breakerState.failures.size === 0) {
      console.log('  • All pipelines healthy (no failures recorded)');
    } else {
      for (const [pipelineId, failures] of breakerState.failures.entries()) {
        const lastFailure = breakerState.lastFailure.get(pipelineId);
        const status = failures >= 5 ? '🔴 OPEN' : '🟢 CLOSED';
        console.log(`  • ${pipelineId}: ${status} (${failures} failures, last: ${lastFailure ? new Date(lastFailure).toLocaleString() : 'never'})`);
      }
    }
    
    // Cleanup
    console.log('\n🧹 Cleaning up...');
    await orchestrator.cleanup();
    
    console.log('\n🎉 Orchestrator demonstration completed successfully!');
    console.log('='.repeat(50));
    
    return {
      success: true,
      registeredPipelines: availablePipelines.length,
      processedFrames: metrics.totalRequests,
      successRate: metrics.successfulRequests / Math.max(1, metrics.totalRequests)
    };
    
  } catch (error) {
    console.error('❌ Orchestrator demonstration failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Circuit breaker demonstration
const demonstrateCircuitBreaker = async () => {
  console.log('\n⚡ Circuit Breaker Demonstration');
  console.log('-'.repeat(30));
  
  const orchestrator = createOrchestrator();
  
  // Register a pipeline
  const pipeline = createMediaPipeFacePipeline();
  await orchestrator.registerPipeline(pipeline);
  
  // Create a pipeline that will fail
  const originalProcess = pipeline.process;
  pipeline.process = async () => {
    throw new Error('Simulated failure for circuit breaker test');
  };
  
  const mockFrame = createMockFrame();
  
  console.log('Triggering failures to open circuit breaker...');
  
  // Trigger failures
  for (let i = 0; i < 7; i++) {
    try {
      await orchestrator.process(mockFrame, {
        capabilities: [Capability.FACE_DETECTION]
      });
    } catch (error) {
      console.log(`  Failure ${i + 1}: ${error.message}`);
    }
  }
  
  // Check circuit breaker state
  const breakerState = orchestrator.getCircuitBreakerState();
  const failures = breakerState.failures.get('mediapipe-face') || 0;
  const isOpen = failures >= 5;
  
  console.log(`Circuit breaker status: ${isOpen ? '🔴 OPEN' : '🟢 CLOSED'} (${failures} failures)`);
  
  // Restore pipeline and test recovery
  pipeline.process = originalProcess;
  
  if (isOpen) {
    console.log('Waiting for circuit breaker cooldown...');
    // In real scenario, we'd wait 30 seconds. For demo, we'll just show the logic
    console.log('(In production, circuit would reopen after 30 seconds)');
  }
  
  await orchestrator.cleanup();
  return isOpen;
};

// Run demonstrations
const runDemonstrations = async () => {
  const orchestratorResult = await demonstrateOrchestrator();
  const circuitBreakerResult = await demonstrateCircuitBreaker();
  
  return {
    orchestrator: orchestratorResult,
    circuitBreaker: circuitBreakerResult
  };
};

// Export for external use
export { 
  demonstrateOrchestrator, 
  demonstrateCircuitBreaker,
  runDemonstrations 
};

// Auto-run if this file is executed directly
if (typeof window !== 'undefined') {
  // Browser environment - wait for page load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', runDemonstrations);
  } else {
    runDemonstrations();
  }
} else if (typeof process !== 'undefined' && process.argv && process.argv[1] && process.argv[1].includes('test-orchestrator-demo.js')) {
  // Node.js environment - run immediately
  runDemonstrations().catch(console.error);
}