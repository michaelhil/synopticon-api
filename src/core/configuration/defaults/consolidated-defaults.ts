/**
 * Consolidated Configuration Defaults
 * Centralized defaults from all scattered configuration files
 */

import type { ConsolidatedSynopticonConfig } from '../schema/extended-config-types.js';

/**
 * Base pipeline configuration defaults (migrated from core/pipeline/pipeline-config.js)
 */
export const BASE_PIPELINE_DEFAULTS = {
  confidenceThreshold: 0.5,
  smoothingFactor: 0.3,
  enableAdvancedFeatures: true,
  debug: false,
  maxRetries: 3,
  timeout: 5000,
  enablePerformanceMetrics: true
};

/**
 * Pipeline type-specific configuration defaults (migrated from core/pipeline/pipeline-config.js)
 */
export const PIPELINE_TYPE_DEFAULTS = {
  ageEstimation: {
    inputSize: [64, 64] as [number, number],
    enableGenderDetection: true,
    ageRangeMapping: {
      child: [0, 12] as [number, number],
      teen: [13, 19] as [number, number],
      adult: [20, 64] as [number, number],
      senior: [65, 100] as [number, number]
    },
    modelUrl: null,
    batchSize: 1
  },
  
  emotionAnalysis: {
    inputSize: [48, 48] as [number, number],
    enableValenceArousal: true,
    modelUrl: 'https://cdn.jsdelivr.net/gh/oarriaga/face_classification/trained_models/emotion_models/fer2013_mini_XCEPTION.102-0.66.hdf5',
    batchSize: 1,
    emotionLabels: ['angry', 'disgusted', 'fearful', 'happy', 'sad', 'surprised', 'neutral'],
    enableWebGL: true
  },
  
  mediapipeFaceMesh: {
    maxNumFaces: 1,
    refineLandmarks: true,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5,
    selfieMode: false,
    enableIris: false,
    staticImageMode: false,
    enable6DOF: true
  },
  
  mediapipeFace: {
    modelSelection: 0,
    minDetectionConfidence: 0.5,
    maxFaces: 1,
    staticImageMode: false,
    enablePoseEstimation: true
  },
  
  irisTracking: {
    maxNumFaces: 1,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5,
    refineLandmarks: true,
    enableGazeEstimation: true,
    smoothingFactor: 0.7,
    enablePupilDilation: false,
    gazeCalibrationPoints: 9
  }
};

/**
 * Audio configuration defaults (migrated from various audio config files)
 */
export const AUDIO_DEFAULTS = {
  agc: {
    targetLevel: -12,
    maxGain: 30,
    minGain: -10,
    attackTime: 0.003,
    releaseTime: 0.1,
    sampleRate: 44100,
    lookAheadTime: 0.005
  },
  
  vad: {
    energyThreshold: 0.01,
    energyWeight: 0.5,
    zcrWeight: 0.2,
    entropyWeight: 0.3,
    spectralRolloffThreshold: 0.85,
    zeroCrossingRateThreshold: 0.3,
    frameSize: 1024,
    hopSize: 512,
    smoothingWindow: 5,
    hangoverFrames: 3,
    enableConsensus: true,
    consensusThreshold: 0.6,
    enableSmoothing: true,
    smoothingFactor: 0.3
  },
  
  noiseReduction: {
    enableSpectralSubtraction: true,
    enableWienerFilter: false,
    enableFFTFiltering: true,
    spectralFloor: 0.01,
    overSubtractionFactor: 2.0,
    windowType: 'hanning' as const,
    windowSize: 1024,
    hopSize: 512,
    enableAdaptive: true
  },
  
  emotion: {
    modelUrl: 'https://models.example.com/speech-emotion.onnx',
    confidenceThreshold: 0.6,
    smoothingFactor: 0.4,
    enableRealtime: true,
    emotionLabels: ['neutral', 'happy', 'sad', 'angry', 'fearful', 'disgusted', 'surprised'],
    enableValenceArousal: true,
    windowSize: 2048,
    hopSize: 1024
  },
  
  preprocessing: {
    enableNormalization: true,
    enableHighpass: true,
    enableLowpass: false,
    highpassCutoff: 80,
    lowpassCutoff: 8000,
    enableDCRemoval: true,
    enablePreemphasis: true,
    preemphasisCoeff: 0.97
  }
};

/**
 * Speech analysis configuration defaults
 */
export const SPEECH_ANALYSIS_DEFAULTS = {
  audio: AUDIO_DEFAULTS,
  
  llm: {
    provider: 'openai' as const,
    modelName: 'gpt-3.5-turbo',
    maxTokens: 1000,
    temperature: 0.3,
    topP: 1.0,
    enableCaching: true,
    cacheSize: 100,
    timeout: 30000,
    retryAttempts: 3,
    enableMetrics: true
  },
  
  recognition: {
    backend: 'web-speech' as const,
    language: 'en-US',
    continuous: true,
    interimResults: true,
    maxAlternatives: 1,
    confidenceThreshold: 0.7,
    enableNoiseSuppression: true,
    enableEchoCancellation: true
  },
  
  // Speech analysis specific settings (migrated from speech-analysis-config.ts)
  analysis: {
    prompts: [
      'Analyse sentiment, show as 5 keywords, nothing else.',
      'Identify most controversial statement and respond with a counterargument.',
      'Extract key themes and topics mentioned.',
      'Assess emotional tone and intensity level.'
    ],
    systemPrompt: 'You are a helpful AI assistant analyzing speech from conversations. Always consider both the provided conversation context AND the current speech segment in your analysis. Keep all responses to 25 words or less.',
    preferredBackend: 'webllm',
    fallbackBackends: ['transformers_js', 'tfjs_models', 'mock'],
    contextStrategy: 'hybrid',
    maxChunks: 10,
    summaryThreshold: 20,
    autoStart: false,
    autoAnalyze: true,
    enableSync: true,
    maxConcurrency: 2,
    requestTimeout: 30000,
    useFallback: false,
    mockMode: false
  },
  
  analytics: {
    enableTopicAnalysis: true,
    enableSentimentAnalysis: true,
    enableInteractionMetrics: true,
    enableQualityAssessment: true,
    windowSize: 5000,
    hopSize: 2500,
    enableRealtime: true
  }
};

