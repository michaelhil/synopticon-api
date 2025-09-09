/**
 * Standardized Pipeline Result Types
 * Provides unified result formats across all pipeline types
 * TypeScript-native with strict type safety
 */

import { handleError, ErrorCategory, ErrorSeverity } from '../../shared/utils/error-handler';
import type { 
  FaceResult, 
  EmotionResult, 
  AgeResult, 
  GenderResult, 
  Pose3DOF, 
  EyeResult, 
  Point2D, 
  BoundingBox,
  PerformanceMetrics,
  ErrorResult
} from '../configuration/types';

// Standard result status codes
export const ResultStatus = {
  SUCCESS: 'success',
  PARTIAL: 'partial',
  FAILED: 'failed',
  TIMEOUT: 'timeout',
  UNSUPPORTED: 'unsupported'
} as const;

export type ResultStatusType = typeof ResultStatus[keyof typeof ResultStatus];

// Confidence levels for standardized interpretation
export const ConfidenceLevel = {
  VERY_HIGH: { min: 0.9, label: 'Very High' },
  HIGH: { min: 0.7, label: 'High' },
  MEDIUM: { min: 0.5, label: 'Medium' },
  LOW: { min: 0.3, label: 'Low' },
  VERY_LOW: { min: 0.0, label: 'Very Low' }
} as const;

export type ConfidenceLevelType = typeof ConfidenceLevel[keyof typeof ConfidenceLevel];

// Base result interface
export interface BaseResult {
  readonly status: ResultStatusType;
  readonly timestamp: number;
  readonly processingTime: number;
  readonly confidence: number;
  readonly confidenceLevel: ConfidenceLevelType;
  readonly version: string;
  readonly pipelineId?: string;
  readonly metadata?: Record<string, unknown>;
  readonly warnings?: ReadonlyArray<string>;
}

// Pipeline result discriminated union
export type PipelineResult<T = unknown> = 
  | (BaseResult & { readonly status: 'success'; readonly data: T })
  | (BaseResult & { readonly status: 'partial'; readonly data: Partial<T>; readonly missing: ReadonlyArray<string> })
  | (BaseResult & { readonly status: 'failed' | 'timeout' | 'unsupported'; readonly error: ErrorResult });

// Specialized result interfaces
export interface FacePipelineResult extends BaseResult {
  readonly faces: ReadonlyArray<FaceResult>;
  readonly totalFaces: number;
  readonly avgConfidence: number;
  readonly processingStats: {
    readonly detectionTime: number;
    readonly landmarkTime: number;
    readonly poseTime: number;
    readonly emotionTime: number;
  };
}

export interface EmotionPipelineResult extends BaseResult {
  readonly emotions: ReadonlyArray<EmotionResult>;
  readonly dominantEmotion: EmotionResult;
  readonly emotionDistribution: Record<string, number>;
}

export interface AgePipelineResult extends BaseResult {
  readonly ageEstimations: ReadonlyArray<AgeResult>;
  readonly avgAge: number;
  readonly ageRange: { min: number; max: number };
}

export interface GenderPipelineResult extends BaseResult {
  readonly genderPredictions: ReadonlyArray<GenderResult>;
  readonly distribution: Record<string, number>;
}

export interface PosePipelineResult extends BaseResult {
  readonly poses: ReadonlyArray<Pose3DOF>;
  readonly avgPose: Pose3DOF;
  readonly stability: number;
}

export interface EyePipelineResult extends BaseResult {
  readonly eyes: ReadonlyArray<{ left: EyeResult; right: EyeResult }>;
  readonly gazeDirection: Point2D;
  readonly blinkRate: number;
  readonly attentionScore: number;
}

export interface LandmarkPipelineResult extends BaseResult {
  readonly landmarks: ReadonlyArray<ReadonlyArray<Point2D>>;
  readonly landmarkQuality: ReadonlyArray<number>;
  readonly normalizedLandmarks: ReadonlyArray<ReadonlyArray<Point2D>>;
}

