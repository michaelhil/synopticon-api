/**
 * Media Streaming Pipeline
 * Handles video and audio streaming with quality control
 * Following functional programming patterns with factory functions
 */

import { createPipeline } from '../../core/pipeline/pipeline.ts';
import { createQualityController } from './quality-controller.js';
import { createPipelineState } from './pipeline-state.js';
import { createStreamOperations } from './stream-operations.js';
import { createPipelineInterface } from './pipeline-interface.js';

/**
 * Create media streaming pipeline for a specific device
 * @param {Object} deviceInfo - Device information from discovery
 * @param {Object} config - Pipeline configuration
 * @returns {Object} Media streaming pipeline
 */
export const createMediaStreamingPipeline = (deviceInfo, config = {}) => {
  const state = createPipelineState(deviceInfo, config);

  // Initialize quality controller if enabled
  if (config.enableQualityControl !== false) {
    state.qualityController = createQualityController({
      deviceId: deviceInfo.id,
      deviceType: deviceInfo.type,
      initialQuality: state.quality,
      adaptationEnabled: config.adaptiveQuality !== false
    });
  }
  
  // Create modular operations and interface
  const operations = createStreamOperations(state);
  const pipeline = createPipelineInterface(state, operations);
  
  // Create pipeline process function for compatibility
  const process = async (input) => {
    if (!input || !input.action) {
      throw new Error('Invalid input: action is required');
    }
    
    switch (input.action) {
      case 'START_STREAM':
        return operations.startStream();
      case 'STOP_STREAM':
        return operations.stopStream();
      case 'CHANGE_QUALITY':
        const quality = input.parameters?.quality || 'medium';
        return operations.changeQuality(quality);
      default:
        throw new Error(`Unknown action: ${input.action}`);
    }
  };
  
  return {
    ...pipeline,
    process,
    initialize: async () => {
      console.log(`📹 Initializing media streaming pipeline for device: ${deviceInfo.label || deviceInfo.id}`);
      return true;
    }
  };
        if (qualityInfo.recommendedQuality !== state.quality) {
          changeQuality(qualityInfo.recommendedQuality).catch(error => {
            console.warn('Automatic quality change failed:', error);
          });
        }
      }
    });
  }

  // Quality profiles synchronized with quality controller
  const QUALITY_PROFILES = {
    ultra: {
      video: { width: 3840, height: 2160, fps: 60, bitrate: '25M' },
      audio: { sampleRate: 48000, channels: 2, bitrate: '320k' }
    },
    high: {
      video: { width: 1920, height: 1080, fps: 30, bitrate: '8M' },
      audio: { sampleRate: 48000, channels: 2, bitrate: '256k' }
    },
    medium: {
      video: { width: 1280, height: 720, fps: 30, bitrate: '4M' },
      audio: { sampleRate: 44100, channels: 2, bitrate: '192k' }
    },
    low: {
      video: { width: 854, height: 480, fps: 24, bitrate: '1M' },
      audio: { sampleRate: 22050, channels: 1, bitrate: '96k' }
    },
    mobile: {
      video: { width: 640, height: 360, fps: 15, bitrate: '500k' },
      audio: { sampleRate: 16000, channels: 1, bitrate: '64k' }
    }
  };

  // Initialize media capture
  const initializeMediaCapture = async (requestedQuality = 'medium') => {
    if (state.mediaStream) {
      // Stop existing stream
      state.mediaStream.getTracks().forEach(track => track.stop());
    }

    const profile = QUALITY_PROFILES[requestedQuality];
    if (!profile) {
      throw new Error(`Invalid quality profile: ${requestedQuality}`);
    }

    try {
      const constraints = {};

      // Configure video constraints
      if (deviceInfo.type === 'videoinput') {
        constraints.video = {
          deviceId: { exact: deviceInfo.id },
          width: { ideal: profile.video.width },
          height: { ideal: profile.video.height },
          frameRate: { ideal: profile.video.fps }
        };
      }

      // Configure audio constraints  
      if (deviceInfo.type === 'audioinput') {
        constraints.audio = {
          deviceId: { exact: deviceInfo.id },
          sampleRate: { ideal: profile.audio.sampleRate },
          channelCount: { ideal: profile.audio.channels },
          noiseSuppression: true,
          echoCancellation: true,
          autoGainControl: true
        };
      }

      console.log(`🎥 Initializing media capture for ${deviceInfo.label} at ${requestedQuality} quality`);
      state.mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      state.quality = requestedQuality;

      // Set up frame capture for video streams
      if (constraints.video) {
        await setupVideoFrameCapture();
      }

      // Set up audio capture for audio streams
      if (constraints.audio) {
        await setupAudioCapture();
      }

      console.log(`✅ Media capture initialized successfully`);
      return true;

    } catch (error) {
      console.error('Failed to initialize media capture:', error);
      throw new Error(`Media capture failed: ${error.message}`);
    }
  };

  // Set up video frame capture using canvas
  const setupVideoFrameCapture = async () => {
    if (typeof document === 'undefined') {
      console.warn('Video frame capture not available in server environment');
      return;
    }

    const video = document.createElement('video');
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    video.srcObject = state.mediaStream;
    video.autoplay = true;
    video.muted = true;

    return new Promise((resolve) => {
      video.onloadedmetadata = () => {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        state.videoElement = video;
        state.canvas = canvas;
        state.canvasContext = ctx;
        
        resolve();
      };
    });
  };

  // Set up audio capture using Web Audio API
  const setupAudioCapture = async () => {
    if (typeof window === 'undefined' || !window.AudioContext) {
      console.warn('Audio capture not available in this environment');
      return;
    }

    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const source = audioContext.createMediaStreamSource(state.mediaStream);
    const analyser = audioContext.createAnalyser();
    
    analyser.fftSize = 2048;
    source.connect(analyser);

    state.audioContext = audioContext;
    state.audioAnalyser = analyser;
    state.audioBuffer = new Float32Array(analyser.frequencyBinCount);
  };

  // Capture current video frame
  const captureVideoFrame = () => {
    if (!state.canvasContext || !state.videoElement) {
      throw new Error('Video capture not initialized');
    }

    const { canvas, canvasContext: ctx, videoElement: video } = state;
    
    // Draw current video frame to canvas
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // Get image data
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const frameData = {
      data: imageData.data,
      width: canvas.width,
      height: canvas.height,
      format: 'rgba',
      timestamp: Date.now(),
      frameNumber: state.stats.framesProcessed + 1
    };

    // Update statistics
    updateFrameStats(frameData);
    
    return frameData;
  };

  // Capture current audio data
  const captureAudioData = () => {
    if (!state.audioAnalyser) {
      throw new Error('Audio capture not initialized');
    }

    state.audioAnalyser.getFloatFrequencyData(state.audioBuffer);
    
    return {
      frequencyData: new Float32Array(state.audioBuffer),
      sampleRate: state.audioContext.sampleRate,
      timestamp: Date.now(),
      format: 'float32'
    };
  };

  // Update streaming statistics
  const updateFrameStats = (frameData) => {
    const now = Date.now();
    const frameSize = frameData.data ? frameData.data.byteLength : 0;
    
    state.stats.framesProcessed++;
    state.stats.bytesStreamed += frameSize;
    
    // Calculate average frame size
    state.stats.averageFrameSize = 
      (state.stats.averageFrameSize * (state.stats.framesProcessed - 1) + frameSize) / 
      state.stats.framesProcessed;

    // Calculate FPS
    if (state.stats.lastFrameTime > 0) {
      const deltaTime = now - state.stats.lastFrameTime;
      const currentFPS = 1000 / deltaTime;
      state.stats.currentFPS = 
        (state.stats.currentFPS * 0.9) + (currentFPS * 0.1); // Smooth FPS
    }
    state.stats.lastFrameTime = now;

    // Add to buffer
    state.frameBuffer.add(frameData);

    // Update quality controller with stream metrics
    if (state.qualityController) {
      state.qualityController.updateStreamMetrics({
        frameSize,
        fps: state.stats.currentFPS,
        bytesStreamed: state.stats.bytesStreamed,
        framesProcessed: state.stats.framesProcessed,
        averageFrameSize: state.stats.averageFrameSize,
        timestamp: now
      });
    }
  };

  // Change streaming quality
  const changeQuality = async (newQuality) => {
    if (!QUALITY_PROFILES[newQuality]) {
      throw new Error(`Invalid quality: ${newQuality}`);
    }

    if (newQuality === state.quality) {
      return { success: true, message: 'Quality unchanged' };
    }

    console.log(`📊 Changing quality from ${state.quality} to ${newQuality}`);
    
    try {
      const wasStreaming = state.isStreaming;
      
      if (wasStreaming) {
        await stopStreaming();
      }
      
      await initializeMediaCapture(newQuality);
      
      if (wasStreaming) {
        await startStreaming();
      }

      // Notify callbacks
      state.callbacks.onQualityChange.forEach(callback => {
        try {
          callback({ oldQuality: state.quality, newQuality });
        } catch (error) {
          console.warn('Quality change callback error:', error);
        }
      });

      return { 
        success: true, 
        oldQuality: state.quality, 
        newQuality,
        profile: QUALITY_PROFILES[newQuality]
      };
    } catch (error) {
      console.error('Quality change failed:', error);
      throw error;
    }
  };

  // Start streaming
  const startStreaming = async () => {
    if (state.isStreaming) {
      return { success: true, message: 'Already streaming' };
    }

    if (!state.mediaStream) {
      await initializeMediaCapture();
    }

    state.isStreaming = true;
    console.log(`🎬 Started streaming ${deviceInfo.label} at ${state.quality} quality`);
    
    return { 
      success: true, 
      deviceId: deviceInfo.id,
      quality: state.quality,
      profile: QUALITY_PROFILES[state.quality]
    };
  };

  // Stop streaming
  const stopStreaming = async () => {
    if (!state.isStreaming) {
      return { success: true, message: 'Not streaming' };
    }

    state.isStreaming = false;
    
    if (state.mediaStream) {
      state.mediaStream.getTracks().forEach(track => track.stop());
      state.mediaStream = null;
    }

    // Clean up audio context
    if (state.audioContext && state.audioContext.state !== 'closed') {
      await state.audioContext.close();
      state.audioContext = null;
    }

    console.log(`🛑 Stopped streaming ${deviceInfo.label}`);
    return { success: true, deviceId: deviceInfo.id };
  };

  // Get current streaming status
  const getStreamingStatus = () => ({
    isStreaming: state.isStreaming,
    deviceId: deviceInfo.id,
    deviceLabel: deviceInfo.label,
    deviceType: deviceInfo.type,
    quality: state.quality,
    profile: QUALITY_PROFILES[state.quality],
    stats: { ...state.stats },
    bufferSize: state.frameBuffer.getSize(),
    capabilities: deviceInfo.capabilities
  });

  // Main pipeline processing function
  const processStreamCommand = async (command) => {
    try {
      const { action, parameters = {} } = command;
      let result;

      switch (action) {
        case 'START_STREAM':
          result = await startStreaming();
          break;

        case 'STOP_STREAM':
          result = await stopStreaming();
          break;

        case 'CHANGE_QUALITY':
          result = await changeQuality(parameters.quality);
          break;

        case 'GET_FRAME':
          if (deviceInfo.type === 'videoinput') {
            result = captureVideoFrame();
          } else {
            throw new Error('Cannot capture frame from non-video device');
          }
          break;

        case 'GET_AUDIO_DATA':
          if (deviceInfo.type === 'audioinput') {
            result = captureAudioData();
          } else {
            throw new Error('Cannot capture audio from non-audio device');
          }
          break;

        case 'GET_STATUS':
          result = getStreamingStatus();
          break;

        case 'UPDATE_CONFIG':
          Object.assign(config, parameters);
          result = { success: true, config: { ...config } };
          break;

        default:
          throw new Error(`Unknown command: ${action}`);
      }

      return createAnalysisResult({
        status: 'success',
        data: {
          command: action,
          result,
          deviceId: deviceInfo.id,
          timestamp: Date.now()
        },
        id: `media-stream_${deviceInfo.id}_${Date.now()}`,
        source: `media-stream-${deviceInfo.id}`,
        processingTime: 1,
        timestamp: Date.now()
      });

    } catch (error) {
      console.error(`Stream command ${command.action} failed:`, error);
      
      return createAnalysisResult({
        status: 'failed',
        error: createErrorResult(error.message, `media-stream-${deviceInfo.id}`),
        id: `media-stream_${deviceInfo.id}_${Date.now()}`,
        source: `media-stream-${deviceInfo.id}`,
        processingTime: 1,
        timestamp: Date.now()
      });
    }
  };

  // Event subscription methods
  const onFrame = (callback) => {
    state.callbacks.onFrame.push(callback);
    return () => {
      const index = state.callbacks.onFrame.indexOf(callback);
      if (index !== -1) state.callbacks.onFrame.splice(index, 1);
    };
  };

  const onError = (callback) => {
    state.callbacks.onError.push(callback);
    return () => {
      const index = state.callbacks.onError.indexOf(callback);
      if (index !== -1) state.callbacks.onError.splice(index, 1);
    };
  };

  const onQualityChange = (callback) => {
    state.callbacks.onQualityChange.push(callback);
    return () => {
      const index = state.callbacks.onQualityChange.indexOf(callback);
      if (index !== -1) state.callbacks.onQualityChange.splice(index, 1);
    };
  };

  // Create the pipeline
  const pipeline = createPipeline({
    name: `media-stream-${deviceInfo.id}`,
    version: '1.0.0',
    capabilities: ['video_streaming', 'audio_streaming', 'quality_adaptation'],
    performance: {
      fps: deviceInfo.capabilities?.maxFrameRate || 30,
      latency: '50-100ms',
      cpuUsage: 'medium',
      batteryImpact: 'medium'
    },
    description: `Media streaming pipeline for ${deviceInfo.label}`,
    
    // Pipeline initialization
    initialize: async (initConfig = {}) => {
      Object.assign(config, initConfig);
      if (config.autoStart) {
        await initializeMediaCapture(config.quality || 'medium');
      }
      return true;
    },
    
    // Main processing function
    process: processStreamCommand,
    
    // Cleanup function
    cleanup: async () => {
      await stopStreaming();
      state.frameBuffer.clear();
      state.callbacks.onFrame = [];
      state.callbacks.onError = [];
      state.callbacks.onQualityChange = [];
    }
  });

  // Add custom methods to pipeline
  return {
    ...pipeline,
    
    // Device info
    getDeviceInfo: () => ({ ...deviceInfo }),
    getDeviceId: () => deviceInfo.id,
    getDeviceType: () => deviceInfo.type,
    
    // Stream control
    startStreaming,
    stopStreaming,
    changeQuality,
    
    // Data capture
    captureFrame: captureVideoFrame,
    captureAudioData,
    
    // Status and stats
    getStatus: getStreamingStatus,
    getStats: () => ({ ...state.stats }),
    getBuffer: () => state.frameBuffer,
    
    // Quality profiles and control
    getQualityProfiles: () => ({ ...QUALITY_PROFILES }),
    getCurrentQuality: () => state.quality,
    getQualityController: () => state.qualityController,
    
    // Quality controller methods
    updateNetworkStats: (networkStats) => {
      if (state.qualityController) {
        state.qualityController.updateNetworkStats(networkStats);
      }
    },
    getQualityMetrics: () => {
      return state.qualityController ? 
        state.qualityController.getQualityInfo() : null;
    },
    setAdaptationEnabled: (enabled) => {
      if (state.qualityController) {
        state.qualityController.setAdaptiveMode(enabled);
      }
    },
    
    // Event handlers
    onFrame,
    onError,
    onQualityChange,
    
    // Stream state
    isStreaming: () => state.isStreaming,
    getMediaStream: () => state.mediaStream
  };
};

/**
 * Convenience function to create streaming pipeline for multiple devices
 * @param {Array} devices - Array of device info objects
 * @param {Object} config - Common configuration
 * @returns {Map} Map of deviceId -> pipeline
 */
export const createMultiDeviceStreaming = (devices, config = {}) => {
  const pipelines = new Map();
  
  devices.forEach(device => {
    const pipeline = createMediaStreamingPipeline(device, config);
    pipelines.set(device.id, pipeline);
  });
  
  return pipelines;
};

