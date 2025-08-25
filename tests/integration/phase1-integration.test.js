/**
 * Phase 1 Integration Tests
 * Ensures backward compatibility and tests new stream functionality
 * Using Bun test runner
 */

import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { createDataStream, createStreamBuffer, streamFactory } from '../../src/core/streams.js';
import { 
  createAudioResult, 
  createMotionResult, 
  createMultimodalResult,
  StreamCapability 
} from '../../src/core/types.ts';
import { createWebSocketTransport, transportFactory } from '../../src/core/transport.js';

// Test existing face analysis functionality still works
describe('Backward Compatibility Tests', () => {
  
  it('should preserve existing type factories', async () => {
    // Import existing face analysis types
    const { createPose6DOF, createAnalysisResult, Capability } = await import('../../src/core/types.js');
    
    // Test existing pose creation still works
    const pose = createPose6DOF({
      rotation: { yaw: 0.1, pitch: 0.2, roll: 0.3 },
      translation: { x: 10, y: 20, z: 30 },
      confidence: 0.9
    });
    
    expect(pose.rotation.yaw).toBe(0.1);
    expect(pose.translation.x).toBe(10);
    expect(pose.confidence).toBe(0.9);
    
    // Test existing analysis result creation
    const result = createAnalysisResult({
      faces: [{ pose, confidence: 0.8 }],
      processingTime: 15.5
    });
    
    expect(result.faces).toHaveLength(1);
    expect(result.processingTime).toBe(15.5);
    
    // Test existing capabilities are preserved
    expect(Capability.FACE_DETECTION).toBe('face_detection');
    expect(Capability.POSE_ESTIMATION_6DOF).toBe('pose_6dof');
  });
  
  it('should preserve existing orchestrator functionality', async () => {
    const { createOrchestrator } = await import('../src/core/orchestrator.js');
    
    // Test existing orchestrator creation
    const orchestrator = createOrchestrator({
      defaultRequirements: {
        capabilities: ['face_detection'],
        strategy: 'performance_first'
      }
    });
    
    expect(typeof orchestrator.registerPipeline).toBe('function');
    expect(typeof orchestrator.getHealthStatus).toBe('function');
    expect(orchestrator.getHealthStatus().status).toBe('degraded'); // No pipelines registered yet
  });

  it('should preserve existing pipeline functionality', async () => {
    const { createPipeline } = await import('../src/core/pipeline.js');
    
    // This should work exactly as before
    expect(typeof createPipeline).toBe('function');
  });
});

// Test new stream functionality
describe('Stream Abstraction Layer', () => {
  let stream;
  
  afterEach(() => {
    if (stream && stream.isActive()) {
      stream.stop();
    }
  });
  
  it('should create a basic data stream', () => {
    stream = createDataStream({
      type: 'test',
      sampleRate: 30
    });
    
    expect(stream.getType()).toBe('test');
    expect(stream.getSampleRate()).toBe(30);
    expect(stream.isActive()).toBe(false);
  });
  
  it('should start and stop streams', async () => {
    stream = createDataStream({ type: 'test' });
    
    const started = await stream.start();
    expect(started).toBe(true);
    expect(stream.isActive()).toBe(true);
    
    stream.stop();
    expect(stream.isActive()).toBe(false);
  });
  
  it('should process data through stream', async () => {
    stream = createDataStream({ type: 'test' });
    await stream.start();
    
    const testData = { value: 42, timestamp: Date.now() };
    const result = await stream.process(testData);
    
    expect(result.value).toBe(42);
    expect(result.streamId).toBe(stream.getId());
    expect(result.streamType).toBe('test');
    expect(typeof result.processingTime).toBe('number');
  });
  
  it('should handle data callbacks', async () => {
    stream = createDataStream({ type: 'test' });
    await stream.start();
    
    let callbackData = null;
    const unsubscribe = stream.onData((data) => {
      callbackData = data;
    });
    
    const testData = { value: 123 };
    await stream.process(testData);
    
    expect(callbackData).not.toBeNull();
    expect(callbackData.value).toBe(123);
    
    unsubscribe();
  });
  
  it('should handle error callbacks', async () => {
    stream = createDataStream({ 
      type: 'test',
      usePipeline: false,
      processors: [{
        process: () => { throw new Error('Test error'); }
      }]
    });
    await stream.start();
    
    let errorData = null;
    let errorThrown = false;
    
    stream.onError((error) => {
      errorData = error;
    });
    
    try {
      await stream.process({ test: true });
    } catch (error) {
      errorThrown = true;
      expect(error.message).toBe('Test error');
    }
    
    expect(errorThrown).toBe(true);
    expect(errorData).not.toBeNull();
    expect(errorData.message).toBe('Test error');
  });
});

describe('Stream Buffer', () => {
  let buffer;
  
  beforeEach(() => {
    buffer = createStreamBuffer({ maxSize: 5, windowMs: 1000 });
  });
  
  it('should add items to buffer', () => {
    const item = { data: 'test', timestamp: Date.now() };
    const added = buffer.add(item);
    
    expect(added.data).toBe('test');
    expect(typeof added.bufferTimestamp).toBe('number');
    expect(buffer.getSize()).toBe(1);
  });
  
  it('should respect max size limit', () => {
    for (let i = 0; i < 10; i++) {
      buffer.add({ data: i, timestamp: Date.now() });
    }
    
    expect(buffer.getSize()).toBe(5); // maxSize is 5
    
    const latest = buffer.getLatest(1);
    expect(latest[0].data).toBe(9); // Should have the latest item
  });
  
  it('should find closest item by timestamp', () => {
    const now = Date.now();
    
    buffer.add({ data: 'a', timestamp: now - 100 });
    buffer.add({ data: 'b', timestamp: now - 50 });
    buffer.add({ data: 'c', timestamp: now });
    
    const closest = buffer.getClosest(now - 45, 20);
    expect(closest.data).toBe('b');
  });
});

