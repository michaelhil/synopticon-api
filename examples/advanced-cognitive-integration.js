/**
 * @fileoverview Advanced Cognitive Integration Example
 * 
 * Demonstrates the complete integration of the three advanced cognitive components:
 * - Temporal Context Engine for temporal awareness and predictions
 * - Explainable AI Engine for prediction transparency
 * - Prediction Confidence Visualization for real-time confidence display
 * 
 * This example shows how to set up all components and integrate them with
 * the existing cognitive fusion system for enhanced human factors support.
 * 
 * @version 1.0.0
 * @author Synopticon Development Team
 */

import { createInformationFusionEngine } from '../src/core/cognitive/fusion-engine.js';
import { createTemporalContextEngine } from '../src/core/cognitive/temporal-context-engine.js';
import { createExplainableAIEngine } from '../src/core/cognitive/explainable-ai-engine.js';
import { createPredictionConfidenceVisualization } from '../src/core/cognitive/prediction-confidence-visualization.js';

/**
 * Example configuration for advanced cognitive system integration
 */
const ADVANCED_COGNITIVE_CONFIG = {
  temporalContext: {
    maxHistorySize: 10000,
    circadianModelType: 'two-process',
    fatigueModelType: 'three-process',
    taskPhaseDetection: true,
    predictionHorizon: 1800000, // 30 minutes
    adaptationLearning: true
  },
  explainableAI: {
    explanationMethods: ['feature-attribution', 'rule-based', 'causal-reasoning'],
    explanationStyle: 'balanced',
    confidenceThreshold: 0.7,
    attributionMethod: 'integrated-gradients',
    maxExplanationLength: 500
  },
  confidenceVisualization: {
    canvasWidth: 1200,
    canvasHeight: 600,
    updateInterval: 100,
    historyLength: 300,
    visualizationStyle: 'balanced',
    enableInteractivity: true,
    showUncertaintyBands: true,
    showTemporalProgression: true
  }
};

/**
 * Create and configure the advanced cognitive system
 * @returns {Object} Configured cognitive system with all components
 */
const createAdvancedCognitiveSystem = async () => {
  console.log('🚀 Initializing Advanced Cognitive System...');
  
  // 1. Create core fusion engine
  const fusionEngine = createInformationFusionEngine({
    enableTemporalFusion: true,
    confidenceWeighting: true,
    adaptiveLearning: true
  });
  
  // 2. Create temporal context engine
  const temporalContextEngine = createTemporalContextEngine(ADVANCED_COGNITIVE_CONFIG.temporalContext);
  
  // 3. Create explainable AI engine
  const explainableAIEngine = createExplainableAIEngine(ADVANCED_COGNITIVE_CONFIG.explainableAI);
  
  // 4. Create prediction confidence visualization
  const confidenceVisualization = createPredictionConfidenceVisualization(ADVANCED_COGNITIVE_CONFIG.confidenceVisualization);
  
  // 5. Initialize all components
  await temporalContextEngine.initialize();
  await explainableAIEngine.initialize();
  
  console.log('✅ All cognitive components initialized');
  
  // 6. Integrate all components with the fusion engine
  fusionEngine.integrateAdvancedCognitiveComponents({
    temporalContext: temporalContextEngine,
    explainableAI: explainableAIEngine,
    confidenceVisualization
  });
  
  return {
    fusionEngine,
    temporalContextEngine,
    explainableAIEngine,
    confidenceVisualization
  };
};

/**
 * Simulate multi-modal data streams for testing
 * @param {Object} cognitiveSystem - The cognitive system to feed data to
 */
