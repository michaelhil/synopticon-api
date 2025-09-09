/**
 * Emotion detection configuration management
 */

export interface EmotionMapping {
  arousal: number;
  valence: number;
}

export interface EmotionMappingWeights {
  happy: EmotionMapping;
  sad: EmotionMapping;
  angry: EmotionMapping;
  fear: EmotionMapping;
  surprise: EmotionMapping;
  disgust: EmotionMapping;
  neutral: EmotionMapping;
  [key: string]: EmotionMapping;
}

export interface ProsodicConfig {
  frameSize: number;
  hopSize: number;
  sampleRate: number;
  pitchRange: readonly [number, number];
  energySmoothing: number;
  timingWindowSize: number;
  normalizeFeatures: boolean;
  adaptiveNormalization: boolean;
}

export interface ClassifierConfig {
  smoothingFactor: number;
  confidenceThreshold: number;
  timelineLength: number;
  emotionMappingWeights: EmotionMappingWeights;
}

export interface EmotionConfig {
  frameSize: number;
  sampleRate: number;
  enableProsodics: boolean;
  enableClassification: boolean;
  emotionUpdateInterval: number; // ms
  prosodics: ProsodicConfig;
  classifier: ClassifierConfig;
  maxPoolSize: number;
}

export interface EmotionConfigInput {
  frameSize?: number;
  sampleRate?: number;
  enableProsodics?: boolean;
  enableClassification?: boolean;
  emotionUpdateInterval?: number;
  hopSize?: number;
  pitchRange?: readonly [number, number];
  energySmoothing?: number;
  timingWindowSize?: number;
  normalizeFeatures?: boolean;
  adaptiveNormalization?: boolean;
  smoothingFactor?: number;
  confidenceThreshold?: number;
  timelineLength?: number;
  emotionMappingWeights?: Partial<EmotionMappingWeights>;
  maxPoolSize?: number;
  prosodics?: Partial<ProsodicConfig>;
  classifier?: Partial<ClassifierConfig>;
  [key: string]: unknown;
}

export const createEmotionConfig = (config: EmotionConfigInput = {}): EmotionConfig => ({
  frameSize: config.frameSize ?? 1024,
  sampleRate: config.sampleRate ?? 44100,
  
  // Processing configuration
  enableProsodics: config.enableProsodics !== false,
  enableClassification: config.enableClassification !== false,
  
  // Update intervals
  emotionUpdateInterval: config.emotionUpdateInterval ?? 500, // ms
  
  // Prosodic analyzer config
  prosodics: {
    frameSize: config.frameSize ?? 1024,
    hopSize: config.hopSize ?? 512,
    sampleRate: config.sampleRate ?? 44100,
    pitchRange: config.pitchRange ?? [80, 400] as const,
    energySmoothing: config.energySmoothing ?? 0.3,
    timingWindowSize: config.timingWindowSize ?? 10,
    normalizeFeatures: config.normalizeFeatures !== false,
    adaptiveNormalization: config.adaptiveNormalization !== false,
    ...config.prosodics
  },
  
  // Emotion classifier config
  classifier: {
    smoothingFactor: config.smoothingFactor ?? 0.7,
    confidenceThreshold: config.confidenceThreshold ?? 0.6,
    timelineLength: config.timelineLength ?? 50,
    emotionMappingWeights: {
      happy: { arousal: 0.8, valence: 0.9 },
      sad: { arousal: -0.6, valence: -0.8 },
      angry: { arousal: 0.9, valence: -0.7 },
      fear: { arousal: 0.7, valence: -0.6 },
      surprise: { arousal: 0.6, valence: 0.3 },
      disgust: { arousal: 0.4, valence: -0.9 },
      neutral: { arousal: 0, valence: 0 },
      ...config.emotionMappingWeights
    },
    ...config.classifier
  },
  
  // Memory pool config
  maxPoolSize: config.maxPoolSize ?? 100
});

export const validateEmotionConfig = (config: EmotionConfig): string[] => {
  const errors: string[] = [];
  
  if (config.emotionUpdateInterval < 100) {
    errors.push('Emotion update interval must be at least 100ms');
  }
  
  if (config.frameSize <= 0 || !Number.isInteger(config.frameSize)) {
    errors.push('Frame size must be a positive integer');
  }
  
  if (config.sampleRate <= 0) {
    errors.push('Sample rate must be positive');
  }
  
  // Validate prosodic config
  if (config.prosodics) {
    const [minPitch, maxPitch] = config.prosodics.pitchRange;
    if (minPitch >= maxPitch || minPitch <= 0) {
      errors.push('Invalid pitch range: min must be less than max and both positive');
    }
  }
  
  // Validate classifier weights
  if (config.classifier?.emotionMappingWeights) {
    const weights = config.classifier.emotionMappingWeights;
    for (const [emotion, mapping] of Object.entries(weights)) {
      if (typeof mapping.arousal !== 'number' || typeof mapping.valence !== 'number') {
        errors.push(`Invalid mapping for emotion '${emotion}': arousal and valence must be numbers`);
      }
      if (Math.abs(mapping.arousal) > 1 || Math.abs(mapping.valence) > 1) {
        errors.push(`Invalid mapping for emotion '${emotion}': arousal and valence must be between -1 and 1`);
      }
    }
  }
  
  return errors;
};

export const updateEmotionConfig = (
  currentConfig: EmotionConfig, 
  updates: Partial<EmotionConfigInput>
): EmotionConfig => {
  const newConfig: EmotionConfig = { ...currentConfig };
  
  // Deep merge nested objects
  if (updates.prosodics) {
    newConfig.prosodics = { ...currentConfig.prosodics, ...updates.prosodics };
  }
  
  if (updates.classifier) {
    newConfig.classifier = { ...currentConfig.classifier, ...updates.classifier };
    
    // Deep merge emotion mapping weights
    if (updates.classifier.emotionMappingWeights) {
      newConfig.classifier.emotionMappingWeights = {
        ...currentConfig.classifier.emotionMappingWeights,
        ...updates.classifier.emotionMappingWeights
      };
    }
  }
  
  // Apply other updates
  Object.assign(newConfig, updates);
  
  const errors = validateEmotionConfig(newConfig);
  
  if (errors.length > 0) {
    throw new Error(`Invalid emotion detection configuration: ${errors.join(', ')`);
  }
  
  return newConfig;
};