/**
 * Rate limiting configuration defaults (migrated from rate-limiting-config.js)
 */
export const RATE_LIMIT_DEFAULTS = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 100,
  algorithm: 'sliding-window' as const,
  keyGenerator: (req: any) => req.headers.get('x-forwarded-for') || 'anonymous',
  skipSuccessfulRequests: false,
  skipFailedRequests: false,
  skipList: [] as string[],
  message: 'Too Many Requests',
  statusCode: 429,
  headers: true,
  enableVariableWindow: false,
  burstAllowance: 0.1,
  routeLimits: new Map(),
  enableMonitoring: true,
  logViolations: true
};

/**
 * Resource pool configuration defaults
 */
export const RESOURCE_DEFAULTS = {
  memory: {
    maxPoolSize: 100,
    initialSize: 10,
    growthFactor: 1.5,
    enableAutoGrowth: true,
    enableShrinking: true,
    shrinkThreshold: 0.5,
    cleanupInterval: 30000,
    enableMetrics: true,
    arrayPools: {
      float32: {
        sizes: [256, 512, 1024, 2048, 4096],
        maxInstances: 20
      },
      uint8: {
        sizes: [256, 512, 1024, 2048, 4096],
        maxInstances: 20
      },
      uint8Clamped: {
        sizes: [256, 512, 1024, 2048, 4096],
        maxInstances: 15
      }
    },
    canvasPool: {
      maxCanvases: 10,
      maxWidth: 1920,
      maxHeight: 1080,
      enableWebGL: true
    }
  },
  
  webgl: {
    maxContexts: 4,
    maxTextures: 100,
    maxBuffers: 50,
    enableDebug: false,
    contextAttributes: {
      alpha: false,
      antialias: false,
      depth: false,
      premultipliedAlpha: false,
      preserveDrawingBuffer: false
    }
  },
  
  canvas: {
    maxCanvases: 20,
    maxWidth: 1920,
    maxHeight: 1080,
    enableImageSmoothing: true,
    imageSmoothingQuality: 'high' as const
  },
  
  garbage: {
    enableAutoCollection: true,
    collectionInterval: 60000,
    memoryThreshold: 0.8,
    forceCollectionThreshold: 0.9
  }
};

/**
 * MCP configuration defaults (migrated from services/mcp/config/mcp-config.ts)
 */
export const MCP_DEFAULTS = {
  server: {
    port: 3001,
    host: 'localhost',
    enableLogging: true,
    maxConnections: 100,
    timeout: 5000,
    synopticonApiUrl: 'http://localhost:3000',
    transport: 'stdio' as const,
    debug: false,
    retry: {
      attempts: 3,
      delay: 1000
    }
  },
  
  tools: {
    enabled: ['analyze', 'process', 'validate'],
    categories: {
      analysis: true,
      processing: true,
      validation: true,
      experimental: false
    },
    rateLimit: {
      enabled: true,
      maxRequestsPerMinute: 60
    }
  },
  
  validation: {
    enableStrictValidation: true,
    maxParameterLength: 10000,
    enableSchemaValidation: true
  },
  
  client: {
    timeout: 10000,
    retryAttempts: 3,
    enableHealthCheck: true,
    healthCheckInterval: 30000,
    client: 'claude-desktop' as const,
    deployment: 'local' as const,
    overrides: {}
  },
  
  // Additional MCP-specific constants
  ports: {
    default: 3001,
    alternatives: [3002, 3003, 3004]
  },
  
  supportedClients: {
    'claude-desktop': {
      name: 'Claude Desktop',
      configPath: '~/.config/claude/claude_desktop_config.json',
      transport: 'stdio' as const
    },
    'cursor': {
      name: 'Cursor',
      configPath: '~/.cursor/mcp_config.json',
      transport: 'stdio' as const
    },
    'continue': {
      name: 'Continue',
      configPath: '~/.continue/config.json',
      transport: 'sse' as const
    }
  }
};

/**
 * Cross-cutting defaults
 */
export const GLOBAL_DEFAULTS = {
  timeout: 10000,
  retryAttempts: 3,
  enableCaching: true,
  cacheTimeout: 300000,
  enableMetrics: true,
  enableHealthChecks: true
};

/**
 * Complete consolidated defaults factory
 */
export const createConsolidatedDefaults = (): Partial<ConsolidatedSynopticonConfig> => ({
  pipeline: {
    ...BASE_PIPELINE_DEFAULTS,
    ...PIPELINE_TYPE_DEFAULTS
  },
  
  speechAnalysis: SPEECH_ANALYSIS_DEFAULTS,
  
  resources: RESOURCE_DEFAULTS,
  
  rateLimit: RATE_LIMIT_DEFAULTS,
  
  mcp: MCP_DEFAULTS,
  
  defaults: GLOBAL_DEFAULTS
});

/**
 * Supported pipeline types (migrated from core/pipeline/pipeline-config.js)
 */
export const SUPPORTED_PIPELINE_TYPES = Object.keys(PIPELINE_TYPE_DEFAULTS);