/**
 * Feature Extraction Engine for Age and Gender Detection
 * Handles facial feature analysis and extraction from image data
 */

import type {
  FacialFeatures,
  GenderFeatures,
  FaceRegionData,
  createEmptyFacialFeatures,
  createEmptyGenderFeatures,
  normalizeFacialFeatures
} from './base-age-detector.js';

/**
 * Creates a feature extraction engine for facial analysis
 */
export const createFeatureExtractionEngine = () => {
  /**
   * Extract age-relevant facial features from image data
   */
  const extractAgeFeatures = (faceData: FaceRegionData): FacialFeatures => {
    if (!faceData || !faceData.data) {
      return createEmptyFacialFeatures();
    }

    const { data: pixels, width, height } = faceData;
    
    // Convert to grayscale for analysis
    const grayPixels = convertToGrayscale(pixels, width, height);
    
    const features = {
      skinTexture: analyzeSkinTexture(grayPixels, width, height),
      eyeArea: analyzeEyeRegion(grayPixels, width, height),
      facialStructure: analyzeFacialStructure(grayPixels, width, height),
      hairline: analyzeHairline(grayPixels, width, height),
      facialFatness: analyzeFacialFatness(grayPixels, width, height),
      contrast: analyzeOverallContrast(grayPixels, width, height)
    };

    return normalizeFacialFeatures(features);
  };

  /**
   * Extract gender-relevant features from image data
   */
  const extractGenderFeatures = (faceData: FaceRegionData): GenderFeatures => {
    if (!faceData || !faceData.data) {
      return createEmptyGenderFeatures();
    }

    const { data: pixels, width, height } = faceData;
    const grayPixels = convertToGrayscale(pixels, width, height);

    return {
      jawStrength: analyzeJawStrength(grayPixels, width, height),
      eyebrowThickness: analyzeEyebrowThickness(grayPixels, width, height),
      facialHair: analyzeFacialHair(grayPixels, width, height),
      faceRoundness: analyzeFaceShape(grayPixels, width, height),
      lipThickness: analyzeLipRegion(grayPixels, width, height)
    };
  };

  /**
   * Convert RGB image data to grayscale
   */
  const convertToGrayscale = (pixels: Uint8ClampedArray, width: number, height: number): number[] => {
    const grayPixels = new Array(width * height);
    for (let i = 0; i < pixels.length; i += 4) {
      // Standard luminance conversion
      const gray = 0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2];
      grayPixels[i / 4] = gray;
    }
    return grayPixels;
  };

  /**
   * Analyze skin texture (wrinkles and smoothness indicator)
   */
  const analyzeSkinTexture = (grayPixels: number[], width: number, height: number): number => {
    let textureSum = 0;
    let count = 0;

    // Sample cheek regions for skin texture analysis
    const cheekRegions = [
      { startX: Math.floor(width * 0.1), endX: Math.floor(width * 0.35), startY: Math.floor(height * 0.4), endY: Math.floor(height * 0.7) },
      { startX: Math.floor(width * 0.65), endX: Math.floor(width * 0.9), startY: Math.floor(height * 0.4), endY: Math.floor(height * 0.7) }
    ];

    for (const region of cheekRegions) {
      for (let y = region.startY; y < region.endY - 1; y++) {
        for (let x = region.startX; x < region.endX - 1; x++) {
          if (x + 1 < width && y + 1 < height) {
            // Calculate local variance as texture measure
            const current = grayPixels[y * width + x];
            const right = grayPixels[y * width + (x + 1)];
            const down = grayPixels[(y + 1) * width + x];
            
            const variance = Math.abs(current - right) + Math.abs(current - down);
            textureSum += variance;
            count++;
          }
        }
      }
    }

    return count > 0 ? textureSum / (count * 255) : 0; // Normalize by max possible variance
  };

  /**
   * Analyze eye region characteristics
   */
  const analyzeEyeRegion = (grayPixels: number[], width: number, height: number): number => {
    const eyeStartY = Math.floor(height * 0.25);
    const eyeEndY = Math.floor(height * 0.45);
    
    let darkPixels = 0;
    let totalPixels = 0;
    let averageBrightness = 0;

    // Analyze both eye regions
    const eyeRegions = [
      { startX: Math.floor(width * 0.15), endX: Math.floor(width * 0.4) },
      { startX: Math.floor(width * 0.6), endX: Math.floor(width * 0.85) }
    ];

    for (const region of eyeRegions) {
      for (let y = eyeStartY; y < eyeEndY; y++) {
        for (let x = region.startX; x < region.endX; x++) {
          const pixel = grayPixels[y * width + x];
          if (pixel < 100) darkPixels++; // Dark pixels (eyes, lashes)
          averageBrightness += pixel;
          totalPixels++;
        }
      }
    }

    // Combine darkness ratio with brightness variance
    const darknessRatio = totalPixels > 0 ? darkPixels / totalPixels : 0;
    const avgBrightness = totalPixels > 0 ? averageBrightness / totalPixels : 128;
    
    return (darknessRatio * 0.7) + ((255 - avgBrightness) / 255 * 0.3);
  };

  /**
   * Analyze facial structure (bone definition)
   */
  const analyzeFacialStructure = (grayPixels: number[], width: number, height: number): number => {
    let edgeSum = 0;
    let count = 0;

    // Apply simple edge detection on cheekbone and jaw areas
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        // Sobel operator for edge detection
        const gx = 
          -grayPixels[(y - 1) * width + (x - 1)] + grayPixels[(y - 1) * width + (x + 1)] +
          -2 * grayPixels[y * width + (x - 1)] + 2 * grayPixels[y * width + (x + 1)] +
          -grayPixels[(y + 1) * width + (x - 1)] + grayPixels[(y + 1) * width + (x + 1)];
        
        const gy = 
          -grayPixels[(y - 1) * width + (x - 1)] - 2 * grayPixels[(y - 1) * width + x] - grayPixels[(y - 1) * width + (x + 1)] +
          grayPixels[(y + 1) * width + (x - 1)] + 2 * grayPixels[(y + 1) * width + x] + grayPixels[(y + 1) * width + (x + 1)];
        
        const edgeStrength = Math.sqrt(gx * gx + gy * gy);
        edgeSum += edgeStrength;
        count++;
      }
    }

    return count > 0 ? Math.min(1, edgeSum / (count * 255)) : 0;
  };

  /**
   * Analyze hairline and hair characteristics
   */
  const analyzeHairline = (grayPixels: number[], width: number, height: number): number => {
    const topRegionHeight = Math.floor(height * 0.2);
    let darkPixels = 0;
    let totalPixels = 0;

    // Analyze top portion of face for hair/hairline
    for (let y = 0; y < topRegionHeight; y++) {
      for (let x = Math.floor(width * 0.2); x < Math.floor(width * 0.8); x++) {
        if (grayPixels[y * width + x] < 80) darkPixels++; // Dark pixels (hair)
        totalPixels++;
      }
    }

    return totalPixels > 0 ? darkPixels / totalPixels : 0;
  };

  /**
   * Analyze facial fatness/roundness
   */
  const analyzeFacialFatness = (grayPixels: number[], width: number, height: number): number => {
    // Calculate average brightness in cheek areas
    let brightnessSum = 0;
    let count = 0;

    const cheekY = Math.floor(height * 0.5);
    const cheekHeight = Math.floor(height * 0.2);

    // Left and right cheek regions
    const cheekRegions = [
      { startX: Math.floor(width * 0.1), endX: Math.floor(width * 0.35) },
      { startX: Math.floor(width * 0.65), endX: Math.floor(width * 0.9) }
    ];

    for (const region of cheekRegions) {
      for (let y = cheekY; y < cheekY + cheekHeight; y++) {
        for (let x = region.startX; x < region.endX; x++) {
          brightnessSum += grayPixels[y * width + x];
          count++;
        }
      }
    }

    const averageBrightness = count > 0 ? brightnessSum / count : 128;
    
    // Higher brightness often indicates fuller/softer facial features
    return averageBrightness / 255;
  };

  /**
   * Analyze overall facial contrast
   */
  const analyzeOverallContrast = (grayPixels: number[], width: number, height: number): number => {
    let min = 255;
    let max = 0;

    // Find min and max brightness in central face region
    const centerStartX = Math.floor(width * 0.2);
    const centerEndX = Math.floor(width * 0.8);
    const centerStartY = Math.floor(height * 0.2);
    const centerEndY = Math.floor(height * 0.8);

    for (let y = centerStartY; y < centerEndY; y++) {
      for (let x = centerStartX; x < centerEndX; x++) {
        const pixel = grayPixels[y * width + x];
        min = Math.min(min, pixel);
        max = Math.max(max, pixel);
      }
    }

    return (max - min) / 255; // Normalized contrast
  };

  /**
   * Analyze jaw strength for gender detection
   */
  const analyzeJawStrength = (grayPixels: number[], width: number, height: number): number => {
    const jawStartY = Math.floor(height * 0.7);
    let edgeSum = 0;
    let count = 0;

    // Detect edges in jaw region
    for (let y = jawStartY; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const current = grayPixels[y * width + x];
        const left = grayPixels[y * width + (x - 1)];
        const right = grayPixels[y * width + (x + 1)];
        
        const edgeStrength = Math.abs(current - left) + Math.abs(current - right);
        edgeSum += edgeStrength;
        count++;
      }
    }

    return count > 0 ? edgeSum / (count * 255) : 0;
  };

  /**
   * Analyze eyebrow thickness
   */
  const analyzeEyebrowThickness = (grayPixels: number[], width: number, height: number): number => {
    const browStartY = Math.floor(height * 0.2);
    const browEndY = Math.floor(height * 0.35);
    
    let darkPixels = 0;
    let totalPixels = 0;

    // Analyze eyebrow regions
    const browRegions = [
      { startX: Math.floor(width * 0.15), endX: Math.floor(width * 0.4) },
      { startX: Math.floor(width * 0.6), endX: Math.floor(width * 0.85) }
    ];

    for (const region of browRegions) {
      for (let y = browStartY; y < browEndY; y++) {
        for (let x = region.startX; x < region.endX; x++) {
          if (grayPixels[y * width + x] < 100) darkPixels++;
          totalPixels++;
        }
      }
    }

    return totalPixels > 0 ? darkPixels / totalPixels : 0;
  };

  /**
   * Analyze facial hair presence
   */
  const analyzeFacialHair = (grayPixels: number[], width: number, height: number): number => {
    const beardStartY = Math.floor(height * 0.75);
    let darkPixels = 0;
    let totalPixels = 0;

    // Check beard/mustache region
    for (let y = beardStartY; y < height; y++) {
      for (let x = Math.floor(width * 0.2); x < Math.floor(width * 0.8); x++) {
        if (grayPixels[y * width + x] < 80) darkPixels++;
        totalPixels++;
      }
    }

    return totalPixels > 0 ? darkPixels / totalPixels : 0;
  };

  /**
   * Analyze face shape/roundness
   */
  const analyzeFaceShape = (grayPixels: number[], width: number, height: number): number => {
    // Calculate face width at different heights
    const topWidth = calculateFaceWidthAtHeight(grayPixels, width, height, 0.3);
    const middleWidth = calculateFaceWidthAtHeight(grayPixels, width, height, 0.5);
    const bottomWidth = calculateFaceWidthAtHeight(grayPixels, width, height, 0.8);

    // Roundness indicator (less variation = rounder)
    const widthVariation = Math.abs(topWidth - bottomWidth) + Math.abs(middleWidth - topWidth);
    return Math.max(0, 1.0 - Math.min(1.0, widthVariation / width));
  };

  /**
   * Calculate face width at specific height
   */
  const calculateFaceWidthAtHeight = (grayPixels: number[], width: number, height: number, relativeHeight: number): number => {
    const y = Math.floor(height * relativeHeight);
    let leftEdge = 0;
    let rightEdge = width - 1;

    // Find left edge (background to face transition)
    for (let x = 0; x < width / 2; x++) {
      if (grayPixels[y * width + x] > 120) {
        leftEdge = x;
        break;
      }
    }

    // Find right edge (face to background transition)
    for (let x = width - 1; x > width / 2; x--) {
      if (grayPixels[y * width + x] > 120) {
        rightEdge = x;
        break;
      }
    }

    return rightEdge - leftEdge;
  };

  /**
   * Analyze lip region thickness
   */
  const analyzeLipRegion = (grayPixels: number[], width: number, height: number): number => {
    const lipStartY = Math.floor(height * 0.65);
    const lipEndY = Math.floor(height * 0.75);

    let darkPixels = 0;
    let totalPixels = 0;

    for (let y = lipStartY; y < lipEndY; y++) {
      for (let x = Math.floor(width * 0.3); x < Math.floor(width * 0.7); x++) {
        if (grayPixels[y * width + x] < 120) darkPixels++;
        totalPixels++;
      }
    }

    return totalPixels > 0 ? darkPixels / totalPixels : 0;
  };

  return {
    extractAgeFeatures,
    extractGenderFeatures,
    convertToGrayscale,
    
    // Individual feature analyzers (exposed for testing)
    analyzeSkinTexture,
    analyzeEyeRegion,
    analyzeFacialStructure,
    analyzeHairline,
    analyzeFacialFatness,
    analyzeOverallContrast,
    analyzeJawStrength,
    analyzeEyebrowThickness,
    analyzeFacialHair,
    analyzeFaceShape,
    analyzeLipRegion
  };
};

export type FeatureExtractionEngine = ReturnType<typeof createFeatureExtractionEngine>;
