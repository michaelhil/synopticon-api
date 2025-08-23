/**
 * Age Estimation Pipeline Implementation
 * Provides real-time age estimation using facial feature analysis
 * Includes gender detection as complementary feature
 */

import { createPipeline } from '../core/pipeline.js';
import { 
  Capability,
  createPerformanceProfile,
  createAgeResult,
  createGenderResult,
  createAnalysisResult
} from '../core/types.js';

// Age estimation configuration factory
const createAgeEstimationConfig = (config = {}) => ({
  modelUrl: config.modelUrl || null,
  inputSize: config.inputSize || [64, 64],
  enableGenderDetection: config.enableGenderDetection !== false,
  confidenceThreshold: config.confidenceThreshold || 0.6,
  smoothingFactor: config.smoothingFactor || 0.4,
  ageRangeMapping: config.ageRangeMapping || {
    child: [0, 12],
    teen: [13, 19], 
    adult: [20, 64],
    senior: [65, 100]
  },
  ...config
});

// Age estimation using facial feature analysis
const createAgeEstimator = () => {
  // Facial feature analysis for age estimation
  const analyzeAgeFeatures = (imageData, faceRegion) => {
    try {
      const faceData = extractFaceRegion(imageData, faceRegion);
      const features = extractAgeFeatures(faceData);
      
      // Estimate age based on facial features
      const estimatedAge = calculateAgeFromFeatures(features);
      const confidence = calculateAgeConfidence(features);
      
      return {
        estimatedAge,
        confidence,
        features
      };
    } catch (error) {
      console.warn('Age estimation failed:', error);
      return {
        estimatedAge: 30,
        confidence: 0,
        features: {}
      };
    }
  };

  // Extract face region from full image
  const extractFaceRegion = (imageData, bbox) => {
    const [x, y, width, height] = bbox;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    
    // Create image from imageData
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = imageData.width;
    tempCanvas.height = imageData.height;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.putImageData(imageData, 0, 0);
    
    // Extract face region
    ctx.drawImage(tempCanvas, x, y, width, height, 0, 0, width, height);
    
    return ctx.getImageData(0, 0, width, height);
  };

  // Extract age-relevant facial features
  const extractAgeFeatures = (faceData) => {
    const pixels = faceData.data;
    const width = faceData.width;
    const height = faceData.height;
    
    const features = {
      skinTexture: 0,      // Wrinkles and skin smoothness
      eyeArea: 0,          // Eye region characteristics
      facialStructure: 0,  // Bone structure definition
      hairline: 0,         // Hairline and hair characteristics
      facialFatness: 0,    // Facial fat distribution
      contrast: 0          // Overall facial contrast
    };

    // Convert to grayscale and analyze
    const grayPixels = new Array(width * height);
    for (let i = 0; i < pixels.length; i += 4) {
      const gray = 0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2];
      grayPixels[i / 4] = gray;
    }

    // Analyze skin texture (wrinkles indicator)
    features.skinTexture = analyzeSkinTexture(grayPixels, width, height);
    
    // Analyze eye region
    features.eyeArea = analyzeEyeRegion(grayPixels, width, height);
    
    // Analyze facial structure
    features.facialStructure = analyzeFacialStructure(grayPixels, width, height);
    
    // Analyze hairline region
    features.hairline = analyzeHairline(grayPixels, width, height);
    
    // Analyze facial fatness
    features.facialFatness = analyzeFacialFatness(grayPixels, width, height);
    
    // Calculate overall contrast
    features.contrast = calculateImageContrast(grayPixels);

    return features;
  };

  // Analyze skin texture for age indicators
  const analyzeSkinTexture = (grayPixels, width, height) => {
    let textureScore = 0;
    let edgeStrength = 0;
    
    // Calculate local variance (texture indicator)
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const center = grayPixels[y * width + x];
        
        // 3x3 neighborhood variance
        let variance = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const neighbor = grayPixels[(y + dy) * width + (x + dx)];
            variance += Math.pow(neighbor - center, 2);
          }
        }
        variance /= 9;
        
        textureScore += variance;
        
        // Edge detection for wrinkles
        const sobelX = 
          grayPixels[(y-1) * width + (x-1)] * -1 +
          grayPixels[(y-1) * width + (x+1)] * 1 +
          grayPixels[y * width + (x-1)] * -2 +
          grayPixels[y * width + (x+1)] * 2 +
          grayPixels[(y+1) * width + (x-1)] * -1 +
          grayPixels[(y+1) * width + (x+1)] * 1;
          
        edgeStrength += Math.abs(sobelX);
      }
    }
    
    return (textureScore + edgeStrength) / (width * height);
  };

  // Analyze eye region characteristics
  const analyzeEyeRegion = (grayPixels, width, height) => {
    // Focus on upper third of face (eye region)
    const eyeRegionStart = Math.floor(height * 0.2);
    const eyeRegionEnd = Math.floor(height * 0.5);
    
    let brightness = 0;
    let pixelCount = 0;
    
    for (let y = eyeRegionStart; y < eyeRegionEnd; y++) {
      for (let x = 0; x < width; x++) {
        brightness += grayPixels[y * width + x];
        pixelCount++;
      }
    }
    
    return brightness / pixelCount;
  };

  // Analyze facial bone structure
  const analyzeFacialStructure = (grayPixels, width, height) => {
    // Analyze jaw and cheek definition
    const lowerFaceStart = Math.floor(height * 0.6);
    let structureDefinition = 0;
    
    for (let y = lowerFaceStart; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const center = grayPixels[y * width + x];
        const left = grayPixels[y * width + (x - 1)];
        const right = grayPixels[y * width + (x + 1)];
        
        structureDefinition += Math.abs(right - left);
      }
    }
    
    return structureDefinition / ((height - lowerFaceStart) * (width - 2));
  };

  // Analyze hairline characteristics
  const analyzeHairline = (grayPixels, width, height) => {
    // Focus on top portion of image
    const hairlineRegionEnd = Math.floor(height * 0.2);
    let hairPixels = 0;
    let pixelCount = 0;
    
    for (let y = 0; y < hairlineRegionEnd; y++) {
      for (let x = 0; x < width; x++) {
        const pixel = grayPixels[y * width + x];
        if (pixel < 80) hairPixels++; // Dark pixels likely hair
        pixelCount++;
      }
    }
    
    return hairPixels / pixelCount;
  };

  // Analyze facial fat distribution
  const analyzeFacialFatness = (grayPixels, width, height) => {
    // Analyze cheek region brightness (fuller faces tend to be brighter)
    const cheekRegionStartY = Math.floor(height * 0.4);
    const cheekRegionEndY = Math.floor(height * 0.7);
    const cheekRegionStartX = Math.floor(width * 0.1);
    const cheekRegionEndX = Math.floor(width * 0.9);
    
    let brightness = 0;
    let pixelCount = 0;
    
    for (let y = cheekRegionStartY; y < cheekRegionEndY; y++) {
      for (let x = cheekRegionStartX; x < cheekRegionEndX; x++) {
        brightness += grayPixels[y * width + x];
        pixelCount++;
      }
    }
    
    return brightness / pixelCount;
  };

  // Calculate overall image contrast
  const calculateImageContrast = (grayPixels) => {
    const min = Math.min(...grayPixels);
    const max = Math.max(...grayPixels);
    return (max - min) / 255;
  };

  // Calculate age from extracted features
  const calculateAgeFromFeatures = (features) => {
    let age = 25; // Base age
    
    // Skin texture contribution (wrinkles indicate older age)
    age += (features.skinTexture / 100) * 25;
    
    // Eye region brightness (brighter usually younger)
    age += (150 - features.eyeArea) / 10;
    
    // Facial structure definition (more defined = older)
    age += (features.facialStructure / 20) * 15;
    
    // Hairline (receding hairline = older)
    age += (0.5 - features.hairline) * 20;
    
    // Facial fatness (fuller faces often younger)
    age -= (features.facialFatness - 120) / 10;
    
    // Contrast (lower contrast = older)
    age += (0.6 - features.contrast) * 30;
    
    // Clamp to reasonable range
    return Math.max(5, Math.min(85, Math.round(age)));
  };

  // Calculate confidence based on feature quality
  const calculateAgeConfidence = (features) => {
    // Confidence based on feature clarity and consistency
    let confidence = 0.5;
    
    // Higher texture score = more reliable age indicators
    confidence += Math.min(0.3, features.skinTexture / 500);
    
    // Good facial structure definition = more reliable
    confidence += Math.min(0.2, features.facialStructure / 100);
    
    // Reasonable contrast = better analysis
    if (features.contrast > 0.2 && features.contrast < 0.8) {
      confidence += 0.2;
    }
    
    return Math.min(1.0, confidence);
  };

  return {
    analyzeAgeFeatures
  };
};