// Validation and conversion utilities
export interface ValidationResult {
  readonly valid: boolean;
  readonly errors: ReadonlyArray<string>;
  readonly warnings: ReadonlyArray<string>;
}

export interface ConversionOptions {
  readonly format: 'json' | 'csv' | 'binary' | 'protobuf';
  readonly compress?: boolean;
  readonly precision?: number;
  readonly includeMetadata?: boolean;
}

/**
 * Gets confidence level classification
 */
export const getConfidenceLevel = (confidence: number): ConfidenceLevelType => {
  const clampedConfidence = Math.max(0, Math.min(1, confidence));
  
  if (clampedConfidence >= ConfidenceLevel.VERY_HIGH.min) return ConfidenceLevel.VERY_HIGH;
  if (clampedConfidence >= ConfidenceLevel.HIGH.min) return ConfidenceLevel.HIGH;
  if (clampedConfidence >= ConfidenceLevel.MEDIUM.min) return ConfidenceLevel.MEDIUM;
  if (clampedConfidence >= ConfidenceLevel.LOW.min) return ConfidenceLevel.LOW;
  return ConfidenceLevel.VERY_LOW;
};

/**
 * Base result factory with common properties
 */
export const createBaseResult = (data: Partial<BaseResult> = {}): BaseResult => {
  const confidence = Math.max(0, Math.min(1, data.confidence ?? 0));
  
  return {
    status: data.status ?? ResultStatus.SUCCESS,
    timestamp: data.timestamp ?? Date.now(),
    processingTime: data.processingTime ?? 0,
    confidence,
    confidenceLevel: getConfidenceLevel(confidence),
    version: data.version ?? '1.0.0',
    pipelineId: data.pipelineId,
    metadata: data.metadata ? { ...data.metadata } : undefined,
    warnings: data.warnings ? [...data.warnings] : undefined
  };
};

/**
 * Face result factory
 */
export const createFaceResult = (data: Partial<FacePipelineResult>): FacePipelineResult => {
  const baseResult = createBaseResult(data);
  const faces = data.faces ?? [];
  
  return {
    ...baseResult,
    faces,
    totalFaces: faces.length,
    avgConfidence: faces.length > 0 ? faces.reduce((sum, face) => sum + face.detection.confidence, 0) / faces.length : 0,
    processingStats: {
      detectionTime: 0,
      landmarkTime: 0,
      poseTime: 0,
      emotionTime: 0,
      ...data.processingStats
    }
  };
};

/**
 * Emotion result factory
 */
export const createEmotionResult = (data: Partial<EmotionPipelineResult>): EmotionPipelineResult => {
  const baseResult = createBaseResult(data);
  const emotions = data.emotions ?? [];
  const dominantEmotion = emotions.length > 0 
    ? emotions.reduce((max, emotion) => emotion.confidence > max.confidence ? emotion : max, emotions[0])
    : { emotion: 'neutral' as const, confidence: 0 };
    
  // Calculate emotion distribution
  const distribution: Record<string, number> = {};
  emotions.forEach(emotion => {
    distribution[emotion.emotion] = (distribution[emotion.emotion] || 0) + emotion.confidence;
  });
  
  return {
    ...baseResult,
    emotions,
    dominantEmotion,
    emotionDistribution: distribution
  };
};

/**
 * Age result factory
 */
export const createAgeResult = (data: Partial<AgePipelineResult>): AgePipelineResult => {
  const baseResult = createBaseResult(data);
  const ageEstimations = data.ageEstimations ?? [];
  
  const ages = ageEstimations.map(est => est.estimatedAge);
  const avgAge = ages.length > 0 ? ages.reduce((sum, age) => sum + age, 0) / ages.length : 0;
  const ageRange = ages.length > 0 
    ? { min: Math.min(...ages), max: Math.max(...ages) }
    : { min: 0, max: 0 };
  
  return {
    ...baseResult,
    ageEstimations,
    avgAge,
    ageRange
  };
};

/**
 * Gender result factory
 */
