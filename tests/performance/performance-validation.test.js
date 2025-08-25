/**
 * Performance Validation Tests
 * Validates that the eye tracking integration meets performance targets
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { createGazeProcessor } from '../../src/features/eye-tracking/gaze-processing.js';
import { createAdaptiveBatchScheduler } from '../../src/core/adaptive-batching.js';
import { createMemoryOptimizer } from '../../src/core/memory-optimization.js';
import { streamFactory } from '../../src/core/streams.js';

describe('Performance Validation', () => {
  describe('Gaze Processing Performance', () => {
    it('should process gaze data at target rate (200Hz)', async () => {
      const processor = createGazeProcessor();
      const startTime = performance.now();
      const targetCount = 200; // 1 second worth at 200Hz

      const testData = Array.from({ length: targetCount }, (_, i) => ({
        x: 0.5 + Math.sin(i * 0.1) * 0.2,
        y: 0.5 + Math.cos(i * 0.1) * 0.2,
        confidence: 0.8 + Math.random() * 0.2,
        timestamp: Date.now() + i * 5 // 5ms intervals
      }));

      for (const data of testData) {
        await processor.processGazeData(data);
      }

      const endTime = performance.now();
      const duration = endTime - startTime;
      const rate = (targetCount / (duration / 1000)).toFixed(0);

      console.log(`Gaze processing rate: ${rate} Hz (target: 200 Hz)`);
      console.log(`Processing time: ${duration.toFixed(2)}ms`);

      // Should process at least 200Hz (allow some overhead)
      expect(duration).toBeLessThan(1500); // Under 1.5 seconds
      
      const actualRate = targetCount / (duration / 1000);
      expect(actualRate).toBeGreaterThan(150); // At least 150Hz
    });

    it('should maintain low latency under load', async () => {
      const processor = createGazeProcessor();
      const latencies = [];
      const testCount = 1000;

      for (let i = 0; i < testCount; i++) {
        const startTime = performance.now();
        
        await processor.processGazeData({
          x: Math.random(),
          y: Math.random(),
          confidence: 0.8,
          timestamp: Date.now()
        });

        const latency = performance.now() - startTime;
        latencies.push(latency);
      }

      const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
      const maxLatency = Math.max(...latencies);
      const p95Latency = latencies.sort((a, b) => a - b)[Math.floor(latencies.length * 0.95)];

      console.log(`Average latency: ${avgLatency.toFixed(2)}ms`);
      console.log(`Max latency: ${maxLatency.toFixed(2)}ms`);
      console.log(`95th percentile: ${p95Latency.toFixed(2)}ms`);

      expect(avgLatency).toBeLessThan(5); // Average under 5ms
      expect(p95Latency).toBeLessThan(10); // 95th percentile under 10ms
      expect(maxLatency).toBeLessThan(50); // Max under 50ms
    });
  });

  describe('Memory Usage Performance', () => {
    it('should manage memory efficiently with object pooling', () => {
      const optimizer = createMemoryOptimizer();
      const initialMemory = performance.memory?.usedJSHeapSize || 0;
      
      // Create and release many objects
      const objects = [];
      for (let i = 0; i < 5000; i++) {
        objects.push(optimizer.createGazeData(
          Date.now(),
          Math.random(),
          Math.random(),
          0.8 + Math.random() * 0.2
        ));
      }

      const afterCreation = performance.memory?.usedJSHeapSize || 0;
      
      // Release objects back to pool
      for (const obj of objects) {
        optimizer.releaseObject(obj);
      }

      const afterRelease = performance.memory?.usedJSHeapSize || 0;
      
      const creationGrowth = afterCreation - initialMemory;
      const releaseGrowth = afterRelease - initialMemory;

      console.log(`Memory after creation: ${(creationGrowth / 1024 / 1024).toFixed(2)} MB`);
      console.log(`Memory after release: ${(releaseGrowth / 1024 / 1024).toFixed(2)} MB`);

      const stats = optimizer.getStats();
      console.log(`Pool reuse ratio: ${(stats.memoryPool.reuseHits / stats.memoryPool.allocations * 100).toFixed(1)}%`);

      // Memory growth should be reasonable
      expect(creationGrowth).toBeLessThan(100 * 1024 * 1024); // Under 100MB
      
      // Should have some object reuse
      expect(stats.memoryPool.reuseHits).toBeGreaterThan(0);

      optimizer.cleanup();
    });

    it('should handle memory pressure gracefully', async () => {
      const optimizer = createMemoryOptimizer({
        memoryPressureThreshold: 0.1, // Low threshold for testing
        gcInterval: 100
      });

      optimizer.startMonitoring();

      const initialStats = optimizer.getStats();
      
      // Create sustained memory load
      const objects = [];
      for (let batch = 0; batch < 10; batch++) {
        for (let i = 0; i < 1000; i++) {
          objects.push(optimizer.createGazeData(
            Date.now(),
            Math.random(),
            Math.random(),
            Math.random()
          ));
        }
        
        // Occasionally release some objects
        if (batch % 3 === 0 && objects.length > 500) {
          for (let i = 0; i < 500; i++) {
            optimizer.releaseObject(objects.pop());
          }
        }
        
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      const finalStats = optimizer.getStats();
      
      console.log(`Total objects created: ${finalStats.memoryPool.poolSizes.gazeData?.created || 0}`);
      console.log(`Optimizations applied: ${finalStats.optimizationApplied}`);

      // Should have triggered some optimization
      expect(finalStats.optimizationApplied).toBeGreaterThan(0);

      optimizer.cleanup();
    });
  });

  describe('Adaptive Batching Performance', () => {
    it('should adapt batch size based on load', async () => {
      const scheduler = createAdaptiveBatchScheduler({
        strategy: 'adaptive',
        maxBatchSize: 50,
        minBatchSize: 1
      });

      const decisions = [];
      const processingTimes = [];

      // Test different load scenarios
      const scenarios = [
        { itemCount: 10, expectedLoad: 'low' },
        { itemCount: 100, expectedLoad: 'medium' }, 
        { itemCount: 500, expectedLoad: 'high' }
      ];

      for (const scenario of scenarios) {
        const items = Array.from({ length: scenario.itemCount }, (_, i) => ({
          id: i,
          data: Math.random(),
          confidence: 0.8 + Math.random() * 0.2
        }));

        const startTime = performance.now();
        
        const result = await scheduler.processBatch(items, async (batch) => {
          // Simulate processing delay
          await new Promise(resolve => setTimeout(resolve, batch.length * 0.1));
          return batch.map(item => ({ ...item, processed: true }));
        });

        const processingTime = performance.now() - startTime;
        processingTimes.push(processingTime);
        decisions.push({
          scenario: scenario.expectedLoad,
          itemCount: scenario.itemCount,
          batchSize: result.decision.batchSize,
          processingTime,
          throughput: result.processed / (processingTime / 1000)
        });
      }

      console.log('Batching performance:');
      decisions.forEach(d => {
        console.log(`  ${d.scenario}: ${d.itemCount} items → ${d.batchSize} batch size, ${d.throughput.toFixed(0)} items/sec`);
      });

      // Batch sizes should adapt to load
      expect(decisions[0].batchSize).toBeLessThanOrEqual(decisions[1].batchSize);
      
      // Should maintain reasonable throughput
      decisions.forEach(d => {
        expect(d.throughput).toBeGreaterThan(50); // At least 50 items/sec
      });
    });

    it('should handle quality-aware batching', () => {
      const scheduler = createAdaptiveBatchScheduler({
        strategy: 'quality_aware'
      });

      const highQualityItems = Array.from({ length: 20 }, () => ({ 
        confidence: 0.9 + Math.random() * 0.1 
      }));
      
      const lowQualityItems = Array.from({ length: 20 }, () => ({ 
        confidence: 0.2 + Math.random() * 0.3 
      }));

      const highQualityDecision = scheduler.decideBatchStrategy(highQualityItems);
      const lowQualityDecision = scheduler.decideBatchStrategy(lowQualityItems);

      console.log(`High quality: batch size ${highQualityDecision.batchSize}, reason: ${highQualityDecision.reason}`);
      console.log(`Low quality: batch size ${lowQualityDecision.batchSize}, reason: ${lowQualityDecision.reason}`);

      // High quality should allow larger batches
      expect(highQualityDecision.batchSize).toBeGreaterThanOrEqual(lowQualityDecision.batchSize);
      expect(highQualityDecision.reason).toContain('high_quality');
      expect(lowQualityDecision.reason).toContain('low_quality');
    });
  });

  describe('Stream Integration Performance', () => {
    it('should maintain performance with optimized eye tracking stream', async () => {
      const stream = streamFactory.create('eyetracking', {
        id: 'performance-test',
        enableMemoryOptimization: true,
        enableAdaptiveBatching: true,
        sampleRate: 200
      });

      await stream.start();

      const startTime = Date.now();
      const processedData = [];

      // Process data for 1 second
      const testDuration = 1000;
      const expectedSamples = 200; // 200Hz
      
      stream.onData((data) => {
        processedData.push({
          timestamp: data.timestamp,
          processingTime: data.processingTime || 0
        });
      });

      // Generate test data at 200Hz
      for (let i = 0; i < expectedSamples; i++) {
        await stream.process({
          timestamp: startTime + i * 5,
          x: 0.5 + Math.sin(i * 0.1) * 0.2,
          y: 0.5 + Math.cos(i * 0.1) * 0.2,
          confidence: 0.8 + Math.random() * 0.2
        });
      }

      const totalTime = Date.now() - startTime;
      const actualRate = processedData.length / (totalTime / 1000);

      console.log(`Stream processing rate: ${actualRate.toFixed(0)} Hz (target: 200 Hz)`);
      console.log(`Total processing time: ${totalTime}ms`);
      
      if (processedData.length > 0) {
        const avgProcessingTime = processedData.reduce((sum, d) => sum + d.processingTime, 0) / processedData.length;
        console.log(`Average per-item processing time: ${avgProcessingTime.toFixed(2)}ms`);
        
        expect(avgProcessingTime).toBeLessThan(5); // Under 5ms per item
      }

      // Should process most of the data
      expect(processedData.length).toBeGreaterThan(expectedSamples * 0.8); // At least 80%
      
      // Should complete in reasonable time
      expect(totalTime).toBeLessThan(testDuration * 2); // Under 2 seconds

      await stream.stop();
    });
  });

  describe('System Integration Performance', () => {
    it('should handle concurrent multimodal processing', async () => {
      const faceStream = streamFactory.create('video', { 
        id: 'face-perf',
        sampleRate: 30 
      });
      
      const gazeStream = streamFactory.create('eyetracking', { 
        id: 'gaze-perf',
        enableMemoryOptimization: true,
        enableAdaptiveBatching: true,
        sampleRate: 200
      });

      await Promise.all([faceStream.start(), gazeStream.start()]);

      const results = { face: [], gaze: [] };
      
      faceStream.onData((data) => results.face.push(data));
      gazeStream.onData((data) => results.gaze.push(data));

      const startTime = Date.now();
      const testDuration = 500; // 0.5 seconds

      // Concurrent processing
      const promises = [];

      // Face processing (30 Hz)
      for (let i = 0; i < 15; i++) {
        promises.push(
          faceStream.process({
            timestamp: startTime + i * 33,
            faces: [{
              bbox: { x: 100, y: 100, width: 200, height: 200 },
              confidence: 0.9
            }]
          })
        );
      }

      // Gaze processing (200 Hz)
      for (let i = 0; i < 100; i++) {
        promises.push(
          gazeStream.process({
            timestamp: startTime + i * 5,
            x: Math.random(),
            y: Math.random(),
            confidence: 0.8
          })
        );
      }

      await Promise.all(promises);
      
      const totalTime = Date.now() - startTime;
      
      console.log(`Concurrent processing completed in ${totalTime}ms`);
      console.log(`Face samples processed: ${results.face.length}`);
      console.log(`Gaze samples processed: ${results.gaze.length}`);

      // Should complete efficiently
      expect(totalTime).toBeLessThan(1000); // Under 1 second
      
      // Should process all data
      expect(results.face.length).toBe(15);
      expect(results.gaze.length).toBe(100);

      await Promise.all([faceStream.stop(), gazeStream.stop()]);
    });
  });
});