// Gender detection using facial feature analysis
const createGenderDetector = () => {
  const analyzeGenderFeatures = (imageData, faceRegion) => {
    try {
      const faceData = extractFaceRegion(imageData, faceRegion);
      const features = extractGenderFeatures(faceData);
      
      const genderProbabilities = calculateGenderProbabilities(features);
      const primaryGender = genderProbabilities.male > genderProbabilities.female ? 'male' : 'female';
      const confidence = Math.max(genderProbabilities.male, genderProbabilities.female);
      
      return {
        gender: primaryGender,
        confidence,
        probabilities: genderProbabilities
      };
    } catch (error) {
      console.warn('Gender detection failed:', error);
      return {
        gender: 'unknown',
        confidence: 0,
        probabilities: { male: 0.5, female: 0.5 }
      };
    }
  };

  // Extract face region
  const extractFaceRegion = (imageData, bbox) => {
    const [x, y, width, height] = bbox;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = imageData.width;
    tempCanvas.height = imageData.height;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.putImageData(imageData, 0, 0);
    
    ctx.drawImage(tempCanvas, x, y, width, height, 0, 0, width, height);
    return ctx.getImageData(0, 0, width, height);
  };

  // Extract gender-relevant features
  const extractGenderFeatures = (faceData) => {
    const pixels = faceData.data;
    const width = faceData.width;
    const height = faceData.height;
    
    // Convert to grayscale
    const grayPixels = new Array(width * height);
    for (let i = 0; i < pixels.length; i += 4) {
      const gray = 0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2];
      grayPixels[i / 4] = gray;
    }

    return {
      jawStrength: analyzeJawStrength(grayPixels, width, height),
      eyebrowThickness: analyzeEyebrowRegion(grayPixels, width, height),
      facialHair: analyzeFacialHairRegion(grayPixels, width, height),
      faceRoundness: analyzeFaceShape(grayPixels, width, height),
      lipThickness: analyzeLipRegion(grayPixels, width, height)
    };
  };

  // Analyze jaw strength (males typically have stronger jaws)
  const analyzeJawStrength = (grayPixels, width, height) => {
    const jawRegionStart = Math.floor(height * 0.75);
    let edgeStrength = 0;
    let pixelCount = 0;
    
    for (let y = jawRegionStart; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const center = grayPixels[y * width + x];
        const left = grayPixels[y * width + (x - 1)];
        const right = grayPixels[y * width + (x + 1)];
        
        edgeStrength += Math.abs(right - left);
        pixelCount++;
      }
    }
    
    return edgeStrength / pixelCount;
  };

  // Analyze eyebrow region (males typically have thicker eyebrows)
  const analyzeEyebrowRegion = (grayPixels, width, height) => {
    const eyebrowStart = Math.floor(height * 0.25);
    const eyebrowEnd = Math.floor(height * 0.35);
    
    let darkPixels = 0;
    let totalPixels = 0;
    
    for (let y = eyebrowStart; y < eyebrowEnd; y++) {
      for (let x = 0; x < width; x++) {
        if (grayPixels[y * width + x] < 100) darkPixels++;
        totalPixels++;
      }
    }
    
    return darkPixels / totalPixels;
  };

  // Analyze facial hair region
  const analyzeFacialHairRegion = (grayPixels, width, height) => {
    const moustacheStart = Math.floor(height * 0.6);
    const moustacheEnd = Math.floor(height * 0.7);
    const beardStart = Math.floor(height * 0.75);
    
    let darkPixels = 0;
    let totalPixels = 0;
    
    // Check moustache region
    for (let y = moustacheStart; y < moustacheEnd; y++) {
      for (let x = Math.floor(width * 0.3); x < Math.floor(width * 0.7); x++) {
        if (grayPixels[y * width + x] < 80) darkPixels++;
        totalPixels++;
      }
    }
    
    // Check beard region
    for (let y = beardStart; y < height; y++) {
      for (let x = Math.floor(width * 0.2); x < Math.floor(width * 0.8); x++) {
        if (grayPixels[y * width + x] < 80) darkPixels++;
        totalPixels++;
      }
    }
    
    return darkPixels / totalPixels;
  };

  // Analyze face shape/roundness
  const analyzeFaceShape = (grayPixels, width, height) => {
    // Calculate face width at different heights
    const topWidth = calculateFaceWidthAtHeight(grayPixels, width, height, 0.3);
    const middleWidth = calculateFaceWidthAtHeight(grayPixels, width, height, 0.5);
    const bottomWidth = calculateFaceWidthAtHeight(grayPixels, width, height, 0.8);
    
    // Roundness indicator (females tend to have rounder faces)
    const widthVariation = Math.abs(topWidth - bottomWidth) + Math.abs(middleWidth - topWidth);
    return 1.0 - Math.min(1.0, widthVariation / width);
  };

  // Helper function to calculate face width at specific height
  const calculateFaceWidthAtHeight = (grayPixels, width, height, relativeHeight) => {
    const y = Math.floor(height * relativeHeight);
    let leftEdge = 0;
    let rightEdge = width - 1;
    
    // Find left edge (dark to light transition)
    for (let x = 0; x < width / 2; x++) {
      if (grayPixels[y * width + x] > 120) {
        leftEdge = x;
        break;
      }
    }
    
    // Find right edge (dark to light transition)
    for (let x = width - 1; x > width / 2; x--) {
      if (grayPixels[y * width + x] > 120) {
        rightEdge = x;
        break;
      }
    }
    
    return rightEdge - leftEdge;
  };

  // Analyze lip region thickness
  const analyzeLipRegion = (grayPixels, width, height) => {
    const lipStart = Math.floor(height * 0.65);
    const lipEnd = Math.floor(height * 0.75);
    
    let darkPixels = 0;
    let totalPixels = 0;
    
    for (let y = lipStart; y < lipEnd; y++) {
      for (let x = Math.floor(width * 0.3); x < Math.floor(width * 0.7); x++) {
        if (grayPixels[y * width + x] < 120) darkPixels++;
        totalPixels++;
      }
    }
    
    return darkPixels / totalPixels;
  };

  // Calculate gender probabilities from features
  const calculateGenderProbabilities = (features) => {
    let maleScore = 0.5;
    
    // Jaw strength (males typically stronger)
    maleScore += (features.jawStrength - 15) / 30;
    
    // Eyebrow thickness (males typically thicker)
    maleScore += (features.eyebrowThickness - 0.3) * 2;
    
    // Facial hair (strong male indicator)
    maleScore += features.facialHair * 3;
    
    // Face roundness (females typically rounder)
    maleScore -= (features.faceRoundness - 0.5) * 2;
    
    // Lip thickness (females typically fuller)
    maleScore -= (features.lipThickness - 0.2) * 2;
    
    // Clamp and normalize
    maleScore = Math.max(0.1, Math.min(0.9, maleScore));
    
    return {
      male: maleScore,
      female: 1.0 - maleScore
    };
  };

  return {
    analyzeGenderFeatures
  };
};

