/**
 * Context Orchestrator
 * Coordinates between all cognitive system components, manages decision routing,
 * and provides the main interface for the Cognitive Advisory System
 */

import { EventEmitter } from 'events';
import { createLogger } from '../../shared/utils/logger.js';

const logger = createLogger({ level: 2 });

/**
 * Decision routing logic based on context and urgency
 */
const createDecisionRouter = () => {
  const routingRules = [
    {
      condition: (context) => context.alerts?.level === 'critical' || context.emergency,
      route: 'emergency-response',
      priority: 'high',
      timeout: 5000
    },
    {
      condition: (context) => context.performance?.degraded || context.human?.overload,
      route: 'performance-intervention',
      priority: 'high',
      timeout: 10000
    },
    {
      condition: (context) => context.situational?.awarenessLevel === 'low',
      route: 'situational-awareness',
      priority: 'normal',
      timeout: 15000
    },
    {
      condition: (context) => context.userQuery,
      route: 'advisory-response',
      priority: 'normal',
      timeout: 20000
    },
    {
      condition: (context) => context.routine,
      route: 'routine-monitoring',
      priority: 'low',
      timeout: 30000
    }
  ];
  
  const route = (context) => {
    for (const rule of routingRules) {
      if (rule.condition(context)) {
        return {
          route: rule.route,
          priority: rule.priority,
          timeout: rule.timeout,
          context
        };
      }
    }
    
    return {
      route: 'default',
      priority: 'low',
      timeout: 30000,
      context
    };
  };
  
  return { route, routingRules };
};

/**
 * Context aggregation from all system components
 */
const createContextAggregator = () => {
  const contexts = new Map();
  const maxContextAge = 60000; // 1 minute
  
  const updateContext = (source, data) => {
    contexts.set(source, {
      ...data,
      timestamp: Date.now(),
      source
    });
    
    // Clean old contexts
    const cutoff = Date.now() - maxContextAge;
    for (const [key, value] of contexts.entries()) {
      if (value.timestamp < cutoff) {
        contexts.delete(key);
      }
    }
  };
  
  const getAggregatedContext = () => {
    const aggregated = {
      timestamp: Date.now(),
      sources: Array.from(contexts.keys()),
      freshness: {}
    };
    
    // Aggregate all context data
    for (const [source, data] of contexts.entries()) {
      const age = Date.now() - data.timestamp;
      aggregated.freshness[source] = {
        age,
        fresh: age < maxContextAge / 2
      };
      
      // Merge context data
      Object.assign(aggregated, { [source]: data });
    }
    
    // Add derived context
    aggregated.emergencyActive = checkEmergencyState(aggregated);
    aggregated.performanceDegraded = checkPerformanceDegradation(aggregated);
    aggregated.situationalAwareness = assessSituationalAwareness(aggregated);
    aggregated.overallStatus = determineOverallStatus(aggregated);
    
    return aggregated;
  };
  
  const checkEmergencyState = (context) => {
    return (
      context.alerts?.level === 'critical' ||
      context.human?.fatigue > 0.9 ||
      context.environment?.totalRisk > 0.8 ||
      context.system?.health < 0.3
    );
  };
  
  const checkPerformanceDegradation = (context) => {
    return (
      context.human?.performance < 0.6 ||
      context.human?.cognitiveLoad > 0.8 ||
      context.system?.performance < 0.7
    );
  };
  
  const assessSituationalAwareness = (context) => {
    const factors = [
      context.human?.attention || 0.8,
      1 - (context.environment?.totalRisk || 0.3),
      context.system?.reliability || 0.9
    ];
    
    const level = factors.reduce((a, b) => a + b, 0) / factors.length;
    
    return {
      level,
      status: level > 0.8 ? 'high' : level > 0.6 ? 'moderate' : 'low',
      factors: ['human-attention', 'environmental-stability', 'system-reliability']
    };
  };
  
  const determineOverallStatus = (context) => {
    if (context.emergencyActive) return 'emergency';
    if (context.performanceDegraded) return 'degraded';
    if (context.situationalAwareness?.level < 0.6) return 'limited-awareness';
    return 'nominal';
  };
  
  return { updateContext, getAggregatedContext };
};

/**
 * Response coordination and execution
 */
