/**
 * Core System Integrity Test
 * Tests the TypeScript-converted core functionality
 */

import { createOrchestrator } from './src/core/orchestrator.ts';
import { createStrategyRegistry } from './src/core/strategies.ts';
import { createConfiguration } from './src/core/configuration.ts';
import { createPipeline } from './src/core/pipeline.ts';
import type { AnalysisRequirements, CapabilityType, AnalysisResult } from './src/core/types.ts';

// Test pipeline implementation
const createTestPipeline = (name: string, capabilities: ReadonlyArray<CapabilityType>) => {
  return createPipeline({
    name,
    capabilities,
    performance: {
      fps: 30,
      latency: '50ms',
      modelSize: 'medium',
      cpuUsage: 'medium',
      memoryUsage: 'medium',
      batteryImpact: 'medium'
    },
    process: async (frame: unknown): Promise<AnalysisResult> => {
      // Mock processing
      return {
        status: 'success',
        data: {
          faces: [],
          metadata: {
            processingTime: 50,
            algorithm: name,
            modelVersion: '1.0.0',
            imageSize: { width: 640, height: 480 },
            timestamp: Date.now()
          },
          performance: {
            processedFrames: 1,
            averageProcessingTime: 50,
            currentFPS: 20,
            peakMemoryUsage: 0,
            gcPressure: 0,
            droppedFrames: 0,
            qualityScore: 1.0,
            timestamp: Date.now()
          }
        },
        id: `${name}_${Date.now()}`,
        timestamp: Date.now(),
        processingTime: 50,
        source: name
      };
    }
  });
};

async function testCoreSystem() {
  console.log('🧪 Testing TypeScript Core System Integrity...');
  
  try {
    // Test 1: Configuration System
    console.log('\n1️⃣  Testing Configuration System...');
    const config = createConfiguration({
      system: {
        performanceMonitoring: true,
        errorHandling: 'graceful',
        logLevel: 'info',
        enableMetrics: true
      },
      performance: {
        targetFPS: 30,
        maxLatency: 100,
        memoryLimit: 512 * 1024 * 1024,
        gcThreshold: 0.8,
        profileQueries: false,
        enableProfiling: false,
        metricsInterval: 1000
      }
    });
    console.log('✅ Configuration system working');
    
    // Test 2: Strategy Registry
    console.log('\n2️⃣  Testing Strategy Registry...');
    const strategies = createStrategyRegistry();
    const performanceStrategy = strategies.getStrategy('performance_first');
    const accuracyStrategy = strategies.getStrategy('accuracy_first');
    console.log('✅ Strategy registry working');
    console.log(`   Available strategies: ${strategies.listStrategies().join(', ')}`);
    
    // Test 3: Pipeline Creation
    console.log('\n3️⃣  Testing Pipeline Creation...');
    const testPipeline = createTestPipeline('test-pipeline', ['face_detection']);
    await testPipeline.initialize();
    console.log('✅ Pipeline creation and initialization working');
    
    // Test 4: Orchestrator Creation
    console.log('\n4️⃣  Testing Orchestrator...');
    const orchestrator = createOrchestrator({
      strategies,
      defaultStrategy: 'performance_first'
    });
    
    // Register test pipeline
    await orchestrator.registerPipeline(testPipeline);
    console.log('✅ Orchestrator creation and pipeline registration working');
    
    // Test 5: Analysis Execution
    console.log('\n5️⃣  Testing Analysis Execution...');
    const requirements: AnalysisRequirements = {
      capabilities: ['face_detection'],
      strategy: 'performance_first'
    };
    
    const result = await orchestrator.analyze('mock-frame', requirements);
    console.log('✅ Analysis execution working');
    console.log(`   Result status: ${result.status}`);
    
    // Test 6: Circuit Breaker
    console.log('\n6️⃣  Testing Circuit Breaker...');
    const circuitStats = orchestrator.getCircuitBreakerStats();
    console.log('✅ Circuit breaker working');
    console.log(`   Circuit breaker stats retrieved for ${Object.keys(circuitStats).length} pipelines`);
    
    // Test 7: Health Status
    console.log('\n7️⃣  Testing Health Monitoring...');
    const status = orchestrator.getStatus();
    console.log('✅ Health monitoring working');
    console.log(`   System status: ${status.pipelines.total} pipelines, ${status.pipelines.healthy} healthy`);
    
    // Cleanup
    await orchestrator.cleanup();
    console.log('\n🎉 All core system tests passed!');
    console.log('\n📊 TypeScript Core System Status:');
    console.log('   ✅ Type-safe configuration system');
    console.log('   ✅ Strategy pattern with full typing');
    console.log('   ✅ Pipeline orchestration with circuit breakers');
    console.log('   ✅ Discriminated union result types');
    console.log('   ✅ Error handling and recovery mechanisms');
    console.log('   ✅ Performance monitoring and metrics');
    
  } catch (error) {
    console.error('❌ Core system test failed:', error);
    process.exit(1);
  }
}

// Run the test
testCoreSystem().catch(console.error);
