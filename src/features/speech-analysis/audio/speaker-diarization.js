/**
 * Speaker Diarization Module
 * Advanced speaker identification and segmentation for multi-speaker conversations
 * Following functional programming patterns with factory functions
 * 
 * Refactored into modular components for maintainability:
 * - Voice Fingerprinting: MFCC-based speaker identification
 * - Speaker Change Detection: Audio feature-based change point detection  
 * - Diarization Manager: Orchestrates both components for complete diarization
 */

// Import modular components
import { createVoiceFingerprinting } from './diarization/voice-fingerprinting.js';
import { createSpeakerChangeDetection } from './diarization/speaker-change-detection.js';
import { createDiarizationManager } from './diarization/diarization-manager.js';

// Re-export individual components for advanced usage
export { createVoiceFingerprinting } from './diarization/voice-fingerprinting.js';
export { createSpeakerChangeDetection } from './diarization/speaker-change-detection.js';

// Main speaker diarization system using the diarization manager
export const createSpeakerDiarization = (config = {}) => {
  console.log('🎙️ Initializing comprehensive speaker diarization system...');
  
  // Create diarization manager with all modular components
  const diarizationManager = createDiarizationManager(config);
  
  console.log('✅ Speaker diarization system initialized with modular components');
  
  // Return the complete API with enhanced logging
  return {
    ...diarizationManager,
    
    // Enhanced processing with logging
    processFrame: (audioBuffer, timestamp = Date.now()) => {
      const result = diarizationManager.processFrame(audioBuffer, timestamp);
      
      if (result.speakerChanged) {
        console.log(`🔄 Speaker change detected: ${result.speakerId} (confidence: ${result.confidence.toFixed(3)})`);
      }
      
      return result;
    },
    
    // Enhanced stats with component breakdown
    getStats: () => {
      const stats = diarizationManager.getStats();
      
      console.log('📊 Diarization Stats:', {
        totalFrames: stats.totalFrames,
        totalSpeakers: stats.totalSpeakers,
        totalSpeakerSwitches: stats.totalSpeakerSwitches,
        averageConfidence: stats.confidence?.toFixed(3) || 'N/A',
        activeSpeaker: stats.activeSpeaker
      });
      
      return stats;
    },
    
    // Enhanced reset with logging
    reset: () => {
      console.log('🔄 Resetting speaker diarization system...');
      diarizationManager.reset();
      console.log('✅ Speaker diarization system reset');
    },
    
    // Enhanced cleanup with logging  
    cleanup: () => {
      console.log('🧹 Cleaning up speaker diarization system...');
      diarizationManager.cleanup();
      console.log('✅ Speaker diarization system cleaned up');
    }
  };
};