const createResponseCoordinator = () => {
  const activeResponses = new Map();
  const responseHistory = [];
  const maxHistorySize = 100;
  
  const coordinateResponse = async (routing, components) => {
    const responseId = `response-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const response = {
      id: responseId,
      route: routing.route,
      priority: routing.priority,
      status: 'initiating',
      startTime: Date.now(),
      components: [],
      results: {}
    };
    
    activeResponses.set(responseId, response);
    
    try {
      switch (routing.route) {
        case 'emergency-response':
          response.results = await handleEmergencyResponse(routing.context, components);
          break;
          
        case 'performance-intervention':
          response.results = await handlePerformanceIntervention(routing.context, components);
          break;
          
        case 'situational-awareness':
          response.results = await handleSituationalAwareness(routing.context, components);
          break;
          
        case 'advisory-response':
          response.results = await handleAdvisoryResponse(routing.context, components);
          break;
          
        case 'routine-monitoring':
          response.results = await handleRoutineMonitoring(routing.context, components);
          break;
          
        default:
          response.results = await handleDefaultResponse(routing.context, components);
      }
      
      response.status = 'completed';
      response.endTime = Date.now();
      response.duration = response.endTime - response.startTime;
      
    } catch (error) {
      response.status = 'failed';
      response.error = error.message;
      response.endTime = Date.now();
      response.duration = response.endTime - response.startTime;
      response.results = { error: error.message };
      
      logger.error(`Response coordination failed for ${routing.route}:`, error);
    } finally {
      activeResponses.delete(responseId);
      
      // Add to history
      responseHistory.push({
        ...response,
        contextSummary: summarizeContext(routing.context)
      });
      
      if (responseHistory.length > maxHistorySize) {
        responseHistory.shift();
      }
    }
    
    return response;
  };
  
  const handleEmergencyResponse = async (context, components) => {
    const actions = [];
    
    // Immediate state management updates
    if (components.stateManager) {
      await components.stateManager.updateState('system.automation.level', 5);
      await components.stateManager.updateState('interaction.alerts.priority', 'critical');
      actions.push('automation-maximized');
    }
    
    // High-priority pipeline processing
    if (components.pipelineSystem) {
      const emergencyAnalysis = await components.pipelineSystem.process(
        'collision-detection',
        context,
        'tactical'
      );
      actions.push('emergency-analysis-completed');
    }
    
    // Immediate LLM analysis
    if (components.llmIntegration) {
      const advisory = await components.llmIntegration.analyze('advisory', {
        ...context,
        emergency: true,
        userQuery: 'Emergency situation detected - provide immediate guidance'
      });
      actions.push('emergency-advisory-generated');
    }
    
    // Broadcast emergency alert
    if (components.communicationManager) {
      await components.communicationManager.broadcastAlert({
        level: 'critical',
        message: 'Emergency conditions detected - enhanced monitoring active',
        actions,
        timestamp: Date.now()
      });
    }
    
    return { actions, advisory: advisory?.advisory, priority: 'critical' };
  };
  
  const handlePerformanceIntervention = async (context, components) => {
    const interventions = [];
    
    // Analyze performance degradation
    if (components.llmIntegration) {
      const analysis = await components.llmIntegration.analyze('performance-analysis', context.human);
      interventions.push({ type: 'analysis', result: analysis });
    }
    
    // Adjust automation level
    if (components.stateManager && context.human?.cognitiveLoad > 0.8) {
      const currentLevel = components.stateManager.getState('system.automation.level') || 0;
      const newLevel = Math.min(5, currentLevel + 1);
      await components.stateManager.updateState('system.automation.level', newLevel);
      interventions.push({ type: 'automation-increase', from: currentLevel, to: newLevel });
    }
    
    // Process through operational pipeline
    if (components.pipelineSystem) {
      const optimization = await components.pipelineSystem.process(
        'performance-analysis',
        context.human,
        'operational'
      );
      interventions.push({ type: 'optimization', result: optimization });
    }
    
    return { interventions, status: 'active' };
  };
  
  const handleSituationalAwareness = async (context, components) => {
    // Fuse all available data
    const fusionResult = components.fusionEngine ? 
      components.fusionEngine.getAllFusionResults() : {};
    
    // Get LLM situational analysis
    const analysis = components.llmIntegration ?
      await components.llmIntegration.analyze('situational-awareness', fusionResult) : null;
    
    // Update situational state
    if (components.stateManager && analysis) {
      await components.stateManager.updateState('interaction.dialogue.currentIntent', 'situational-update');
    }
    
    return {
      fusion: fusionResult,
      analysis: analysis?.assessment,
      awarenessLevel: analysis?.awarenessLevel || 'moderate',
      recommendations: analysis?.recommendations || []
    };
  };
  
  const handleAdvisoryResponse = async (context, components) => {
    // Generate advisory response
    const advisory = components.llmIntegration ?
      await components.llmIntegration.analyze('advisory', context) : null;
    
    // Update dialogue context
    if (components.stateManager) {
      await components.stateManager.updateState('interaction.dialogue.lastSystemOutput', advisory?.advisory);
      await components.stateManager.updateState('interaction.dialogue.turn', 
        (components.stateManager.getState('interaction.dialogue.turn') || 0) + 1);
    }
    
    return {
      advisory: advisory?.advisory || 'System nominal - no specific recommendations at this time.',
      priority: advisory?.priority || 'normal',
      actionItems: advisory?.actionItems || [],
      timeframe: advisory?.timeframe || 'ongoing'
    };
  };
  
  const handleRoutineMonitoring = async (context, components) => {
    const monitoring = {
      timestamp: Date.now(),
      checks: []
    };
    
    // Basic system health checks
    if (components.stateManager) {
      const systemHealth = components.stateManager.getState('system.health') || 1.0;
      monitoring.checks.push({ type: 'system-health', value: systemHealth, status: systemHealth > 0.8 ? 'good' : 'warning' });
      
      const humanPerformance = components.stateManager.getState('human.performance.composite') || 0.8;
      monitoring.checks.push({ type: 'human-performance', value: humanPerformance, status: humanPerformance > 0.7 ? 'good' : 'warning' });
    }
    
    return monitoring;
  };
  
  const handleDefaultResponse = async (context, components) => {
    return {
      message: 'Context received and processed',
      status: 'nominal',
      availableActions: ['performance-analysis', 'situational-update', 'advisory-request']
    };
  };
  
  const summarizeContext = (context) => {
    return {
      sources: context.sources?.length || 0,
      status: context.overallStatus,
      emergency: !!context.emergencyActive,
      performance: context.performanceDegraded,
      timestamp: context.timestamp
    };
  };
  
  return { coordinateResponse, activeResponses, responseHistory };
};

/**
 * Main Context Orchestrator
 */
export const createContextOrchestrator = (components, config = {}) => {
  const {
    maxConcurrentResponses = 3,
    contextUpdateInterval = 1000,
    responseTimeout = 30000
  } = config;
  
  const router = createDecisionRouter();
  const aggregator = createContextAggregator();
  const coordinator = createResponseCoordinator();
  const emitter = new EventEmitter();
  
  // Component references
  const {
    stateManager,
    communicationManager,
    pipelineSystem,
    fusionEngine,
    llmIntegration
  } = components;
  
  // Context update loop
  let contextUpdateTimer;
  
  const startContextUpdates = () => {
    contextUpdateTimer = setInterval(() => {
      updateAggregatedContext();
    }, contextUpdateInterval);
  };
  
  const stopContextUpdates = () => {
    if (contextUpdateTimer) {
      clearInterval(contextUpdateTimer);
      contextUpdateTimer = null;
    }
  };
  
  const updateAggregatedContext = () => {
    try {
      // Gather context from all components
      if (stateManager) {
        aggregator.updateContext('state', stateManager.getSnapshot());
      }
      
      if (fusionEngine) {
        aggregator.updateContext('fusion', fusionEngine.getAllFusionResults());
        aggregator.updateContext('data-quality', fusionEngine.getDataQuality());
      }
      
      if (pipelineSystem) {
        aggregator.updateContext('pipeline-metrics', pipelineSystem.getMetrics());
      }
      
      if (llmIntegration) {
        aggregator.updateContext('llm-metrics', llmIntegration.getMetrics());
      }
      
      const aggregatedContext = aggregator.getAggregatedContext();
      emitter.emit('contextUpdated', aggregatedContext);
      
    } catch (error) {
      logger.error('Context update failed:', error);
    }
  };
  
  const processContext = async (userContext = {}) => {
    const aggregatedContext = aggregator.getAggregatedContext();
    const fullContext = { ...aggregatedContext, ...userContext };
    
    // Route the decision
    const routing = router.route(fullContext);
    
    emitter.emit('contextRouted', { routing, context: fullContext });
    
    // Coordinate response
    const response = await coordinator.coordinateResponse(routing, components);
    
    emitter.emit('responseCompleted', response);
    
    return response;
  };
  
  const handleUserQuery = async (query, context = {}) => {
    return processContext({
      ...context,
      userQuery: query,
      timestamp: Date.now()
    });
  };
  
  const handleEmergency = async (emergencyData) => {
    return processContext({
      emergency: true,
      emergencyData,
      timestamp: Date.now()
    });
  };
  
  const getSystemStatus = () => {
    const context = aggregator.getAggregatedContext();
    
    return {
      status: context.overallStatus,
      components: {
        stateManager: !!stateManager,
        communicationManager: !!communicationManager,
        pipelineSystem: !!pipelineSystem,
        fusionEngine: !!fusionEngine,
        llmIntegration: !!llmIntegration
      },
      metrics: {
        activeResponses: coordinator.activeResponses.size,
        responseHistory: coordinator.responseHistory.length,
        contextSources: context.sources?.length || 0,
        freshness: context.freshness
      },
      lastUpdate: context.timestamp
    };
  };
  
  const getCapabilities = () => ({
    routing: router.routingRules.map(r => r.route),
    maxConcurrentResponses,
    components: Object.keys(components),
    features: [
      'emergency-response',
      'performance-intervention',
      'situational-awareness',
      'advisory-response',
      'routine-monitoring',
      'context-aggregation',
      'decision-routing'
    ]
  });
  
  // Initialize
  startContextUpdates();
  updateAggregatedContext(); // Initial context
  
  logger.info('✅ Context Orchestrator initialized');
  logger.info(`Components: ${Object.keys(components).join(', ')}`);
  
  return {
    processContext,
    handleUserQuery,
    handleEmergency,
    getSystemStatus,
    getCapabilities,
    startContextUpdates,
    stopContextUpdates,
    on: emitter.on.bind(emitter),
    off: emitter.off.bind(emitter),
    emit: emitter.emit.bind(emitter)
  };
};