/**
 * @fileoverview Synchronization Engine Type Definitions
 * 
 * Comprehensive type definitions for stream synchronization, temporal alignment,
 * and multi-modal data coordination with precision timing capabilities.
 * 
 * @version 1.0.0
 * @author Synopticon Development Team
 */

/**
 * Synchronization strategy types
 */
export const SynchronizationStrategy = {
  HARDWARE_TIMESTAMP: 'hardware_timestamp',
  SOFTWARE_TIMESTAMP: 'software_timestamp', 
  BUFFER_BASED: 'buffer_based',
  EVENT_DRIVEN: 'event_driven'
} as const;

export type SynchronizationStrategyType = typeof SynchronizationStrategy[keyof typeof SynchronizationStrategy];

/**
 * Stream data structure with timing information
 */
export interface StreamData {
  timestamp?: number;
  hardwareTimestamp?: number;
  streamId: string;
  data: unknown;
  metadata?: {
    frameIndex?: number;
    confidence?: number;
    quality?: number;
  };
}

/**
 * Synchronization metrics for quality assessment
 */
export interface SyncMetrics {
  quality: number;
  latency: number;
  jitter: number;
  droppedSamples: number;
  alignmentAccuracy: number;
  lastUpdate: number;
  computeOverallQuality(): number;
}

/**
 * Configuration for sync metrics creation
 */
export interface SyncMetricsConfig {
  quality?: number;
  latency?: number;
  jitter?: number;
  droppedSamples?: number;
  alignmentAccuracy?: number;
  lastUpdate?: number;
}

/**
 * Alignment result from temporal alignment algorithms
 */
export interface AlignmentResult {
  alignedTimestamp: number;
  confidence: number;
  offset: number;
  drift?: number;
  event?: SyncEvent | null;
  data?: StreamData;
}

/**
 * Synchronization event for event-driven alignment
 */
export interface SyncEvent {
  type: string;
  timestamp: number;
}

/**
 * Clock synchronization state for software timestamp alignment
 */
export interface ClockSyncState {
  offset: number;
  drift: number;
  lastSync: number;
}

/**
 * Temporal aligner interface
 */
export interface TemporalAligner {
  align(streamData: StreamData | StreamData[], referenceTimestamp?: number): AlignmentResult | AlignmentResult[];
  getQuality(alignmentResults?: Map<string, AlignmentResult> | boolean): SyncMetrics;
  strategy: SynchronizationStrategyType;
  findBestAlignment?(streamBuffers: Map<string, StreamBuffer>, targetTimestamp: number): Map<string, AlignmentResult>;
  updateClockSync?(serverTime: number, clientTime: number): void;
  registerEvent?(eventType: string, timestamp?: number): void;
}

/**
 * Stream buffer interface
 */
export interface StreamBuffer {
  add(data: StreamData): StreamData;
  getClosest(timestamp: number, tolerance: number): StreamData | null;
  getLatest(count: number): StreamData[];
  size: number;
  clear(): void;
}

/**
 * Stream information with buffer and metrics
 */
export interface StreamInfo {
  stream: DataStream;
  buffer: StreamBuffer;
  lastTimestamp: number | null;
  metrics: SyncMetrics;
}

/**
 * Generic data stream interface
 */
export interface DataStream {
  getId(): string;
  start(): Promise<void>;
  stop(): void;
  onData(callback: (data: StreamData) => void): () => void;
}

/**
 * Synchronization engine configuration
 */
export interface SynchronizationEngineConfig {
  strategy?: SynchronizationStrategyType;
  tolerance?: number;
  bufferSize?: number;
  windowMs?: number;
}

/**
 * Synchronization engine callbacks
 */
export interface SyncCallbacks {
  onSync: Array<(alignmentResults: Map<string, AlignmentResult>, syncMetrics: SyncMetrics) => void>;
  onQualityChange: Array<(metrics: SyncMetrics) => void>;
  onError: Array<(error: Error) => void>;
}

/**
 * Synchronized stream data for backward compatibility
 */
export interface SynchronizedStreamData {
  streamId: string;
  streamType: string;
  timestamp: number;
  data: unknown;
  confidence: number;
  syncMetrics: SyncMetrics;
}

