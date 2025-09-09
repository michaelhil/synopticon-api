/**
 * @fileoverview Advanced Cognitive Components Test Suite
 * 
 * Comprehensive testing framework for the three advanced cognitive components:
 * - Temporal Context Engine
 * - Explainable AI Engine  
 * - Prediction Confidence Visualization
 * 
 * Tests integration, functionality, performance, and reliability under various conditions.
 * 
 * @version 1.0.0
 * @author Synopticon Development Team
 */

import { describe, test, expect, beforeEach, afterEach, mock } from 'bun:test';
import { createTemporalContextEngine } from '../../src/core/cognitive/temporal-context-engine.js';
import { createExplainableAIEngine } from '../../src/core/cognitive/explainable-ai-engine.js';
import { createPredictionConfidenceVisualization } from '../../src/core/cognitive/prediction-confidence-visualization.js';
import { createInformationFusionEngine } from '../../src/core/cognitive/fusion-engine.js';

// Test configuration constants
const TEST_CONFIG = {
  temporal: {
    maxHistorySize: 100,
    circadianModelType: 'two-process',
    fatigueModelType: 'three-process',
    predictionHorizon: 60000, // 1 minute for testing
    adaptationLearning: false // Disable for deterministic tests
  },
  explainableAI: {
    explanationMethods: ['feature-attribution', 'rule-based'],
    explanationStyle: 'technical',
    confidenceThreshold: 0.6,
    maxExplanationLength: 200
  },
  confidenceVisualization: {
    canvasWidth: 400,
    canvasHeight: 300,
    updateInterval: 50,
    historyLength: 50,
    visualizationStyle: 'technical',
    enableInteractivity: false // Disable for headless testing
  }
};

// Mock DOM environment for visualization tests
const setupMockDOM = () => {
  global.document = {
    createElement: (tag) => {
      const element = {
        tagName: tag.toUpperCase(),
        style: {},
        width: 0,
        height: 0,
        addEventListener: mock(),
        removeEventListener: mock(),
        appendChild: mock(),
        removeChild: mock(),
        getContext: (type) => ({
          imageSmoothingEnabled: true,
          imageSmoothingQuality: 'high',
          fillStyle: '',
          strokeStyle: '',
          lineWidth: 1,
          font: '',
          textAlign: 'left',
          fillRect: mock(),
          strokeRect: mock(),
          fillText: mock(),
          beginPath: mock(),
          moveTo: mock(),
          lineTo: mock(),
          arc: mock(),
          fill: mock(),
          stroke: mock()
        }),
        getBoundingClientRect: () => ({
          left: 0,
          top: 0,
          width: 400,
          height: 300
        }),
        toDataURL: () => 'data:image/png;base64,mock'
      };
      return element;
    },
    getElementById: () => null,
    body: {
      appendChild: mock()
    }
  };
  
  global.cancelAnimationFrame = mock();
  global.requestAnimationFrame = (callback) => {
    setTimeout(callback, 16);
    return 1;
  };
};

