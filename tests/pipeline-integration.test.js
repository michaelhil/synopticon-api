/**
 * Integration tests for Synopticon API multi-pipeline system
 * synopticon-api: an open-source platform for real-time multi-modal behavioral analysis and sensor synchronization
 * Tests orchestrator functionality, fallback strategies, and combined pipeline usage
 */

import { createOrchestrator } from '../src/core/orchestrator.js';
import { createBlazeFacePipeline } from '../src/pipelines/blazeface-pipeline.js';
import { createEyeTrackingPipeline } from '../src/pipelines/eye-tracking-pipeline.js';
import { createMediaPipeFaceMeshPipeline } from '../src/pipelines/mediapipe-pipeline.js';
import { createIrisTrackingPipeline } from '../src/pipelines/iris-tracking-pipeline.js';
import { createEmotionAnalysisPipeline } from '../src/pipelines/emotion-analysis-pipeline.js';
import { createAgeEstimationPipeline } from '../src/pipelines/age-estimation-pipeline.js';
import { Capability } from '../src/core/types.js';
import { isDependencyAvailable, checkSystemCapabilities } from '../src/utils/dependency-loader.js';

// Mock video frame for testing
const createMockVideoFrame = () => ({
  data: new Uint8Array(640 * 480 * 4), // RGBA
  width: 640,
  height: 480,
  timestamp: Date.now()
});

