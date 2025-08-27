/**
 * Media streaming pipeline state management
 */

import { createStreamBuffer } from '../../core/state/streams.js';

export const createPipelineState = (deviceInfo, config = {}) => {
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

export const resetPipelineStats = (state) => {
  state.stats.framesProcessed = 0;
  state.stats.bytesStreamed = 0;
  state.stats.droppedFrames = 0;
  state.stats.averageFrameSize = 0;
  state.stats.currentFPS = 0;
  state.stats.lastFrameTime = 0;
};

export const updateFrameStats = (state, frameData) => {
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