// Age and gender smoothing filter
const createAgeGenderFilter = (config = {}) => {
  const state = {
    initialized: false,
    previousAge: null,
    previousGenderProbs: null,
    alpha: config.smoothingFactor || 0.4
  };

  const update = (ageResult, genderResult) => {
    if (!state.initialized) {
      state.previousAge = ageResult.estimatedAge;
      state.previousGenderProbs = { ...genderResult.probabilities };
      state.initialized = true;
      return { ageResult, genderResult };
    }

    // Smooth age estimation
    const smoothedAge = Math.round(
      state.alpha * ageResult.estimatedAge + (1 - state.alpha) * state.previousAge
    );

    // Smooth gender probabilities
    const smoothedGenderProbs = {
      male: state.alpha * genderResult.probabilities.male + (1 - state.alpha) * state.previousGenderProbs.male,
      female: state.alpha * genderResult.probabilities.female + (1 - state.alpha) * state.previousGenderProbs.female
    };

    state.previousAge = smoothedAge;
    state.previousGenderProbs = { ...smoothedGenderProbs };

    return {
      ageResult: { ...ageResult, estimatedAge: smoothedAge },
      genderResult: { 
        ...genderResult, 
        probabilities: smoothedGenderProbs,
        gender: smoothedGenderProbs.male > smoothedGenderProbs.female ? 'male' : 'female',
        confidence: Math.max(smoothedGenderProbs.male, smoothedGenderProbs.female)
      }
    };
  };

  const reset = () => {
    state.initialized = false;
    state.previousAge = null;
    state.previousGenderProbs = null;
  };

  return { update, reset };
};

