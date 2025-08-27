/**
 * Age Estimation Pipeline - Main Factory
 * Modular architecture assembling feature extraction, age calculation, and smoothing
 */

import { createPipeline } from '../../../core/pipeline/pipeline.ts';
import { createPipelineConfig } from '../../../core/pipeline/pipeline-config.js';
import { createImageProcessor } from '../../../core/engine/image-processor.js';
import { getGlobalResourcePool } from '../../../core/performance/resource-pool.js';
import { 
  StreamCapability as Capability,
  createPerformanceProfile,
  createAgeResult,
  createGenderResult,
  createAnalysisResult
} from '../../../core/configuration/types.ts';
import { handleError, ErrorCategory, ErrorSeverity } from '../../../shared/utils/error-handler.js';

import {
  type BaseAgeDetector,
  type AgeDetectorConfiguration,
  type AgeResult,
  type GenderResult,
  type FaceRegionData,
  createDefaultAgeConfiguration,
  getLifeStageFromAge,
  calculateAgeRange,
  DEFAULT_AGE_RANGES
} from './base-age-detector.ts';

import {
  createFeatureExtractionEngine,
  type FeatureExtractionEngine
} from './feature-extraction-engine.ts';

import {
  createAgeCalculationEngine,
  type AgeCalculationEngine
} from './age-calculation-engine.ts';

import {
  createSmoothingFilter,
  type SmoothingFilter,
  type SmoothingResult
} from './smoothing-filter.ts';

export interface AgeEstimationPipeline extends BaseAgeDetector {
  // Pipeline methods
  initialize: () => Promise<boolean>;
  process: (input: any, options?: any) => Promise<any>;
  cleanup: () => Promise<void>;
  
  // Status methods
  getHealthStatus: () => any;
  getStats: () => any;
  getInfo: () => any;
  
  // Configuration methods
  updateConfig: (updates: any) => any;
}

/**
 * Creates a modular age estimation pipeline
 */
