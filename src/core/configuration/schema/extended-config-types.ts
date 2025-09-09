/**
 * Extended Configuration Types for Consolidated System
 * Includes all operational settings from scattered configuration files
 */

// Import base types
import type { 
  EnvironmentType, 
  LoggingConfig, 
  ServerConfig,
  FaceAnalysisConfig,
  EyeTrackingConfig,
  EmotionAnalysisConfig,
  MediaStreamingConfig,
  DistributionConfig,
  SecurityConfig,
  PerformanceConfig
} from './config-types.js';

// Pipeline-specific configuration types
export interface PipelineConfig {
  // Base pipeline settings
  confidenceThreshold: number;
  smoothingFactor: number;
  enableAdvancedFeatures: boolean;
  debug: boolean;
  maxRetries: number;
  timeout: number;
  enablePerformanceMetrics: boolean;
  
  // Type-specific configurations
  ageEstimation: {
    inputSize: [number, number];
    enableGenderDetection: boolean;
    ageRangeMapping: {
      child: [number, number];
      teen: [number, number]; 
      adult: [number, number];
      senior: [number, number];
    };
    modelUrl: string | null;
    batchSize: number;
  };
  
  emotionAnalysis: {
    inputSize: [number, number];
    enableValenceArousal: boolean;
    modelUrl: string;
    batchSize: number;
    emotionLabels: string[];
    enableWebGL: boolean;
  };
  
  mediapipeFaceMesh: {
    maxNumFaces: number;
    refineLandmarks: boolean;
    minDetectionConfidence: number;
    minTrackingConfidence: number;
    selfieMode: boolean;
    enableIris: boolean;
    staticImageMode: boolean;
    enable6DOF: boolean;
  };
  
  mediapipeFace: {
    modelSelection: number;
    minDetectionConfidence: number;
    maxFaces: number;
    staticImageMode: boolean;
    enablePoseEstimation: boolean;
  };
  
  irisTracking: {
    maxNumFaces: number;
    minDetectionConfidence: number;
    minTrackingConfidence: number;
    refineLandmarks: boolean;
    enableGazeEstimation: boolean;
    smoothingFactor: number;
    enablePupilDilation: boolean;
    gazeCalibrationPoints: number;
  };
}

// Audio processing configuration types
export interface AudioConfig {
  // AGC (Automatic Gain Control)
  agc: {
    targetLevel: number; // dB
    maxGain: number; // dB
    minGain: number; // dB
    attackTime: number; // seconds
    releaseTime: number; // seconds
    sampleRate: number;
    lookAheadTime: number; // seconds
  };
  
  // Voice Activity Detection
  vad: {
    energyThreshold: number;
    spectralRolloffThreshold: number;
    zeroCrossingRateThreshold: number;
    frameSize: number;
    hopSize: number;
    smoothingWindow: number;
    enableConsensus: boolean;
    consensusThreshold: number;
    enableSmoothing: boolean;
    smoothingFactor: number;
  };
  
  // Noise Reduction
  noiseReduction: {
    enableSpectralSubtraction: boolean;
    enableWienerFilter: boolean;
    enableFFTFiltering: boolean;
    spectralFloor: number;
    overSubtractionFactor: number;
    windowType: 'hanning' | 'hamming' | 'blackman';
    windowSize: number;
    hopSize: number;
    enableAdaptive: boolean;
  };
  
  // Emotion Detection
  emotion: {
    modelUrl: string;
    confidenceThreshold: number;
    smoothingFactor: number;
    enableRealtime: boolean;
    emotionLabels: string[];
    enableValenceArousal: boolean;
    windowSize: number;
    hopSize: number;
  };
  
  // Audio Preprocessing
  preprocessing: {
    enableNormalization: boolean;
    enableHighpass: boolean;
    enableLowpass: boolean;
    highpassCutoff: number;
    lowpassCutoff: number;
    enableDCRemoval: boolean;
    enablePreemphasis: boolean;
    preemphasisCoeff: number;
  };
}

// Extended Rate Limiting Configuration
export interface ExtendedRateLimitConfig {
  // Global defaults
  windowMs: number;
  maxRequests: number;
  algorithm: 'sliding-window' | 'fixed-window' | 'token-bucket';
  keyGenerator: (req: any) => string;
  
  // Skip conditions
  skipSuccessfulRequests: boolean;
  skipFailedRequests: boolean;
  skipList: string[]; // IPs to skip
  
  // Response configuration
  message: string;
  statusCode: number;
  headers: boolean;
  
  // Advanced features
  enableVariableWindow: boolean;
  burstAllowance: number; // percentage
  
  // Route-specific limits
  routeLimits: Map<string, {
    maxRequests?: number;
    windowMs?: number;
    message?: string;
    statusCode?: number;
  }>;
  
  // Monitoring
  enableMonitoring: boolean;
  logViolations: boolean;
}

// Memory Pool Configuration
export interface MemoryPoolConfig {
  maxPoolSize: number;
  initialSize: number;
  growthFactor: number;
  enableAutoGrowth: boolean;
  enableShrinking: boolean;
  shrinkThreshold: number;
  cleanupInterval: number;
  enableMetrics: boolean;
  
