/**
 * Unit tests for sensor infrastructure
 * Testing the new sensor abstraction layer
 */

import { expect, test, describe, beforeEach } from 'bun:test';
import { 
  createSensorFactory,
  createCameraSensor,
  createFaceDetectionSensor,
  createEyeTrackingSensor,
  createMediaStreamingSensor,
  createAudioSensor
} from '../../../src/core/sensors';

describe('Sensor Factory', () => {
  let factory: ReturnType<typeof createSensorFactory>;

  beforeEach(() => {
    factory = createSensorFactory();
  });

  test('creates factory with correct methods', () => {
    expect(factory).toBeDefined();
    expect(typeof factory.register).toBe('function');
    expect(typeof factory.get).toBe('function');
    expect(typeof factory.list).toBe('function');
    expect(typeof factory.remove).toBe('function');
    expect(factory.size()).toBe(0);
  });

  test('registers and retrieves sensors', () => {
    const mockSensor = { id: 'test-sensor' };
    factory.register('test-sensor', mockSensor);

    expect(factory.size()).toBe(1);
    expect(factory.get('test-sensor')).toBe(mockSensor);
    expect(factory.list()).toEqual(['test-sensor']);
  });

  test('removes sensors correctly', () => {
    factory.register('sensor1', { id: 'sensor1' });
    factory.register('sensor2', { id: 'sensor2' });
    
    expect(factory.size()).toBe(2);
    expect(factory.remove('sensor1')).toBe(true);
    expect(factory.size()).toBe(1);
    expect(factory.list()).toEqual(['sensor2']);
  });
});

describe('Camera Sensor', () => {
  test('creates camera sensor with configuration', () => {
    const config = {
      deviceId: 'test-camera',
      resolution: { width: 1280, height: 720 },
      fps: 30,
      format: 'rgba' as const
    };

    const sensor = createCameraSensor(config);
    
    expect(sensor).toBeDefined();
    expect(typeof sensor.start).toBe('function');
    expect(typeof sensor.stop).toBe('function');
    expect(typeof sensor.captureFrame).toBe('function');
    expect(sensor.isActive()).toBe(false);
    expect(sensor.getConfig()).toEqual(config);
  });

  test('tracks stats correctly', () => {
    const sensor = createCameraSensor({ deviceId: 'test' });
    const stats = sensor.getStats();
    
    expect(stats.frameCount).toBe(0);
    expect(stats.isActive).toBe(false);
    expect(stats.deviceId).toBe('test');
  });
});

describe('Face Detection Sensor', () => {
  test('creates face detection sensor with configuration', () => {
    const config = {
      pipeline: 'mediapipe' as const,
      maxFaces: 2,
      minConfidence: 0.7,
      enableLandmarks: true,
      enable6DOF: true
    };

    const sensor = createFaceDetectionSensor(config);
    
    expect(sensor).toBeDefined();
    expect(typeof sensor.initialize).toBe('function');
    expect(typeof sensor.processFrame).toBe('function');
    expect(typeof sensor.cleanup).toBe('function');
    expect(sensor.isInitialized()).toBe(false);
    expect(sensor.getConfig()).toEqual(config);
  });

  test('initializes correctly', async () => {
    const sensor = createFaceDetectionSensor({ pipeline: 'mediapipe' });
    
    const result = await sensor.initialize();
    expect(result).toBe(true);
    expect(sensor.isInitialized()).toBe(true);
  });
});

describe('Eye Tracking Sensor', () => {
  test('creates eye tracking sensor with configuration', () => {
    const config = {
      device: 'webcam' as const,
      calibrationRequired: true,
      trackingMode: 'gaze' as const,
      smoothing: 0.3
    };

    const sensor = createEyeTrackingSensor(config);
    
    expect(sensor).toBeDefined();
    expect(typeof sensor.startCalibration).toBe('function');
    expect(typeof sensor.startTracking).toBe('function');
    expect(typeof sensor.stopTracking).toBe('function');
    expect(sensor.isCalibrated()).toBe(false);
    expect(sensor.isTracking()).toBe(false);
  });

  test('calibration flow works correctly', async () => {
    const sensor = createEyeTrackingSensor({
      device: 'webcam',
      calibrationRequired: true,
      trackingMode: 'gaze'
    });

    await sensor.startCalibration();
    expect(sensor.isCalibrated()).toBe(true);

    await sensor.startTracking();
    expect(sensor.isTracking()).toBe(true);

    await sensor.stopTracking();
    expect(sensor.isTracking()).toBe(false);
  });
});

describe('Media Streaming Sensor', () => {
  test('creates media streaming sensor with configuration', () => {
    const config = {
      deviceId: 'stream-device',
      quality: 'high' as const,
      enableAudio: true,
      enableVideo: true,
      maxBitrate: 5000000
    };

    const sensor = createMediaStreamingSensor(config);
    
    expect(sensor).toBeDefined();
    expect(typeof sensor.startStream).toBe('function');
    expect(typeof sensor.stopStream).toBe('function');
    expect(typeof sensor.addClient).toBe('function');
    expect(sensor.isStreaming()).toBe(false);
  });

  test('manages client connections', () => {
    const sensor = createMediaStreamingSensor({
      deviceId: 'test',
      quality: 'medium',
      enableAudio: true,
      enableVideo: true
    });

    const added = sensor.addClient('client1', ['frame']);
    expect(added).toBe(true);

    const removed = sensor.removeClient('client1');
    expect(removed).toBe(true);
  });
});

describe('Audio Sensor', () => {
  test('creates audio sensor with configuration', () => {
    const config = {
      deviceId: 'audio-device',
      sampleRate: 44100,
      channels: 2,
      bitDepth: 24 as const,
      bufferSize: 1024
    };

    const sensor = createAudioSensor(config);
    
    expect(sensor).toBeDefined();
    expect(typeof sensor.start).toBe('function');
    expect(typeof sensor.stop).toBe('function');
    expect(typeof sensor.captureAudioFrame).toBe('function');
    expect(typeof sensor.convertToFrameData).toBe('function');
    expect(sensor.isRecording()).toBe(false);
  });

  test('tracks audio stats correctly', () => {
    const sensor = createAudioSensor({
      deviceId: 'test-audio',
      sampleRate: 48000,
      channels: 1,
      bitDepth: 16,
      bufferSize: 512
    });

    const stats = sensor.getStats();
    expect(stats.frameCount).toBe(0);
    expect(stats.isRecording).toBe(false);
    expect(stats.deviceId).toBe('test-audio');
    expect(stats.sampleRate).toBe(48000);
  });
});