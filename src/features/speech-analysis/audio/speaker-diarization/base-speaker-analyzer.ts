/**
 * Base Speaker Analysis Interface and Types
 * Foundation interfaces and utilities for speaker diarization systems
 */

export interface SpeakerFeatures {
  readonly pitch: number;
  readonly spectralCentroid: number;
  readonly spectralRolloff: number;
  readonly zeroCrossingRate: number;
  readonly mfcc: readonly number[];
  readonly formants: readonly number[];
  readonly energy: number;
}

export interface SpeakerSegment {
  readonly speakerId: string;
  readonly startTime: number;
  readonly endTime: number;
  readonly duration: number;
  readonly confidence: number;
  readonly features?: SpeakerFeatures;
  readonly active?: boolean;
}

export interface SpeakerInfo {
  readonly speakerId: string;
  readonly totalDuration: number;
  readonly segmentCount: number;
  readonly averageConfidence: number;
  readonly firstAppearance: number;
  readonly lastAppearance: number;
}

export interface SpeakerDiarizationResult {
  readonly speakerId: string;
  readonly confidence: number;
  readonly isNewSpeaker: boolean;
  readonly changeDetected: boolean;
  readonly timestamp: number;
  readonly features: SpeakerFeatures;
  readonly segments: readonly SpeakerSegment[];
}

export interface SpeakerAnalysisConfiguration {
  readonly frameSize: number;
  readonly hopSize: number;
  readonly sampleRate: number;
  readonly mfccCoefficients: number;
  readonly melFilters: number;
  readonly minFreq: number;
  readonly maxFreq: number;
  readonly changeThreshold: number;
  readonly minSegmentDuration: number;
  readonly similarityThreshold: number;
  readonly maxSpeakers: number;
}

export interface SpeakerAnalysisStats {
  readonly totalFrames: number;
  readonly totalSpeakers: number;
  readonly totalSpeakerSwitches: number;
  readonly averageSegmentDuration: number;
  readonly confidence: number;
  readonly identificationsPerformed: number;
  readonly changePointsDetected: number;
}

export interface BaseSpeakerAnalyzer {
  // Core functionality
  processAudioFrame: (audioBuffer: Float32Array, timestamp?: number) => Promise<SpeakerDiarizationResult>;
  
  // Speaker management
  getSegments: () => SpeakerSegment[];
  getSpeakerInfo: () => SpeakerInfo[];
  getCurrentSpeaker: () => string | null;
  
  // Configuration
  getConfiguration: () => SpeakerAnalysisConfiguration;
  updateConfiguration: (config: Partial<SpeakerAnalysisConfiguration>) => void;
  
  // Status and metrics
  getStats: () => SpeakerAnalysisStats;
  isInitialized: () => boolean;
  
  // Lifecycle
  reset: () => void;
  cleanup: () => void;
}

/**
 * Creates default speaker analysis configuration
 */
export const createDefaultSpeakerConfiguration = (config: Partial<SpeakerAnalysisConfiguration> = {}): SpeakerAnalysisConfiguration => {
  return {
    frameSize: config.frameSize || 1024,
    hopSize: config.hopSize || 512,
    sampleRate: config.sampleRate || 44100,
    mfccCoefficients: config.mfccCoefficients || 13,
    melFilters: config.melFilters || 26,
    minFreq: config.minFreq || 80,
    maxFreq: config.maxFreq || 8000,
    changeThreshold: config.changeThreshold || 0.15,
    minSegmentDuration: config.minSegmentDuration || 1000,
    similarityThreshold: config.similarityThreshold || 0.8,
    maxSpeakers: config.maxSpeakers || 10
  };
};

/**
 * Creates empty speaker features
 */
export const createEmptySpeakerFeatures = (): SpeakerFeatures => ({
  pitch: 0,
  spectralCentroid: 0,
  spectralRolloff: 0,
  zeroCrossingRate: 0,
  mfcc: [],
  formants: [],
  energy: 0
});

/**
 * Creates empty speaker analysis stats
 */
export const createEmptyStats = (): SpeakerAnalysisStats => ({
  totalFrames: 0,
  totalSpeakers: 0,
  totalSpeakerSwitches: 0,
  averageSegmentDuration: 0,
  confidence: 0,
  identificationsPerformed: 0,
  changePointsDetected: 0
});

/**
 * Generate unique speaker ID
 */
export const generateSpeakerId = (index: number): string => {
  const labels = ['Speaker A', 'Speaker B', 'Speaker C', 'Speaker D', 'Speaker E', 
                 'Speaker F', 'Speaker G', 'Speaker H', 'Speaker I', 'Speaker J'];
  
  if (index < labels.length) {
    return labels[index];
  }
  
  return `Speaker ${String.fromCharCode(65 + (index % 26))}${Math.floor(index / 26) || ''}`;
};

/**
 * Validate speaker features
 */
