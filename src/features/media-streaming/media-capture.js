/**
 * Media Capture Module
 * Handles video and audio capture with quality profiles
 */

// Quality profiles synchronized with quality controller
export const QUALITY_PROFILES = {
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
    audio: { sampleRate: 44100, channels: 1, bitrate: '128k' }
  }
};

/**
 * Initialize media capture with specified quality
 */
export const initializeMediaCapture = async (state, requestedQuality = 'medium') => {
  try {
    const profile = QUALITY_PROFILES[requestedQuality];
    if (!profile) {
      throw new Error(`Unknown quality profile: ${requestedQuality}`);
    }

    console.log(`📹 Initializing media capture at ${requestedQuality} quality`);

    // Check if we're in browser environment
    if (typeof navigator === 'undefined' || !navigator.mediaDevices) {
      console.log(`📹 Server-side mode: Creating virtual stream for ${requestedQuality} quality`);
      // Server-side: create virtual stream state
      state.quality = requestedQuality;
      state.mediaStream = null; // Virtual stream
      console.log('✅ Virtual media capture initialized successfully');
      return true;
    }

    const mediaStream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: profile.video.width },
        height: { ideal: profile.video.height },
        frameRate: { ideal: profile.video.fps }
      },
      audio: {
        sampleRate: { ideal: profile.audio.sampleRate },
        channelCount: { ideal: profile.audio.channels }
      }
    });

    state.mediaStream = mediaStream;
    state.quality = requestedQuality;
    
    // Setup capture components
    await setupVideoFrameCapture(state);
    await setupAudioCapture(state);
    
    console.log('✅ Media capture initialized successfully');
    return true;
  } catch (error) {
    console.error('Media capture initialization failed:', error);
    throw error;
  }
};

/**
 * Setup video frame capture
 */
const setupVideoFrameCapture = async (state) => {
  if (!state.mediaStream) return;

  const videoTracks = state.mediaStream.getVideoTracks();
  if (videoTracks.length === 0) return;

  // Create canvas for frame capture
  state.canvas = document.createElement('canvas');
  state.canvasContext = state.canvas.getContext('2d');
  
  // Create video element for frame processing
  state.videoElement = document.createElement('video');
  state.videoElement.srcObject = state.mediaStream;
  state.videoElement.play();

  console.log('📹 Video frame capture setup complete');
};

/**
 * Setup audio capture and analysis
 */
const setupAudioCapture = async (state) => {
  if (!state.mediaStream) return;

  const audioTracks = state.mediaStream.getAudioTracks();
  if (audioTracks.length === 0) return;

  try {
    state.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    state.audioSource = state.audioContext.createMediaStreamSource(state.mediaStream);
    state.audioAnalyser = state.audioContext.createAnalyser();
    
    state.audioAnalyser.fftSize = 2048;
    state.audioBuffer = new Float32Array(state.audioAnalyser.frequencyBinCount);
    
    state.audioSource.connect(state.audioAnalyser);
    
    console.log('🎤 Audio capture setup complete');
  } catch (error) {
    console.warn('Audio capture setup failed:', error);
  }
};

/**
 * Capture current video frame
 */
export const captureVideoFrame = (state) => {
  if (!state.videoElement || !state.canvas || !state.canvasContext) {
    return null;
  }

  try {
    const video = state.videoElement;
    const {canvas} = state;
    const ctx = state.canvasContext;
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    const frameData = {
      imageData: ctx.getImageData(0, 0, canvas.width, canvas.height),
      dataURL: canvas.toDataURL('image/jpeg', 0.8),
      timestamp: Date.now(),
      dimensions: { width: canvas.width, height: canvas.height }
    };

    updateFrameStats(state, frameData);
    return frameData;
  } catch (error) {
    console.error('Frame capture failed:', error);
    return null;
  }
};

/**
 * Capture audio data for analysis
 */
export const captureAudioData = (state) => {
  if (!state.audioAnalyser || !state.audioBuffer) {
    return null;
  }

  state.audioAnalyser.getFloatFrequencyData(state.audioBuffer);
  
  return {
    frequencyData: new Float32Array(state.audioBuffer),
    sampleRate: state.audioContext.sampleRate,
    timestamp: Date.now(),
    format: 'float32'
  };
};

/**
 * Update frame statistics
 */
const updateFrameStats = (state, frameData) => {
  const now = Date.now();
  
  if (state.stats.lastFrameTime) {
    state.stats.frameInterval = now - state.stats.lastFrameTime;
    state.stats.fps = Math.round(1000 / state.stats.frameInterval);
  }
  
  state.stats.lastFrameTime = now;
  state.stats.totalFrames++;
  state.stats.totalBytes += frameData.imageData.data.length;
  
  // Update frame buffer
  state.frameBuffer.push({
    ...frameData,
    id: `frame_${state.stats.totalFrames}`,
    quality: state.quality
  });
  
  // Keep buffer size manageable
  if (state.frameBuffer.length > 100) {
    state.frameBuffer.shift();
  }
};
