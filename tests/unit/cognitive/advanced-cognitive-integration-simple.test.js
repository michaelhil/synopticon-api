/**
 * @fileoverview Simplified Advanced Cognitive Integration Test
 * 
 * Basic integration tests for the three advanced cognitive components:
 * - Temporal Context Engine
 * - Explainable AI Engine  
 * - Prediction Confidence Visualization
 * 
 * Focuses on integration functionality rather than detailed unit testing.
 * 
 * @version 1.0.0
 * @author Synopticon Development Team
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { createInformationFusionEngine } from '../../src/core/cognitive/fusion-engine.js';

// Mock DOM for visualization testing
const setupMockDOM = () => {
  global.document = {
    createElement: () => ({
      style: {},
      addEventListener: () => {},
      appendChild: () => {},
      getContext: () => ({
        imageSmoothingEnabled: true,
        fillStyle: '',
        fillRect: () => {},
        fillText: () => {},
        beginPath: () => {},
        moveTo: () => {},
        lineTo: () => {},
        stroke: () => {},
        fill: () => {}
      }),
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 400, height: 300 }),
      toDataURL: () => 'data:image/png;base64,test'
    }),
    body: { appendChild: () => {} }
  };
  
  global.requestAnimationFrame = (callback) => {
    setTimeout(callback, 16);
    return 1;
  };
  global.cancelAnimationFrame = () => {};
};

describe('Advanced Cognitive Integration', () => {
  let fusionEngine;
  
  beforeEach(() => {
    setupMockDOM();
    fusionEngine = createInformationFusionEngine();
  });
  
  test('should create fusion engine successfully', () => {
    expect(fusionEngine).toBeDefined();
    expect(typeof fusionEngine.ingestData).toBe('function');
    expect(typeof fusionEngine.getFusionResult).toBe('function');
    expect(typeof fusionEngine.integrateAdvancedCognitiveComponents).toBe('function');
  });
  
  test('should ingest and process physiological data', () => {
    const physiologicalData = {
      heartRate: 80,
      heartRateVariability: 0.4,
      timestamp: Date.now(),
      confidence: 0.9
    };
    
    const quality = fusionEngine.ingestData('human', 'physiological', physiologicalData);
    
    expect(quality).toBeDefined();
    expect(quality.quality).toBeGreaterThan(0);
    expect(quality.confidence).toBeGreaterThan(0);
  });
  
  test('should handle multiple data sources', async () => {
    // Ingest various data types
    fusionEngine.ingestData('human', 'physiological', {
      heartRate: 75,
      timestamp: Date.now(),
      confidence: 0.9
    });
    
    fusionEngine.ingestData('human', 'behavioral', {
      taskSwitchingRate: 0.5,
      timestamp: Date.now(),
      confidence: 0.8
    });
    
    fusionEngine.ingestData('human', 'performance', {
      accuracy: 0.85,
      timestamp: Date.now(),
      confidence: 0.95
    });
    
    // Wait for fusion processing
    await new Promise(resolve => setTimeout(resolve, 50));
    
    const humanState = fusionEngine.getFusionResult('human-state');
    expect(humanState).toBeDefined();
  });
  
  test('should get data quality metrics', () => {
    // Add some test data
    fusionEngine.ingestData('human', 'physiological', {
      heartRate: 70,
      timestamp: Date.now(),
      confidence: 0.9
    });
    
    const quality = fusionEngine.getDataQuality();
    
    expect(quality).toBeDefined();
    expect(quality.sources).toBeGreaterThan(0);
    expect(typeof quality.averageQuality).toBe('number');
    expect(typeof quality.averageConfidence).toBe('number');
  });
  
  test('should handle integration without components', () => {
    // Should not throw error when integrating with null components
    expect(() => {
      fusionEngine.integrateAdvancedCognitiveComponents({
        temporalContext: null,
        explainableAI: null,
        confidenceVisualization: null
      });
    }).not.toThrow();
  });
  
  test('should emit fusion events', async () => {
    let eventReceived = false;
    
    fusionEngine.on('fusionCompleted', (event) => {
      eventReceived = true;
      expect(event.type).toBeDefined();
      expect(event.result).toBeDefined();
    });
    
    // Trigger fusion with sufficient data
    fusionEngine.ingestData('human', 'physiological', {
      heartRate: 80,
      timestamp: Date.now(),
      confidence: 0.9
    });
    
    fusionEngine.ingestData('human', 'behavioral', {
      taskSwitchingRate: 0.4,
      timestamp: Date.now(),
      confidence: 0.8
    });
    
    // Wait for async processing
    await new Promise(resolve => setTimeout(resolve, 100));
    
    expect(eventReceived).toBe(true);
  });
  
  test('should handle performance under moderate load', () => {
    const startTime = Date.now();
    
    // Process 50 data points
    for (let i = 0; i < 50; i++) {
      fusionEngine.ingestData('human', 'physiological', {
        heartRate: 70 + Math.random() * 30,
        timestamp: Date.now(),
        confidence: 0.8 + Math.random() * 0.2
      });
    }
    
    const endTime = Date.now();
    const totalTime = endTime - startTime;
    
    // Should complete within reasonable time
    expect(totalTime).toBeLessThan(1000); // Less than 1 second
  });
});

describe('Component Factory Functions', () => {
  beforeEach(() => {
    setupMockDOM();
  });
  
  test('should import and create temporal context engine', async () => {
    const { createTemporalContextEngine } = await import('../../src/core/cognitive/temporal-context-engine.js');
    
    const engine = createTemporalContextEngine({
      maxHistorySize: 100,
      predictionHorizon: 60000
    });
    
    expect(engine).toBeDefined();
    expect(typeof engine).toBe('object');
  });
  
  test('should import and create explainable AI engine', async () => {
    const { createExplainableAIEngine } = await import('../../src/core/cognitive/explainable-ai-engine.js');
    
    const engine = createExplainableAIEngine({
      explanationStyle: 'technical'
    });
    
    expect(engine).toBeDefined();
    expect(typeof engine).toBe('object');
  });
  
  test('should import and create confidence visualization', async () => {
    const { createPredictionConfidenceVisualization } = await import('../../src/core/cognitive/prediction-confidence-visualization.js');
    
    const visualization = createPredictionConfidenceVisualization({
      canvasWidth: 400,
      canvasHeight: 300
    });
    
    expect(visualization).toBeDefined();
    expect(typeof visualization).toBe('object');
  });
});

describe('Advanced Integration Demo', () => {
  test('should import demo functions', async () => {
    const demo = await import('../../examples/advanced-cognitive-integration.js');
    
    expect(demo.createAdvancedCognitiveSystem).toBeDefined();
    expect(demo.simulateDataStreams).toBeDefined();
    expect(demo.setupMonitoring).toBeDefined();
    expect(demo.ADVANCED_COGNITIVE_CONFIG).toBeDefined();
    expect(typeof demo.createAdvancedCognitiveSystem).toBe('function');
  });
  
  test('should have valid configuration', async () => {
    const { ADVANCED_COGNITIVE_CONFIG } = await import('../../examples/advanced-cognitive-integration.js');
    
    expect(ADVANCED_COGNITIVE_CONFIG.temporalContext).toBeDefined();
    expect(ADVANCED_COGNITIVE_CONFIG.explainableAI).toBeDefined();
    expect(ADVANCED_COGNITIVE_CONFIG.confidenceVisualization).toBeDefined();
    
    expect(typeof ADVANCED_COGNITIVE_CONFIG.temporalContext.maxHistorySize).toBe('number');
    expect(typeof ADVANCED_COGNITIVE_CONFIG.explainableAI.confidenceThreshold).toBe('number');
    expect(typeof ADVANCED_COGNITIVE_CONFIG.confidenceVisualization.canvasWidth).toBe('number');
  });
});