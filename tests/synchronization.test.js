/**
 * Stream Synchronization Engine Tests
 * Testing temporal alignment, quality metrics, and multimodal coordination
 * Using Bun test runner
 */

import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { 
  createSynchronizationEngine,
  createMultiStreamCoordinator,
  createTemporalAligner,
  createSyncMetrics,
  SynchronizationStrategy
} from '../src/core/synchronization.js';
import { createDataStream } from '../src/core/streams.js';

describe('Synchronization Metrics', () => {
  
  it('should create sync metrics with defaults', () => {
    const metrics = createSyncMetrics();
    
    expect(metrics.quality).toBe(1.0);
    expect(metrics.latency).toBe(0);
    expect(metrics.jitter).toBe(0);
    expect(metrics.droppedSamples).toBe(0);
    expect(typeof metrics.lastUpdate).toBe('number');
  });
  
  it('should compute overall quality based on penalties', () => {
    const metrics = createSyncMetrics({
      jitter: 5, // 5ms jitter = 5% penalty
      droppedSamples: 10, // 10 drops = 10% penalty  
      latency: 20 // 20ms latency = 20% penalty
    });
    
    const overallQuality = metrics.computeOverallQuality();
    expect(overallQuality).toBeCloseTo(0.92, 1); // 1.0 - 0.05 - 0.01 - 0.02 = 0.92
  });
});

describe('Temporal Alignment Algorithms', () => {
  
  it('should create hardware timestamp aligner', () => {
    const aligner = createTemporalAligner(SynchronizationStrategy.HARDWARE_TIMESTAMP);
    
    expect(aligner.strategy).toBe(SynchronizationStrategy.HARDWARE_TIMESTAMP);
    expect(typeof aligner.align).toBe('function');
    expect(typeof aligner.getQuality).toBe('function');
  });
  
  it('should create buffer-based aligner', () => {
    const aligner = createTemporalAligner(SynchronizationStrategy.BUFFER_BASED);
    
    expect(aligner.strategy).toBe(SynchronizationStrategy.BUFFER_BASED);
    expect(typeof aligner.align).toBe('function');
    expect(typeof aligner.findBestAlignment).toBe('function');
  });
  
  it('should align data with hardware timestamps', () => {
    const aligner = createTemporalAligner(SynchronizationStrategy.HARDWARE_TIMESTAMP);
    
    const baseTime = Date.now();
    const streamData1 = { 
      streamId: 'test-stream-1',
      hardwareTimestamp: baseTime,
      timestamp: baseTime 
    };
    
    const result1 = aligner.align(streamData1);
    expect(result1.confidence).toBe(0.95);
    expect(typeof result1.alignedTimestamp).toBe('number');
    
    // Second data point should track drift
    const streamData2 = { 
      streamId: 'test-stream-1',
      hardwareTimestamp: baseTime + 100,
      timestamp: baseTime + 102 // 2ms software drift
    };
    
    const result2 = aligner.align(streamData2);
    expect(result2.confidence).toBe(0.95);
    expect(typeof result2.drift).toBe('number');
  });
  
  it('should align data with buffer-based strategy', () => {
    const aligner = createTemporalAligner(SynchronizationStrategy.BUFFER_BASED);
    
    const baseTime = Date.now();
    const tolerance = 50;
    
    const streamData = [
      { streamId: 'stream1', timestamp: baseTime },
      { streamId: 'stream2', timestamp: baseTime + 10 },
      { streamId: 'stream3', timestamp: baseTime + 100 } // Outside tolerance
    ];
    
    const results = aligner.align(streamData, baseTime);
    
    expect(results.length).toBe(2); // Third stream outside tolerance
    expect(results[0].confidence).toBe(1.0); // Perfect alignment
    expect(results[1].confidence).toBeGreaterThanOrEqual(0.8); // Close alignment
  });
  
  it('should handle event-driven alignment', () => {
    const aligner = createTemporalAligner(SynchronizationStrategy.EVENT_DRIVEN);
    
    const eventTime = Date.now();
    aligner.registerEvent('experiment_start', eventTime);
    
    const streamData = {
      streamId: 'stream1',
      timestamp: eventTime + 20 // 20ms after event
    };
    
    const result = aligner.align(streamData, 'experiment_start');
    
    expect(result.event).not.toBeNull();
    expect(result.event.type).toBe('experiment_start');
    expect(result.confidence).toBeGreaterThanOrEqual(0.8);
    expect(result.offset).toBe(20);
  });
});