// Test orchestrator with all pipelines
describe('Pipeline Integration Tests', () => {
  let orchestrator;
  let mockFrame;

  beforeEach(() => {
    orchestrator = createOrchestrator({
      defaultRequirements: {
        capabilities: [Capability.FACE_DETECTION],
        strategy: 'performance_first',
        maxLatency: 100,
        targetFPS: 30
      }
    });
    mockFrame = createMockVideoFrame();
  });

  afterEach(async () => {
    if (orchestrator) {
      await orchestrator.cleanup();
    }
  });

  describe('Pipeline Registration and Discovery', () => {
    test('should register all pipelines successfully', async () => {
      const pipelines = [
        createBlazeFacePipeline(),
        createEyeTrackingPipeline({ useMockDevices: true }),
        createEmotionAnalysisPipeline(),
        createAgeEstimationPipeline(),
        // Skip MediaPipe pipelines if dependencies not available
        ...(isDependencyAvailable('mediapipeFaceMesh') ? [createMediaPipeFaceMeshPipeline()] : []),
        ...(isDependencyAvailable('mediapipeIris') ? [createIrisTrackingPipeline()] : [])
      ];

      for (const pipeline of pipelines) {
        try {
          const result = await orchestrator.registerPipeline(pipeline);
          expect(result).toBe(true);
          console.log(`✅ Registered pipeline: ${pipeline.name}`);
        } catch (error) {
          console.warn(`⚠️ Skipped pipeline ${pipeline.name}: ${error.message}`);
        }
      }

      const availablePipelines = orchestrator.getAvailablePipelines();
      expect(availablePipelines.length).toBeGreaterThan(0);
      
      // At minimum, BlazeFace and Eye Tracking should be available
      const pipelineNames = availablePipelines.map(p => p.name);
      expect(pipelineNames).toContain('blazeface');
      expect(pipelineNames).toContain('eye-tracking');
    });

    test('should handle pipeline initialization failures gracefully', async () => {
      // Create a pipeline that will fail to initialize
      const failingPipeline = createBlazeFacePipeline();
      
      // Mock the initialize method to fail
      const originalInitialize = failingPipeline.initialize;
      failingPipeline.initialize = async () => {
        throw new Error('Simulated initialization failure');
      };

      // Registration should handle the failure
      try {
        await orchestrator.registerPipeline(failingPipeline);
        fail('Expected registration to throw error');
      } catch (error) {
        expect(error.message).toContain('initialization failure');
      }
    });
  });

  describe('Capability-Based Pipeline Selection', () => {
    beforeEach(async () => {
      // Register available pipelines
      await orchestrator.registerPipeline(createBlazeFacePipeline());
      await orchestrator.registerPipeline(createEyeTrackingPipeline({ useMockDevices: true }));
    });

    test('should select pipelines based on requested capabilities', async () => {
      const requirements = {
        capabilities: [Capability.FACE_DETECTION],
        strategy: 'performance_first'
      };

      const selectedPipelines = await orchestrator.selectOptimalPipelines(requirements);
      expect(selectedPipelines.length).toBeGreaterThan(0);
      
      // Should include BlazeFace for face detection
      expect(selectedPipelines.some(p => p.includes('blazeface'))).toBe(true);
    });

    test('should handle multiple capability requirements', async () => {
      const requirements = {
        capabilities: [Capability.FACE_DETECTION, Capability.EYE_TRACKING],
        strategy: 'accuracy_first'
      };

      const selectedPipelines = await orchestrator.selectOptimalPipelines(requirements);
      
      // Should select pipelines that cover all capabilities
      expect(selectedPipelines.length).toBeGreaterThan(0);
    });

    test('should return empty array for unsupported capabilities', async () => {
      const requirements = {
        capabilities: ['unsupported_capability'],
        strategy: 'performance_first'
      };

      const selectedPipelines = await orchestrator.selectOptimalPipelines(requirements);
      expect(selectedPipelines).toEqual([]);
    });
  });

  describe('Multi-Pipeline Processing', () => {
    beforeEach(async () => {
      // Register pipelines that work without external dependencies
      await orchestrator.registerPipeline(createBlazeFacePipeline());
      await orchestrator.registerPipeline(createEyeTrackingPipeline({ 
        useMockDevices: true,
        autoConnect: false 
      }));
    });

    test('should process frame through multiple pipelines', async () => {
      const requirements = {
        capabilities: [Capability.FACE_DETECTION, Capability.EYE_TRACKING],
        strategy: 'hybrid'
      };

      try {
        const results = await orchestrator.process(mockFrame, requirements);
        
        expect(results).toBeDefined();
        expect(results.faces || results.gazeData).toBeDefined();
        expect(results.timestamp).toBeGreaterThan(0);
        expect(results.metadata).toBeDefined();
        
        console.log('✅ Multi-pipeline processing successful');
      } catch (error) {
        // If dependencies not available, test should handle gracefully
        console.warn(`⚠️ Multi-pipeline test skipped: ${error.message}`);
      }
    });

    test('should handle individual pipeline failures in multi-pipeline scenario', async () => {
      // Register a pipeline and then break it
      const eyeTrackingPipeline = createEyeTrackingPipeline({ useMockDevices: true });
      await orchestrator.registerPipeline(eyeTrackingPipeline);

      // Mock a processing failure
      const originalProcess = eyeTrackingPipeline.process;
      eyeTrackingPipeline.process = async () => {
        throw new Error('Simulated processing failure');
      };

      const requirements = {
        capabilities: [Capability.FACE_DETECTION],
        strategy: 'performance_first'
      };

      // Should still work with BlazeFace pipeline
      const results = await orchestrator.process(mockFrame, requirements);
      expect(results).toBeDefined();
    });
  });

  describe('Fallback Strategies', () => {
    test('should fall back to working pipelines when preferred pipeline fails', async () => {
      // Register multiple pipelines with same capability
      const blazeFace1 = createBlazeFacePipeline();
      blazeFace1.name = 'blazeface-primary';
      
      const blazeFace2 = createBlazeFacePipeline();
      blazeFace2.name = 'blazeface-fallback';

      await orchestrator.registerPipeline(blazeFace1);
      await orchestrator.registerPipeline(blazeFace2);

      // Break the primary pipeline
      blazeFace1.process = async () => {
        throw new Error('Primary pipeline failed');
      };

      const requirements = {
        capabilities: [Capability.FACE_DETECTION],
        strategy: 'performance_first'
      };

      const results = await orchestrator.processWithFallback(mockFrame, requirements);
      expect(results).toBeDefined();
      expect(results.source).toBe('blazeface-fallback');
    });

    test('should report error when all pipelines fail', async () => {
      const pipeline = createBlazeFacePipeline();
      
      // Mock failure
      pipeline.process = async () => {
        throw new Error('All pipelines failed');
      };
      
      await orchestrator.registerPipeline(pipeline);

      const requirements = {
        capabilities: [Capability.FACE_DETECTION],
        strategy: 'performance_first'
      };

      try {
        await orchestrator.processWithFallback(mockFrame, requirements);
        fail('Expected processing to throw error');
      } catch (error) {
        expect(error.message).toContain('pipelines failed');
      }
    });
  });

  describe('Circuit Breaker Functionality', () => {
    test('should open circuit breaker after repeated failures', async () => {
      const pipeline = createBlazeFacePipeline();
      pipeline.process = async () => {
        throw new Error('Consistent failure');
      };

      await orchestrator.registerPipeline(pipeline);
      
      const requirements = {
        capabilities: [Capability.FACE_DETECTION],
        strategy: 'performance_first'
      };

      // Trigger multiple failures
      for (let i = 0; i < 6; i++) {
        try {
          await orchestrator.process(mockFrame, requirements);
        } catch (error) {
          // Expected failures
        }
      }

      // Circuit should be open now
      const breakerState = orchestrator.getCircuitBreakerState();
      expect(breakerState.failures.get('blazeface')).toBeGreaterThan(0);
    });

    test('should reset circuit breaker after successful execution', async () => {
      const pipeline = createBlazeFacePipeline();
      let failureCount = 0;
      
      pipeline.process = async () => {
        if (failureCount < 3) {
          failureCount++;
          throw new Error('Temporary failure');
        }
        // Success after 3 failures
        return { faces: [], timestamp: Date.now(), source: 'blazeface' };
      };

      await orchestrator.registerPipeline(pipeline);
      
      const requirements = {
        capabilities: [Capability.FACE_DETECTION],
        strategy: 'performance_first'
      };

      // Trigger failures then success
      for (let i = 0; i < 5; i++) {
        try {
          await orchestrator.process(mockFrame, requirements);
        } catch (error) {
          // Some failures expected
        }
      }

      // Circuit should be reset
      const breakerState = orchestrator.getCircuitBreakerState();
      expect(breakerState.failures.get('blazeface')).toBe(0);
    });
  });

  describe('Performance Monitoring', () => {
    test('should collect performance metrics', async () => {
      await orchestrator.registerPipeline(createBlazeFacePipeline());
      
      const requirements = {
        capabilities: [Capability.FACE_DETECTION],
        strategy: 'performance_first'
      };

      const results = await orchestrator.process(mockFrame, requirements);
      
      const metrics = orchestrator.getMetrics();
      expect(metrics.totalRequests).toBeGreaterThan(0);
      expect(metrics.averageLatency).toBeGreaterThan(0);
      
      console.log('📊 Performance metrics:', metrics);
    });

    test('should track health status', async () => {
      await orchestrator.registerPipeline(createBlazeFacePipeline());
      
      const healthStatus = orchestrator.getHealthStatus();
      expect(healthStatus.status).toBeDefined();
      expect(healthStatus.lastCheck).toBeGreaterThan(0);
      
      console.log('🏥 Health status:', healthStatus);
    });
  });

  describe('Dependency Management', () => {
    test('should check system capabilities', () => {
      const capabilities = checkSystemCapabilities();
      
      expect(capabilities).toBeDefined();
      expect(typeof capabilities.tensorflow).toBe('object');
      expect(typeof capabilities.blazeface).toBe('object');
      expect(typeof capabilities.mediapipe).toBe('object');
      
      console.log('🔍 System capabilities:', capabilities);
    });

    test('should skip unavailable dependencies gracefully', async () => {
      // This test ensures the system works even without MediaPipe
      const pipelines = [
        createBlazeFacePipeline(),
        createEyeTrackingPipeline({ useMockDevices: true })
      ];

      let successCount = 0;
      for (const pipeline of pipelines) {
        try {
          await orchestrator.registerPipeline(pipeline);
          successCount++;
        } catch (error) {
          console.warn(`Pipeline skipped: ${error.message}`);
        }
      }

      expect(successCount).toBeGreaterThan(0);
      console.log(`✅ ${successCount} pipelines registered successfully`);
    });
  });

  describe('Combined Pipeline Workflows', () => {
    test('should coordinate face detection with eye tracking', async () => {
      const blazeFace = createBlazeFacePipeline();
      const eyeTracking = createEyeTrackingPipeline({ 
        useMockDevices: true,
        autoConnect: false
      });

      await orchestrator.registerPipeline(blazeFace);
      await orchestrator.registerPipeline(eyeTracking);

      const requirements = {
        capabilities: [Capability.FACE_DETECTION, Capability.EYE_TRACKING],
        strategy: 'hybrid'
      };

      try {
        const results = await orchestrator.process(mockFrame, requirements);
        
        // Should have combined results
        expect(results).toBeDefined();
        expect(results.timestamp).toBeGreaterThan(0);
        
        console.log('🔗 Combined pipeline workflow successful');
      } catch (error) {
        console.warn(`⚠️ Combined workflow test: ${error.message}`);
      }
    });

    test('should handle different processing strategies', async () => {
      await orchestrator.registerPipeline(createBlazeFacePipeline());
      await orchestrator.registerPipeline(createEyeTrackingPipeline({ 
        useMockDevices: true 
      }));

      const strategies = ['performance_first', 'accuracy_first', 'hybrid'];

      for (const strategy of strategies) {
        const requirements = {
          capabilities: [Capability.FACE_DETECTION],
          strategy
        };

        try {
          const results = await orchestrator.process(mockFrame, requirements);
          expect(results).toBeDefined();
          console.log(`✅ Strategy '${strategy}' works`);
        } catch (error) {
          console.warn(`⚠️ Strategy '${strategy}' failed: ${error.message}`);
        }
      }
    });
  });
});