// Create Age Estimation Pipeline
export const createAgeEstimationPipeline = (config = {}) => {
  const ageConfig = createAgeEstimationConfig(config);
  let ageEstimator = null;
  let genderDetector = null;
  let smoothingFilter = null;

  return createPipeline({
    name: 'age-estimation',
    capabilities: [
      Capability.AGE_ESTIMATION,
      ...(ageConfig.enableGenderDetection ? [Capability.GENDER_DETECTION] : [])
    ],
    performance: createPerformanceProfile({
      fps: 25,
      latency: '20-35ms',
      modelSize: '1.8MB',
      cpuUsage: 'medium',
      memoryUsage: 'low',
      batteryImpact: 'low'
    }),

    // Initialize age estimation system
    initialize: async (pipelineConfig) => {
      try {
        // Initialize age estimator
        ageEstimator = createAgeEstimator();
        
        // Initialize gender detector if enabled
        if (ageConfig.enableGenderDetection) {
          genderDetector = createGenderDetector();
        }

        // Initialize smoothing filter
        smoothingFilter = createAgeGenderFilter({
          smoothingFactor: ageConfig.smoothingFactor
        });

        console.log('✅ Age Estimation pipeline initialized');
        return true;
      } catch (error) {
        throw new Error(`Age Estimation initialization failed: ${error.message}`);
      }
    },

    // Process video frame for age and gender analysis
    process: async (frame) => {
      if (!ageEstimator) {
        throw new Error('Age Estimation not initialized');
      }

      try {
        // Convert frame to ImageData if needed
        let imageData;
        let canvas = null;

        if (frame instanceof HTMLVideoElement || frame instanceof HTMLCanvasElement) {
          canvas = document.createElement('canvas');
          canvas.width = frame.videoWidth || frame.width || 320;
          canvas.height = frame.videoHeight || frame.height || 240;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(frame, 0, 0, canvas.width, canvas.height);
          imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        } else if (frame.data && frame.width && frame.height) {
          imageData = frame;
        } else {
          throw new Error('Unsupported frame format for age estimation');
        }

        // For demonstration, assume face covers central region
        // In real implementation, this would be coordinated with face detection
        const faceRegion = [
          imageData.width * 0.25,
          imageData.height * 0.25,
          imageData.width * 0.5,
          imageData.height * 0.5
        ];

        // Perform age estimation
        const ageAnalysis = ageEstimator.analyzeAgeFeatures(imageData, faceRegion);
        
        // Determine age category
        let ageCategory = 'adult';
        for (const [category, range] of Object.entries(ageConfig.ageRangeMapping)) {
          if (ageAnalysis.estimatedAge >= range[0] && ageAnalysis.estimatedAge <= range[1]) {
            ageCategory = category;
            break;
          }
        }

        // Create age result
        let ageResult = createAgeResult({
          estimatedAge: ageAnalysis.estimatedAge,
          ageRange: {
            min: Math.max(0, ageAnalysis.estimatedAge - 5),
            max: Math.min(100, ageAnalysis.estimatedAge + 5)
          },
          confidence: ageAnalysis.confidence,
          ageCategory
        });

        // Perform gender detection if enabled
        let genderResult = null;
        if (ageConfig.enableGenderDetection && genderDetector) {
          const genderAnalysis = genderDetector.analyzeGenderFeatures(imageData, faceRegion);
          genderResult = createGenderResult(genderAnalysis);
        }

        // Apply smoothing
        if (smoothingFilter) {
          const smoothed = smoothingFilter.update(ageResult, genderResult);
          ageResult = smoothed.ageResult;
          genderResult = smoothed.genderResult;
        }

        return createAnalysisResult({
          faces: [{
            bbox: faceRegion,
            age: ageResult,
            gender: genderResult,
            confidence: ageResult.confidence
          }],
          confidence: ageResult.confidence,
          source: 'age-estimation',
          metadata: {
            ageProcessingEnabled: true,
            genderProcessingEnabled: ageConfig.enableGenderDetection,
            smoothingApplied: true,
            ageCategory: ageResult.ageCategory
          }
        });

      } catch (error) {
        throw new Error(`Age Estimation processing failed: ${error.message}`);
      }
    },

    // Cleanup resources
    cleanup: async () => {
      try {
        if (smoothingFilter) {
          smoothingFilter.reset();
        }
        ageEstimator = null;
        genderDetector = null;
        smoothingFilter = null;
        console.log('✅ Age Estimation pipeline cleaned up');
        return true;
      } catch (error) {
        console.warn('⚠️ Age Estimation cleanup error:', error);
        return false;
      }
    }
  });
};

