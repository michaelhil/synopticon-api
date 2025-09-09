/**
 * Audio Sensor Integration
 * Audio capture and processing with universal data types
 */

import type { FrameData } from '../../common/types';

export interface AudioConfig {
  deviceId: string;
  sampleRate: number;
  channels: number;
  bitDepth: 16 | 24 | 32;
  bufferSize: number;
}

export interface AudioFrame {
  timestamp: bigint;
  sequenceNumber: number;
  sourceId: string;
  samples: Float32Array;
  sampleRate: number;
  channels: number;
  duration: number;
}

// Audio stream initialization helper
const initializeAudioCapture = async (config: AudioConfig) => {
  const audioContext = new AudioContext({ sampleRate: config.sampleRate });
  const mediaStream = await navigator.mediaDevices.getUserMedia({
    audio: {
      deviceId: config.deviceId,
      sampleRate: config.sampleRate,
      channelCount: config.channels
    }
  });
  return { audioContext, mediaStream };
};

// Audio frame capture helper
const captureAudioData = (
  audioContext: AudioContext,
  mediaStream: MediaStream,
  config: AudioConfig,
  frameCount: number,
  durationMs: number = 100
): AudioFrame => {
  const source = audioContext.createMediaStreamSource(mediaStream);
  const analyzer = audioContext.createAnalyser();
  const bufferLength = Math.floor(config.sampleRate * durationMs / 1000);
  const dataArray = new Float32Array(bufferLength);
  
  source.connect(analyzer);
  analyzer.getFloatTimeDomainData(dataArray);

  return {
    timestamp: BigInt(Date.now() * 1000),
    sequenceNumber: frameCount,
    sourceId: config.deviceId,
    samples: dataArray,
    sampleRate: config.sampleRate,
    channels: config.channels,
    duration: durationMs
  };
};

// Convert audio frame to universal FrameData format
const convertToFrameData = (audioFrame: AudioFrame): FrameData => {
  const audioBuffer = new ArrayBuffer(audioFrame.samples.length * 4);
  const audioView = new Float32Array(audioBuffer);
  audioView.set(audioFrame.samples);

  return {
    timestamp: audioFrame.timestamp,
    sequenceNumber: audioFrame.sequenceNumber,
    sourceId: audioFrame.sourceId,
    sourceType: 'sensor',
    width: audioFrame.samples.length,
    height: 1,
    format: 'rgba',
    data: new Uint8Array(audioBuffer),
    metadata: {
      type: 'audio',
      sampleRate: audioFrame.sampleRate,
      channels: audioFrame.channels,
      duration: audioFrame.duration
    }
  };
};

// Factory function for audio sensor
export const createAudioSensor = (config: AudioConfig) => {
  let isRecording = false;
  let audioContext: AudioContext | null = null;
  let mediaStream: MediaStream | null = null;
  let frameCount = 0;

  const start = async (): Promise<boolean> => {
    try {
      const result = await initializeAudioCapture(config);
      audioContext = result.audioContext;
      mediaStream = result.mediaStream;
      isRecording = true;
      return true;
    } catch (error) {
      console.error('Audio capture start failed:', error);
      return false;
    }
  };

  const stop = async (): Promise<void> => {
    if (mediaStream) {
      mediaStream.getTracks().forEach(track => track.stop());
      mediaStream = null;
    }
    if (audioContext) {
      await audioContext.close();
      audioContext = null;
    }
    isRecording = false;
  };

  const captureAudioFrame = async (durationMs: number = 100): Promise<AudioFrame | null> => {
    if (!audioContext || !mediaStream || !isRecording) return null;
    return captureAudioData(audioContext, mediaStream, config, frameCount++, durationMs);
  };

  return {
    start, stop, captureAudioFrame, convertToFrameData,
    isRecording: () => isRecording,
    getConfig: () => ({ ...config }),
    getStats: () => ({ frameCount, isRecording, deviceId: config.deviceId, sampleRate: config.sampleRate })
  };
};