export const createGenderResult = (data: Partial<GenderPipelineResult>): GenderPipelineResult => {
  const baseResult = createBaseResult(data);
  const genderPredictions = data.genderPredictions ?? [];
  
  // Calculate distribution
  const distribution: Record<string, number> = {};
  genderPredictions.forEach(pred => {
    distribution[pred.gender] = (distribution[pred.gender] || 0) + pred.confidence;
  });
  
  return {
    ...baseResult,
    genderPredictions,
    distribution
  };
};

/**
 * Pose result factory
 */
export const createPoseResult = (data: Partial<PosePipelineResult>): PosePipelineResult => {
  const baseResult = createBaseResult(data);
  const poses = data.poses ?? [];
  
  // Calculate average pose
  const avgPose = poses.length > 0 
    ? poses.reduce((avg, pose) => ({
      yaw: avg.yaw + pose.yaw / poses.length,
      pitch: avg.pitch + pose.pitch / poses.length,
      roll: avg.roll + pose.roll / poses.length,
      confidence: avg.confidence + pose.confidence / poses.length,
      timestamp: Date.now()
    }), { yaw: 0, pitch: 0, roll: 0, confidence: 0, timestamp: Date.now() })
    : { yaw: 0, pitch: 0, roll: 0, confidence: 0, timestamp: Date.now() };
    
  // Calculate stability (variance from average)
  const stability = poses.length > 1
    ? 1 - (poses.reduce((variance, pose) => {
      const yawDiff = pose.yaw - avgPose.yaw;
      const pitchDiff = pose.pitch - avgPose.pitch;
      const rollDiff = pose.roll - avgPose.roll;
      return variance + (yawDiff * yawDiff + pitchDiff * pitchDiff + rollDiff * rollDiff);
    }, 0) / poses.length) / Math.PI
    : 1;
  
  return {
    ...baseResult,
    poses,
    avgPose,
    stability: Math.max(0, Math.min(1, stability))
  };
};

/**
 * Eye result factory
 */
export const createEyeResult = (data: Partial<EyePipelineResult>): EyePipelineResult => {
  const baseResult = createBaseResult(data);
  const eyes = data.eyes ?? [];
  
  // Calculate average gaze direction
  const gazeDirection = eyes.length > 0
    ? eyes.reduce((avg, eyePair) => {
      const leftGaze = eyePair.left.gazeDirection ?? { x: 0, y: 0, z: 1 };
      const rightGaze = eyePair.right.gazeDirection ?? { x: 0, y: 0, z: 1 };
      return {
        x: avg.x + (leftGaze.x + rightGaze.x) / (2 * eyes.length),
        y: avg.y + (leftGaze.y + rightGaze.y) / (2 * eyes.length)
      };
    }, { x: 0, y: 0 })
    : { x: 0, y: 0 };
    
  // Calculate blink rate and attention score
  const blinkCount = eyes.filter(eyePair => 
    eyePair.left.blinkState === 'closed' || eyePair.right.blinkState === 'closed'
  ).length;
  const blinkRate = eyes.length > 0 ? blinkCount / eyes.length : 0;
  
  const attentionScore = eyes.length > 0
    ? eyes.reduce((sum, eyePair) => sum + (eyePair.left.openness + eyePair.right.openness) / 2, 0) / eyes.length
    : 0;
  
  return {
    ...baseResult,
    eyes,
    gazeDirection,
    blinkRate,
    attentionScore
  };
};

/**
 * Landmark result factory
 */
