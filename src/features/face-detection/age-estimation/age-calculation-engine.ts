/**
 * Age and Gender Calculation Engine
 * Handles age estimation and gender detection based on facial features
 */

import type {
  FacialFeatures,
  GenderFeatures,
  AgeResult,
  GenderResult,
  getLifeStageFromAge,
  calculateAgeRange
} from './base-age-detector.js';

/**
 * Creates an age and gender calculation engine
 */
export const createAgeCalculationEngine = () => {
  /**
   * Calculate age from facial features
   */
  const calculateAgeFromFeatures = (features: FacialFeatures): number => {
    // Base age estimation using weighted feature analysis
    let ageScore = 30; // Start with middle age

    // Skin texture (wrinkles increase with age)
    ageScore += features.skinTexture * 25; // +0-25 years

    // Eye area changes (bags, drooping with age)  
    ageScore += features.eyeArea * 15; // +0-15 years

    // Facial structure (becomes more defined with age)
    ageScore += features.facialStructure * 10; // +0-10 years

    // Hairline changes (receding/thinning with age)
    ageScore += features.hairline * 20; // +0-20 years (inverse - less hair = older)

    // Facial fatness (decreases with age typically)
    ageScore -= features.facialFatness * 15; // -0-15 years

    // Overall contrast (decreases with age)
    ageScore -= (1 - features.contrast) * 10; // -0-10 years

    // Clamp to reasonable age range
    return Math.max(5, Math.min(90, Math.round(ageScore)));
  };

  /**
   * Calculate age estimation confidence
   */
  const calculateAgeConfidence = (features: FacialFeatures): number => {
    // Confidence based on feature clarity and consistency
    const featureValues = [
      features.skinTexture,
      features.eyeArea,
      features.facialStructure,
      features.hairline,
      features.facialFatness,
      features.contrast
    ];

    // Higher confidence when features are more pronounced (not middle values)
    const featureClarity = featureValues.reduce((sum, value) => {
      const clarityScore = Math.abs(value - 0.5) * 2; // Distance from middle
      return sum + clarityScore;
    }, 0) / featureValues.length;

    // Base confidence from feature analysis quality
    const baseConfidence = 0.4 + (featureClarity * 0.4);

    // Boost confidence if multiple features align
    const consistencyBonus = calculateFeatureConsistency(features) * 0.2;

    return Math.min(0.95, Math.max(0.1, baseConfidence + consistencyBonus));
  };

  /**
   * Calculate consistency between facial features
   */
  const calculateFeatureConsistency = (features: FacialFeatures): number => {
    // Features that should correlate for age estimation
    const correlations = [
      // Older features tend to correlate
      [features.skinTexture, features.eyeArea],
      [features.facialStructure, features.contrast],
      // Younger features (inverse correlation)
      [1 - features.facialFatness, features.skinTexture]
    ];

    let consistencyScore = 0;
    for (const [feature1, feature2] of correlations) {
      const correlation = 1 - Math.abs(feature1 - feature2);
      consistencyScore += correlation;
    }

    return consistencyScore / correlations.length;
  };

  /**
   * Calculate gender probabilities from facial features
   */
  const calculateGenderProbabilities = (features: GenderFeatures): { male: number; female: number } => {
    let maleScore = 0.5; // Start neutral

    // Jaw strength (males typically have stronger jaws)
    maleScore += (features.jawStrength - 0.5) * 0.6;

    // Eyebrow thickness (males typically have thicker eyebrows)
    maleScore += (features.eyebrowThickness - 0.3) * 0.8;

    // Facial hair (strong male indicator)
    maleScore += features.facialHair * 1.2;

    // Face roundness (females typically have rounder faces)
    maleScore -= (features.faceRoundness - 0.5) * 0.7;

    // Lip thickness (females typically have fuller lips)
    maleScore -= (features.lipThickness - 0.2) * 0.6;

    // Clamp to reasonable probability range
    maleScore = Math.max(0.05, Math.min(0.95, maleScore));

    return {
      male: maleScore,
      female: 1.0 - maleScore
    };
  };

  /**
   * Calculate gender confidence
   */
  const calculateGenderConfidence = (probabilities: { male: number; female: number }): number => {
    // Confidence is higher when one gender has significantly higher probability
    const maxProb = Math.max(probabilities.male, probabilities.female);
    const difference = Math.abs(probabilities.male - probabilities.female);
    
    // Base confidence from probability difference
    const baseConfidence = difference * 0.8;
    
    // Bonus for very high or very low probabilities
    const extremeBonus = maxProb > 0.8 ? (maxProb - 0.8) * 0.5 : 0;
    
    return Math.min(0.95, Math.max(0.1, baseConfidence + extremeBonus));
  };

  /**
   * Generate complete age analysis result
   */
  const generateAgeResult = (features: FacialFeatures): AgeResult => {
    const estimatedAge = calculateAgeFromFeatures(features);
    const confidence = calculateAgeConfidence(features);
    const ageRange = calculateAgeRange(estimatedAge, confidence);
    const lifeStage = getLifeStageFromAge(estimatedAge);

    return {
      estimatedAge,
      confidence,
      ageRange,
      features,
      lifeStage,
      metadata: {
        calculationMethod: 'feature_analysis',
        timestamp: Date.now()
      }
    };
  };

  /**
   * Generate complete gender analysis result
   */
  const generateGenderResult = (features: GenderFeatures): GenderResult => {
    const probabilities = calculateGenderProbabilities(features);
    const confidence = calculateGenderConfidence(probabilities);
    const gender = probabilities.male > probabilities.female ? 'male' : 'female';

    return {
      gender,
      confidence,
      probabilities,
      features,
      metadata: {
        calculationMethod: 'feature_analysis',
        timestamp: Date.now()
      }
    };
  };

  /**
   * Validate age result
   */
  const validateAgeResult = (result: AgeResult): string[] => {
    const errors: string[] = [];

    if (result.estimatedAge < 0 || result.estimatedAge > 150) {
      errors.push('Estimated age out of valid range');
    }

    if (result.confidence < 0 || result.confidence > 1) {
      errors.push('Confidence must be between 0 and 1');
    }

    if (result.ageRange.min > result.ageRange.max) {
      errors.push('Age range minimum cannot be greater than maximum');
    }

    if (!result.lifeStage) {
      errors.push('Life stage is required');
    }

    return errors;
  };

  /**
   * Validate gender result
   */
  const validateGenderResult = (result: GenderResult): string[] => {
    const errors: string[] = [];

    if (!['male', 'female', 'unknown'].includes(result.gender)) {
      errors.push('Invalid gender value');
    }

    if (result.confidence < 0 || result.confidence > 1) {
      errors.push('Confidence must be between 0 and 1');
    }

    const probSum = result.probabilities.male + result.probabilities.female;
    if (Math.abs(probSum - 1.0) > 0.01) {
      errors.push('Gender probabilities must sum to 1.0');
    }

    return errors;
  };

  /**
   * Create fallback age result for error cases
   */
  const createFallbackAgeResult = (reason = 'Analysis failed'): AgeResult => {
    const fallbackAge = 30;
    return {
      estimatedAge: fallbackAge,
      confidence: 0.1,
      ageRange: { min: 20, max: 40 },
      features: {
        skinTexture: 0,
        eyeArea: 0,
        facialStructure: 0,
        hairline: 0,
        facialFatness: 0,
        contrast: 0
      },
      lifeStage: 'adult',
      metadata: {
        fallback: true,
        reason,
        timestamp: Date.now()
      }
    };
  };

  /**
   * Create fallback gender result for error cases
   */
  const createFallbackGenderResult = (reason = 'Analysis failed'): GenderResult => {
    return {
      gender: 'unknown',
      confidence: 0.0,
      probabilities: { male: 0.5, female: 0.5 },
      features: {
        jawStrength: 0,
        eyebrowThickness: 0,
        facialHair: 0,
        faceRoundness: 0,
        lipThickness: 0
      },
      metadata: {
        fallback: true,
        reason,
        timestamp: Date.now()
      }
    };
  };

  return {
    // Core calculation methods
    calculateAgeFromFeatures,
    calculateAgeConfidence,
    calculateGenderProbabilities,
    calculateGenderConfidence,

    // Result generation
    generateAgeResult,
    generateGenderResult,

    // Validation
    validateAgeResult,
    validateGenderResult,

    // Fallback handling
    createFallbackAgeResult,
    createFallbackGenderResult,

    // Utility methods
    calculateFeatureConsistency
  };
};

export type AgeCalculationEngine = ReturnType<typeof createAgeCalculationEngine>;
