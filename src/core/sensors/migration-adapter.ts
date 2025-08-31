/**
 * Sensor Migration Adapter
 * Bridges existing sensor implementations with new sensor infrastructure
 */

import type { FrameData } from '../common/types';
import { createCameraSensor } from './camera';
import { createFaceDetectionSensor } from './face-detection';
import { createEyeTrackingSensor } from './eye-tracking';
import { createMediaStreamingSensor } from './media-streaming';
import { createAudioSensor } from './audio';

// Migration adapter for existing media streaming pipeline
export const createMediaStreamingAdapter = (existingPipeline: any) => {
  const sensor = createMediaStreamingSensor({
    deviceId: existingPipeline.getDeviceId?.() || 'unknown',
    quality: existingPipeline.getCurrentQuality?.() || 'medium',
    enableAudio: true,
    enableVideo: true
  });

  const bridgeFrame = async (existingFrame: any): Promise<FrameData> => {
    // Convert existing frame format to FrameData
    return {
      timestamp: BigInt(Date.now() * 1000),
      sequenceNumber: existingFrame.sequenceNumber || 0,
      sourceId: existingFrame.deviceId || 'unknown',
      sourceType: 'sensor',
      width: existingFrame.width || 640,
      height: existingFrame.height || 480,
      format: existingFrame.format || 'rgba',
      data: existingFrame.data || new Uint8Array(0)
    };
  };

  const startWithBridge = async () => {
    await existingPipeline.startStreaming?.();
    return sensor.startStream();
  };

  return {
    ...sensor,
    bridgeFrame,
    startWithBridge,
    getOriginalPipeline: () => existingPipeline
  };
};

// Migration adapter for existing face detection pipeline
export const createFaceDetectionAdapter = (existingPipeline: any) => {
  const sensor = createFaceDetectionSensor({
    pipeline: 'mediapipe', // Default assumption
    maxFaces: existingPipeline.maxNumFaces || 1,
    minConfidence: existingPipeline.minDetectionConfidence || 0.5,
    enableLandmarks: true,
    enable6DOF: true
  });

  const processWithBridge = async (frameData: FrameData) => {
    // Process through existing pipeline first
    const existingResult = await existingPipeline.process?.(frameData);
    
    // Convert result to our format
    const bridgedResult = await sensor.processFrame(frameData);
    
    // Merge results if needed
    return bridgedResult;
  };

  return {
    ...sensor,
    processWithBridge,
    getOriginalPipeline: () => existingPipeline
  };
};

// Factory for creating appropriate adapters based on existing code
export const createSensorAdapter = (type: string, existingImplementation: any) => {
  switch (type) {
    case 'media-streaming':
      return createMediaStreamingAdapter(existingImplementation);
    case 'face-detection':
      return createFaceDetectionAdapter(existingImplementation);
    default:
      throw new Error(`No adapter available for sensor type: ${type}`);
  }
};