export const validateSpeakerFeatures = (features: any): string[] => {
  const errors: string[] = [];
  
  if (typeof features.pitch !== 'number' || features.pitch < 0) {
    errors.push('Pitch must be a non-negative number');
  }
  
  if (typeof features.spectralCentroid !== 'number' || features.spectralCentroid < 0) {
    errors.push('Spectral centroid must be a non-negative number');
  }
  
  if (typeof features.spectralRolloff !== 'number' || features.spectralRolloff < 0) {
    errors.push('Spectral rolloff must be a non-negative number');
  }
  
  if (typeof features.zeroCrossingRate !== 'number' || features.zeroCrossingRate < 0) {
    errors.push('Zero crossing rate must be a non-negative number');
  }
  
  if (!Array.isArray(features.mfcc)) {
    errors.push('MFCC must be an array');
  }
  
  if (!Array.isArray(features.formants)) {
    errors.push('Formants must be an array');
  }
  
  if (typeof features.energy !== 'number' || features.energy < 0) {
    errors.push('Energy must be a non-negative number');
  }
  
  return errors;
};

/**
 * Validate speaker segment
 */
export const validateSpeakerSegment = (segment: any): string[] => {
  const errors: string[] = [];
  
  if (!segment.speakerId || typeof segment.speakerId !== 'string') {
    errors.push('Speaker ID must be a non-empty string');
  }
  
  if (typeof segment.startTime !== 'number' || segment.startTime < 0) {
    errors.push('Start time must be a non-negative number');
  }
  
  if (typeof segment.endTime !== 'number' || segment.endTime < segment.startTime) {
    errors.push('End time must be greater than or equal to start time');
  }
  
  if (typeof segment.duration !== 'number' || segment.duration < 0) {
    errors.push('Duration must be a non-negative number');
  }
  
  if (typeof segment.confidence !== 'number' || segment.confidence < 0 || segment.confidence > 1) {
    errors.push('Confidence must be between 0 and 1');
  }
  
  return errors;
};

/**
 * Calculate feature distance between two speaker features
 */
export const calculateFeatureDistance = (features1: SpeakerFeatures, features2: SpeakerFeatures): number => {
  let totalDistance = 0;
  let count = 0;
  
  // Pitch distance (normalized by frequency)
  if (features1.pitch > 0 && features2.pitch > 0) {
    const pitchDistance = Math.abs(features1.pitch - features2.pitch) / Math.max(features1.pitch, features2.pitch, 100);
    totalDistance += pitchDistance;
    count++;
  }
  
  // Spectral centroid distance
  const centroidDistance = Math.abs(features1.spectralCentroid - features2.spectralCentroid) / 
                          Math.max(features1.spectralCentroid, features2.spectralCentroid, 1);
  totalDistance += centroidDistance;
  count++;
  
  // Spectral rolloff distance
  const rolloffDistance = Math.abs(features1.spectralRolloff - features2.spectralRolloff) / 
                         Math.max(features1.spectralRolloff, features2.spectralRolloff, 1);
  totalDistance += rolloffDistance;
  count++;
  
  // Zero crossing rate distance
  const zcrDistance = Math.abs(features1.zeroCrossingRate - features2.zeroCrossingRate) / 
                     Math.max(features1.zeroCrossingRate, features2.zeroCrossingRate, 0.1);
  totalDistance += zcrDistance;
  count++;
  
  // MFCC distance (if both have MFCC coefficients)
  if (features1.mfcc.length > 0 && features2.mfcc.length > 0) {
    const minLength = Math.min(features1.mfcc.length, features2.mfcc.length);
    let mfccDistance = 0;
    
    for (let i = 0; i < minLength; i++) {
      mfccDistance += Math.abs(features1.mfcc[i] - features2.mfcc[i]);
    }
    
    mfccDistance /= minLength;
    totalDistance += mfccDistance * 0.5; // Weight MFCC less heavily
    count += 0.5;
  }
  
  // Energy distance
  const energyDistance = Math.abs(features1.energy - features2.energy) / 
                        Math.max(features1.energy, features2.energy, 0.01);
  totalDistance += energyDistance * 0.3; // Weight energy less heavily
  count += 0.3;
  
  return count > 0 ? totalDistance / count : 1;
};

/**
 * Calculate similarity between two speaker features (1 - distance)
 */
export const calculateSimilarity = (features1: SpeakerFeatures, features2: SpeakerFeatures): number => {
  const distance = calculateFeatureDistance(features1, features2);
  return Math.max(0, 1 - distance);
};

/**
 * Normalize audio buffer
 */
export const normalizeAudioBuffer = (audioBuffer: Float32Array): Float32Array => {
  const maxValue = Math.max(...Array.from(audioBuffer).map(Math.abs));
  if (maxValue === 0) return audioBuffer;
  
  const normalized = new Float32Array(audioBuffer.length);
  for (let i = 0; i < audioBuffer.length; i++) {
    normalized[i] = audioBuffer[i] / maxValue;
  }
  
  return normalized;
};

/**
 * Calculate RMS energy of audio buffer
 */
export const calculateRMSEnergy = (audioBuffer: Float32Array): number => {
  let sum = 0;
  for (let i = 0; i < audioBuffer.length; i++) {
    sum += audioBuffer[i] * audioBuffer[i];
  }
  return Math.sqrt(sum / audioBuffer.length);
};