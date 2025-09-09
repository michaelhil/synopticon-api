/**
 * @fileoverview Type definitions for prediction confidence visualization system
 * 
 * Comprehensive type definitions for real-time visualization of prediction 
 * confidence levels, uncertainty bands, and interactive explanation interfaces.
 * 
 * @version 1.0.0
 * @author Synopticon Development Team
 */

export type VisualizationStyle = 'technical' | 'simple' | 'balanced';
export type InteractionMode = 'overview' | 'detailed' | 'explanation';
export type ImageFormat = 'png' | 'jpeg';

export interface ConfidenceThresholds {
  readonly high: number;
  readonly medium: number;
  readonly low: number;
}

export interface ColorScheme {
  readonly highConfidence: string;
  readonly mediumConfidence: string;
  readonly lowConfidence: string;
  readonly uncertainty: string;
  readonly background: string;
  readonly grid: string;
  readonly text: string;
}

export interface PredictionConfidenceVisualizationConfig {
  readonly canvasWidth?: number;
  readonly canvasHeight?: number;
  readonly updateInterval?: number;
  readonly historyLength?: number;
  readonly confidenceThresholds?: ConfidenceThresholds;
  readonly colorScheme?: ColorScheme;
  readonly visualizationStyle?: VisualizationStyle;
  readonly enableInteractivity?: boolean;
  readonly showUncertaintyBands?: boolean;
  readonly showTemporalProgression?: boolean;
  readonly resourcePool?: unknown;
}

export interface UncertaintyBounds {
  readonly upper: number;
  readonly lower: number;
  readonly uncertainty: number;
}

export interface FeatureAttribution {
  readonly feature: string;
  readonly importance: number;
}

export interface ExplanationData {
  readonly summary?: string;
  readonly featureAttributions?: FeatureAttribution[];
  readonly uncertainty?: number;
  readonly primaryFactors?: string[];
  readonly keyInsights?: string[];
}

export interface ConfidenceVisualization {
  readonly timestamp: number;
  readonly overallConfidence: number;
  readonly featureConfidences: Map<string, number>;
  readonly uncertaintyBounds: UncertaintyBounds;
  readonly predictionType: string;
  readonly explanation: ExplanationData | null;
  readonly temporalTrend: number;
}

export interface Position {
  readonly x: number;
  readonly y: number;
}

export interface TemporalWindow {
  readonly start: number;
  readonly end: number;
}

export interface VisualizationState {
  confidenceHistory: Array<ConfidenceVisualization | null>;
  currentConfidence: ConfidenceVisualization | null;
  canvas: HTMLCanvasElement | null;
  context: CanvasRenderingContext2D | null;
  animationFrame: number | null;
  lastUpdate: number;
  isRunning: boolean;
  interactionMode: InteractionMode;
  selectedFeature: string | null;
  hoverPosition: Position;
  temporalWindow: TemporalWindow;
}

export interface ConfidenceStats {
  readonly overall: number;
  readonly mean: number;
  readonly min: number;
  readonly max: number;
  readonly std: number;
  readonly trend: number;
  readonly uncertainty: number;
}

export interface UncertaintyMetadata {
  readonly sampleSize?: number;
  readonly variability?: number;
  readonly temporalStability?: number;
}

export interface PredictionData {
  readonly type?: string;
  readonly confidence?: number;
  readonly features?: Record<string, {
    readonly confidence?: number;
    readonly certainty?: number;
    [key: string]: unknown;
  }>;
  readonly metadata?: UncertaintyMetadata;
  readonly explanation?: ExplanationData;
  [key: string]: unknown;
}

export interface ContextData {
  readonly stability?: number;
  readonly variability?: number;
  [key: string]: unknown;
}

// Engine Integration Interfaces
export interface ExplainableAIEngine {
  on(event: 'explanationGenerated', callback: (explanationData: ExplanationData) => void): void;
}

export interface TemporalContextEngine {
  on(event: 'contextUpdate', callback: (contextData: ContextData) => void): void;
}

export interface CognitiveFusionEngine {
  on(event: 'predictionUpdate', callback: (predictionData: PredictionData) => void): void;
}

export interface PredictionConfidenceVisualization {
  initialize(container: HTMLElement): Promise<void>;
  start(): void;
  stop(): void;
  updateConfidence(confidenceData: ConfidenceVisualization): void;
  setVisualizationStyle(style: VisualizationStyle): void;
  setInteractionMode(mode: InteractionMode): void;
  exportImage(format?: ImageFormat): string | null;
  getConfidenceStats(): ConfidenceStats | null;
  integrateWithExplainableAI(engine: ExplainableAIEngine): void;
  integrateWithTemporalContext(engine: TemporalContextEngine): void;
  integrateWithCognitiveFusion(engine: CognitiveFusionEngine): void;
  cleanup(): void;
}

// Utility interfaces
export interface ConfidenceVisualizationUtils {
  createConfidenceData(prediction: PredictionData, metadata?: UncertaintyMetadata): ConfidenceVisualization;
  validateConfig(config: PredictionConfidenceVisualizationConfig): boolean;
}