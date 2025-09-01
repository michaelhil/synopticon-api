/**
 * Integration tests for the Cognitive Advisory System
 * Tests complete system operation with all components working together
 */

import { expect, test, describe, beforeEach, afterEach } from 'bun:test';
import { createCognitiveStateManager } from '../../src/core/cognitive/state-manager.js';
import { createBidirectionalCommunicationManager } from '../../src/core/cognitive/communication-manager.js';
import { createMultiLevelPipelineSystem } from '../../src/core/cognitive/pipeline-system.js';
import { createInformationFusionEngine } from '../../src/core/cognitive/fusion-engine.js';
import { createLLMIntegration } from '../../src/core/cognitive/llm-integration.js';
import { createContextOrchestrator } from '../../src/core/cognitive/context-orchestrator.js';

describe('Cognitive Advisory System Integration', () => {
  let stateManager: ReturnType<typeof createCognitiveStateManager>;
  let communicationManager: ReturnType<typeof createBidirectionalCommunicationManager>;
  let pipelineSystem: ReturnType<typeof createMultiLevelPipelineSystem>;
  let fusionEngine: ReturnType<typeof createInformationFusionEngine>;
  let llmIntegration: ReturnType<typeof createLLMIntegration>;
  let contextOrchestrator: ReturnType<typeof createContextOrchestrator>;

  beforeEach(() => {
    // Initialize all components
    stateManager = createCognitiveStateManager({
      historySize: 1000
    });

    communicationManager = createBidirectionalCommunicationManager({
      maxQueueSize: 50,
      conversationHistorySize: 100
    });

    pipelineSystem = createMultiLevelPipelineSystem({
      maxConcurrent: 4
    });

    fusionEngine = createInformationFusionEngine();

    llmIntegration = createLLMIntegration({
      providers: [
        { 
          name: 'test', 
          provider: 'mock', 
          model: 'test-model',
          apiKey: 'test-key'
        }
      ]
    });

    // Initialize context orchestrator with all components
    contextOrchestrator = createContextOrchestrator({
      stateManager,
      communicationManager,
      pipelineSystem,
      fusionEngine,
      llmIntegration
    });
  });

  afterEach(() => {
    contextOrchestrator?.stopContextUpdates();
  });

  test('system initialization and component connectivity', () => {
    // Verify all components are properly initialized
    expect(stateManager).toBeDefined();
    expect(communicationManager).toBeDefined();
    expect(pipelineSystem).toBeDefined();
    expect(fusionEngine).toBeDefined();
    expect(llmIntegration).toBeDefined();
    expect(contextOrchestrator).toBeDefined();

    // Check system status
    const status = contextOrchestrator.getSystemStatus();
    expect(status.components.stateManager).toBe(true);
    expect(status.components.communicationManager).toBe(true);
    expect(status.components.pipelineSystem).toBe(true);
    expect(status.components.fusionEngine).toBe(true);
    expect(status.components.llmIntegration).toBe(true);
  });

  test('end-to-end data flow: human state monitoring', async () => {
    // Simulate human physiological data
    const physiologicalData = {
      heartRate: 85,
      heartRateVariability: 45,
      temperature: 36.8,
      timestamp: Date.now(),
      type: 'human-physiological'
    };

    // Simulate behavioral data
    const behavioralData = {
      taskSwitchingRate: 0.3,
      reactionTimeIncrease: 0.15,
      errorRecoveryTime: 1200,
      timestamp: Date.now(),
      type: 'human-behavioral'
    };

    // Simulate performance data
    const performanceData = {
      accuracy: 0.92,
      reactionTime: 350,
      errorRate: 0.08,
      timestamp: Date.now(),
      type: 'human-performance'
    };

    // Ingest data into fusion engine
    const physioQuality = fusionEngine.ingestData('human', 'physiological', physiologicalData);
    const behaviorQuality = fusionEngine.ingestData('human', 'behavioral', behavioralData);
    const perfQuality = fusionEngine.ingestData('human', 'performance', performanceData);

    // Verify data quality assessment
    expect(physioQuality.quality).toBeGreaterThan(0.7);
    expect(behaviorQuality.quality).toBeGreaterThan(0.7);
    expect(perfQuality.quality).toBeGreaterThan(0.7);

    // Wait for fusion to complete
    await new Promise(resolve => setTimeout(resolve, 100));

    // Verify fusion result
    const humanStateFusion = fusionEngine.getFusionResult('human-state');
    expect(humanStateFusion).toBeDefined();
    expect(humanStateFusion.cognitiveLoad).toBeDefined();
    expect(humanStateFusion.fatigue).toBeDefined();
    expect(humanStateFusion.stress).toBeDefined();

    // Update state manager
    stateManager.updateState('human.cognitive.workload', humanStateFusion.cognitiveLoad);
    stateManager.updateState('human.cognitive.fatigue', humanStateFusion.fatigue);
    stateManager.updateState('human.cognitive.stress', humanStateFusion.stress);

    // Verify state updates
    expect(stateManager.getState('human.cognitive.workload')).toBe(humanStateFusion.cognitiveLoad);
    expect(stateManager.getState('human.cognitive.fatigue')).toBe(humanStateFusion.fatigue);
  });

  test('pipeline system processing at different levels', async () => {
    // Test tactical level processing (<50ms)
    const tacticalData = {
      cognitive: { fatigue: 0.7, stress: 0.4, attention: 0.8 },
      emotional: { valence: -0.2, arousal: 0.6 },
      physical: { eyeStrain: 0.5, heartRate: 85, alertness: 0.9 }
    };

    const tacticalStart = Date.now();
    const tacticalResult = await pipelineSystem.process('human-state-monitor', tacticalData, 'tactical');
    const tacticalDuration = Date.now() - tacticalStart;

    expect(tacticalDuration).toBeLessThan(100); // Should be fast
    expect(tacticalResult.alertLevel).toBeDefined();
    expect(tacticalResult.immediate).toBeDefined();
    expect(tacticalResult.recommendation).toBeDefined();

    // Test operational level processing (<500ms)
    const operationalData = {
      accuracy: 0.88,
      reactionTime: 420,
      errorRate: 0.12,
      workload: 0.75,
      history: [
        { performanceScore: 0.85 },
        { performanceScore: 0.82 },
        { performanceScore: 0.88 }
      ]
    };

    const operationalStart = Date.now();
    const operationalResult = await pipelineSystem.process('performance-analysis', operationalData, 'operational');
    const operationalDuration = Date.now() - operationalStart;

    expect(operationalDuration).toBeLessThan(600); // Allow some overhead
    expect(operationalResult.performanceScore).toBeDefined();
    expect(operationalResult.trend).toBeDefined();
    expect(operationalResult.recommendations).toBeDefined();
    expect(Array.isArray(operationalResult.recommendations)).toBe(true);
  });

  test('LLM integration and analysis', async () => {
    const performanceData = {
      accuracy: 0.75,
      reactionTime: 450,
      errorRate: 0.15,
      workload: 0.85,
      fatigue: 0.6,
      trend: 'declining',
      sessionDuration: 45,
      taskComplexity: 'high'
    };

    // Test performance analysis
    const analysisResult = await llmIntegration.analyze('performance-analysis', performanceData);

    expect(analysisResult).toBeDefined();
    expect(analysisResult.analysis).toBeDefined();
    expect(typeof analysisResult.analysis).toBe('string');
    expect(analysisResult.analysis.length).toBeGreaterThan(50);
    expect(analysisResult.confidence).toBeGreaterThan(0);
    expect(analysisResult.confidence).toBeLessThanOrEqual(1);
    expect(Array.isArray(analysisResult.recommendations)).toBe(true);

    // Test advisory generation
    const advisoryContext = {
      mission: {
        phase: 'execution',
        objectives: ['navigate-to-waypoint', 'maintain-altitude'],
        progress: 65
      },
      performance: {
        status: 'degraded'
      },
      userQuery: 'What should I do about the performance issues?'
    };

    const advisoryResult = await llmIntegration.analyze('advisory', advisoryContext);

    expect(advisoryResult).toBeDefined();
    expect(advisoryResult.advisory).toBeDefined();
    expect(typeof advisoryResult.advisory).toBe('string');
    expect(advisoryResult.priority).toBeDefined();
    expect(['high', 'normal', 'low'].includes(advisoryResult.priority)).toBe(true);
  });

  test('context orchestration and decision routing', async () => {
    // Set up a performance degradation scenario
    stateManager.updateState('human.cognitive.workload', 0.9);
    stateManager.updateState('human.cognitive.fatigue', 0.8);
    stateManager.updateState('human.performance.accuracy', 0.65);

    // Simulate system data
    stateManager.updateState('system.vehicle.systems.engines', 'normal');
    stateManager.updateState('system.health', 0.95);

    // Simulate environmental risk
    fusionEngine.ingestData('external', 'weather', {
      visibility: 3000,
      windSpeed: 25,
      precipitationIntensity: 0.3,
      timestamp: Date.now()
    });

    // Wait for fusion
    await new Promise(resolve => setTimeout(resolve, 150));

    // Process through orchestrator
    const response = await contextOrchestrator.processContext({
      performanceDegraded: true,
      userQuery: 'System is getting overwhelmed, need help'
    });

    expect(response).toBeDefined();
    expect(response.route).toBe('performance-intervention');
    expect(response.priority).toBe('high');
    expect(response.status).toBe('completed');
    expect(response.results).toBeDefined();
    expect(response.results.interventions).toBeDefined();
    expect(Array.isArray(response.results.interventions)).toBe(true);
  });

  test('emergency response workflow', async () => {
    // Set up emergency conditions
    const emergencyData = {
      type: 'collision-warning',
      timeToImpact: 8,
      severity: 'high',
      automaticResponse: false
    };

    // Trigger emergency response
    const emergencyResponse = await contextOrchestrator.handleEmergency(emergencyData);

    expect(emergencyResponse).toBeDefined();
    expect(emergencyResponse.route).toBe('emergency-response');
    expect(emergencyResponse.priority).toBe('high');
    expect(emergencyResponse.results).toBeDefined();
    expect(emergencyResponse.results.actions).toBeDefined();
    expect(Array.isArray(emergencyResponse.results.actions)).toBe(true);
    expect(emergencyResponse.results.priority).toBe('critical');

    // Verify state changes
    const automationLevel = stateManager.getState('system.automation.level');
    expect(automationLevel).toBe(5); // Should be maximized
    
    const alertPriority = stateManager.getState('interaction.alerts.priority');
    expect(alertPriority).toBe('critical');
  });

  test('bidirectional communication flow', async () => {
    // Test human-to-AI communication
    const userMessage = {
      content: "I'm feeling overwhelmed with the current workload",
      intent: 'request-help',
      urgency: 'normal',
      timestamp: Date.now()
    };

    const humanResponse = await communicationManager.processHumanInput(userMessage);
    
    expect(humanResponse).toBeDefined();
    expect(humanResponse.acknowledged).toBe(true);
    expect(humanResponse.intent).toBe('request-help');

    // Test AI response generation
    const aiResponse = await communicationManager.generateAIResponse({
      context: 'performance-support',
      userMessage: userMessage.content,
      systemState: stateManager.getSnapshot(),
      priority: 'normal'
    });

    expect(aiResponse).toBeDefined();
    expect(aiResponse.content).toBeDefined();
    expect(typeof aiResponse.content).toBe('string');
    expect(aiResponse.recommendations).toBeDefined();

    // Test simulator communication
    const simulatorCommand = {
      type: 'automation-adjustment',
      parameters: { level: 3 },
      priority: 'normal'
    };

    const simResponse = await communicationManager.sendSimulatorCommand(simulatorCommand);
    
    expect(simResponse).toBeDefined();
    expect(simResponse.success).toBe(true);
    expect(simResponse.commandId).toBeDefined();
  });

  test('system metrics and monitoring', () => {
    // Get comprehensive system status
    const systemStatus = contextOrchestrator.getSystemStatus();

    expect(systemStatus).toBeDefined();
    expect(systemStatus.status).toBeDefined();
    expect(['nominal', 'degraded', 'emergency', 'limited-awareness'].includes(systemStatus.status)).toBe(true);
    expect(systemStatus.components).toBeDefined();
    expect(systemStatus.metrics).toBeDefined();
    expect(systemStatus.lastUpdate).toBeDefined();

    // Check individual component metrics
    const pipelineMetrics = pipelineSystem.getMetrics();
    expect(pipelineMetrics.resource).toBeDefined();
    expect(pipelineMetrics.tasks).toBeDefined();
    expect(pipelineMetrics.processors).toBeDefined();

    const fusionQuality = fusionEngine.getDataQuality();
    expect(fusionQuality.sources).toBeGreaterThanOrEqual(0);

    const llmMetrics = llmIntegration.getMetrics();
    expect(llmMetrics.requests).toBeDefined();
    expect(llmMetrics.provider).toBeDefined();
  });

  test('temporal analysis and prediction', async () => {
    // Create time series data
    const baseTime = Date.now();
    const timePoints = [0, 1000, 2000, 3000, 4000, 5000];
    const workloadValues = [0.3, 0.4, 0.5, 0.6, 0.75, 0.8];

    // Update state over time
    for (let i = 0; i < timePoints.length; i++) {
      stateManager.updateState('human.cognitive.workload', workloadValues[i], {
        timestamp: baseTime + timePoints[i]
      });
      
      // Small delay to ensure temporal ordering
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    // Get temporal analysis
    const analysis = stateManager.getTemporalAnalysis('human.cognitive.workload', 10000);

    expect(analysis).toBeDefined();
    expect(analysis.current).toBe(0.8);
    expect(analysis.trend).toBe('increasing');
    expect(analysis.samples).toBe(6);
    expect(analysis.stats).toBeDefined();
    expect(analysis.stats.mean).toBeGreaterThan(0);

    // Test prediction
    const prediction = stateManager.getStateWithPredictions('human.cognitive.workload', 2);

    expect(prediction).toBeDefined();
    expect(prediction.current).toBe(0.8);
    expect(prediction.predicted).toBeGreaterThan(prediction.current);
    expect(prediction.confidence).toBeGreaterThan(0);
    expect(prediction.confidence).toBeLessThanOrEqual(1);
  });

  test('data fusion accuracy and confidence', async () => {
    // Provide high-quality, consistent data
    const highQualityData = {
      physiological: {
        heartRate: 75,
        heartRateVariability: 50,
        temperature: 36.5,
        timestamp: Date.now(),
        type: 'human-physiological'
      },
      behavioral: {
        taskSwitchingRate: 0.2,
        reactionTimeIncrease: 0.05,
        errorRecoveryTime: 800,
        timestamp: Date.now(),
        type: 'human-behavioral'  
      },
      performance: {
        accuracy: 0.95,
        reactionTime: 280,
        errorRate: 0.05,
        timestamp: Date.now(),
        type: 'human-performance'
      }
    };

    // Ingest high-quality data
    const physioQuality = fusionEngine.ingestData('human', 'physiological', highQualityData.physiological);
    const behaviorQuality = fusionEngine.ingestData('human', 'behavioral', highQualityData.behavioral);
    const perfQuality = fusionEngine.ingestData('human', 'performance', highQualityData.performance);

    // Verify high data quality
    expect(physioQuality.quality).toBeGreaterThan(0.8);
    expect(behaviorQuality.quality).toBeGreaterThan(0.8);
    expect(perfQuality.quality).toBeGreaterThan(0.8);

    // Wait for fusion
    await new Promise(resolve => setTimeout(resolve, 100));

    // Check fusion result quality
    const fusionResult = fusionEngine.getFusionResult('human-state');
    expect(fusionResult).toBeDefined();
    expect(fusionResult.confidence).toBeGreaterThan(0.8);

    // Test with low-quality data
    const lowQualityData = {
      heartRate: 300, // Implausible value
      temperature: 45, // Implausible value
      timestamp: Date.now() - 30000, // Stale data
      type: 'human-physiological'
    };

    const lowQuality = fusionEngine.ingestData('human', 'physiological', lowQualityData);
    expect(lowQuality.quality).toBeLessThan(0.5);
    expect(lowQuality.issues.length).toBeGreaterThan(0);
  });
});

describe('Cognitive System Use Cases', () => {
  let cognitiveSystem: {
    stateManager: ReturnType<typeof createCognitiveStateManager>;
    communicationManager: ReturnType<typeof createBidirectionalCommunicationManager>;
    pipelineSystem: ReturnType<typeof createMultiLevelPipelineSystem>;
    fusionEngine: ReturnType<typeof createInformationFusionEngine>;
    llmIntegration: ReturnType<typeof createLLMIntegration>;
    contextOrchestrator: ReturnType<typeof createContextOrchestrator>;
  };

  beforeEach(() => {
    const stateManager = createCognitiveStateManager();
    const communicationManager = createBidirectionalCommunicationManager();
    const pipelineSystem = createMultiLevelPipelineSystem();
    const fusionEngine = createInformationFusionEngine();
    const llmIntegration = createLLMIntegration();
    const contextOrchestrator = createContextOrchestrator({
      stateManager,
      communicationManager,
      pipelineSystem,
      fusionEngine,
      llmIntegration
    });

    cognitiveSystem = {
      stateManager,
      communicationManager,
      pipelineSystem,
      fusionEngine,
      llmIntegration,
      contextOrchestrator
    };
  });

  afterEach(() => {
    cognitiveSystem.contextOrchestrator?.stopContextUpdates();
  });

  test('Use Case 1: Pilot fatigue detection and intervention', async () => {
    // Simulate gradual fatigue increase
    const fatigueProgression = [0.2, 0.4, 0.6, 0.8, 0.9];
    
    for (const fatigueLevel of fatigueProgression) {
      // Update human state
      cognitiveSystem.stateManager.updateState('human.cognitive.fatigue', fatigueLevel);
      cognitiveSystem.stateManager.updateState('human.physical.eyeStrain', fatigueLevel * 0.8);
      cognitiveSystem.stateManager.updateState('human.performance.accuracy', 1 - fatigueLevel * 0.3);

      // Process through pipeline
      const analysis = await cognitiveSystem.pipelineSystem.process('human-state-monitor', {
        cognitive: { fatigue: fatigueLevel, stress: 0.3, attention: 1 - fatigueLevel * 0.4 },
        emotional: { valence: -fatigueLevel * 0.5, arousal: 0.5 },
        physical: { eyeStrain: fatigueLevel * 0.8, heartRate: 70 + fatigueLevel * 20, alertness: 1 - fatigueLevel }
      }, 'tactical');

      if (fatigueLevel >= 0.8) {
        expect(analysis.immediate).toBe(true);
        expect(analysis.recommendation).toBe('immediate-rest');
      }
    }

    // Verify intervention triggered
    const response = await cognitiveSystem.contextOrchestrator.processContext({
      performanceDegraded: true
    });

    expect(response.route).toBe('performance-intervention');
    expect(response.results.interventions).toBeDefined();
    expect(response.results.interventions.some((i: any) => i.type === 'automation-increase')).toBe(true);
  });

  test('Use Case 2: Environmental risk assessment and route optimization', async () => {
    // Simulate challenging weather conditions
    const weatherData = {
      visibility: 2000,
      windSpeed: 35,
      precipitationIntensity: 0.7,
      timestamp: Date.now()
    };

    const trafficData = {
      density: 80,
      conflicts: [
        { distance: 500, severity: 'moderate' },
        { distance: 300, severity: 'high' }
      ],
      complexity: 0.8,
      timestamp: Date.now()
    };

    // Ingest environmental data
    cognitiveSystem.fusionEngine.ingestData('external', 'weather', weatherData);
    cognitiveSystem.fusionEngine.ingestData('external', 'traffic', trafficData);

    // Wait for fusion
    await new Promise(resolve => setTimeout(resolve, 150));

    // Check environmental fusion result
    const envFusion = cognitiveSystem.fusionEngine.getFusionResult('environmental');
    expect(envFusion).toBeDefined();
    expect(envFusion.totalRisk).toBeGreaterThan(0.5);
    expect(envFusion.recommendation).toBe('high-caution');

    // Process mission optimization
    const optimization = await cognitiveSystem.pipelineSystem.process('mission-optimization', {
      objectives: ['reach-destination', 'avoid-weather'],
      constraints: ['fuel-limit', 'time-constraint'],
      progress: 0.4,
      environment: envFusion
    }, 'operational');

    expect(optimization).toBeDefined();
  });

  test('Use Case 3: Adaptive automation based on workload', async () => {
    // Simulate increasing workload scenario
    const workloadProgression = [0.3, 0.5, 0.7, 0.85, 0.95];
    const automationAdjustments: number[] = [];

    for (const workload of workloadProgression) {
      // Update workload
      cognitiveSystem.stateManager.updateState('human.cognitive.workload', workload);
      
      // Get current automation level
      const currentAutomation = cognitiveSystem.stateManager.getState('system.automation.level') || 0;
      
      // Process performance intervention if needed
      if (workload > 0.8) {
        const response = await cognitiveSystem.contextOrchestrator.processContext({
          performanceDegraded: true
        });

        if (response.results.interventions) {
          const automationChange = response.results.interventions.find((i: any) => i.type === 'automation-increase');
          if (automationChange) {
            automationAdjustments.push(automationChange.to);
          }
        }
      }
    }

    // Verify automation was increased under high workload
    expect(automationAdjustments.length).toBeGreaterThan(0);
    expect(Math.max(...automationAdjustments)).toBeGreaterThan(0);
  });

  test('Use Case 4: Natural language advisory interaction', async () => {
    // Set up operational context
    cognitiveSystem.stateManager.updateState('mission.phase', 'execution');
    cognitiveSystem.stateManager.updateState('mission.progress', 0.75);
    cognitiveSystem.stateManager.updateState('human.performance.accuracy', 0.88);
    cognitiveSystem.stateManager.updateState('system.health', 0.92);

    // Process user query
    const response = await cognitiveSystem.contextOrchestrator.handleUserQuery(
      "How am I doing with the current mission? Any recommendations?"
    );

    expect(response).toBeDefined();
    expect(response.route).toBe('advisory-response');
    expect(response.results.advisory).toBeDefined();
    expect(typeof response.results.advisory).toBe('string');
    expect(response.results.advisory.length).toBeGreaterThan(50);

    // Verify conversation context updated
    const lastOutput = cognitiveSystem.stateManager.getState('interaction.dialogue.lastSystemOutput');
    expect(lastOutput).toBe(response.results.advisory);
  });

  test('Use Case 5: Multi-modal performance monitoring', async () => {
    // Simulate multi-modal data streams
    const physiologicalStream = [
      { heartRate: 72, hrv: 52, timestamp: Date.now() },
      { heartRate: 78, hrv: 48, timestamp: Date.now() + 1000 },
      { heartRate: 85, hrv: 42, timestamp: Date.now() + 2000 },
      { heartRate: 92, hrv: 38, timestamp: Date.now() + 3000 }
    ];

    const behavioralStream = [
      { reactionTime: 320, errorRate: 0.05, timestamp: Date.now() },
      { reactionTime: 340, errorRate: 0.08, timestamp: Date.now() + 1000 },
      { reactionTime: 380, errorRate: 0.12, timestamp: Date.now() + 2000 },
      { reactionTime: 420, errorRate: 0.18, timestamp: Date.now() + 3000 }
    ];

    // Stream data over time
    for (let i = 0; i < physiologicalStream.length; i++) {
      cognitiveSystem.fusionEngine.ingestData('human', 'physiological', physiologicalStream[i]);
      cognitiveSystem.fusionEngine.ingestData('human', 'behavioral', behavioralStream[i]);
      
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    // Check fusion results
    const humanState = cognitiveSystem.fusionEngine.getFusionResult('human-state');
    expect(humanState).toBeDefined();
    expect(humanState.overallState).toBeDefined();

    // Get temporal trends
    const trends = cognitiveSystem.fusionEngine.getTrends(5000);
    expect(trends['human-physiological']).toBeDefined();
    expect(trends['human-behavioral']).toBeDefined();
  });
});