// Test new data types
describe('Multimodal Data Types', () => {
  
  it('should create audio results', () => {
    const audioResult = createAudioResult({
      audioData: new Float32Array([0.1, 0.2, 0.3]),
      sampleRate: 16000,
      transcription: {
        text: 'hello world',
        confidence: 0.95
      },
      volume: 0.7
    });
    
    expect(audioResult.sampleRate).toBe(16000);
    expect(audioResult.transcription.text).toBe('hello world');
    expect(audioResult.volume).toBe(0.7);
    expect(audioResult.source).toBe('audio_stream');
  });
  
  it('should create motion results', () => {
    const motionResult = createMotionResult({
      pose: {
        rotation: { yaw: 0.1, pitch: 0.2, roll: 0.3 },
        translation: { x: 1, y: 2, z: 3 }
      },
      velocity: {
        linear: { x: 0.5, y: 0, z: 0 },
        angular: { x: 0, y: 0.1, z: 0 }
      },
      confidence: 0.8
    });
    
    expect(motionResult.pose.rotation.yaw).toBe(0.1);
    expect(motionResult.velocity.linear.x).toBe(0.5);
    expect(motionResult.confidence).toBe(0.8);
  });
  
  it('should create multimodal results', () => {
    const multiResult = createMultimodalResult({
      streams: {
        audio: createAudioResult({ volume: 0.5 }),
        motion: createMotionResult({ confidence: 0.7 })
      },
      synchronization: {
        quality: 0.95,
        latency: 15
      }
    });
    
    expect(multiResult.streams.audio.volume).toBe(0.5);
    expect(multiResult.streams.motion.confidence).toBe(0.7);
    expect(multiResult.synchronization.quality).toBe(0.95);
    expect(multiResult.streamCount).toBe(2);
  });
  
  it('should extend capabilities', () => {
    expect(StreamCapability.FACE_DETECTION).toBe('face_detection');
    expect(StreamCapability.SPEECH_RECOGNITION).toBe('speech_recognition');
    expect(StreamCapability.MOTION_CAPTURE).toBe('motion_capture');
    expect(StreamCapability.PHYSIOLOGICAL).toBe('physiological');
  });
});

// Test transport layer
describe('Transport Layer', () => {
  let transport;
  
  afterEach(() => {
    if (transport && transport.stop) {
      transport.stop();
    }
  });
  
  it('should create WebSocket transport', () => {
    transport = createWebSocketTransport({
      isServer: true,
      port: 8081
    });
    
    expect(typeof transport.startServer).toBe('function');
    expect(typeof transport.send).toBe('function');
    expect(transport.getConnectionCount()).toBe(0);
  });
  
  it('should handle transport events', () => {
    transport = createWebSocketTransport({ isServer: true });
    
    let connectCalled = false;
    const unsubscribe = transport.onConnect(() => {
      connectCalled = true;
    });
    
    expect(typeof unsubscribe).toBe('function');
    unsubscribe();
  });
  
  it('should create HTTP transport', () => {
    transport = transportFactory.create('http', {
      baseUrl: 'http://localhost:8080'
    });
    
    expect(typeof transport.get).toBe('function');
    expect(typeof transport.post).toBe('function');
    expect(transport.getBaseUrl()).toBe('http://localhost:8080');
  });
  
  it('should list available protocols', () => {
    const protocols = transportFactory.getAvailableProtocols();
    
    expect(protocols).toContain('websocket');
    expect(protocols).toContain('http');
    expect(protocols).toContain('udp');
  });
});

// Test stream factory
describe('Stream Factory', () => {
  
  it('should create different stream types', () => {
    const videoStream = streamFactory.create('video', { id: 'test-video' });
    const audioStream = streamFactory.create('audio', { id: 'test-audio' });
    
    expect(videoStream.getType()).toBe('video');
    expect(videoStream.getSampleRate()).toBe(30);
    
    expect(audioStream.getType()).toBe('audio');
    expect(audioStream.getSampleRate()).toBe(16000);
  });
  
  it('should list available stream types', () => {
    const types = streamFactory.getAvailableTypes();
    
    expect(types).toContain('generic');
    expect(types).toContain('video');
    expect(types).toContain('audio');
    expect(types).toContain('sensor');
  });
  
  it('should allow custom stream type registration', () => {
    streamFactory.register('custom', (config) => createDataStream({
      ...config,
      sampleRate: 1000,
      specialProperty: true
    }));
    
    const customStream = streamFactory.create('custom');
    expect(customStream.getSampleRate()).toBe(1000);
  });
});

// Integration test: Stream with transport
describe('Stream-Transport Integration', () => {
  let stream;
  let serverTransport;
  let clientTransport;
  
  afterEach(() => {
    if (stream) stream.stop();
    if (serverTransport) serverTransport.stop();
    if (clientTransport) clientTransport.stop();
  });
  
  it('should integrate stream with WebSocket transport', async () => {
    // Create server transport with dynamic port
    const testPort = 8090 + Math.floor(Math.random() * 100);
    serverTransport = createWebSocketTransport({
      isServer: true,
      port: testPort
    });
    
    // Create stream
    stream = createDataStream({ type: 'test' });
    await stream.start();
    
    // When stream produces data, send via transport
    stream.onData((data) => {
      serverTransport.send({
        type: 'streamData',
        streamId: stream.getId(),
        data
      });
    });
    
    // Start server
    serverTransport.startServer();
    
    expect(serverTransport.getConnectionCount()).toBe(0);
  }, 10000);
});