export const createAgeEstimationPipeline = (userConfig: Record<string, any> = {}): AgeEstimationPipeline => {
  // Use unified configuration system
  const config = createPipelineConfig('age-estimation', userConfig);
  const ageConfig = createDefaultAgeConfiguration(config);
  
  // Create modular engines
  const featureEngine = createFeatureExtractionEngine();
  const calculationEngine = createAgeCalculationEngine();
  const smoothingFilter = createSmoothingFilter({
    smoothingFactor: ageConfig.smoothingFactor,
    adaptiveSmoothing: true,
    confidenceWeighting: true
  });

  // Initialize core components
  let imageProcessor: any = null;
  let resourcePool: any = null;
  let isInitialized = false;

  /**
   * Initialize the age estimation pipeline
   */
  const initialize = async (): Promise<boolean> => {
    if (isInitialized) {
      return true;
    }

    try {
      // Initialize image processor for face extraction
      imageProcessor = createImageProcessor();
      resourcePool = getGlobalResourcePool();
      
      isInitialized = true;
      
      handleError(
        'Age estimation pipeline initialized successfully',
        ErrorCategory.INITIALIZATION,
        ErrorSeverity.INFO,
        { capabilities: getCapabilities() }
      );

      return true;

    } catch (error) {
      handleError(
        `Age estimation pipeline initialization failed: ${error instanceof Error ? error.message : String(error)}`,
        ErrorCategory.INITIALIZATION,
        ErrorSeverity.ERROR
      );
      return false;
    }
  };

  /**
   * Process input for age and gender estimation
   */
  const process = async (input: any, options: any = {}): Promise<any> => {
    if (!isInitialized) {
      throw new Error('Pipeline not initialized');
    }

    const startTime = performance.now();

    try {
      // Extract faces from input
      const faces = await extractFacesFromInput(input);
      
      if (!faces || faces.length === 0) {
        return createAnalysisResult({
          status: 'no_faces',
          results: [],
          processingTime: performance.now() - startTime,
          source: 'age-estimation'
        });
      }

      // Process each detected face
      const results = await Promise.all(
        faces.map(async (face, index) => {
          try {
            const faceRegion = extractFaceRegion(input, face.bbox);
            
            if (!faceRegion) {
              return {
                faceIndex: index,
                age: createFallbackAgeResult('Face extraction failed'),
                gender: ageConfig.enableGenderDetection 
                  ? createFallbackGenderResult('Face extraction failed')
                  : null,
                bbox: face.bbox
              };
            }

            // Analyze age and gender
            const ageResult = await analyzeAge(faceRegion, face);
            const genderResult = ageConfig.enableGenderDetection 
              ? await analyzeGender(faceRegion, face)
              : null;

            // Apply temporal smoothing if enabled
            let finalResults = { ageResult, genderResult };
            if (config.enableSmoothing && genderResult) {
              const smoothingResult = smoothingFilter.applySmoothingFilter(ageResult, genderResult);
              finalResults = {
                ageResult: smoothingResult.ageResult,
                genderResult: smoothingResult.genderResult
              };
            }

            return {
              faceIndex: index,
              age: createAgeResult(finalResults.ageResult),
              gender: finalResults.genderResult ? createGenderResult(finalResults.genderResult) : null,
              bbox: face.bbox,
              smoothingApplied: config.enableSmoothing
            };

          } catch (error) {
            handleError(
              `Face analysis failed for face ${index}: ${error instanceof Error ? error.message : String(error)}`,
              ErrorCategory.PROCESSING,
              ErrorSeverity.WARNING,
              { faceIndex: index }
            );

            return {
              faceIndex: index,
              age: createFallbackAgeResult(`Analysis failed: ${error instanceof Error ? error.message : String(error)}`),
              gender: ageConfig.enableGenderDetection 
                ? createFallbackGenderResult(`Analysis failed: ${error instanceof Error ? error.message : String(error)}`)
                : null,
              bbox: face.bbox,
              error: error instanceof Error ? error.message : String(error)
            };
          }
        })
      );

      const processingTime = performance.now() - startTime;

      return createAnalysisResult({
        status: 'success',
        results,
        processingTime,
        source: 'age-estimation',
        pipelinesUsed: ['age-estimation'],
        metadata: {
          facesDetected: faces.length,
          processingTime,
          smoothingEnabled: config.enableSmoothing,
          genderDetectionEnabled: ageConfig.enableGenderDetection
        }
      });

    } catch (error) {
      const processingTime = performance.now() - startTime;
      
      handleError(
        `Age estimation processing failed: ${error instanceof Error ? error.message : String(error)}`,
        ErrorCategory.PROCESSING,
        ErrorSeverity.ERROR
      );

      return createAnalysisResult({
        status: 'error',
        error: error instanceof Error ? error.message : String(error),
        processingTime,
        source: 'age-estimation'
      });
    }
  };

  /**
   * Analyze age from face region data
   */
  const analyzeAge = async (faceData: FaceRegionData, faceRegion?: any): Promise<AgeResult> => {
    try {
      const features = featureEngine.extractAgeFeatures(faceData);
      return calculationEngine.generateAgeResult(features);
    } catch (error) {
      return calculationEngine.createFallbackAgeResult(
        error instanceof Error ? error.message : String(error)
      );
    }
  };

  /**
   * Analyze gender from face region data
   */
  const analyzeGender = async (faceData: FaceRegionData, faceRegion?: any): Promise<GenderResult> => {
    try {
      const features = featureEngine.extractGenderFeatures(faceData);
      return calculationEngine.generateGenderResult(features);
    } catch (error) {
      return calculationEngine.createFallbackGenderResult(
        error instanceof Error ? error.message : String(error)
      );
    }
  };

  /**
   * Extract faces from input data
   */
  const extractFacesFromInput = async (input: any): Promise<any[]> => {
    // This would integrate with face detection results
    // For now, assume input has faces array or is a single face
    if (input.faces && Array.isArray(input.faces)) {
      return input.faces;
    }
    
    if (input.bbox || (input.x !== undefined && input.y !== undefined)) {
      return [{ bbox: input.bbox || input }];
    }

    // If no face info, return empty array
    return [];
  };

  /**
   * Extract face region from image data
   */
  const extractFaceRegion = (imageData: any, bbox: any): FaceRegionData | null => {
    try {
      if (!imageProcessor) {
        return null;
      }

      return imageProcessor.extractFaceRegion(imageData, bbox, {
        targetSize: ageConfig.inputSize,
        padding: 0.1
      });
    } catch (error) {
      handleError(
        `Face region extraction failed: ${error instanceof Error ? error.message : String(error)}`,
        ErrorCategory.PROCESSING,
        ErrorSeverity.WARNING
      );
      return null;
    }
  };

  /**
   * Create fallback age result
   */
  const createFallbackAgeResult = (reason: string): any => {
    const fallbackResult = calculationEngine.createFallbackAgeResult(reason);
    return createAgeResult(fallbackResult);
  };

  /**
   * Create fallback gender result
   */
  const createFallbackGenderResult = (reason: string): any => {
    const fallbackResult = calculationEngine.createFallbackGenderResult(reason);
    return createGenderResult(fallbackResult);
  };

  /**
   * Get pipeline capabilities
   */
  const getCapabilities = (): string[] => {
    const capabilities = ['age-estimation'];
    if (ageConfig.enableGenderDetection) {
      capabilities.push('gender-detection');
    }
    return capabilities;
  };

  /**
   * Cleanup pipeline resources
   */
  const cleanup = async (): Promise<void> => {
    try {
      if (smoothingFilter) {
        smoothingFilter.reset();
      }
      
      isInitialized = false;
      
      console.log('Age estimation pipeline cleaned up');
    } catch (error) {
      console.warn('Age estimation cleanup error:', error);
    }
  };

  // Create base pipeline with standard interface
  const pipeline = createPipeline({
    name: 'age-estimation',
    capabilities: [
      Capability.AGE_ESTIMATION,
      ...(ageConfig.enableGenderDetection ? [Capability.GENDER_DETECTION] : [])
    ],
    initialize,
    process,
    cleanup
  });

  // Return enhanced pipeline with age-specific methods
  return {
    ...pipeline,

    // Core age detection interface
    analyzeAge,
    analyzeGender: ageConfig.enableGenderDetection ? analyzeGender : undefined,
    getConfiguration: () => ageConfig,
    updateConfiguration: (newConfig: Partial<AgeDetectorConfiguration>) => {
      Object.assign(ageConfig, newConfig);
    },
    isInitialized: () => isInitialized,
    getCapabilities,

    // Pipeline-specific methods
    getHealthStatus: () => ({
      healthy: isInitialized,
      runtime: 'browser',
      backend: 'feature-analysis',
      modelLoaded: isInitialized,
      smoothingEnabled: !!config.enableSmoothing,
      genderDetectionEnabled: ageConfig.enableGenderDetection,
      resourcePoolAvailable: !!resourcePool
    }),

    getStats: () => ({
      runtime: 'browser',
      backend: 'feature-analysis',
      config: { ...config },
      initialized: isInitialized,
      performance: {
        fps: config.fps || 25,
        latency: config.latency || '20-35ms',
        modelSize: config.modelSize || '1.8MB',
        cpuUsage: 'medium',
        memoryUsage: 'low'
      },
      capabilities: getCapabilities(),
      smoothingStats: smoothingFilter.getStatistics()
    }),

    getInfo: () => ({
      name: 'age-estimation',
      version: '2.0.0',
      type: 'face-analysis',
      capabilities: getCapabilities(),
      performance: {
        fps: 25,
        latency: '20-35ms',
        modelSize: '1.8MB',
        cpuUsage: 'medium',
        memoryUsage: 'low',
        batteryImpact: 'low'
      },
      requirements: {
        webgl: false,
        mediaApi: false,
        hardware: 'cpu'
      }
    }),

    updateConfig: (updates: any) => {
      const newConfig = createPipelineConfig('age-estimation', { ...config, ...updates });
      Object.assign(config, newConfig);
      return config;
    }
  };
};

