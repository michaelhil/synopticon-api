/**
 * Speaker Context Manager
 * Manages speaker identification, tracking, and voice characteristics
 */

export interface VoiceCharacteristics {
  readonly pitch: {
    mean: number;
    variance: number;
    range: [number, number];
  };
  readonly formants: {
    f1: number;
    f2: number;
    f3: number;
  };
  readonly spectral: {
    centroid: number;
    rolloff: number;
    flux: number;
  };
  readonly prosodic: {
    speakingRate: number;
    pausePattern: number[];
    stressPattern: number[];
  };
  readonly quality: {
    snr: number;
    clarity: number;
    stability: number;
  };
}

export interface SpeakerProfile {
  readonly id: string;
  readonly name?: string;
  readonly voiceCharacteristics: VoiceCharacteristics;
  readonly metadata: {
    gender?: 'male' | 'female' | 'unknown';
    ageGroup?: 'child' | 'young_adult' | 'adult' | 'senior';
    accent?: string;
    language?: string;
    confidence: number;
  };
  readonly statistics: {
    totalSpeechTime: number;
    wordCount: number;
    avgConfidence: number;
    lastSeen: number;
    sessionCount: number;
  };
}

export interface SpeakerSegment {
  readonly speakerId: string;
  readonly startTime: number;
  readonly endTime: number;
  readonly confidence: number;
  readonly audioFeatures: Partial<VoiceCharacteristics>;
  readonly transcript?: string;
  readonly metadata?: Record<string, any>;
}

export interface SpeakerContextConfig {
  maxSpeakers?: number;
  confidenceThreshold?: number;
  adaptationRate?: number;
  enableVoicePrint?: boolean;
  enableGenderDetection?: boolean;
  enableAgeEstimation?: boolean;
}

export interface SpeakerContextManager {
  // Speaker management
  identifySpeaker: (audioFeatures: Partial<VoiceCharacteristics>) => Promise<string | null>;
  registerSpeaker: (profile: Omit<SpeakerProfile, 'id' | 'statistics'>) => Promise<string>;
  updateSpeaker: (speakerId: string, updates: Partial<SpeakerProfile>) => Promise<void>;
  removeSpeaker: (speakerId: string) => Promise<void>;
  
  // Speaker tracking
  trackSpeakerChange: (segment: SpeakerSegment) => Promise<void>;
  getCurrentSpeaker: () => Promise<string | null>;
  getSpeakerHistory: (timeWindowMs?: number) => Promise<SpeakerSegment[]>;
  
  // Voice analysis
  analyzeVoiceCharacteristics: (audioBuffer: ArrayBuffer) => Promise<VoiceCharacteristics>;
  compareVoices: (speakerId1: string, speakerId2: string) => Promise<number>;
  
  // Profile management
  getSpeakerProfile: (speakerId: string) => Promise<SpeakerProfile | null>;
  getAllSpeakers: () => Promise<SpeakerProfile[]>;
  getActiveSpeakers: (timeWindowMs?: number) => Promise<SpeakerProfile[]>;
  
  // Statistics
  getSpeakerStatistics: (speakerId: string) => Promise<SpeakerProfile['statistics'] | null>;
  getOverallStatistics: () => Promise<{
    totalSpeakers: number;
    activeSpeakers: number;
    totalSpeechTime: number;
    avgConfidence: number;
  }>;
}

/**
 * Create speaker context manager
 */
