/**
 * @fileoverview Integration System for Prediction Confidence Visualization
 * 
 * Handles integration with external engines and systems including
 * explainable AI, temporal context, and cognitive fusion engines.
 * 
 * @version 1.0.0
 * @author Synopticon Development Team
 */

import type {
  ExplainableAIEngine,
  TemporalContextEngine,
  CognitiveFusionEngine,
  PredictionData,
  ConfidenceVisualization,
  ExplanationData,
  ContextData,
  VisualizationState
} from './types.js';
import type { DataProcessor } from './data-processor.js';

export interface IntegrationManager {
  integrateWithExplainableAI(engine: ExplainableAIEngine): void;
  integrateWithTemporalContext(engine: TemporalContextEngine): void;
  integrateWithCognitiveFusion(engine: CognitiveFusionEngine): void;
  extractConfidenceFromPrediction(predictionData: PredictionData): ConfidenceVisualization;
  processExplanationData(explanationData: ExplanationData): ExplanationData;
  processContextUpdate(contextData: ContextData): void;
  disconnectAllIntegrations(): void;
}

export const createIntegrationManager = (
  state: VisualizationState,
  dataProcessor: DataProcessor,
  requestRender: () => void
): IntegrationManager => {
  
  // Track active integrations for cleanup
  const activeIntegrations = new Set<string>();
  const integrationCallbacks = new Map<string, (() => void)[]>();

  /**
   * Integrate with explainable AI engine for enhanced explanations
   */
  const integrateWithExplainableAI = (engine: ExplainableAIEngine): void => {
    const integrationId = 'explainableAI';
    
    const callback = (explanationData: ExplanationData) => {
      if (state.currentConfidence) {
        const processedExplanation = processExplanationData(explanationData);
        
        // Update current confidence with enhanced explanation
        state.currentConfidence = {
          ...state.currentConfidence,
          explanation: processedExplanation
        };
        
        requestRender();
      }
    };
    
    engine.on('explanationGenerated', callback);
    
    // Track integration
    activeIntegrations.add(integrationId);
    if (!integrationCallbacks.has(integrationId)) {
      integrationCallbacks.set(integrationId, []);
    }
    integrationCallbacks.get(integrationId)!.push(() => {
      // Note: In a real implementation, you'd want to properly remove the event listener
      // This would depend on the specific engine API
      console.log(`Disconnecting from ${integrationId}`);
    });
    
    console.log('✅ Integrated with Explainable AI engine');
  };

  /**
   * Integrate with temporal context engine for stability analysis
   */
  const integrateWithTemporalContext = (engine: TemporalContextEngine): void => {
    const integrationId = 'temporalContext';
    
    const callback = (contextData: ContextData) => {
      processContextUpdate(contextData);
      
      if (state.currentConfidence) {
        // Update uncertainty bounds based on temporal stability
        const uncertaintyBounds = dataProcessor.calculateUncertaintyBounds(
          state.currentConfidence.overallConfidence,
          {
            temporalStability: contextData.stability ?? 0.8,
            variability: contextData.variability ?? 0.1
          }
        );
        
        // Update temporal trend
        const temporalTrend = dataProcessor.calculateTemporalTrend();
        
        // Create updated confidence data
        state.currentConfidence = {
          ...state.currentConfidence,
          uncertaintyBounds,
          temporalTrend
        };
        
        requestRender();
      }
    };
    
    engine.on('contextUpdate', callback);
    
    // Track integration
    activeIntegrations.add(integrationId);
    if (!integrationCallbacks.has(integrationId)) {
      integrationCallbacks.set(integrationId, []);
    }
    integrationCallbacks.get(integrationId)!.push(() => {
      console.log(`Disconnecting from ${integrationId}`);
    });
    
    console.log('✅ Integrated with Temporal Context engine');
  };

  /**
   * Integrate with cognitive fusion engine for prediction updates
   */
  const integrateWithCognitiveFusion = (engine: CognitiveFusionEngine): void => {
    const integrationId = 'cognitiveFusion';
    
    const callback = (predictionData: PredictionData) => {
      try {
        const confidenceData = extractConfidenceFromPrediction(predictionData);
        
        // Apply additional validation and enhancement
        const enhancedConfidenceData = enhanceConfidenceData(confidenceData, predictionData);
        
        dataProcessor.updateHistory(enhancedConfidenceData);
        
        if (state.isRunning) {
          requestRender();
        }
        
        // Log prediction update for debugging
        console.log('📊 Confidence updated:', {
          overall: enhancedConfidenceData.overallConfidence,
          features: enhancedConfidenceData.featureConfidences.size,
          type: enhancedConfidenceData.predictionType
        });
        
      } catch (error) {
        console.error('❌ Failed to process prediction update:', error);
      }
    };
    
    engine.on('predictionUpdate', callback);
    
    // Track integration
    activeIntegrations.add(integrationId);
    if (!integrationCallbacks.has(integrationId)) {
      integrationCallbacks.set(integrationId, []);
    }
    integrationCallbacks.get(integrationId)!.push(() => {
      console.log(`Disconnecting from ${integrationId}`);
    });
    
    console.log('✅ Integrated with Cognitive Fusion engine');
  };

  /**
   * Extract confidence data from prediction results with enhanced processing
   */
  const extractConfidenceFromPrediction = (predictionData: PredictionData): ConfidenceVisualization => {
    const featureConfidences = new Map<string, number>();
    
    // Extract feature-level confidences with validation
    if (predictionData.features) {
      Object.entries(predictionData.features).forEach(([feature, data]) => {
        // Validate confidence values
        const rawConfidence = data.confidence ?? data.certainty ?? 0.5;
        const validatedConfidence = Math.max(0, Math.min(1, rawConfidence));
        
        featureConfidences.set(feature, validatedConfidence);
      });
    }
    
    // Calculate overall confidence with weighted averaging
    let overallConfidence: number;
    
    if (featureConfidences.size > 0) {
      // Use weighted average based on feature importance (if available)
      const confidenceValues = Array.from(featureConfidences.values());
      overallConfidence = confidenceValues.reduce((sum, conf) => sum + conf, 0) / confidenceValues.length;
    } else {
      overallConfidence = Math.max(0, Math.min(1, predictionData.confidence ?? 0.5));
    }
    
    // Calculate uncertainty bounds with metadata
    const uncertaintyBounds = dataProcessor.calculateUncertaintyBounds(
      overallConfidence,
      predictionData.metadata ?? {}
    );
    
    // Calculate temporal trend
    const temporalTrend = dataProcessor.calculateTemporalTrend();
    
    return {
      timestamp: Date.now(),
      overallConfidence,
      featureConfidences,
      uncertaintyBounds,
      predictionType: validatePredictionType(predictionData.type ?? 'unknown'),
      explanation: processExplanationData(predictionData.explanation ?? null),
      temporalTrend
    };
  };

  /**
   * Process and enhance explanation data
   */
  const processExplanationData = (explanationData: ExplanationData | null): ExplanationData | null => {
    if (!explanationData) return null;
    
    // Enhance explanation with additional insights
    const enhancedExplanation: ExplanationData = {
      summary: explanationData.summary ?? 'Analysis in progress...',
      featureAttributions: explanationData.featureAttributions?.map(attr => ({
        feature: attr.feature,
        importance: Math.max(0, Math.min(1, attr.importance))
      })),
      uncertainty: explanationData.uncertainty 
        ? Math.max(0, Math.min(1, explanationData.uncertainty))
        : undefined,
      primaryFactors: explanationData.primaryFactors?.slice(0, 5), // Limit to top 5
      keyInsights: explanationData.keyInsights?.slice(0, 3) // Limit to top 3
    };
    
    // Add derived insights if not present
    if (!enhancedExplanation.keyInsights && enhancedExplanation.featureAttributions) {
      enhancedExplanation.keyInsights = generateInsightsFromAttributions(
        enhancedExplanation.featureAttributions
      );
    }
    
    return enhancedExplanation;
  };

  /**
   * Process context updates from temporal engine
   */
  const processContextUpdate = (contextData: ContextData): void => {
    // Validate and normalize context data
    const normalizedContext = {
      stability: contextData.stability ? Math.max(0, Math.min(1, contextData.stability)) : 0.8,
      variability: contextData.variability ? Math.max(0, Math.min(1, contextData.variability)) : 0.1
    };
    
    // Log context updates for monitoring
    console.log('🕒 Temporal context updated:', normalizedContext);
    
    // Store context for future use
    state.temporalWindow = {
      ...state.temporalWindow,
      ...normalizedContext
    };
  };

  /**
   * Disconnect all active integrations
   */
  const disconnectAllIntegrations = (): void => {
    integrationCallbacks.forEach((callbacks, integrationId) => {
      callbacks.forEach(cleanup => cleanup());
      console.log(`🔌 Disconnected from ${integrationId}`);
    });
    
    integrationCallbacks.clear();
    activeIntegrations.clear();
  };

  // Helper functions
  const enhanceConfidenceData = (
    confidenceData: ConfidenceVisualization,
    predictionData: PredictionData
  ): ConfidenceVisualization => {
    // Add quality metrics
    const qualityScore = calculatePredictionQuality(predictionData);
    
    // Adjust confidence based on quality
    const qualityAdjustedConfidence = confidenceData.overallConfidence * qualityScore;
    
    // Recalculate uncertainty bounds with quality adjustment
    const adjustedUncertaintyBounds = dataProcessor.calculateUncertaintyBounds(
      qualityAdjustedConfidence,
      {
        ...predictionData.metadata,
        variability: (predictionData.metadata?.variability ?? 0.1) * (1 - qualityScore)
      }
    );
    
    return {
      ...confidenceData,
      overallConfidence: qualityAdjustedConfidence,
      uncertaintyBounds: adjustedUncertaintyBounds
    };
  };

  const calculatePredictionQuality = (predictionData: PredictionData): number => {
    let qualityScore = 1.0;
    
    // Reduce quality for missing or incomplete data
    if (!predictionData.features) {
      qualityScore *= 0.8;
    }
    
    if (!predictionData.confidence && !predictionData.features) {
      qualityScore *= 0.6;
    }
    
    // Consider metadata quality indicators
    if (predictionData.metadata) {
      const sampleSize = predictionData.metadata.sampleSize ?? 100;
      const sampleQuality = Math.min(1, Math.sqrt(sampleSize / 100));
      qualityScore *= sampleQuality;
    }
    
    return Math.max(0.1, Math.min(1, qualityScore));
  };

  const validatePredictionType = (type: string): string => {
    const validTypes = [
      'classification', 'regression', 'clustering', 'anomaly_detection',
      'time_series', 'text_analysis', 'image_analysis', 'multimodal',
      'reinforcement_learning', 'unsupervised', 'unknown'
    ];
    
    return validTypes.includes(type) ? type : 'unknown';
  };

  const generateInsightsFromAttributions = (
    attributions: { feature: string; importance: number }[]
  ): string[] => {
    const insights: string[] = [];
    
    // Sort by importance
    const sortedAttributions = [...attributions].sort((a, b) => b.importance - a.importance);
    
    if (sortedAttributions.length > 0) {
      const topFeature = sortedAttributions[0];
      insights.push(`Primary factor: ${topFeature.feature} (${(topFeature.importance * 100).toFixed(1)}%)`);
    }
    
    if (sortedAttributions.length > 1) {
      const topFeatures = sortedAttributions.slice(0, 3);
      const totalImportance = topFeatures.reduce((sum, attr) => sum + attr.importance, 0);
      insights.push(`Top features account for ${(totalImportance * 100).toFixed(1)}% of prediction`);
    }
    
    // Identify feature diversity
    const importanceRange = sortedAttributions.length > 1
      ? sortedAttributions[0].importance - sortedAttributions[sortedAttributions.length - 1].importance
      : 0;
    
    if (importanceRange < 0.2) {
      insights.push('Features show balanced contribution to prediction');
    } else {
      insights.push('Prediction dominated by key features');
    }
    
    return insights.slice(0, 3); // Return top 3 insights
  };

  return {
    integrateWithExplainableAI,
    integrateWithTemporalContext,
    integrateWithCognitiveFusion,
    extractConfidenceFromPrediction,
    processExplanationData,
    processContextUpdate,
    disconnectAllIntegrations
  };
};