export const createLandmarkResult = (data: Partial<LandmarkPipelineResult>): LandmarkPipelineResult => {
  const baseResult = createBaseResult(data);
  const landmarks = data.landmarks ?? [];
  
  // Calculate landmark quality scores
  const landmarkQuality = landmarks.map(landmarkSet => {
    if (landmarkSet.length === 0) return 0;
    
    // Simple quality metric based on landmark distribution
    const centroid = landmarkSet.reduce((avg, point) => ({
      x: avg.x + point.x / landmarkSet.length,
      y: avg.y + point.y / landmarkSet.length
    }), { x: 0, y: 0 });
    
    const avgDistance = landmarkSet.reduce((sum, point) => {
      const dx = point.x - centroid.x;
      const dy = point.y - centroid.y;
      return sum + Math.sqrt(dx * dx + dy * dy);
    }, 0) / landmarkSet.length;
    
    return Math.min(1, avgDistance / 100); // Normalize to [0, 1]
  });
  
  // Normalize landmarks to [0, 1] range
  const normalizedLandmarks = landmarks.map(landmarkSet => {
    if (landmarkSet.length === 0) return [];
    
    const minX = Math.min(...landmarkSet.map(p => p.x));
    const maxX = Math.max(...landmarkSet.map(p => p.x));
    const minY = Math.min(...landmarkSet.map(p => p.y));
    const maxY = Math.max(...landmarkSet.map(p => p.y));
    
    const rangeX = maxX - minX || 1;
    const rangeY = maxY - minY || 1;
    
    return landmarkSet.map(point => ({
      x: (point.x - minX) / rangeX,
      y: (point.y - minY) / rangeY
    }));
  });
  
  return {
    ...baseResult,
    landmarks,
    landmarkQuality,
    normalizedLandmarks
  };
};

/**
 * Generic analysis result factory
 */
export const createAnalysisResult = <T>(data: Partial<BaseResult> & { data?: T }): PipelineResult<T> => {
  const baseResult = createBaseResult(data);
  
  if (baseResult.status === ResultStatus.SUCCESS && data.data !== undefined) {
    return {
      ...baseResult,
      status: ResultStatus.SUCCESS,
      data: data.data
    };
  }
  
  if (baseResult.status === ResultStatus.PARTIAL && data.data !== undefined) {
    return {
      ...baseResult,
      status: ResultStatus.PARTIAL,
      data: data.data as Partial<T>,
      missing: []
    };
  }
  
  return {
    ...baseResult,
    status: baseResult.status as 'failed' | 'timeout' | 'unsupported',
    error: {
      error: true,
      message: 'Operation failed',
      code: 'PIPELINE_ERROR',
      timestamp: Date.now(),
      source: 'pipeline-results'
    }
  };
};

/**
 * Error result factory
 */
export const createErrorResult = (data: Partial<BaseResult> & { error: ErrorResult }): PipelineResult<never> => {
  const baseResult = createBaseResult({ ...data, status: ResultStatus.FAILED });
  
  return {
    ...baseResult,
    status: ResultStatus.FAILED,
    error: data.error
  };
};

/**
 * Validates result structure
 */
export const validateResult = (result: unknown): ValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  if (!result || typeof result !== 'object') {
    errors.push('Result must be an object');
    return { valid: false, errors, warnings };
  }
  
  const r = result as Record<string, unknown>;
  
  // Check required fields
  if (!r.status || !Object.values(ResultStatus).includes(r.status as ResultStatusType)) {
    errors.push('Invalid or missing status');
  }
  
  if (typeof r.timestamp !== 'number') {
    errors.push('Invalid or missing timestamp');
  }
  
  if (typeof r.confidence !== 'number' || r.confidence < 0 || r.confidence > 1) {
    errors.push('Invalid confidence value (must be 0-1)');
  }
  
  if (typeof r.processingTime !== 'number' || r.processingTime < 0) {
    errors.push('Invalid processing time');
  }
  
  // Warnings for optional fields
  if (r.confidence !== undefined && typeof r.confidence === 'number' && r.confidence < 0.3) {
    warnings.push('Low confidence result');
  }
  
  if (r.processingTime !== undefined && typeof r.processingTime === 'number' && r.processingTime > 1000) {
    warnings.push('High processing time detected');
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
};

/**
 * Merges multiple results into a single result
 */