describe('Synchronization Engine', () => {
  let syncEngine;
  let stream1, stream2;
  
  beforeEach(async () => {
    syncEngine = createSynchronizationEngine({
      strategy: SynchronizationStrategy.BUFFER_BASED,
      tolerance: 50
    });
    
    stream1 = createDataStream({ id: 'video-stream', type: 'video' });
    stream2 = createDataStream({ id: 'audio-stream', type: 'audio' });
    
    await stream1.start();
    await stream2.start();
  });
  
  afterEach(() => {
    if (stream1) stream1.stop();
    if (stream2) stream2.stop();
    if (syncEngine) syncEngine.stop();
  });
  
  it('should add and remove streams', () => {
    syncEngine.addStream('video-stream', stream1);
    syncEngine.addStream('audio-stream', stream2);
    
    expect(syncEngine.getStreamCount()).toBe(2);
    
    syncEngine.removeStream('video-stream');
    expect(syncEngine.getStreamCount()).toBe(1);
  });
  
  it('should process stream data and trigger synchronization', async () => {
    syncEngine.addStream('video-stream', stream1);
    syncEngine.addStream('audio-stream', stream2);
    syncEngine.start();
    
    let syncResults = null;
    syncEngine.onSync((results, metrics) => {
      syncResults = results;
    });
    
    const baseTime = Date.now();
    
    // Process data from both streams
    await syncEngine.processStreamData('video-stream', {
      timestamp: baseTime,
      data: { frame: 1 }
    });
    
    await syncEngine.processStreamData('audio-stream', {
      timestamp: baseTime + 10, // 10ms offset
      data: { sample: 1000 }
    });
    
    // Should have synchronized both streams
    expect(syncResults).not.toBeNull();
    expect(syncResults.size).toBe(2);
    expect(syncResults.has('video-stream')).toBe(true);
    expect(syncResults.has('audio-stream')).toBe(true);
  });
  
  it('should provide sync quality metrics', async () => {
    syncEngine.addStream('video-stream', stream1);
    syncEngine.addStream('audio-stream', stream2);
    syncEngine.start();
    
    const baseTime = Date.now();
    
    await syncEngine.processStreamData('video-stream', {
      timestamp: baseTime,
      data: { frame: 1 }
    });
    
    const metrics = syncEngine.getMetrics();
    
    expect(typeof metrics.quality).toBe('number');
    expect(typeof metrics.latency).toBe('number');
    expect(typeof metrics.jitter).toBe('number');
  });
  
  it('should handle synchronization errors gracefully', async () => {
    syncEngine.addStream('error-stream', stream1);
    
    let errorCaught = null;
    syncEngine.onError((error) => {
      errorCaught = error;
    });
    
    // Try to process data for unregistered stream
    try {
      await syncEngine.processStreamData('nonexistent-stream', { data: 'test' });
    } catch (error) {
      expect(error.message).toContain('not registered');
    }
  });
});

describe('Multi-Stream Coordinator', () => {
  let coordinator;
  let videoStream, audioStream, motionStream;
  
  beforeEach(async () => {
    coordinator = createMultiStreamCoordinator({
      syncConfig: {
        strategy: SynchronizationStrategy.BUFFER_BASED,
        tolerance: 30
      },
      processingInterval: 100 // 100ms for testing
    });
    
    videoStream = createDataStream({ 
      id: 'video', 
      type: 'video',
      sampleRate: 30 
    });
    
    audioStream = createDataStream({ 
      id: 'audio', 
      type: 'audio',
      sampleRate: 16000 
    });
    
    motionStream = createDataStream({ 
      id: 'motion', 
      type: 'sensor',
      sampleRate: 100 
    });
  });
  
  afterEach(async () => {
    if (coordinator) {
      coordinator.stop();
    }
  });
  
  it('should coordinate multiple streams', async () => {
    await coordinator.addStream(videoStream);
    await coordinator.addStream(audioStream);
    await coordinator.addStream(motionStream);
    
    expect(coordinator.getStreams().size).toBe(3);
    
    const syncEngine = coordinator.getSyncEngine();
    expect(syncEngine.getStreamCount()).toBe(3);
  });
  
  it('should start and stop all streams together', async () => {
    await coordinator.addStream(videoStream);
    await coordinator.addStream(audioStream);
    
    expect(coordinator.isActive()).toBe(false);
    expect(videoStream.isActive()).toBe(false);
    expect(audioStream.isActive()).toBe(false);
    
    await coordinator.start();
    
    expect(coordinator.isActive()).toBe(true);
    expect(videoStream.isActive()).toBe(true);
    expect(audioStream.isActive()).toBe(true);
    
    coordinator.stop();
    
    expect(coordinator.isActive()).toBe(false);
    expect(videoStream.isActive()).toBe(false);
    expect(audioStream.isActive()).toBe(false);
  });
  
  it('should remove streams properly', async () => {
    await coordinator.addStream(videoStream);
    await coordinator.addStream(audioStream);
    
    expect(coordinator.getStreams().size).toBe(2);
    
    coordinator.removeStream('video');
    
    expect(coordinator.getStreams().size).toBe(1);
    expect(coordinator.getSyncEngine().getStreamCount()).toBe(1);
  });
  
  it('should handle real-time synchronization', async () => {
    await coordinator.addStream(videoStream);
    await coordinator.addStream(audioStream);
    
    let syncCount = 0;
    coordinator.getSyncEngine().onSync((results) => {
      syncCount++;
    });
    
    await coordinator.start();
    
    // Generate some data
    const baseTime = Date.now();
    await videoStream.process({ 
      timestamp: baseTime,
      frame: 1 
    });
    
    await audioStream.process({ 
      timestamp: baseTime + 5,
      sample: 1000 
    });
    
    // Wait for processing interval
    await new Promise(resolve => setTimeout(resolve, 150));
    
    expect(syncCount).toBeGreaterThan(0);
  });
});

