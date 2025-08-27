/**
 * Speaker Diarization Manager
 * Orchestrates speaker change detection and voice fingerprinting for comprehensive diarization
 */

import { createEnhancedMemoryPool } from '../../../shared/utils/enhanced-memory-pool.js';
import { createVoiceFingerprinting } from './voice-fingerprinting.js';
import { createSpeakerChangeDetection } from './speaker-change-detection.js';

export const createDiarizationManager = (config = {}) => {
  const memoryPool = createEnhancedMemoryPool({
    maxPoolSize: config.maxPoolSize || 100,
    enableMetrics: true
  });
  memoryPool.initialize();

  const state = {
    config: {
      frameSize: config.frameSize || 1024,
      hopSize: config.hopSize || 512,
      sampleRate: config.sampleRate || 44100,
      
      // Processing parameters
      enableChangeDetection: config.enableChangeDetection !== false,
      enableVoiceFingerprinting: config.enableVoiceFingerprinting !== false,
      minSpeakerDuration: config.minSpeakerDuration || 2000, // ms
      
      ...config
    },
    
    // Components
    voiceFingerprinting: null,
    changeDetection: null,
    
    // Current processing state
    currentSpeaker: null,
    speakerSegments: [],
    isInitialized: false,
    
    // Statistics
    stats: {
      totalFrames: 0,
      totalSpeakers: 0,
      totalSpeakerSwitches: 0,
      averageSegmentDuration: 0,
      confidence: 0
    }
  };

  // Initialize components
  const initialize = () => {
    if (state.config.enableVoiceFingerprinting) {
      state.voiceFingerprinting = createVoiceFingerprinting(state.config);
    }
    
    if (state.config.enableChangeDetection) {
      state.changeDetection = createSpeakerChangeDetection(state.config);
    }
    
    state.isInitialized = true;
  };

  // Register diarization result type
  memoryPool.registerFactory('DiarizationResult', () => ({
    _pooled: true,
    timestamp: 0,
    speakerId: null,
    confidence: 0,
    speakerChanged: false,
    segmentInfo: null,
    processing: {
      changeDetected: false,
      fingerprinted: false,
      processingTime: 0
    }
  }));

  // Process audio frame for diarization
  const processFrame = (audioBuffer, timestamp = Date.now()) => {
    if (!state.isInitialized) {
      initialize();
    }
    
    const startTime = performance.now();
    let speakerId = null;
    let confidence = 0;
    let speakerChanged = false;
    let segmentInfo = null;
    
    // Run change detection
    let changeResult = null;
    if (state.changeDetection) {
      changeResult = state.changeDetection.processFrame(audioBuffer, timestamp);
    }
    
    // Run voice fingerprinting
    let fingerprintResult = null;
    if (state.voiceFingerprinting) {
      fingerprintResult = state.voiceFingerprinting.processAudioSegment(audioBuffer, timestamp);
      speakerId = fingerprintResult.speakerId;
      confidence = fingerprintResult.confidence;
    }
    
    // Combine results
    if (changeResult && changeResult.changeDetected) {
      // Speaker change detected, trust the change detection
      if (state.currentSpeaker) {
        // End current segment
        const segment = {
          speakerId: state.currentSpeaker.speakerId,
          startTime: state.currentSpeaker.startTime,
          endTime: timestamp,
          duration: timestamp - state.currentSpeaker.startTime,
          confidence: state.currentSpeaker.confidence
        };
        
        if (segment.duration >= state.config.minSpeakerDuration) {
          state.speakerSegments.push(segment);
          state.stats.totalSpeakerSwitches++;
        }
      }
      
      // Start new segment
      if (speakerId) {
        state.currentSpeaker = {
          speakerId,
          startTime: timestamp,
          confidence
        };
        speakerChanged = true;
        
        if (fingerprintResult && fingerprintResult.newSpeaker) {
          state.stats.totalSpeakers++;
        }
      }
      
      segmentInfo = changeResult.segment;
    } else if (speakerId && speakerId !== (state.currentSpeaker?.speakerId)) {
      // Voice fingerprinting detected different speaker
      if (confidence > 0.7) { // High confidence threshold
        if (state.currentSpeaker) {
          // End current segment
          const segment = {
            speakerId: state.currentSpeaker.speakerId,
            startTime: state.currentSpeaker.startTime,
            endTime: timestamp,
            duration: timestamp - state.currentSpeaker.startTime,
            confidence: state.currentSpeaker.confidence
          };
          
          if (segment.duration >= state.config.minSpeakerDuration) {
            state.speakerSegments.push(segment);
            state.stats.totalSpeakerSwitches++;
          }
        }
        
        // Start new segment
        state.currentSpeaker = {
          speakerId,
          startTime: timestamp,
          confidence
        };
        speakerChanged = true;
        
        if (fingerprintResult && fingerprintResult.newSpeaker) {
          state.stats.totalSpeakers++;
        }
      }
    } else if (state.currentSpeaker) {
      // Continue with current speaker
      speakerId = state.currentSpeaker.speakerId;
      
      // Update confidence with moving average
      if (confidence > 0) {
        state.currentSpeaker.confidence = 
          state.currentSpeaker.confidence * 0.9 + confidence * 0.1;
      }
    }
    
    const processingTime = performance.now() - startTime;
    
    // Update statistics
    state.stats.totalFrames++;
    if (confidence > 0) {
      state.stats.confidence = (state.stats.confidence * (state.stats.totalFrames - 1) + 
                               confidence) / state.stats.totalFrames;
    }
    
    // Create result
    const result = memoryPool.acquire('DiarizationResult');
    result.timestamp = timestamp;
    result.speakerId = speakerId;
    result.confidence = confidence;
    result.speakerChanged = speakerChanged;
    result.segmentInfo = segmentInfo;
    result.processing = {
      changeDetected: changeResult?.changeDetected || false,
      fingerprinted: fingerprintResult !== null,
      processingTime
    };
    
    return result;
  };

  // Release diarization result
  const releaseResult = (result) => {
    memoryPool.release(result);
  };

  // Get all speaker segments
  const getSegments = () => {
    const allSegments = [...state.speakerSegments];
    
    // Add current segment if it exists
    if (state.currentSpeaker) {
      const current = {
        speakerId: state.currentSpeaker.speakerId,
        startTime: state.currentSpeaker.startTime,
        endTime: Date.now(),
        duration: Date.now() - state.currentSpeaker.startTime,
        confidence: state.currentSpeaker.confidence,
        active: true
      };
      allSegments.push(current);
    }
    
    return allSegments;
  };

  // Get speaker information
  const getSpeakerInfo = () => {
    const speakers = new Map();
    
    for (const segment of state.speakerSegments) {
      if (!speakers.has(segment.speakerId)) {
        speakers.set(segment.speakerId, {
          speakerId: segment.speakerId,
          totalDuration: 0,
          segmentCount: 0,
          averageConfidence: 0,
          firstAppearance: segment.startTime,
          lastAppearance: segment.endTime
        });
      }
      
      const speaker = speakers.get(segment.speakerId);
      speaker.totalDuration += segment.duration;
      speaker.segmentCount++;
      speaker.averageConfidence = (speaker.averageConfidence * (speaker.segmentCount - 1) + 
                                  segment.confidence) / speaker.segmentCount;
      speaker.lastAppearance = Math.max(speaker.lastAppearance, segment.endTime);
    }
    
    return Array.from(speakers.values());
  };

  // Get comprehensive statistics
  const getStats = () => ({
    ...state.stats,
    components: {
      voiceFingerprinting: state.voiceFingerprinting ? state.voiceFingerprinting.getStats() : null,
      changeDetection: state.changeDetection ? state.changeDetection.getStats() : null
    },
    memoryPool: memoryPool.getStats(),
    currentSegments: state.speakerSegments.length,
    activeSpeaker: state.currentSpeaker?.speakerId || null
  });

  // Update configuration
  const updateConfig = (newConfig) => {
    Object.assign(state.config, newConfig);
    
    if (newConfig.voiceFingerprinting && state.voiceFingerprinting) {
      state.voiceFingerprinting.updateConfig(newConfig.voiceFingerprinting);
    }
    if (newConfig.changeDetection && state.changeDetection) {
      state.changeDetection.updateConfig(newConfig.changeDetection);
    }
  };

  // Reset system
  const reset = () => {
    state.currentSpeaker = null;
    state.speakerSegments = [];
    state.stats = {
      totalFrames: 0,
      totalSpeakers: 0,
      totalSpeakerSwitches: 0,
      averageSegmentDuration: 0,
      confidence: 0
    };
    
    if (state.voiceFingerprinting) {
      state.voiceFingerprinting.resetSpeakers();
    }
    if (state.changeDetection) {
      state.changeDetection.reset();
    }
  };

  // Cleanup
  const cleanup = () => {
    memoryPool.cleanup();
  };

  return {
    processFrame,
    releaseResult,
    getSegments,
    getSpeakerInfo,
    getStats,
    updateConfig,
    reset,
    cleanup,
    isInitialized: () => state.isInitialized
  };
};