const simulateDataStreams = (cognitiveSystem) => {
  const { fusionEngine } = cognitiveSystem;
  
  console.log('📊 Starting data stream simulation...');
  
  // Simulate physiological data stream
  setInterval(() => {
    const physiologicalData = {
      heartRate: 70 + Math.random() * 30,
      heartRateVariability: 0.3 + Math.random() * 0.4,
      eyeBlinkRate: 0.2 + Math.random() * 0.3,
      cortisol: 0.2 + Math.random() * 0.4,
      temperature: 36.5 + Math.random() * 1.0,
      timestamp: Date.now(),
      confidence: 0.9 + Math.random() * 0.1
    };
    
    fusionEngine.ingestData('human', 'physiological', physiologicalData);
  }, 1000);
  
  // Simulate behavioral data stream
  setInterval(() => {
    const behavioralData = {
      taskSwitchingRate: 0.3 + Math.random() * 0.4,
      reactionTimeIncrease: 0.1 + Math.random() * 0.5,
      errorRecoveryTime: 2 + Math.random() * 3,
      attentionFocus: 0.6 + Math.random() * 0.3,
      timestamp: Date.now(),
      confidence: 0.8 + Math.random() * 0.2
    };
    
    fusionEngine.ingestData('human', 'behavioral', behavioralData);
  }, 1500);
  
  // Simulate performance data stream
  setInterval(() => {
    const performanceData = {
      accuracy: 0.8 + Math.random() * 0.15,
      errorRate: 0.05 + Math.random() * 0.15,
      variability: 0.2 + Math.random() * 0.3,
      taskCompletionTime: 30 + Math.random() * 20,
      timestamp: Date.now(),
      confidence: 0.95 + Math.random() * 0.05
    };
    
    fusionEngine.ingestData('human', 'performance', performanceData);
  }, 2000);
  
  // Simulate environmental data stream
  setInterval(() => {
    const weatherData = {
      visibility: 5000 + Math.random() * 5000,
      windSpeed: 5 + Math.random() * 25,
      precipitationIntensity: Math.random() * 0.5,
      temperature: 15 + Math.random() * 20,
      timestamp: Date.now(),
      confidence: 0.85 + Math.random() * 0.15
    };
    
    fusionEngine.ingestData('external', 'weather', weatherData);
    
    const trafficData = {
      density: 20 + Math.random() * 60,
      conflicts: Array.from({ length: Math.floor(Math.random() * 5) }, (_, i) => ({
        type: 'vehicle',
        distance: 100 + Math.random() * 500,
        severity: Math.random()
      })),
      timestamp: Date.now(),
      confidence: 0.9 + Math.random() * 0.1
    };
    
    fusionEngine.ingestData('external', 'traffic', trafficData);
  }, 3000);
  
  // Simulate simulator telemetry data stream
  setInterval(() => {
    const telemetryData = {
      position: { x: Math.random() * 1000, y: Math.random() * 1000, z: Math.random() * 100 },
      velocity: { x: Math.random() * 50, y: Math.random() * 50, z: Math.random() * 10 },
      altitude: 1000 + Math.random() * 5000,
      speed: 50 + Math.random() * 200,
      health: 0.9 + Math.random() * 0.1,
      complexity: 0.3 + Math.random() * 0.4,
      timestamp: Date.now(),
      confidence: 0.98
    };
    
    fusionEngine.ingestData('simulator', 'telemetry', telemetryData);
  }, 100);
  
  console.log('✅ Data stream simulation started');
};

/**
 * Set up event monitoring and logging
 * @param {Object} cognitiveSystem - The cognitive system to monitor
 */
const setupMonitoring = (cognitiveSystem) => {
  const { fusionEngine, temporalContextEngine, explainableAIEngine, confidenceVisualization } = cognitiveSystem;
  
  console.log('📋 Setting up system monitoring...');
  
  // Monitor fusion events
  fusionEngine.on('fusionCompleted', (event) => {
    console.log(`🔄 Fusion completed: ${event.type}`, {
      confidence: event.result.confidence,
      temporalContext: event.result.temporalContext?.currentPhase,
      explanation: `${event.result.explanation?.summary?.substring(0, 50)  }...`
    });
  });
  
  // Monitor temporal context events
  temporalContextEngine.on('circadianUpdate', (update) => {
    console.log('⏰ Circadian update:', {
      phase: update.currentPhase,
      alertness: update.alertnessLevel.toFixed(2),
      fatigue: update.fatigueLevel.toFixed(2)
    });
  });
  
  temporalContextEngine.on('phaseTransition', (transition) => {
    console.log(`🔄 Task phase transition: ${transition.from} → ${transition.to}`);
  });
  
  // Monitor explainable AI events
  explainableAIEngine.on('explanationGenerated', (explanation) => {
    console.log('💡 Explanation generated:', {
      method: explanation.method,
      confidence: explanation.confidence.toFixed(2),
      summary: `${explanation.summary.substring(0, 50)  }...`
    });
  });
  
  // Monitor data quality
  setInterval(() => {
    const quality = fusionEngine.getDataQuality();
    const stats = confidenceVisualization.getConfidenceStats();
    
    console.log('📊 System Health:', {
      dataSources: quality.sources,
      avgQuality: quality.averageQuality?.toFixed(2) || 'N/A',
      avgConfidence: quality.averageConfidence?.toFixed(2) || 'N/A',
      overallConfidence: stats?.overall?.toFixed(2) || 'N/A',
      trend: stats?.trend?.toFixed(2) || 'N/A'
    });
  }, 30000); // Every 30 seconds
  
  console.log('✅ System monitoring active');
};

/**
 * Set up visualization in DOM
 * @param {Object} cognitiveSystem - The cognitive system
 * @param {string} containerId - ID of container element
 */
