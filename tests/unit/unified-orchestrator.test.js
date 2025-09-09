/**
 * Unit tests for unified orchestrator
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import { createUnifiedOrchestrator } from '../../src/core/orchestration/unified-orchestrator.ts';

describe('Unified Orchestrator', () => {
  let orchestrator;

  beforeEach(() => {
    orchestrator = createUnifiedOrchestrator({
      logLevel: 'error' // Reduce noise in tests
    });
  });

  test('should register and execute pipelines', async () => {
    // Register a simple pipeline
    orchestrator.register('test-pipeline', async (input) => ({
      success: true,
      data: { processed: input.value * 2 }
    }), {
      capabilities: ['processing'],
      priority: 1
    });

    // Execute pipeline
    const result = await orchestrator.executePipeline('test-pipeline', { value: 5 });
    
    expect(result.success).toBe(true);
    expect(result.data.processed).toBe(10);
  });

  test('should find pipelines by capabilities', () => {
    // Register multiple pipelines
    orchestrator.register('pipeline-1', async () => ({}), {
      capabilities: ['face-detection', 'emotion']
    });
    
    orchestrator.register('pipeline-2', async () => ({}), {
      capabilities: ['face-detection']
    });
    
    orchestrator.register('pipeline-3', async () => ({}), {
      capabilities: ['emotion', 'age']
    });

    // Find by single capability
    const faceDetection = orchestrator.findPipelines(['face-detection']);
    expect(faceDetection).toHaveLength(2);
    
    // Find by multiple capabilities
    const emotionAndFace = orchestrator.findPipelines(['face-detection', 'emotion']);
    expect(emotionAndFace).toHaveLength(1);
    expect(emotionAndFace[0].id).toBe('pipeline-1');
  });

  test('should handle retry on failure', async () => {
    let attempts = 0;
    
    // Register pipeline that fails first 2 times
    orchestrator.register('flaky-pipeline', async () => {
      attempts++;
      if (attempts < 3) {
        throw new Error('Temporary failure');
      }
      return { success: true, attempts };
    });

    // Execute with retry
    const result = await orchestrator.executePipeline('flaky-pipeline', {}, {
      retry: {
        maxRetries: 3,
        initialDelayMs: 10 // Fast retry for tests
      }
    });

    expect(result.success).toBe(true);
    expect(result.attempts).toBe(3);
  });

  test('should execute with fallback strategy', async () => {
    // Register pipelines
    orchestrator.register('failing-pipeline', async () => {
      throw new Error('Always fails');
    }, { capabilities: ['test'] });
    
    orchestrator.register('working-pipeline', async (input) => ({
      success: true,
      data: input
    }), { capabilities: ['test'] });

    // Execute with fallback
    const result = await orchestrator.execute(
      { capabilities: ['test'] },
      { value: 'test' },
      { strategy: 'fallback' }
    );

    expect(result.success).toBe(true);
    expect(result.data.value).toBe('test');
  });

  test('should execute pipelines in parallel', async () => {
    const executionOrder = [];
    
    // Register pipelines with different delays
    orchestrator.register('fast', async () => {
      await new Promise(r => setTimeout(r, 10));
      executionOrder.push('fast');
      return { id: 'fast' };
    }, { capabilities: ['test'] });
    
    orchestrator.register('slow', async () => {
      await new Promise(r => setTimeout(r, 50));
      executionOrder.push('slow');
      return { id: 'slow' };
    }, { capabilities: ['test'] });

    // Execute in parallel
    const result = await orchestrator.execute(
      { capabilities: ['test'] },
      {},
      { strategy: 'parallel', maxConcurrent: 2 }
    );

    // Fast pipeline should complete first and be returned
    expect(result.id).toBe('fast');
    expect(executionOrder[0]).toBe('fast');
  });

  test('should track metrics', async () => {
    // Register and execute pipeline
    orchestrator.register('metrics-test', async () => ({
      success: true
    }));

    await orchestrator.executePipeline('metrics-test', {});
    await orchestrator.executePipeline('metrics-test', {});
    
    // Check metrics
    const metrics = orchestrator.getMetrics();
    expect(metrics.totalPipelines).toBe(1);
    expect(metrics.successfulExecutions).toBe(2);
    expect(metrics.failedExecutions).toBe(0);
    
    const pipelineStats = metrics.pipelineStats.find(p => p.id === 'metrics-test');
    expect(pipelineStats.successCount).toBe(2);
    expect(pipelineStats.successRate).toBe(1);
  });

  test('should reset metrics', async () => {
    // Register and execute
    orchestrator.register('reset-test', async () => ({ success: true }));
    await orchestrator.executePipeline('reset-test', {});
    
    // Reset
    orchestrator.reset('reset-test');
    
    // Check metrics are reset
    const pipelines = orchestrator.getPipelines();
    const pipeline = pipelines.find(p => p.id === 'reset-test');
    expect(pipeline.successRate).toBe(0);
  });
});