  // Pool-specific settings
  arrayPools: {
    float32: {
      sizes: number[];
      maxInstances: number;
    };
    uint8: {
      sizes: number[];
      maxInstances: number;
    };
    uint8Clamped: {
      sizes: number[];
      maxInstances: number;
    };
  };
  
  canvasPool: {
    maxCanvases: number;
    maxWidth: number;
    maxHeight: number;
    enableWebGL: boolean;
  };
}

// Resource Pool Configuration
export interface ResourcePoolConfig {
  memory: MemoryPoolConfig;
  
  webgl: {
    maxContexts: number;
    maxTextures: number;
    maxBuffers: number;
    enableDebug: boolean;
    contextAttributes: {
      alpha: boolean;
      antialias: boolean;
      depth: boolean;
      premultipliedAlpha: boolean;
      preserveDrawingBuffer: boolean;
    };
  };
  
  canvas: {
    maxCanvases: number;
    maxWidth: number;
    maxHeight: number;
    enableImageSmoothing: boolean;
    imageSmoothingQuality: 'low' | 'medium' | 'high';
  };
  
  garbage: {
    enableAutoCollection: boolean;
    collectionInterval: number;
    memoryThreshold: number;
    forceCollectionThreshold: number;
  };
}

// Speech Analysis Configuration
export interface SpeechAnalysisConfig {
  audio: AudioConfig;
  
  llm: {
    provider: 'openai' | 'anthropic' | 'local';
    modelName: string;
    apiKey?: string;
    baseUrl?: string;
    maxTokens: number;
    temperature: number;
    topP: number;
    enableCaching: boolean;
    cacheSize: number;
    timeout: number;
    retryAttempts: number;
    enableMetrics: boolean;
  };
  
  recognition: {
    backend: 'web-speech' | 'whisper' | 'azure';
    language: string;
    continuous: boolean;
    interimResults: boolean;
    maxAlternatives: number;
    confidenceThreshold: number;
    enableNoiseSuppression: boolean;
    enableEchoCancellation: boolean;
  };
  
  analytics: {
    enableTopicAnalysis: boolean;
    enableSentimentAnalysis: boolean;
    enableInteractionMetrics: boolean;
    enableQualityAssessment: boolean;
    windowSize: number;
    hopSize: number;
    enableRealtime: boolean;
  };
}

// Media Streaming Configuration
export interface ExtendedMediaStreamingConfig extends MediaStreamingConfig {
  quality: {
    videoCodec: 'h264' | 'vp8' | 'vp9';
    audioCodec: 'opus' | 'aac';
    videoBitrate: number;
    audioBitrate: number;
    frameRate: number;
    resolution: {
      width: number;
      height: number;
    };
  };
  
  multiDevice: {
    enabled: boolean;
    maxDevices: number;
    enableSynchronization: boolean;
    syncTolerance: number; // milliseconds
    enableLoadBalancing: boolean;
  };
  
  pipeline: {
    enableQualityControl: boolean;
    enableAdaptiveBitrate: boolean;
    enableLatencyOptimization: boolean;
    bufferSize: number;
    maxLatency: number; // milliseconds
  };
}

// MCP (Model Context Protocol) Configuration
export interface MCPConfig {
  server: {
    port: number;
    host: string;
    enableLogging: boolean;
    maxConnections: number;
    timeout: number;
  };
  
  tools: {
    enabled: string[];
    categories: Record<string, boolean>;
    rateLimit: {
      enabled: boolean;
      maxRequestsPerMinute: number;
    };
  };
  
  validation: {
    enableStrictValidation: boolean;
    maxParameterLength: number;
    enableSchemaValidation: boolean;
  };
  
  client: {
    timeout: number;
    retryAttempts: number;
    enableHealthCheck: boolean;
    healthCheckInterval: number;
  };
}

// Extended Unified Configuration Interface
export interface ConsolidatedSynopticonConfig {
  // Existing base configuration
  server: ServerConfig;
  features: {
    faceAnalysis: FaceAnalysisConfig;
    eyeTracking: EyeTrackingConfig;
    emotionAnalysis: EmotionAnalysisConfig;
    mediaStreaming: ExtendedMediaStreamingConfig;
    distribution: DistributionConfig;
  };
  logging: LoggingConfig;
  security: SecurityConfig;
  performance: PerformanceConfig;
  environment: {
    type: EnvironmentType;
    debug: boolean;
    telemetryEnabled: boolean;
    metricsEnabled: boolean;
  };
  
  // New consolidated operational settings
  pipeline: PipelineConfig;
  speechAnalysis: SpeechAnalysisConfig;
  resources: ResourcePoolConfig;
  rateLimit: ExtendedRateLimitConfig;
  mcp: MCPConfig;
  
  // Cross-cutting concerns
  defaults: {
    timeout: number;
    retryAttempts: number;
    enableCaching: boolean;
    cacheTimeout: number;
    enableMetrics: boolean;
    enableHealthChecks: boolean;
  };
}

// Configuration validation types
export interface ConfigurationValidationRule {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'enum';
  required?: boolean;
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  values?: readonly string[];
  validate?: (value: any, config?: any) => boolean | string;
}

export interface ConfigurationValidationSchema {
  [key: string]: ConfigurationValidationRule | ConfigurationValidationSchema;
}