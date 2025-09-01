/**
 * Cognitive Advisory System API Routes
 * RESTful endpoints for cognitive system functionality
 */

import { createCognitiveStateManager } from '../../../core/cognitive/state-manager.js';
import { createBidirectionalCommunicationManager } from '../../../core/cognitive/communication-manager.js';
import { createMultiLevelPipelineSystem } from '../../../core/cognitive/pipeline-system.js';
import { createInformationFusionEngine } from '../../../core/cognitive/fusion-engine.js';
import { createLLMIntegration } from '../../../core/cognitive/llm-integration.js';
import { createContextOrchestrator } from '../../../core/cognitive/context-orchestrator.js';
import { createLogger } from '../../../shared/utils/logger.js';

const logger = createLogger({ level: 2 });

// Singleton cognitive system instance
let cognitiveSystem = null;

const initializeCognitiveSystem = () => {
  if (!cognitiveSystem) {
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

    // Connect communication manager to state manager
    communicationManager.setStateManager(stateManager);

    cognitiveSystem = {
      stateManager,
      communicationManager,
      pipelineSystem,
      fusionEngine,
      llmIntegration,
      contextOrchestrator
    };
    
    logger.info('✅ Cognitive system initialized for API routes');
  }
  return cognitiveSystem;
};

// API Routes Array
const routes = [];

// GET /api/cognitive/status - Get system status
routes.push(['GET', '^/api/cognitive/status$', async (request) => {
  try {
    const system = initializeCognitiveSystem();
    const status = system.contextOrchestrator.getSystemStatus();
    const capabilities = system.contextOrchestrator.getCapabilities();
    
    return new Response(JSON.stringify({
      success: true,
      data: {
        status,
        capabilities,
        timestamp: Date.now()
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    logger.error('Failed to get cognitive status:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}]);

// POST /api/cognitive/state/update - Update state data
routes.push(['POST', '^/api/cognitive/state/update$', async (request) => {
  try {
    const body = await request.json();
    const { category, type, data } = body;
    
    if (!category || !type || !data) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Missing required fields: category, type, data'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const system = initializeCognitiveSystem();
    
    // Add timestamp if not present
    const timestampedData = {
      ...data,
      timestamp: data.timestamp || Date.now(),
      type: `${category}-${type}`
    };
    
    // Update through fusion engine and state manager
    const quality = system.fusionEngine.ingestData(category, type, timestampedData);
    const statePath = `${category}.${type}`;
    system.stateManager.updateState(statePath, timestampedData);
    
    return new Response(JSON.stringify({
      success: true,
      data: {
        category,
        type,
        dataQuality: quality,
        timestamp: timestampedData.timestamp
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    logger.error('Failed to update state:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}]);

// GET /api/cognitive/state/[path] - Get state value
routes.push(['GET', '^/api/cognitive/state/([\\w\\.]+)$', async (request, match) => {
  try {
    const statePath = decodeURIComponent(match[1]);
    const system = initializeCognitiveSystem();
    
    const value = system.stateManager.getState(statePath);
    
    if (value === undefined) {
      return new Response(JSON.stringify({
        success: false,
        error: `State path not found: ${statePath}`
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    return new Response(JSON.stringify({
      success: true,
      data: {
        path: statePath,
        value,
        timestamp: Date.now()
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    logger.error('Failed to get state:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}]);

// POST /api/cognitive/analyze/performance - Analyze performance
routes.push(['POST', '^/api/cognitive/analyze/performance$', async (request) => {
  try {
    const body = await request.json();
    const { performanceData, processingLevel = 'operational' } = body;
    
    if (!performanceData) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Missing performanceData'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const system = initializeCognitiveSystem();
    
    const analysis = await system.pipelineSystem.process(
      'performance-analysis',
      performanceData,
      processingLevel
    );
    
    return new Response(JSON.stringify({
      success: true,
      data: {
        analysis,
        processingLevel,
        timestamp: Date.now()
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    logger.error('Failed to analyze performance:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}]);

// POST /api/cognitive/advisory - Get AI advisory
routes.push(['POST', '^/api/cognitive/advisory$', async (request) => {
  try {
    const body = await request.json();
    const { query, context = {} } = body;
    
    if (!query) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Missing query'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const system = initializeCognitiveSystem();
    
    const response = await system.contextOrchestrator.handleUserQuery(query, context);
    
    return new Response(JSON.stringify({
      success: true,
      data: {
        query,
        response: response.results,
        route: response.route,
        priority: response.priority,
        duration: response.duration,
        timestamp: Date.now()
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    logger.error('Failed to get advisory:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}]);

// POST /api/cognitive/emergency - Trigger emergency response
routes.push(['POST', '^/api/cognitive/emergency$', async (request) => {
  try {
    const body = await request.json();
    const { emergencyType, severity = 'high', data = {} } = body;
    
    if (!emergencyType) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Missing emergencyType'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const system = initializeCognitiveSystem();
    
    const emergencyData = {
      type: emergencyType,
      severity,
      timestamp: Date.now(),
      ...data
    };
    
    const response = await system.contextOrchestrator.handleEmergency(emergencyData);
    
    return new Response(JSON.stringify({
      success: true,
      data: {
        emergencyType,
        severity,
        response: response.results,
        route: response.route,
        duration: response.duration,
        timestamp: Date.now()
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    logger.error('Failed to trigger emergency response:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}]);

// GET /api/cognitive/fusion - Get fusion results
routes.push(['GET', '^/api/cognitive/fusion(?:/([\\w-]+))?$', async (request, match) => {
  try {
    const fusionType = match[1];
    const system = initializeCognitiveSystem();
    
    if (fusionType) {
      const result = system.fusionEngine.getFusionResult(fusionType);
      return new Response(JSON.stringify({
        success: true,
        data: { [fusionType]: result }
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    } else {
      const allResults = system.fusionEngine.getAllFusionResults();
      const dataQuality = system.fusionEngine.getDataQuality();
      
      return new Response(JSON.stringify({
        success: true,
        data: {
          fusion: allResults,
          quality: dataQuality
        }
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  } catch (error) {
    logger.error('Failed to get fusion results:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}]);

// GET /api/cognitive/temporal/[path] - Get temporal analysis
routes.push(['GET', '^/api/cognitive/temporal/([\\w\\.]+)$', async (request, match) => {
  try {
    const statePath = decodeURIComponent(match[1]);
    const url = new URL(request.url);
    const duration = parseInt(url.searchParams.get('duration') || '60000');
    const predictionSeconds = parseInt(url.searchParams.get('prediction') || '5');
    
    const system = initializeCognitiveSystem();
    
    const analysis = system.stateManager.getTemporalAnalysis(statePath, duration);
    const prediction = system.stateManager.getStateWithPredictions(statePath, predictionSeconds);
    
    return new Response(JSON.stringify({
      success: true,
      data: {
        statePath,
        analysis,
        prediction,
        timestamp: Date.now()
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    logger.error('Failed to get temporal analysis:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}]);

// GET /api/cognitive/metrics - Get system metrics
routes.push(['GET', '^/api/cognitive/metrics$', async (request) => {
  try {
    const system = initializeCognitiveSystem();
    
    const metrics = {
      pipeline: system.pipelineSystem.getMetrics(),
      fusion: system.fusionEngine.getDataQuality(),
      llm: system.llmIntegration.getMetrics(),
      system: system.contextOrchestrator.getSystemStatus(),
      timestamp: Date.now()
    };
    
    return new Response(JSON.stringify({
      success: true,
      data: metrics
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    logger.error('Failed to get metrics:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}]);

export { routes };