export const createSpeakerContextManager = (config: SpeakerContextConfig = {}): SpeakerContextManager => {
  const configuration = {
    maxSpeakers: config.maxSpeakers || 50,
    confidenceThreshold: config.confidenceThreshold || 0.7,
    adaptationRate: config.adaptationRate || 0.1,
    enableVoicePrint: config.enableVoicePrint !== false,
    enableGenderDetection: config.enableGenderDetection !== false,
    enableAgeEstimation: config.enableAgeEstimation !== false
  };

  const speakers = new Map<string, SpeakerProfile>();
  const segmentHistory: SpeakerSegment[] = [];
  let currentSpeaker: string | null = null;

  const generateId = (): string => {
    return `speaker_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  };

  const identifySpeaker = async (audioFeatures: Partial<VoiceCharacteristics>): Promise<string | null> => {
    if (!configuration.enableVoicePrint) return null;

    let bestMatch: string | null = null;
    let bestScore = 0;

    for (const [speakerId, profile] of speakers.entries()) {
      const similarity = calculateVoiceSimilarity(audioFeatures, profile.voiceCharacteristics);
      
      if (similarity > bestScore && similarity > configuration.confidenceThreshold) {
        bestScore = similarity;
        bestMatch = speakerId;
      }
    }

    return bestMatch;
  };

  const registerSpeaker = async (profile: Omit<SpeakerProfile, 'id' | 'statistics'>): Promise<string> => {
    const id = generateId();
    const now = Date.now();
    
    const speakerProfile: SpeakerProfile = {
      ...profile,
      id,
      statistics: {
        totalSpeechTime: 0,
        wordCount: 0,
        avgConfidence: profile.metadata.confidence,
        lastSeen: now,
        sessionCount: 1
      }
    };

    speakers.set(id, speakerProfile);
    return id;
  };

  const updateSpeaker = async (speakerId: string, updates: Partial<SpeakerProfile>): Promise<void> => {
    const speaker = speakers.get(speakerId);
    if (!speaker) return;

    const updated: SpeakerProfile = {
      ...speaker,
      ...updates,
      id: speaker.id, // Preserve ID
      statistics: {
        ...speaker.statistics,
        ...updates.statistics,
        lastSeen: Date.now()
      }
    };

    speakers.set(speakerId, updated);
  };

  const removeSpeaker = async (speakerId: string): Promise<void> => {
    speakers.delete(speakerId);
    
    // Remove from segment history
    const filteredHistory = segmentHistory.filter(segment => segment.speakerId !== speakerId);
    segmentHistory.length = 0;
    segmentHistory.push(...filteredHistory);
    
    if (currentSpeaker === speakerId) {
      currentSpeaker = null;
    }
  };

  const trackSpeakerChange = async (segment: SpeakerSegment): Promise<void> => {
    segmentHistory.push(segment);
    currentSpeaker = segment.speakerId;

    // Update speaker statistics
    const speaker = speakers.get(segment.speakerId);
    if (speaker) {
      const duration = segment.endTime - segment.startTime;
      const wordCount = segment.transcript ? segment.transcript.split(/\s+/).length : 0;

      const updated: SpeakerProfile = {
        ...speaker,
        statistics: {
          ...speaker.statistics,
          totalSpeechTime: speaker.statistics.totalSpeechTime + duration,
          wordCount: speaker.statistics.wordCount + wordCount,
          lastSeen: segment.endTime,
          avgConfidence: (speaker.statistics.avgConfidence + segment.confidence) / 2
        }
      };

      speakers.set(segment.speakerId, updated);
    }

    // Limit history size
    const maxHistorySize = 1000;
    if (segmentHistory.length > maxHistorySize) {
      segmentHistory.splice(0, segmentHistory.length - maxHistorySize);
    }
  };

  const getCurrentSpeaker = async (): Promise<string | null> => {
    return currentSpeaker;
  };

  const getSpeakerHistory = async (timeWindowMs: number = 300000): Promise<SpeakerSegment[]> => {
    const cutoffTime = Date.now() - timeWindowMs;
    return segmentHistory.filter(segment => segment.startTime >= cutoffTime);
  };

  const analyzeVoiceCharacteristics = async (audioBuffer: ArrayBuffer): Promise<VoiceCharacteristics> => {
    // Placeholder implementation - would use actual audio analysis
    return {
      pitch: {
        mean: 150,
        variance: 20,
        range: [100, 200]
      },
      formants: {
        f1: 500,
        f2: 1500,
        f3: 2500
      },
      spectral: {
        centroid: 2000,
        rolloff: 4000,
        flux: 0.5
      },
      prosodic: {
        speakingRate: 150,
        pausePattern: [0.2, 0.5, 0.3],
        stressPattern: [0.8, 0.6, 0.7]
      },
      quality: {
        snr: 20,
        clarity: 0.85,
        stability: 0.9
      }
    };
  };

  const compareVoices = async (speakerId1: string, speakerId2: string): Promise<number> => {
    const speaker1 = speakers.get(speakerId1);
    const speaker2 = speakers.get(speakerId2);
    
    if (!speaker1 || !speaker2) return 0;
    
    return calculateVoiceSimilarity(
      speaker1.voiceCharacteristics,
      speaker2.voiceCharacteristics
    );
  };

  const getSpeakerProfile = async (speakerId: string): Promise<SpeakerProfile | null> => {
    return speakers.get(speakerId) || null;
  };

  const getAllSpeakers = async (): Promise<SpeakerProfile[]> => {
    return Array.from(speakers.values());
  };

  const getActiveSpeakers = async (timeWindowMs: number = 300000): Promise<SpeakerProfile[]> => {
    const cutoffTime = Date.now() - timeWindowMs;
    return Array.from(speakers.values()).filter(
      speaker => speaker.statistics.lastSeen >= cutoffTime
    );
  };

  const getSpeakerStatistics = async (speakerId: string): Promise<SpeakerProfile['statistics'] | null> => {
    const speaker = speakers.get(speakerId);
    return speaker?.statistics || null;
  };

  const getOverallStatistics = async () => {
    const allSpeakers = Array.from(speakers.values());
    const recentSpeakers = await getActiveSpeakers();

    const totalSpeechTime = allSpeakers.reduce((sum, speaker) => 
      sum + speaker.statistics.totalSpeechTime, 0
    );

    const avgConfidence = allSpeakers.length > 0
      ? allSpeakers.reduce((sum, speaker) => sum + speaker.statistics.avgConfidence, 0) / allSpeakers.length
      : 0;

    return {
      totalSpeakers: allSpeakers.length,
      activeSpeakers: recentSpeakers.length,
      totalSpeechTime,
      avgConfidence
    };
  };

  return {
    identifySpeaker,
    registerSpeaker,
    updateSpeaker,
    removeSpeaker,
    trackSpeakerChange,
    getCurrentSpeaker,
    getSpeakerHistory,
    analyzeVoiceCharacteristics,
    compareVoices,
    getSpeakerProfile,
    getAllSpeakers,
    getActiveSpeakers,
    getSpeakerStatistics,
    getOverallStatistics
  };
};

/**
 * Calculate similarity between voice characteristics
 */
function calculateVoiceSimilarity(
  features1: Partial<VoiceCharacteristics>,
  features2: VoiceCharacteristics
): number {
  let totalWeight = 0;
  let weightedScore = 0;

  // Pitch similarity (weight: 0.3)
  if (features1.pitch) {
    const pitchSimilarity = Math.max(0, 1 - Math.abs(features1.pitch.mean - features2.pitch.mean) / 200);
    weightedScore += pitchSimilarity * 0.3;
    totalWeight += 0.3;
  }

  // Formant similarity (weight: 0.4)
  if (features1.formants) {
    const f1Sim = Math.max(0, 1 - Math.abs(features1.formants.f1 - features2.formants.f1) / 1000);
    const f2Sim = Math.max(0, 1 - Math.abs(features1.formants.f2 - features2.formants.f2) / 2000);
    const formantSimilarity = (f1Sim + f2Sim) / 2;
    weightedScore += formantSimilarity * 0.4;
    totalWeight += 0.4;
  }

  // Spectral similarity (weight: 0.3)
  if (features1.spectral) {
    const spectralSimilarity = Math.max(0, 1 - Math.abs(features1.spectral.centroid - features2.spectral.centroid) / 5000);
    weightedScore += spectralSimilarity * 0.3;
    totalWeight += 0.3;
  }

  return totalWeight > 0 ? weightedScore / totalWeight : 0;
}