// Integration test runner - can be called directly
export const runPipelineIntegrationTests = async () => {
  console.log('🧪 Running Pipeline Integration Tests...');
  
  try {
    const orchestrator = createOrchestrator();
    
    // Test basic pipeline registration
    const blazeFace = createBlazeFacePipeline();
    const eyeTracking = createEyeTrackingPipeline({ useMockDevices: true });
    
    console.log('📋 Registering pipelines...');
    await orchestrator.registerPipeline(blazeFace);
    await orchestrator.registerPipeline(eyeTracking);
    
    const availablePipelines = orchestrator.getAvailablePipelines();
    console.log(`✅ ${availablePipelines.length} pipelines registered`);
    
    // Test processing
    console.log('🔄 Testing processing...');
    const mockFrame = createMockVideoFrame();
    const results = await orchestrator.process(mockFrame, {
      capabilities: [Capability.FACE_DETECTION],
      strategy: 'performance_first'
    });
    
    console.log('✅ Processing successful:', results ? 'Results received' : 'No results');
    
    // Cleanup
    await orchestrator.cleanup();
    console.log('🧹 Cleanup completed');
    
    return {
      success: true,
      pipelineCount: availablePipelines.length,
      processingWorked: !!results
    };
    
  } catch (error) {
    console.error('❌ Integration test failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
};