export const mergeResults = <T>(
  results: ReadonlyArray<PipelineResult<T>>, 
  options: { strategy?: 'combine' | 'average' | 'best' } = {}
): PipelineResult<T[]> => {
  const strategy = options.strategy ?? 'combine';
  
  if (results.length === 0) {
    return createAnalysisResult({ data: [] });
  }
  
  const successResults = results.filter(r => r.status === ResultStatus.SUCCESS) as Array<BaseResult & { status: 'success'; data: T }>;
  
  if (successResults.length === 0) {
    const firstError = results.find(r => r.status !== ResultStatus.SUCCESS);
    return createErrorResult({
      error: {
        error: true,
        message: 'All results failed',
        code: 'MERGE_FAILED',
        timestamp: Date.now(),
        source: 'merge-results'
      }
    });
  }
  
  let mergedData: T[];
  let mergedConfidence: number;
  
  switch (strategy) {
  case 'average':
    mergedData = [successResults[0].data]; // Simplified for typing
    mergedConfidence = successResults.reduce((sum, r) => sum + r.confidence, 0) / successResults.length;
    break;
      
  case 'best':
    const bestResult = successResults.reduce((best, current) => 
      current.confidence > best.confidence ? current : best
    );
    mergedData = [bestResult.data];
    mergedConfidence = bestResult.confidence;
    break;
      
  case 'combine':
  default:
    mergedData = successResults.map(r => r.data);
    mergedConfidence = Math.max(...successResults.map(r => r.confidence));
    break;
  }
  
  const mergedProcessingTime = successResults.reduce((sum, r) => sum + r.processingTime, 0);
  
  return createAnalysisResult({
    confidence: mergedConfidence,
    processingTime: mergedProcessingTime,
    data: mergedData
  });
};

/**
 * Converts result to specified format
 */
export const convertResult = (
  result: PipelineResult<unknown>, 
  options: ConversionOptions = { format: 'json' }
): string | Uint8Array => {
  const { format, compress = false, precision = 6, includeMetadata = true } = options;
  
  // Create a simplified version for conversion
  const convertibleResult = {
    status: result.status,
    timestamp: result.timestamp,
    processingTime: result.processingTime,
    confidence: Number(result.confidence.toFixed(precision)),
    ...(includeMetadata && { metadata: result.metadata }),
    ...('data' in result && { data: result.data }),
    ...('error' in result && { error: result.error })
  };
  
  switch (format) {
  case 'json':
    const jsonString = JSON.stringify(convertibleResult, null, compress ? 0 : 2);
    return jsonString;
      
  case 'csv':
    // Simplified CSV conversion
    const headers = Object.keys(convertibleResult).join('\n'),');
    const values = Object.values(convertibleResult).map(v => 
      typeof v === 'object' ? JSON.stringify(v) : String(v)
    ).join('\n'),');
    return `${headers}
${values}`;
      
  case 'binary':
    return new TextEncoder().encode(JSON.stringify(convertibleResult));
      
  case 'protobuf':
    // Placeholder - would need protobuf library
    return JSON.stringify(convertibleResult);
      
  default:
    throw new Error(`Unsupported format: ${format}`);
  }
};

// Type guards
export const isSuccessResult = <T>(result: PipelineResult<T>): result is BaseResult & { status: 'success'; data: T } => {
  return result.status === ResultStatus.SUCCESS;
};

export const isErrorResult = <T>(result: PipelineResult<T>): result is BaseResult & { status: 'failed' | 'timeout' | 'unsupported'; error: ErrorResult } => {
  return result.status === ResultStatus.FAILED || result.status === ResultStatus.TIMEOUT || result.status === ResultStatus.UNSUPPORTED;
};

export const isPartialResult = <T>(result: PipelineResult<T>): result is BaseResult & { status: 'partial'; data: Partial<T>; missing: ReadonlyArray<string> } => {
  return result.status === ResultStatus.PARTIAL;
};

// Default export with all factories
export default {
  ResultStatus,
  ConfidenceLevel,
  getConfidenceLevel,
  createBaseResult,
  createFaceResult,
  createEmotionResult,
  createAgeResult,
  createGenderResult,
  createPoseResult,
  createEyeResult,
  createLandmarkResult,
  createAnalysisResult,
  createErrorResult,
  validateResult,
  mergeResults,
  convertResult,
  isSuccessResult,
  isErrorResult,
  isPartialResult
};