describe('Temporal Context Engine', () => {
  let temporalEngine;
  
  beforeEach(async () => {
    temporalEngine = createTemporalContextEngine(TEST_CONFIG.temporal);
    // Components are ready to use immediately, no initialization needed
  });
  
  afterEach(() => {
    if (temporalEngine && temporalEngine.cleanup) {
      temporalEngine.cleanup();
    }
  });
  
  test('should initialize correctly with default configuration', () => {
    const engine = createTemporalContextEngine();
    
    expect(engine).toBeDefined();
    expect(typeof engine.analyzeTemporalContext).toBe('function');
    expect(typeof engine.generatePredictions).toBe('function');
    expect(typeof engine.updateCircadianState).toBe('function');
    
    if (engine.cleanup) {
      engine.cleanup();
    }
  });
  
  test('should analyze temporal context with current state', () => {
    const stateData = {
      cognitiveLoad: 0.6,
      fatigue: 0.4,
      stress: 0.3,
      timestamp: Date.now()
    };
    
    const context = temporalEngine.analyzeTemporalContext(stateData);
    
    expect(context).toBeDefined();
    expect(context.currentPhase).toBeDefined();
    expect(context.circadianState).toBeDefined();
    expect(context.fatigueState).toBeDefined();
    expect(typeof context.circadianState.alertnessLevel).toBe('number');
    expect(context.circadianState.alertnessLevel).toBeGreaterThanOrEqual(0);
    expect(context.circadianState.alertnessLevel).toBeLessThanOrEqual(1);
  });
  
  test('should generate temporal predictions', async () => {
    // Add some history data
    const baseTime = Date.now();
    for (let i = 0; i < 10; i++) {
      temporalEngine.analyzeTemporalContext({
        cognitiveLoad: 0.5 + Math.random() * 0.3,
        fatigue: 0.3 + Math.random() * 0.4,
        stress: 0.2 + Math.random() * 0.3,
        timestamp: baseTime + i * 60000
      });
    }
    
    const predictions = temporalEngine.generatePredictions(30 * 60000); // 30 minutes
    
    expect(predictions).toBeDefined();
    expect(predictions.fatigue).toBeDefined();
    expect(predictions.alertness).toBeDefined();
    expect(predictions.cognitiveLoad).toBeDefined();
    
    expect(typeof predictions.fatigue.predicted).toBe('number');
    expect(typeof predictions.fatigue.confidence).toBe('number');
    expect(predictions.fatigue.confidence).toBeGreaterThanOrEqual(0);
    expect(predictions.fatigue.confidence).toBeLessThanOrEqual(1);
  });
  
  test('should detect task phase transitions', async () => {
    const phases = [];
    temporalEngine.on('phaseTransition', (transition) => {
      phases.push(transition);
    });
    
    // Simulate task progression
    const progressionData = [
      { cognitiveLoad: 0.2, timestamp: Date.now() }, // Orientation
      { cognitiveLoad: 0.4, timestamp: Date.now() + 60000 }, // Adaptation
      { cognitiveLoad: 0.7, timestamp: Date.now() + 120000 }, // Performance
      { cognitiveLoad: 0.8, timestamp: Date.now() + 180000 }, // Peak
      { cognitiveLoad: 0.6, timestamp: Date.now() + 240000 } // Plateau
    ];
    
    for (const data of progressionData) {
      temporalEngine.analyzeTemporalContext(data);
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    
    expect(phases.length).toBeGreaterThan(0);
    expect(phases[0].from).toBeDefined();
    expect(phases[0].to).toBeDefined();
  });
  
  test('should handle circadian rhythm modeling', async () => {
    const morningTime = new Date();
    morningTime.setHours(8, 0, 0, 0);
    
    const eveningTime = new Date();
    eveningTime.setHours(20, 0, 0, 0);
    
    const morningContext = temporalEngine.analyzeTemporalContext({
      cognitiveLoad: 0.5,
      timestamp: morningTime.getTime()
    });
    
    const eveningContext = temporalEngine.analyzeTemporalContext({
      cognitiveLoad: 0.5,
      timestamp: eveningTime.getTime()
    });
    
    expect(morningContext.circadianState.alertnessLevel).toBeDefined();
    expect(eveningContext.circadianState.alertnessLevel).toBeDefined();
    
    // Morning should generally have different alertness than evening
    expect(morningContext.circadianState.phase).not.toBe(eveningContext.circadianState.phase);
  });
});

describe('Explainable AI Engine', () => {
  let aiEngine;
  
  beforeEach(() => {
    aiEngine = createExplainableAIEngine(TEST_CONFIG.explainableAI);
    // Components are ready to use immediately, no initialization needed
  });
  
  afterEach(() => {
    if (aiEngine && aiEngine.cleanup) {
      aiEngine.cleanup();
    }
  });
  
  test('should initialize with correct configuration', () => {
    const engine = createExplainableAIEngine();
    
    expect(engine).toBeDefined();
    expect(typeof engine.explainPrediction).toBe('function');
    expect(typeof engine.generateFeatureAttribution).toBe('function');
    expect(typeof engine.generateRuleBasedExplanation).toBe('function');
    
    if (engine.cleanup) {
      engine.cleanup();
    }
  });
  
  test('should generate feature attribution explanations', async () => {
    const prediction = {
      cognitiveLoad: 0.7,
      fatigue: 0.5,
      stress: 0.4,
      confidence: 0.8
    };
    
    const features = {
      heartRate: 85,
      heartRateVariability: 0.3,
      eyeBlinkRate: 0.4,
      taskSwitchingRate: 0.6
    };
    
    const explanation = aiEngine.explainPrediction({
      prediction,
      features,
      context: { method: 'feature-attribution' }
    });
    
    expect(explanation).toBeDefined();
    expect(explanation.method).toBe('feature-attribution');
    expect(explanation.summary).toBeDefined();
    expect(explanation.confidence).toBeDefined();
    expect(explanation.featureAttributions).toBeDefined();
    expect(Array.isArray(explanation.featureAttributions)).toBe(true);
    
    if (explanation.featureAttributions.length > 0) {
      const attribution = explanation.featureAttributions[0];
      expect(attribution.feature).toBeDefined();
      expect(typeof attribution.importance).toBe('number');
    }
  });
  
  test('should generate rule-based explanations', async () => {
    const prediction = {
      cognitiveLoad: 0.8,
      fatigue: 0.6,
      stress: 0.7
    };
    
    const features = {
      heartRate: 95,
      cognitiveLoad: 0.8,
      fatigue: 0.6
    };
    
    const explanation = aiEngine.explainPrediction({
      prediction,
      features,
      context: { method: 'rule-based' }
    });
    
    expect(explanation).toBeDefined();
    expect(explanation.method).toBe('rule-based');
    expect(explanation.summary).toBeDefined();
    expect(explanation.rules).toBeDefined();
    expect(Array.isArray(explanation.rules)).toBe(true);
    
    if (explanation.rules.length > 0) {
      const rule = explanation.rules[0];
      expect(rule.condition).toBeDefined();
      expect(rule.conclusion).toBeDefined();
      expect(typeof rule.confidence).toBe('number');
    }
  });
  
  test('should handle different explanation styles', async () => {
    const prediction = { cognitiveLoad: 0.6 };
    const features = { heartRate: 80 };
    
    const technicalExplanation = aiEngine.explainPrediction({
      prediction,
      features,
      context: { explanationStyle: 'technical' }
    });
    
    const simpleExplanation = aiEngine.explainPrediction({
      prediction,
      features,
      context: { explanationStyle: 'simple' }
    });
    
    expect(technicalExplanation.summary).toBeDefined();
    expect(simpleExplanation.summary).toBeDefined();
    expect(technicalExplanation.summary).not.toBe(simpleExplanation.summary);
  });
  
  test('should validate explanation confidence scores', async () => {
    const prediction = { cognitiveLoad: 0.5, confidence: 0.9 };
    const features = { heartRate: 75, taskComplexity: 0.4 };
    
    const explanation = aiEngine.explainPrediction({
      prediction,
      features
    });
    
    expect(explanation.confidence).toBeGreaterThanOrEqual(0);
    expect(explanation.confidence).toBeLessThanOrEqual(1);
    expect(explanation.uncertainty).toBeDefined();
    expect(explanation.uncertainty.total).toBeGreaterThanOrEqual(0);
    expect(explanation.uncertainty.total).toBeLessThanOrEqual(1);
  });
});

describe('Prediction Confidence Visualization', () => {
  let visualization;
  
  beforeEach(async () => {
    setupMockDOM();
    visualization = createPredictionConfidenceVisualization(TEST_CONFIG.confidenceVisualization);
    
    const container = document.createElement('div');
    await visualization.initialize(container);
  });
  
  afterEach(() => {
    visualization.cleanup();
  });
  
  test('should initialize without errors in mock DOM environment', async () => {
    const viz = createPredictionConfidenceVisualization();
    const container = document.createElement('div');
    
    await expect(viz.initialize(container)).resolves.toBe(undefined);
    
    expect(viz).toBeDefined();
    expect(typeof viz.start).toBe('function');
    expect(typeof viz.stop).toBe('function');
    expect(typeof viz.updateConfidence).toBe('function');
    
    viz.cleanup();
  });
  
  test('should update confidence data correctly', () => {
    const confidenceData = {
      timestamp: Date.now(),
      overallConfidence: 0.8,
      featureConfidences: new Map([
        ['cognitiveLoad', 0.7],
        ['fatigue', 0.9],
        ['stress', 0.6]
      ]),
      uncertaintyBounds: { upper: 0.9, lower: 0.7 },
      predictionType: 'human-state',
      explanation: { summary: 'Test explanation' },
      temporalTrend: 0.1
    };
    
    expect(() => visualization.updateConfidence(confidenceData)).not.toThrow();
    
    const stats = visualization.getConfidenceStats();
    expect(stats).toBeDefined();
    expect(stats.overall).toBe(0.8);
    expect(stats.mean).toBeCloseTo(0.73, 1);
  });
  
  test('should handle visualization style changes', () => {
    expect(() => visualization.setVisualizationStyle('technical')).not.toThrow();
    expect(() => visualization.setVisualizationStyle('simple')).not.toThrow();
    expect(() => visualization.setVisualizationStyle('balanced')).not.toThrow();
    
    // Invalid style should not crash
    expect(() => visualization.setVisualizationStyle('invalid')).not.toThrow();
  });
  
  test('should export image data', () => {
    // Add some confidence data first
    visualization.updateConfidence({
      timestamp: Date.now(),
      overallConfidence: 0.75,
      featureConfidences: new Map([['test', 0.8]]),
      uncertaintyBounds: { upper: 0.85, lower: 0.65 }
    });
    
    const imageData = visualization.exportImage('png');
    expect(imageData).toBeDefined();
    expect(typeof imageData).toBe('string');
    expect(imageData.startsWith('data:image/png')).toBe(true);
  });
  
  test('should handle interaction mode changes', () => {
    expect(() => visualization.setInteractionMode('overview')).not.toThrow();
    expect(() => visualization.setInteractionMode('detailed')).not.toThrow();
    expect(() => visualization.setInteractionMode('explanation')).not.toThrow();
  });
});

describe('Integration Tests', () => {
  let fusionEngine;
  let temporalEngine;
  let aiEngine;
  let visualization;
  
  beforeEach(async () => {
    setupMockDOM();
    
    fusionEngine = createInformationFusionEngine();
    temporalEngine = createTemporalContextEngine(TEST_CONFIG.temporal);
    aiEngine = createExplainableAIEngine(TEST_CONFIG.explainableAI);
    visualization = createPredictionConfidenceVisualization(TEST_CONFIG.confidenceVisualization);
    
    await temporalEngine.initialize();
    await aiEngine.initialize();
    
    const container = document.createElement('div');
    await visualization.initialize(container);
    
    // Integrate all components
    fusionEngine.integrateAdvancedCognitiveComponents({
      temporalContext: temporalEngine,
      explainableAI: aiEngine,
      confidenceVisualization: visualization
    });
  });
  
  afterEach(() => {
    temporalEngine.cleanup();
    aiEngine.cleanup();
    visualization.cleanup();
  });
  
  test('should integrate all components successfully', () => {
    expect(fusionEngine).toBeDefined();
    expect(temporalEngine).toBeDefined();
    expect(aiEngine).toBeDefined();
    expect(visualization).toBeDefined();
  });
  
  test('should process fusion with temporal context enhancement', async () => {
    const results = [];
    
    fusionEngine.on('fusionCompleted', (event) => {
      results.push(event);
    });
    
    // Ingest test data
    fusionEngine.ingestData('human', 'physiological', {
      heartRate: 80,
      heartRateVariability: 0.4,
      eyeBlinkRate: 0.3,
      timestamp: Date.now(),
      confidence: 0.9
    });
    
    fusionEngine.ingestData('human', 'behavioral', {
      taskSwitchingRate: 0.5,
      reactionTimeIncrease: 0.2,
      timestamp: Date.now(),
      confidence: 0.8
    });
    
    fusionEngine.ingestData('human', 'performance', {
      accuracy: 0.85,
      errorRate: 0.1,
      timestamp: Date.now(),
      confidence: 0.95
    });
    
    // Wait for fusion to complete
    await new Promise(resolve => setTimeout(resolve, 100));
    
    expect(results.length).toBeGreaterThan(0);
    
    const fusionResult = results[0].result;
    expect(fusionResult).toBeDefined();
    expect(fusionResult.temporalContext).toBeDefined();
    expect(fusionResult.explanation).toBeDefined();
    expect(fusionResult.confidence).toBeDefined();
  });
  
  test('should handle event propagation between components', async () => {
    const events = [];
    
    fusionEngine.on('predictionUpdate', (data) => {
      events.push({ type: 'predictionUpdate', data });
    });
    
    temporalEngine.on('phaseTransition', (transition) => {
      events.push({ type: 'phaseTransition', transition });
    });
    
    aiEngine.on('explanationGenerated', (explanation) => {
      events.push({ type: 'explanationGenerated', explanation });
    });
    
    // Trigger fusion with data
    fusionEngine.ingestData('human', 'physiological', {
      heartRate: 90,
      timestamp: Date.now(),
      confidence: 0.9
    });
    
    await new Promise(resolve => setTimeout(resolve, 50));
    
    expect(events.length).toBeGreaterThan(0);
  });
  
  test('should maintain performance under load', async () => {
    const startTime = Date.now();
    const iterations = 100;
    
    for (let i = 0; i < iterations; i++) {
      fusionEngine.ingestData('human', 'physiological', {
        heartRate: 70 + Math.random() * 30,
        timestamp: Date.now(),
        confidence: 0.8 + Math.random() * 0.2
      });
      
      if (i % 10 === 0) {
        await new Promise(resolve => setTimeout(resolve, 1));
      }
    }
    
    const endTime = Date.now();
    const totalTime = endTime - startTime;
    const avgTimePerIteration = totalTime / iterations;
    
    expect(avgTimePerIteration).toBeLessThan(10); // Should be under 10ms per iteration
  });
});

describe('Error Handling and Edge Cases', () => {
  test('should handle null/undefined input gracefully', async () => {
    const temporalEngine = createTemporalContextEngine();
    await temporalEngine.initialize();
    
    expect(() => temporalEngine.analyzeTemporalContext(null)).not.toThrow();
    expect(() => temporalEngine.analyzeTemporalContext(undefined)).not.toThrow();
    expect(() => temporalEngine.analyzeTemporalContext({})).not.toThrow();
    
    temporalEngine.cleanup();
  });
  
  test('should handle invalid configuration parameters', async () => {
    const invalidConfig = {
      maxHistorySize: -1,
      predictionHorizon: 'invalid',
      circadianModelType: 'nonexistent'
    };
    
    expect(() => createTemporalContextEngine(invalidConfig)).not.toThrow();
    expect(() => createExplainableAIEngine(invalidConfig)).not.toThrow();
    expect(() => createPredictionConfidenceVisualization(invalidConfig)).not.toThrow();
  });
  
  test('should recover from component integration failures', async () => {
    const fusionEngine = createInformationFusionEngine();
    const mockComponent = {
      // Intentionally broken integration
      integrateTemporalContext: () => { throw new Error('Integration failed'); }
    };
    
    expect(() => {
      fusionEngine.integrateAdvancedCognitiveComponents({
        temporalContext: mockComponent
      });
    }).not.toThrow();
  });
  
  test('should handle memory constraints with large datasets', async () => {
    const temporalEngine = createTemporalContextEngine({
      maxHistorySize: 10000
    });
    await temporalEngine.initialize();
    
    // Add large amount of data
    for (let i = 0; i < 15000; i++) {
      temporalEngine.analyzeTemporalContext({
        cognitiveLoad: Math.random(),
        timestamp: Date.now() + i * 1000
      });
    }
    
    // Should not crash and should maintain reasonable memory usage
    const context = temporalEngine.analyzeTemporalContext({
      cognitiveLoad: 0.5,
      timestamp: Date.now()
    });
    
    expect(context).toBeDefined();
    
    temporalEngine.cleanup();
  });
});

describe('Performance Benchmarks', () => {
  test('temporal context analysis performance', async () => {
    const engine = createTemporalContextEngine();
    await engine.initialize();
    
    const iterations = 1000;
    const startTime = performance.now();
    
    for (let i = 0; i < iterations; i++) {
      engine.analyzeTemporalContext({
        cognitiveLoad: Math.random(),
        fatigue: Math.random(),
        timestamp: Date.now()
      });
    }
    
    const endTime = performance.now();
    const avgTime = (endTime - startTime) / iterations;
    
    expect(avgTime).toBeLessThan(5); // Should be under 5ms per analysis
    
    engine.cleanup();
  });
  
  test('explanation generation performance', async () => {
    const engine = createExplainableAIEngine();
    await engine.initialize();
    
    const iterations = 100;
    const startTime = performance.now();
    
    for (let i = 0; i < iterations; i++) {
      engine.explainPrediction({
        prediction: { cognitiveLoad: Math.random() },
        features: { heartRate: 70 + Math.random() * 30 }
      });
    }
    
    const endTime = performance.now();
    const avgTime = (endTime - startTime) / iterations;
    
    expect(avgTime).toBeLessThan(20); // Should be under 20ms per explanation
    
    engine.cleanup();
  });
});