// Age estimation utilities
export const AgeUtils = {
  // Convert age to life stage description
  getLifeStageDescription: getLifeStageFromAge,

  // Get age-appropriate color coding
  getAgeColor: (age: number): string => {
    if (age < 13) return '#FFB6C1';   // Light Pink - child
    if (age < 20) return '#87CEEB';   // Sky Blue - teen
    if (age < 30) return '#98FB98';   // Pale Green - young adult
    if (age < 45) return '#F0E68C';   // Khaki - adult
    if (age < 60) return '#DDA0DD';   // Plum - middle aged
    if (age < 75) return '#F4A460';   // Sandy Brown - senior
    return '#D3D3D3';                 // Light Gray - elderly
  },

  // Format age range display
  formatAgeRange: (ageResult: any): string => {
    const { estimatedAge, ageRange, confidence } = ageResult;
    const confidencePercent = (confidence * 100).toFixed(0);
    return `${estimatedAge} years (${ageRange.min}-${ageRange.max}, ${confidencePercent}% confidence)`;
  },

  // Get gender-appropriate styling
  getGenderColor: (gender: string): string => {
    const colors = {
      male: '#87CEEB',     // Sky Blue
      female: '#FFB6C1',   // Light Pink
      unknown: '#D3D3D3'   // Light Gray
    };
    return colors[gender as keyof typeof colors] || colors.unknown;
  },

  // Age range mappings
  getAgeRanges: () => DEFAULT_AGE_RANGES
};

// Re-export types and utilities
export {
  type BaseAgeDetector,
  type AgeDetectorConfiguration,
  type AgeResult,
  type GenderResult,
  type FaceRegionData,
  type FeatureExtractionEngine,
  type AgeCalculationEngine,
  type SmoothingFilter,
  createDefaultAgeConfiguration,
  DEFAULT_AGE_RANGES
};

// Default export