/**
 * Synchronization engine interface
 */
export interface SynchronizationEngine {
  // Stream management
  addStream(streamId: string, stream: DataStream): void;
  removeStream(streamId: string): void;
  
  // Synchronization
  synchronizeStreams(targetTimestamp?: number): Promise<Map<string, AlignmentResult>>;
  processStreamData(streamId: string, data: StreamData): Promise<Map<string, AlignmentResult>>;
  
  // Control
  start(): void;
  stop(): void;
  
  // Event handlers
  onSync(callback: (alignmentResults: Map<string, AlignmentResult>, syncMetrics: SyncMetrics) => void): () => void;
  onSynchronizedData(callback: (syncedStreams: SynchronizedStreamData[]) => void): () => void;
  onQualityChange(callback: (metrics: SyncMetrics) => void): () => void;
  onError(callback: (error: Error) => void): () => void;
  
  // Status
  getStrategy(): SynchronizationStrategyType;
  getMetrics(): SyncMetrics;
  getStreamCount(): number;
  isRunning(): boolean;
  
  // Statistics
  getStats(): {
    streamCount: number;
    strategy: SynchronizationStrategyType;
    tolerance: number;
    isRunning: boolean;
    metrics: SyncMetrics;
  };
}

/**
 * Multi-stream coordinator configuration
 */
export interface MultiStreamCoordinatorConfig {
  syncConfig?: SynchronizationEngineConfig;
  processingInterval?: number;
}

/**
 * Multi-stream coordinator interface
 */
export interface MultiStreamCoordinator {
  addStream(stream: DataStream): Promise<void>;
  removeStream(streamId: string): void;
  start(): Promise<void>;
  stop(): void;
  getSyncEngine(): SynchronizationEngine;
  getStreams(): Map<string, DataStream>;
  isActive(): boolean;
}

/**
 * Hardware timestamp aligner state
 */
export interface HardwareTimestampState {
  referenceTime: number | null;
  clockOffsets: Map<string, Array<{ timestamp: number; offset: number }>>;
  driftCompensation: Map<string, number>;
}

/**
 * Software timestamp aligner state
 */
export interface SoftwareTimestampState {
  referenceTime: number | null;
  clockSync: ClockSyncState;
}

/**
 * Buffer-based aligner state
 */
export interface BufferBasedState {
  windowSize: number;
  tolerance: number;
  referenceStream: string | null;
}

/**
 * Event-driven aligner state
 */
export interface EventDrivenState {
  events: SyncEvent[];
  eventWindow: number;
  lastEventTime: number | null;
}

/**
 * Aligner factory function type
 */
export type AlignerFactory = () => TemporalAligner;

/**
 * Linear regression point for drift calculation
 */
export type LinearRegressionPoint = [number, number];

/**
 * Stream processing result
 */
export interface StreamProcessingResult {
  streamId: string;
  success: boolean;
  alignmentResult?: AlignmentResult;
  error?: Error;
  timestamp: number;
}

/**
 * Synchronization quality assessment
 */
export interface QualityAssessment {
  overall: number;
  individual: Map<string, number>;
  factors: {
    latency: number;
    jitter: number;
    drops: number;
    alignment: number;
  };
  recommendation: string;
}

/**
 * Temporal drift compensation parameters
 */
export interface DriftCompensationParams {
  windowSize: number;
  minSamples: number;
  maxCompensation: number;
  adaptationRate: number;
}

/**
 * Synchronization statistics
 */
export interface SyncStatistics {
  totalStreams: number;
  activeStreams: number;
  syncEvents: number;
  averageLatency: number;
  maxJitter: number;
  successRate: number;
  uptime: number;
  lastSync: number;
}

/**
 * Export factory function types
 */
export type SyncMetricsFactory = (config?: SyncMetricsConfig) => SyncMetrics;
export type TemporalAlignerFactory = (strategy?: SynchronizationStrategyType) => TemporalAligner;
export type SynchronizationEngineFactory = (config?: SynchronizationEngineConfig) => SynchronizationEngine;
export type MultiStreamCoordinatorFactory = (config?: MultiStreamCoordinatorConfig) => MultiStreamCoordinator;