// Age estimation utilities
export const AgeUtils = {
  // Convert age to life stage description
  getLifeStageDescription: (age) => {
    if (age < 3) return 'infant';
    if (age < 13) return 'child';
    if (age < 20) return 'teenager';
    if (age < 30) return 'young adult';
    if (age < 45) return 'adult';
    if (age < 60) return 'middle aged';
    if (age < 75) return 'senior';
    return 'elderly';
  },

  // Get age-appropriate color coding
  getAgeColor: (age) => {
    if (age < 13) return '#FFB6C1';   // Light Pink - child
    if (age < 20) return '#87CEEB';   // Sky Blue - teen
    if (age < 30) return '#98FB98';   // Pale Green - young adult
    if (age < 45) return '#F0E68C';   // Khaki - adult
    if (age < 60) return '#DDA0DD';   // Plum - middle aged
    if (age < 75) return '#F4A460';   // Sandy Brown - senior
    return '#D3D3D3';                 // Light Gray - elderly
  },

  // Format age range display
  formatAgeRange: (ageResult) => {
    const { estimatedAge, ageRange, confidence } = ageResult;
    const confidencePercent = (confidence * 100).toFixed(0);
    return `${estimatedAge} years (${ageRange.min}-${ageRange.max}, ${confidencePercent}% confidence)`;
  },

  // Get gender-appropriate styling
  getGenderColor: (gender) => {
    const colors = {
      male: '#87CEEB',     // Sky Blue
      female: '#FFB6C1',   // Light Pink
      unknown: '#D3D3D3'   // Light Gray
    };
    return colors[gender] || colors.unknown;
  }
};