/**
 * @fileoverview Information Fusion Engine Core
 * 
 * Main fusion engine orchestrating multi-modal data integration with
 * quality assessment, temporal analysis, and advanced cognitive component integration.
 * 
 * @version 1.0.0
 * @author Synopticon Development Team
 */

import { EventEmitter } from 'events';
import { createDataQualityAssessment } from './data-quality-assessment.js';
import { createFusionAlgorithms } from './fusion-algorithms.js';
import { createTemporalFusion } from './temporal-fusion.js';
import { createLogger } from '../../../shared/utils/logger.js';
import type {
  InformationFusionEngine,
  InformationFusionEngineFactory,
  InformationFusionConfig,
  FusionData,
  EnrichedData,
  DataQualityAssessment,
  EnhancedFusionResult,
  DataQualitySummary,
  TemporalTrend,
  FusionEvents,
  TemporalContextEngine,
  ExplainableAIEngine,
  PredictionConfidenceVisualization,
  AdvancedCognitiveComponents,
  FeatureExtractor,
  ConfidenceExtractor
} from './types.js';

const logger = createLogger({ level: 2 });

/**
 * Main Information Fusion Engine factory
 */
export const createInformationFusionEngine: InformationFusionEngineFactory = (config = {}) => {
  // Initialize core components
  const qualityAssessment = createDataQualityAssessment(config.dataSources);
  const algorithms = createFusionAlgorithms();
  const temporal = createTemporalFusion(config.maxHistory);
  const emitter = new EventEmitter();
  
  // State management
  const state = {
    dataStore: new Map<string, EnrichedData>(),
    fusionResults: new Map<string, EnhancedFusionResult>(),
    
    // Integration points for advanced cognitive components
    integrations: {
      temporalContextEngine: null as TemporalContextEngine | null,
      explainableAIEngine: null as ExplainableAIEngine | null,
      predictionConfidenceVisualization: null as PredictionConfidenceVisualization | null
    },
    
    // Configuration
    config: {
      enableTemporalAnalysis: config.enableTemporalAnalysis ?? true,
      enableQualityAssessment: config.enableQualityAssessment ?? true,
      fusionThresholds: config.fusionThresholds || {
        human: 0.3,
        environmental: 0.2,
        situational: 0.4
      }
    },
    
    // Performance metrics
    metrics: {
      totalIngestions: 0,
      totalFusions: 0,
      fusionsByType: {} as Record<string, number>,
      averageProcessingTime: 0,
      lastProcessingTime: 0
    }
  };

  /**
   * Ingest data from external source with quality assessment
   */
  const ingestData = (source: string, type: string, data: FusionData): DataQualityAssessment => {
    const startTime = performance.now();
    
    try {
      // Assess data quality if enabled
      const quality = state.config.enableQualityAssessment 
        ? qualityAssessment.assessDataQuality(data, source, type)
        : {
            quality: 0.8,
            confidence: 0.8,
            issues: [],
            staleness: 0.9,
            completeness: 0.9,
            consistency: 0.9,
            plausibility: 0.9
          };

      // Create enriched data object
      const enrichedData: EnrichedData = {
        ...data,
        source,
        type,
        quality,
        ingested: Date.now()
      };
      
      const key = createDataKey(source, type);
      state.dataStore.set(key, enrichedData);
      
      // Add to temporal analysis if enabled
      if (state.config.enableTemporalAnalysis) {
        temporal.addDataPoint(key, { 
          value: extractNumericValue(data), 
          quality: quality.quality,
          timestamp: data.timestamp || Date.now()
        });
      }
      
      // Update metrics
      state.metrics.totalIngestions++;
      const processingTime = performance.now() - startTime;
      updateProcessingMetrics(processingTime);
      
      // Emit ingestion event
      emitter.emit('dataIngested', { source, type, data: enrichedData });
      
      // Trigger fusion analysis
      checkAndTriggerFusion();
      
      return quality;
      
    } catch (error) {
      logger.error('Data ingestion failed:', error as Error);
      throw error;
    }
  };

  /**
   * Check conditions and trigger appropriate fusion processes
   */
  const checkAndTriggerFusion = (): void => {
    try {
      // Check for human state fusion
      if (shouldTriggerFusion('human-state', [
        'human-physiological', 
        'human-behavioral', 
        'human-performance'
      ])) {
        performFusion('human-state');
      }
      
      // Check for environmental fusion
      if (shouldTriggerFusion('environmental', [
        'external-weather', 
        'external-traffic'
      ])) {
        performFusion('environmental');
      }
      
      // Check for situational awareness fusion
      if (shouldTriggerFusion('situational-awareness', [], {
        requiresResults: ['human-state', 'environmental'],
        requiresData: ['simulator-telemetry']
      })) {
        performFusion('situational-awareness');
      }
      
    } catch (error) {
      logger.error('Fusion trigger check failed:', error as Error);
    }
  };

  /**
   * Determine if fusion should be triggered based on data availability and quality
   */
  const shouldTriggerFusion = (
    fusionType: string, 
    requiredKeys: string[] = [], 
    options: {
      requiresResults?: string[];
      requiresData?: string[];
      minimumQuality?: number;
    } = {}
  ): boolean => {
    const threshold = state.config.fusionThresholds[fusionType as keyof typeof state.config.fusionThresholds] || 0.3;
    const minQuality = options.minimumQuality || threshold;
    
    // Check required data availability
    const hasRequiredData = requiredKeys.length === 0 || 
      requiredKeys.some(key => {
        const data = state.dataStore.get(key);
        return data && data.quality.quality >= minQuality;
      });
    
    // Check required fusion results
    const hasRequiredResults = !options.requiresResults || 
      options.requiresResults.every(resultType => state.fusionResults.has(resultType));
    
    // Check additional data requirements
    const hasAdditionalData = !options.requiresData || 
      options.requiresData.every(key => state.dataStore.has(key));
    
    return hasRequiredData && hasRequiredResults && hasAdditionalData;
  };

  /**
   * Perform fusion operation for specified type
   */
  const performFusion = (fusionType: string): void => {
    const startTime = performance.now();
    
    try {
      let result: any;
      const timestamp = Date.now();
      
      switch (fusionType) {
        case 'human-state':
          result = algorithms['human-state-fusion'](
            state.dataStore.get('human-physiological'),
            state.dataStore.get('human-behavioral'),
            state.dataStore.get('human-performance'),
            state.dataStore.get('human-self_report')
          );
          break;
          
        case 'environmental':
          result = algorithms['environmental-fusion'](
            state.dataStore.get('external-weather'),
            state.dataStore.get('external-traffic'),
            state.dataStore.get('external-terrain'),
            state.dataStore.get('external-communications')
          );
          break;
          
        case 'situational-awareness':
          const humanState = state.fusionResults.get('human-state');
          const systemData = state.dataStore.get('simulator-telemetry');
          const environmentalState = state.fusionResults.get('environmental');
          
          if (humanState && systemData && environmentalState) {
            result = algorithms['situational-awareness-fusion'](
              humanState,
              systemData,
              environmentalState
            );
          }
          break;
      }
      
      if (!result) {
        logger.warn(`Fusion ${fusionType} produced no result`);
        return;
      }
      
      // Enhance result with metadata
      const enhancedResult: EnhancedFusionResult = {
        ...result,
        timestamp,
        fusionType
      };
      
      // Add temporal context if available
      enhancedResult.temporalContext = await enhanceWithTemporalContext(
        enhancedResult, 
        fusionType, 
        timestamp
      );
      
      // Add explanations if available
      enhancedResult.explanation = await enhanceWithExplanations(
        enhancedResult, 
        fusionType, 
        timestamp
      );
      
      // Update confidence from explanations
      if (enhancedResult.explanation?.confidence !== undefined) {
        enhancedResult.confidence = enhancedResult.explanation.confidence;
      }
      
      // Store fusion result
      state.fusionResults.set(fusionType, enhancedResult);
      
      // Update visualization if available
      await updateConfidenceVisualization(enhancedResult, fusionType, timestamp);
      
      // Update metrics
      state.metrics.totalFusions++;
      state.metrics.fusionsByType[fusionType] = (state.metrics.fusionsByType[fusionType] || 0) + 1;
      
      const processingTime = performance.now() - startTime;
      updateProcessingMetrics(processingTime);
      
      // Emit fusion completion events
      emitter.emit('fusionCompleted', { type: fusionType, result: enhancedResult });
      emitter.emit('predictionUpdate', enhancedResult);
      
      logger.debug(`Fusion completed: ${fusionType}`, {
        processingTime: processingTime.toFixed(2) + 'ms',
        confidence: enhancedResult.confidence
      });
      
    } catch (error) {
      logger.error(`Fusion ${fusionType} failed:`, error as Error);
    }
  };

  /**
   * Enhance result with temporal context analysis
   */
  const enhanceWithTemporalContext = async (
    result: EnhancedFusionResult, 
    fusionType: string, 
    timestamp: number
  ) => {
    if (!state.integrations.temporalContextEngine) return undefined;
    
    try {
      const temporalContext = await state.integrations.temporalContextEngine.analyzeTemporalContext({
        currentState: result,
        timestamp,
        fusionType
      });
      
      if (temporalContext.predictions) {
        result.temporalPredictions = temporalContext.predictions;
      }
      
      return temporalContext;
    } catch (error) {
      logger.warn('Temporal context enhancement failed:', (error as Error).message);
      return undefined;
    }
  };

  /**
   * Enhance result with AI explanations
   */
  const enhanceWithExplanations = async (
    result: EnhancedFusionResult, 
    fusionType: string, 
    timestamp: number
  ) => {
    if (!state.integrations.explainableAIEngine) return undefined;
    
    try {
      const features = extractFeaturesFromResult(result);
      const explanation = await state.integrations.explainableAIEngine.explainPrediction({
        prediction: result,
        features,
        context: { fusionType, timestamp }
      });
      
      return explanation;
    } catch (error) {
      logger.warn('AI explanation generation failed:', (error as Error).message);
      return undefined;
    }
  };

  /**
   * Update confidence visualization
   */
  const updateConfidenceVisualization = async (
    result: EnhancedFusionResult, 
    fusionType: string, 
    timestamp: number
  ): Promise<void> => {
    if (!state.integrations.predictionConfidenceVisualization) return;
    
    try {
      await state.integrations.predictionConfidenceVisualization.updateConfidence({
        timestamp,
        overallConfidence: result.confidence || 0.8,
        featureConfidences: extractFeatureConfidences(result),
        uncertaintyBounds: result.explanation?.uncertainty || { upper: 0.9, lower: 0.7 },
        predictionType: fusionType,
        explanation: result.explanation,
        temporalTrend: result.temporalContext?.trend || 0
      });
    } catch (error) {
      logger.warn('Confidence visualization update failed:', (error as Error).message);
    }
  };

  /**
   * Get fusion result by type
   */
  const getFusionResult = (type: string): EnhancedFusionResult | undefined => {
    return state.fusionResults.get(type);
  };

  /**
   * Get all fusion results
   */
  const getAllFusionResults = (): Record<string, EnhancedFusionResult> => {
    return Object.fromEntries(state.fusionResults);
  };

  /**
   * Get comprehensive data quality summary
   */
  const getDataQuality = (): DataQualitySummary => {
    const dataEntries = Array.from(state.dataStore.values());
    const qualities = dataEntries.map(d => d.quality);
    
    if (qualities.length === 0) {
      return {
        sources: 0,
        averageQuality: 0,
        averageConfidence: 0,
        issues: [],
        bySource: {}
      };
    }
    
    return {
      sources: state.dataStore.size,
      averageQuality: qualities.reduce((sum, q) => sum + q.quality, 0) / qualities.length,
      averageConfidence: qualities.reduce((sum, q) => sum + q.confidence, 0) / qualities.length,
      issues: qualities.flatMap(q => q.issues),
      bySource: Object.fromEntries(
        Array.from(state.dataStore.entries()).map(([key, data]) => [key, data.quality])
      )
    };
  };

  /**
   * Get temporal trends for all data sources
   */
  const getTrends = (duration?: number): Record<string, TemporalTrend> => {
    if (!state.config.enableTemporalAnalysis) {
      return {};
    }
    
    const trends: Record<string, TemporalTrend> = {};
    for (const key of state.dataStore.keys()) {
      trends[key] = temporal.getTrend(key, duration);
    }
    return trends;
  };

  // Integration methods for advanced cognitive components
  const integrateTemporalContextEngine = (engine: TemporalContextEngine): void => {
    state.integrations.temporalContextEngine = engine;
    logger.info('✅ Temporal Context Engine integrated with Fusion Engine');
  };
  
  const integrateExplainableAI = (engine: ExplainableAIEngine): void => {
    state.integrations.explainableAIEngine = engine;
    logger.info('✅ Explainable AI Engine integrated with Fusion Engine');
  };
  
  const integratePredictionConfidenceVisualization = (visualization: PredictionConfidenceVisualization): void => {
    state.integrations.predictionConfidenceVisualization = visualization;
    
    // Set up bidirectional integration
    if (visualization.integrateWithCognitiveFusion) {
      visualization.integrateWithCognitiveFusion({
        on: emitter.on.bind(emitter),
        emit: emitter.emit.bind(emitter)
      });
    }
    
    logger.info('✅ Prediction Confidence Visualization integrated with Fusion Engine');
  };

  const integrateAdvancedCognitiveComponents = (components: AdvancedCognitiveComponents): void => {
    const { temporalContext, explainableAI, confidenceVisualization } = components;
    
    if (temporalContext) {
      integrateTemporalContextEngine(temporalContext);
    }
    
    if (explainableAI) {
      integrateExplainableAI(explainableAI);
      
      // Cross-integrate temporal context with explainable AI
      if (temporalContext && explainableAI.integrateTemporalContext) {
        explainableAI.integrateTemporalContext(temporalContext);
      }
    }
    
    if (confidenceVisualization) {
      integratePredictionConfidenceVisualization(confidenceVisualization);
      
      // Cross-integrate with other components
      if (explainableAI && confidenceVisualization.integrateWithExplainableAI) {
        confidenceVisualization.integrateWithExplainableAI(explainableAI);
      }
      
      if (temporalContext && confidenceVisualization.integrateWithTemporalContext) {
        confidenceVisualization.integrateWithTemporalContext(temporalContext);
      }
    }
    
    logger.info('✅ All advanced cognitive components integrated successfully');
  };

  // Event handling methods
  const on = <K extends keyof FusionEvents>(event: K, listener: (data: FusionEvents[K]) => void): void => {
    emitter.on(event, listener);
  };

  const off = <K extends keyof FusionEvents>(event: K, listener: (data: FusionEvents[K]) => void): void => {
    emitter.off(event, listener);
  };

  const emit = <K extends keyof FusionEvents>(event: K, data: FusionEvents[K]): void => {
    emitter.emit(event, data);
  };

  // Helper functions
  const createDataKey = (source: string, type: string): string => `${source}-${type}`;
  
  const extractNumericValue = (data: FusionData): number => {
    if (typeof data.value === 'number') return data.value;
    if (typeof data === 'object' && data !== null) {
      // Try to extract a numeric value from common fields
      const numericFields = ['heartRate', 'accuracy', 'temperature', 'speed', 'level'];
      for (const field of numericFields) {
        const value = (data as any)[field];
        if (typeof value === 'number') return value;
      }
    }
    return 0.5; // Default neutral value
  };

  const updateProcessingMetrics = (processingTime: number): void => {
    state.metrics.lastProcessingTime = processingTime;
    
    // Calculate rolling average
    const alpha = 0.1; // Smoothing factor
    state.metrics.averageProcessingTime = state.metrics.averageProcessingTime === 0
      ? processingTime
      : state.metrics.averageProcessingTime * (1 - alpha) + processingTime * alpha;
  };

  /**
   * Extract features from fusion result for AI analysis
   */
  const extractFeaturesFromResult: FeatureExtractor = (result) => {
    const features: Record<string, unknown> = {};
    
    // Extract common fusion result features
    if (result.cognitiveLoad !== undefined) features.cognitiveLoad = result.cognitiveLoad;
    if (result.fatigue !== undefined) features.fatigue = result.fatigue;
    if (result.stress !== undefined) features.stress = result.stress;
    if (result.totalRisk !== undefined) features.totalRisk = result.totalRisk;
    if (result.level !== undefined) features.situationalAwareness = result.level;
    if (result.ratio !== undefined) features.demandCapabilityRatio = result.ratio;
    
    return features;
  };

  /**
   * Extract feature confidences from fusion result
   */
  const extractFeatureConfidences: ConfidenceExtractor = (result) => {
    const confidences = new Map<string, number>();
    
    if (result.sources && Array.isArray(result.sources)) {
      result.sources.forEach(source => {
        confidences.set(source, result.confidence || 0.8);
      });
    }
    
    if (result.riskFactors && Array.isArray(result.riskFactors)) {
      result.riskFactors.forEach((factor: any) => {
        confidences.set(factor.type, factor.confidence || 0.8);
      });
    }
    
    if (confidences.size === 0) {
      confidences.set('overall', result.confidence || 0.8);
    }
    
    return confidences;
  };

  logger.info('✅ Information Fusion Engine initialized');

  return {
    // Core functionality
    ingestData,
    getFusionResult,
    getAllFusionResults,
    getDataQuality,
    getTrends,
    
    // Event handling
    on,
    off,
    emit,
    
    // Component integrations
    integrateTemporalContextEngine,
    integrateExplainableAI,
    integratePredictionConfidenceVisualization,
    integrateAdvancedCognitiveComponents
  };
};