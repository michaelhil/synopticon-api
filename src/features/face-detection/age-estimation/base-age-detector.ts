/**
 * Base Age Detection Interface and Types
 * Foundation interfaces and utilities for age estimation systems
 */

export interface FacialFeatures {
  readonly skinTexture: number;      // Wrinkles and skin smoothness
  readonly eyeArea: number;          // Eye region characteristics  
  readonly facialStructure: number;  // Bone structure definition
  readonly hairline: number;         // Hairline and hair characteristics
  readonly facialFatness: number;    // Facial fat distribution
  readonly contrast: number;         // Overall facial contrast
}

export interface GenderFeatures {
  readonly jawStrength: number;      // Jaw definition and strength
  readonly eyebrowThickness: number; // Eyebrow thickness
  readonly facialHair: number;       // Facial hair presence
  readonly faceRoundness: number;    // Face shape roundness
  readonly lipThickness: number;     // Lip fullness
}

export interface AgeResult {
  readonly estimatedAge: number;
  readonly confidence: number;
  readonly ageRange: {
    readonly min: number;
    readonly max: number;
  };
  readonly features: FacialFeatures;
  readonly lifeStage: string;
  readonly metadata?: Record<string, any>;
}

export interface GenderResult {
  readonly gender: 'male' | 'female' | 'unknown';
  readonly confidence: number;
  readonly probabilities: {
    readonly male: number;
    readonly female: number;
  };
  readonly features: GenderFeatures;
  readonly metadata?: Record<string, any>;
}

export interface FaceRegionData {
  readonly data: Uint8ClampedArray;
  readonly width: number;
  readonly height: number;
}

export interface AgeDetectorConfiguration {
  readonly inputSize: readonly [number, number];
  readonly enableGenderDetection: boolean;
  readonly confidenceThreshold: number;
  readonly smoothingFactor: number;
  readonly ageRangeMapping: Record<string, [number, number]>;
}

export interface BaseAgeDetector {
  // Core functionality
  analyzeAge: (imageData: FaceRegionData, faceRegion?: any) => Promise<AgeResult>;
  analyzeGender?: (imageData: FaceRegionData, faceRegion?: any) => Promise<GenderResult>;
  
  // Configuration
  getConfiguration: () => AgeDetectorConfiguration;
  updateConfiguration: (config: Partial<AgeDetectorConfiguration>) => void;
  
  // Status
  isInitialized: () => boolean;
  getCapabilities: () => string[];
}

/**
 * Age range mappings for different life stages
 */
export const DEFAULT_AGE_RANGES = {
  infant: [0, 3],
  child: [3, 13],
  teenager: [13, 20],
  young_adult: [20, 30],
  adult: [30, 45],
  middle_aged: [45, 60],
  senior: [60, 75],
  elderly: [75, 100]
} as const;

/**
 * Creates default age detector configuration
 */
export const createDefaultAgeConfiguration = (config: Partial<AgeDetectorConfiguration> = {}): AgeDetectorConfiguration => {
  return {
    inputSize: config.inputSize || [64, 64],
    enableGenderDetection: config.enableGenderDetection !== false,
    confidenceThreshold: config.confidenceThreshold || 0.6,
    smoothingFactor: config.smoothingFactor || 0.4,
    ageRangeMapping: config.ageRangeMapping || DEFAULT_AGE_RANGES
  };
};

/**
 * Get life stage description from age
 */
export const getLifeStageFromAge = (age: number): string => {
  if (age < 3) return 'infant';
  if (age < 13) return 'child';
  if (age < 20) return 'teenager';
  if (age < 30) return 'young_adult';
  if (age < 45) return 'adult';
  if (age < 60) return 'middle_aged';
  if (age < 75) return 'senior';
  return 'elderly';
};

/**
 * Calculate age range based on estimated age and confidence
 */
export const calculateAgeRange = (estimatedAge: number, confidence: number): { min: number; max: number } => {
  const uncertainty = (1 - confidence) * 10; // Max ±10 years uncertainty
  return {
    min: Math.max(0, Math.round(estimatedAge - uncertainty)),
    max: Math.min(100, Math.round(estimatedAge + uncertainty))
  };
};

/**
 * Validate facial features data
 */
export const validateFacialFeatures = (features: any): string[] => {
  const errors: string[] = [];
  
  const requiredFields = ['skinTexture', 'eyeArea', 'facialStructure', 'hairline', 'facialFatness', 'contrast'];
  for (const field of requiredFields) {
    if (typeof features[field] !== 'number') {
      errors.push(`${field} must be a number`);
    } else if (features[field] < 0 || features[field] > 1) {
      errors.push(`${field} must be between 0 and 1`);
    }
  }
  
  return errors;
};

/**
 * Validate gender features data
 */
export const validateGenderFeatures = (features: any): string[] => {
  const errors: string[] = [];
  
  const requiredFields = ['jawStrength', 'eyebrowThickness', 'facialHair', 'faceRoundness', 'lipThickness'];
  for (const field of requiredFields) {
    if (typeof features[field] !== 'number') {
      errors.push(`${field} must be a number`);
    }
  }
  
  return errors;
};

/**
 * Normalize feature values to 0-1 range
 */
export const normalizeFacialFeatures = (features: Record<string, number>): FacialFeatures => {
  const normalize = (value: number, min = 0, max = 1): number => {
    return Math.max(0, Math.min(1, (value - min) / (max - min)));
  };

  return {
    skinTexture: normalize(features.skinTexture || 0),
    eyeArea: normalize(features.eyeArea || 0),
    facialStructure: normalize(features.facialStructure || 0),
    hairline: normalize(features.hairline || 0),
    facialFatness: normalize(features.facialFatness || 0),
    contrast: normalize(features.contrast || 0)
  };
};

/**
 * Create empty facial features
 */
export const createEmptyFacialFeatures = (): FacialFeatures => ({
  skinTexture: 0,
  eyeArea: 0,
  facialStructure: 0,
  hairline: 0,
  facialFatness: 0,
  contrast: 0
});

/**
 * Create empty gender features
 */
export const createEmptyGenderFeatures = (): GenderFeatures => ({
  jawStrength: 0,
  eyebrowThickness: 0,
  facialHair: 0,
  faceRoundness: 0,
  lipThickness: 0
});
