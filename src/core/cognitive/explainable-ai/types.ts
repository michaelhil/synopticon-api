/**
 * @fileoverview Type definitions for Explainable AI Engine
 * 
 * Comprehensive type definitions for explainable AI system including
 * feature attribution, rule-based explanations, and causal reasoning.
 * 
 * @version 1.0.0
 * @author Synopticon Development Team
 */

export type ExplanationStyle = 'simple' | 'balanced' | 'technical';
export type PredictionCategory = 'optimal' | 'good' | 'moderate' | 'concerning' | 'critical';
export type FeatureCategory = 'normal' | 'below-normal' | 'above-normal';
export type CauseType = 'primary' | 'secondary' | 'contributing' | 'confounding';

export interface ExplainableAIConfig {
  readonly enableAttribution?: boolean;
  readonly enableRules?: boolean;
  readonly enableCausal?: boolean;
  readonly explanationStyle?: ExplanationStyle;
  readonly attribution?: FeatureAttributionConfig;
  readonly rules?: RuleBasedConfig;
  readonly causal?: CausalReasoningConfig;
  readonly aggregator?: AggregatorConfig;
}

export interface FeatureAttributionConfig {
  readonly enableShapley?: boolean;
  readonly maxFeatures?: number;
  readonly attributionThreshold?: number;
}

export interface RuleBasedConfig {
  readonly maxRules?: number;
  readonly confidenceThreshold?: number;
  readonly enableConditionalLogic?: boolean;
}

export interface CausalReasoningConfig {
  readonly maxCausalDepth?: number;
  readonly causalThreshold?: number;
  readonly enableCounterfactuals?: boolean;
}

export interface AggregatorConfig {
  readonly preferredExplanationStyle?: ExplanationStyle;
  readonly weights?: {
    readonly attribution?: number;
    readonly rules?: number;
    readonly causal?: number;
  };
}

export interface FeatureAttribution {
  readonly value: number;
  readonly attribution: number;
  readonly importance: number;
  readonly direction: 'increases' | 'decreases';
  readonly confidence: number;
}

export interface FeatureRange {
  readonly min: number;
  readonly max: number;
  readonly unit: string;
}

export interface FeatureExplanation {
  readonly value: number;
  readonly formattedName: string;
  readonly interpretation: string;
  readonly normalRange: FeatureRange;
  readonly category: FeatureCategory;
}

export interface Rule {
  readonly id: string;
  readonly condition: string;
  readonly conclusion: string;
  readonly confidence: number;
  readonly support: number;
  readonly priority: number;
}

export interface CausalRelationship {
  readonly cause: string;
  readonly effect: string;
  readonly strength: number;
  readonly type: CauseType;
  readonly conditions?: string[];
}

export interface CausalChainLink {
  readonly cause: string;
  readonly effect: string;
  readonly strength: number;
  readonly confidence: number;
}

export interface AttributionExplanation {
  readonly attributions: Map<string, FeatureAttribution>;
  readonly confidence: number;
  readonly methodology: string;
}

export interface RuleExplanation {
  readonly rules: Rule[];
  readonly primaryExplanation: string;
  readonly confidence: number;
  readonly supportingFacts: string[];
}

export interface CausalExplanation {
  readonly causalChain: CausalChainLink[];
  readonly primaryCause: string | null;
  readonly alternativeCauses?: string[];
  readonly confidence: number;
}

export interface PredictionInfo {
  readonly value: number;
  readonly confidence: number;
  readonly category: PredictionCategory;
  readonly timestamp?: number;
}

export interface ExplanationContent {
  readonly primary: string;
  readonly detailed: string[] | null;
  readonly style: ExplanationStyle;
  readonly confidence: number;
}

export interface UncertaintyInfo {
  readonly level: 'low' | 'medium' | 'high';
  readonly factors: string[];
  readonly sources?: string[];
}

export interface AggregatedExplanation {
  readonly prediction: PredictionInfo;
  readonly explanation: ExplanationContent;
  readonly recommendations: string[];
  readonly uncertainty: UncertaintyInfo;
  readonly featureImportance?: Record<string, number>;
  readonly context?: Record<string, unknown>;
  readonly error?: string;
}

export interface ExplanationOptions {
  readonly includeDetailed?: boolean;
  readonly customContext?: Record<string, unknown>;
  readonly maxRecommendations?: number;
  readonly explanationDepth?: 'shallow' | 'moderate' | 'deep';
}

// Engine interfaces
export interface FeatureAttributionEngine {
  explainPrediction(prediction: number, features: Record<string, number>): AttributionExplanation;
  calculateAttributions(prediction: number, features: Record<string, number>, baseline?: number): Map<string, FeatureAttribution>;
  getImportantFeatures(attributions: Map<string, FeatureAttribution>, maxCount?: number): string[];
}

export interface RuleBasedExplainer {
  explainWithRules(features: Record<string, number>): RuleExplanation;
  addCustomRule(rule: Rule): boolean;
  evaluateRule(rule: Rule, features: Record<string, number>): boolean;
  getApplicableRules(features: Record<string, number>): Rule[];
}

export interface CausalReasoningEngine {
  explainCausally(features: Record<string, number>, prediction: number): CausalExplanation;
  addCausalRelationship(relationship: CausalRelationship): boolean;
  findCausalChain(targetFeature: string, features: Record<string, number>): CausalChainLink[];
  generateCounterfactuals(features: Record<string, number>, targetOutcome: number): Record<string, number>[];
}

export interface ExplanationAggregator {
  aggregateExplanations(
    attribution: AttributionExplanation,
    rules: RuleExplanation,
    causal: CausalExplanation,
    prediction: number
  ): AggregatedExplanation;
  setExplanationStyle(style: ExplanationStyle): void;
  getExplanationStyle(): ExplanationStyle;
  generateRecommendations(
    prediction: number,
    features: Record<string, number>,
    explanation: AggregatedExplanation
  ): string[];
}

export interface ExplainableAIEngine {
  explainPrediction(
    prediction: number,
    features: Record<string, number>,
    options?: ExplanationOptions
  ): AggregatedExplanation;
  explainFeatures(features: Record<string, number>): Record<string, FeatureExplanation>;
  
  // Engine access
  getAttributionEngine(): FeatureAttributionEngine | null;
  getRuleEngine(): RuleBasedExplainer | null;
  getCausalEngine(): CausalReasoningEngine | null;
  getAggregator(): ExplanationAggregator;
  
  // Configuration
  setExplanationStyle(style: ExplanationStyle): void;
  getExplanationStyle(): ExplanationStyle;
  
  // Custom rules and relationships
  addRule(rule: Rule): boolean;
  addCausalRelationship(relationship: CausalRelationship): boolean;
  
  // Integration
  integrateWithFusionEngine(fusionEngine: any): boolean;
  
  // Cleanup
  cleanup(): void;
}

// Features and prediction data
export interface Features {
  readonly [key: string]: number;
}

export interface PredictionData {
  readonly prediction: number;
  readonly features: Features;
  readonly options?: ExplanationOptions;
  readonly metadata?: Record<string, unknown>;
}