describe('Real-world Synchronization Scenarios', () => {
  let coordinator;
  
  beforeEach(() => {
    coordinator = createMultiStreamCoordinator({
      syncConfig: {
        strategy: SynchronizationStrategy.BUFFER_BASED,
        tolerance: 20 // Tight tolerance for research
      }
    });
  });
  
  afterEach(() => {
    if (coordinator) coordinator.stop();
  });
  
  it('should handle eye tracking + face analysis synchronization', async () => {
    const eyeStream = createDataStream({
      id: 'eye-tracker',
      type: 'sensor',
      sampleRate: 120 // 120 Hz eye tracker
    });
    
    const faceStream = createDataStream({
      id: 'face-analysis',
      type: 'video',
      sampleRate: 30 // 30 FPS camera
    });
    
    await coordinator.addStream(eyeStream);
    await coordinator.addStream(faceStream);
    await coordinator.start();
    
    let syncResults = [];
    coordinator.getSyncEngine().onSync((results, metrics) => {
      syncResults.push({ results, metrics, timestamp: Date.now() });
    });
    
    const baseTime = Date.now();
    
    // Simulate eye tracking data at 120 Hz
    for (let i = 0; i < 4; i++) {
      await eyeStream.process({
        timestamp: baseTime + i * 8.33, // ~120 Hz
        gazeX: 0.5 + Math.random() * 0.1,
        gazeY: 0.5 + Math.random() * 0.1,
        pupilDiameter: 3.0 + Math.random() * 0.5
      });
    }
    
    // Simulate face analysis at 30 Hz
    await faceStream.process({
      timestamp: baseTime,
      faces: [{
        bbox: [100, 100, 200, 200],
        confidence: 0.95,
        landmarks: []
      }]
    });
    
    // Wait for synchronization
    await new Promise(resolve => setTimeout(resolve, 50));
    
    expect(syncResults.length).toBeGreaterThan(0);
    
    const lastSync = syncResults[syncResults.length - 1];
    expect(lastSync.results.size).toBe(2);
    expect(lastSync.metrics.quality).toBeGreaterThan(0.5);
  });
  
  it('should handle audio + motion capture synchronization', async () => {
    const audioStream = createDataStream({
      id: 'microphone',
      type: 'audio',
      sampleRate: 16000
    });
    
    const motionStream = createDataStream({
      id: 'motion-capture', 
      type: 'sensor',
      sampleRate: 240 // High-frequency motion capture
    });
    
    await coordinator.addStream(audioStream);
    await coordinator.addStream(motionStream);
    await coordinator.start();
    
    const baseTime = Date.now();
    
    // Simulate audio data
    await audioStream.process({
      timestamp: baseTime,
      audioData: new Float32Array(512),
      volume: 0.7,
      transcription: { text: 'hello', confidence: 0.9 }
    });
    
    // Simulate motion capture data
    await motionStream.process({
      timestamp: baseTime + 2, // Very close timing
      pose: {
        rotation: { yaw: 0.1, pitch: 0.2, roll: 0.05 },
        translation: { x: 10, y: 20, z: 100 }
      },
      confidence: 0.85
    });
    
    const metrics = coordinator.getSyncEngine().getMetrics();
    expect(metrics.quality).toBeGreaterThan(0.8); // High quality sync
  });
  
  it('should maintain quality with network jitter simulation', async () => {
    const networkStream = createDataStream({
      id: 'network-sensor',
      type: 'sensor'
    });
    
    await coordinator.addStream(networkStream);
    await coordinator.start();
    
    let qualityHistory = [];
    coordinator.getSyncEngine().onSync((results, metrics) => {
      qualityHistory.push(metrics.quality);
    });
    
    const baseTime = Date.now();
    
    // Simulate network jitter
    const jitterPattern = [0, 5, -3, 15, -8, 2, 12, -5]; // ms offsets
    
    for (let i = 0; i < jitterPattern.length; i++) {
      await networkStream.process({
        timestamp: baseTime + i * 100 + jitterPattern[i], // Add jitter
        sensorValue: Math.random(),
        sequenceNumber: i
      });
      
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    
    // Quality should adapt to jitter but remain reasonable
    if (qualityHistory.length > 0) {
      const avgQuality = qualityHistory.reduce((a, b) => a + b, 0) / qualityHistory.length;
      expect(avgQuality).toBeGreaterThan(0.2); // Should handle moderate jitter with reasonable quality
    }
  });
});