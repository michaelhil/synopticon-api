/**
 * @fileoverview TypeScript type definitions for centralized configuration system
 * Comprehensive type definitions for all configuration options
 */

/**
 * Environment types
 */
export type EnvironmentType = 'development' | 'staging' | 'production';

/**
 * Logging configuration
 */
export interface LoggingConfig {
  level: 'error' | 'warn' | 'info' | 'debug' | 'verbose';
  enableConsole: boolean;
  enableFile: boolean;
  maxFileSize: string;
  maxFiles: number;
}

/**
 * Server configuration
 */
export interface ServerConfig {
  port: number;
  host: string;
  enableHttps: boolean;
  cors: {
    enabled: boolean;
    origins: string[];
    credentials: boolean;
  };
  rateLimit: {
    enabled: boolean;
    maxRequests: number;
    windowMs: number;
    skipSuccessfulRequests: boolean;
  };
  compression: boolean;
  helmet: boolean;
}

/**
 * Feature-specific configurations
 */
export interface FaceAnalysisConfig {
  enabled: boolean;
  confidenceThreshold: number;
  maxFaces: number;
  realTimeProcessing: boolean;
  enableLandmarks: boolean;
}

export interface EyeTrackingConfig {
  enabled: boolean;
  devices: string[];
  calibrationRequired: boolean;
  gazeSmoothing: boolean;
  confidenceThreshold: number;
}

export interface EmotionAnalysisConfig {
  enabled: boolean;
  models: string[];
  realTime: boolean;
}

export interface MediaStreamingConfig {
  enabled: boolean;
  webrtc: boolean;
  websocket: boolean;
  maxStreams: number;
  bitrateLimit: number;
}

export interface DistributionConfig {
  enabled: boolean;
  protocols: string[];
  buffering: boolean;
  compression: boolean;
}

/**
 * Features configuration container
 */
export interface FeaturesConfig {
  faceAnalysis: FaceAnalysisConfig;
  eyeTracking: EyeTrackingConfig;
  emotionAnalysis: EmotionAnalysisConfig;
  mediaStreaming: MediaStreamingConfig;
  distribution: DistributionConfig;
}

/**
 * Security configuration
 */
export interface SecurityConfig {
  enableAuth: boolean;
  sessionTimeout: number;
  maxLoginAttempts: number;
  enableCsrf: boolean;
  contentSecurityPolicy: boolean;
}

/**
 * Performance configuration
 */
export interface PerformanceConfig {
  enableCaching: boolean;
  cacheMaxAge: number;
  maxConcurrentRequests: number;
  requestTimeout: number;
  enableGzipCompression: boolean;
}

/**
 * Environment configuration
 */
export interface EnvironmentConfig {
  type: EnvironmentType;
  debug: boolean;
  telemetryEnabled: boolean;
  metricsEnabled: boolean;
}

/**
 * Main configuration interface
 */
export interface SynopticonConfig {
  server: ServerConfig;
  features: FeaturesConfig;
  logging: LoggingConfig;
  security: SecurityConfig;
  performance: PerformanceConfig;
  environment: EnvironmentConfig;
}

/**
 * Configuration options for factory function
 */
export interface ConfigurationOptions {
  environment?: EnvironmentType;
  overrides?: Partial<SynopticonConfig>;
  validate?: boolean;
  strict?: boolean;
}

/**
 * Configuration validation result
 */
export interface ConfigValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Configuration change event
 */
export interface ConfigChangeEvent {
  path: string;
  oldValue: unknown;
  newValue: unknown;
  timestamp: number;
}

/**
 * Configuration metadata
 */
export interface ConfigMetadata {
  version: string;
  lastUpdated: number;
  source: string;
  environment: EnvironmentType;
}
