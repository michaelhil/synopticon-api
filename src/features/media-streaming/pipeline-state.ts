/**
 * Media streaming pipeline state management
 */

import { createStreamBuffer } from '../../core/state/streams.js';
import type { StreamBuffer } from '../../core/state/streams.js';
import type { DeviceInfo, FrameCallback, ErrorCallback, QualityChangeCallback } from './pipeline-config.js';

export interface PipelineConfig {
  defaultQuality?: string;
  bufferSize?: number;
  windowMs?: number;
}

export interface PipelineStats {
  framesProcessed: number;
  bytesStreamed: number;
  droppedFrames: number;
  averageFrameSize: number;
  currentFPS: number;
  lastFrameTime: number;
}

export interface PipelineCallbacks {
  onFrame: FrameCallback[];
  onError: ErrorCallback[];
  onQualityChange: QualityChangeCallback[];
}

export interface PipelineState {
  deviceInfo: DeviceInfo;
  mediaStream: MediaStream | null;
  isStreaming: boolean;
  encoder: any | null;
  quality: string;
  frameBuffer: StreamBuffer;
  qualityController: any | null;
  stats: PipelineStats;
  callbacks: PipelineCallbacks;
}

export interface FrameData {
  byteLength?: number;
  [key: string]: unknown;
}

export const createPipelineState = (deviceInfo: DeviceInfo, config: PipelineConfig = {}): PipelineState => {
  return {
    deviceInfo,
    mediaStream: null,
    isStreaming: false,
    encoder: null,
    quality: config.defaultQuality || 'medium',
    frameBuffer: createStreamBuffer({
      maxSize: config.bufferSize || 30, // 1 second at 30fps
      windowMs: config.windowMs || 2000
    }),
    qualityController: null,
    stats: {
      framesProcessed: 0,
      bytesStreamed: 0,
      droppedFrames: 0,
      averageFrameSize: 0,
      currentFPS: 0,
      lastFrameTime: 0
    },
    callbacks: {
      onFrame: [],
      onError: [],
      onQualityChange: []
    }
  };
};

export const resetPipelineStats = (state: PipelineState): void => {
  state.stats.framesProcessed = 0;
  state.stats.bytesStreamed = 0;
  state.stats.droppedFrames = 0;
  state.stats.averageFrameSize = 0;
  state.stats.currentFPS = 0;
  state.stats.lastFrameTime = 0;
};

export const updateFrameStats = (state: PipelineState, frameData: FrameData): void => {
  const now = performance.now();
  const frameSize = frameData.byteLength || 0;
  
  state.stats.framesProcessed++;
  state.stats.bytesStreamed += frameSize;
  
  // Calculate average frame size
  state.stats.averageFrameSize = 
    state.stats.bytesStreamed / state.stats.framesProcessed;
  
  // Calculate FPS
  if (state.stats.lastFrameTime > 0) {
    const deltaTime = now - state.stats.lastFrameTime;
    state.stats.currentFPS = 1000 / deltaTime;
  }
  
  state.stats.lastFrameTime = now;
};