const setupVisualization = async (cognitiveSystem, containerId = 'confidence-visualization') => {
  const { confidenceVisualization } = cognitiveSystem;
  
  console.log('🎨 Setting up confidence visualization...');
  
  // Create container if it doesn't exist
  let container = document.getElementById(containerId);
  if (!container) {
    container = document.createElement('div');
    container.id = containerId;
    container.style.width = '1200px';
    container.style.height = '600px';
    container.style.border = '2px solid #374151';
    container.style.borderRadius = '8px';
    container.style.margin = '20px';
    container.style.backgroundColor = '#1f2937';
    
    document.body.appendChild(container);
  }
  
  // Initialize visualization
  await confidenceVisualization.initialize(container);
  confidenceVisualization.start();
  
  console.log('✅ Confidence visualization ready');
};

/**
 * Demonstrate advanced cognitive features
 * @param {Object} cognitiveSystem - The cognitive system
 */
const demonstrateAdvancedFeatures = async (cognitiveSystem) => {
  const { temporalContextEngine, explainableAIEngine, fusionEngine } = cognitiveSystem;
  
  console.log('🎯 Demonstrating advanced cognitive features...');
  
  // Wait for some data to accumulate
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  // Demonstrate temporal predictions
  console.log('⏰ Temporal Predictions:');
  const temporalPredictions = temporalContextEngine.generatePredictions(30 * 60 * 1000); // 30 minutes
  console.log('  - Fatigue in 30min:', temporalPredictions.fatigue.predicted.toFixed(2));
  console.log('  - Alertness in 30min:', temporalPredictions.alertness.predicted.toFixed(2));
  console.log('  - Cognitive Load in 30min:', temporalPredictions.cognitiveLoad.predicted.toFixed(2));
  
  // Demonstrate explanation generation
  const currentResult = fusionEngine.getFusionResult('human-state');
  if (currentResult) {
    console.log('💡 AI Explanations:');
    
    const featureExplanation = explainableAIEngine.explainPrediction({
      prediction: currentResult,
      features: {
        cognitiveLoad: currentResult.cognitiveLoad,
        fatigue: currentResult.fatigue,
        stress: currentResult.stress
      },
      context: { method: 'feature-attribution' }
    });
    
    console.log('  - Feature Attribution:', featureExplanation.summary);
    
    const ruleExplanation = explainableAIEngine.explainPrediction({
      prediction: currentResult,
      features: {
        cognitiveLoad: currentResult.cognitiveLoad,
        fatigue: currentResult.fatigue,
        stress: currentResult.stress
      },
      context: { method: 'rule-based' }
    });
    
    console.log('  - Rule-based:', ruleExplanation.summary);
  }
  
  // Demonstrate visualization export
  const imageData = cognitiveSystem.confidenceVisualization.exportImage('png');
  console.log('📸 Visualization exported as data URL (length:', imageData?.length || 0, 'chars)');
  
  console.log('✅ Advanced features demonstration complete');
};

/**
 * Main demo function
 */
const runAdvancedCognitiveDemo = async () => {
  try {
    console.log('🚀 Starting Advanced Cognitive Integration Demo');
    console.log('================================================');
    
    // 1. Create and configure the system
    const cognitiveSystem = await createAdvancedCognitiveSystem();
    
    // 2. Set up visualization (only in browser environment)
    if (typeof document !== 'undefined') {
      await setupVisualization(cognitiveSystem);
    } else {
      console.log('📝 Running in Node.js - visualization skipped');
    }
    
    // 3. Set up monitoring
    setupMonitoring(cognitiveSystem);
    
    // 4. Start data simulation
    simulateDataStreams(cognitiveSystem);
    
    // 5. Wait and demonstrate features
    await new Promise(resolve => setTimeout(resolve, 10000));
    await demonstrateAdvancedFeatures(cognitiveSystem);
    
    console.log('===============================================');
    console.log('🎉 Advanced Cognitive Integration Demo Running');
    console.log('Monitor console for real-time updates...');
    
    // Keep the demo running
    if (typeof process !== 'undefined') {
      process.on('SIGINT', () => {
        console.log('\n👋 Shutting down Advanced Cognitive Demo...');
        cognitiveSystem.confidenceVisualization.cleanup();
        process.exit(0);
      });
    }
    
  } catch (error) {
    console.error('❌ Demo failed:', error);
    
    if (typeof process !== 'undefined') {
      process.exit(1);
    }
  }
};

// Export for use in other modules
export {
  createAdvancedCognitiveSystem,
  simulateDataStreams,
  setupMonitoring,
  setupVisualization,
  demonstrateAdvancedFeatures,
  runAdvancedCognitiveDemo,
  ADVANCED_COGNITIVE_CONFIG
};

// Run demo if this file is executed directly
if (typeof process !== 'undefined' && process.argv[1]?.includes('advanced-cognitive-integration.js')) {
  runAdvancedCognitiveDemo();
}