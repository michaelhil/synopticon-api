/**
 * MCP Tools for Cognitive Advisory System
 * Exposes cognitive system capabilities to LLM clients through MCP protocol
 */

import { MCPTool } from '../types/mcp-types.js';
import { createCognitiveStateManager } from '../../../core/cognitive/state-manager/index.js';
import { createBidirectionalCommunicationManager } from '../../../core/cognitive/communication-manager.js';
import { createMultiLevelPipelineSystem } from '../../../core/cognitive/pipeline-system.js';
import { createInformationFusionEngine } from '../../../core/cognitive/fusion-engine.js';
import { createLLMIntegration } from '../../../core/cognitive/llm-integration.js';
import { createContextOrchestrator } from '../../../core/cognitive/context-orchestrator.js';

// Singleton cognitive system instance
let cognitiveSystem: {
  stateManager: ReturnType<typeof createCognitiveStateManager>;
  communicationManager: ReturnType<typeof createBidirectionalCommunicationManager>;
  pipelineSystem: ReturnType<typeof createMultiLevelPipelineSystem>;
  fusionEngine: ReturnType<typeof createInformationFusionEngine>;
  llmIntegration: ReturnType<typeof createLLMIntegration>;
  contextOrchestrator: ReturnType<typeof createContextOrchestrator>;
} | null = null;

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
  }
  return cognitiveSystem;
};

export const getCognitiveSystemStatusTool: MCPTool = {
  name: 'get_cognitive_system_status',
  description: 'Get comprehensive status of the cognitive advisory system including all components',
  inputSchema: {
    type: 'object',
    properties: {},
    required: []
  },
  handler: async (client, args) => {
    try {
      const system = initializeCognitiveSystem();
      const status = system.contextOrchestrator.getSystemStatus();
      
      return {
        status: 'success',
        data: {
          ...status,
          capabilities: system.contextOrchestrator.getCapabilities(),
          componentMetrics: {
            pipeline: system.pipelineSystem.getMetrics(),
            fusion: system.fusionEngine.getDataQuality(),
            llm: system.llmIntegration.getMetrics()
          }
        }
      };
    } catch (error) {
      return {
        status: 'error',
        error: `Failed to get cognitive system status: ${error.message}`
      };
    }
  }
};

export const updateHumanStateTool: MCPTool = {
  name: 'update_human_state',
  description: 'Update human operator state with physiological, behavioral, or performance data',
  inputSchema: {
    type: 'object',
    properties: {
      category: {
        type: 'string',
        enum: ['physiological', 'behavioral', 'performance', 'self_report'],
        description: 'Category of human state data'
      },
      data: {
        type: 'object',
        description: 'State data object with relevant metrics'
      }
    },
    required: ['category', 'data']
  },
  handler: async (client, args) => {
    try {
      const { category, data } = args;
      const system = initializeCognitiveSystem();
      
      // Add timestamp if not present
      const timestampedData = {
        ...data,
        timestamp: data.timestamp || Date.now(),
        type: `human-${category}`
      };
      
      // Ingest data into fusion engine
      const quality = system.fusionEngine.ingestData('human', category, timestampedData);
      
      // Update state manager
      const statePath = `human.${category}`;
      system.stateManager.updateState(statePath, timestampedData);
      
      return {
        status: 'success',
        data: {
          category,
          dataQuality: quality,
          fusionTriggered: true,
          timestamp: timestampedData.timestamp
        }
      };
    } catch (error) {
      return {
        status: 'error',
        error: `Failed to update human state: ${error.message}`
      };
    }
  }
};

export const analyzePerformanceTool: MCPTool = {
  name: 'analyze_performance',
  description: 'Analyze human performance using the cognitive pipeline system',
  inputSchema: {
    type: 'object',
    properties: {
      performanceData: {
        type: 'object',
        properties: {
          accuracy: { type: 'number', minimum: 0, maximum: 1 },
          reactionTime: { type: 'number', minimum: 0 },
          errorRate: { type: 'number', minimum: 0, maximum: 1 },
          workload: { type: 'number', minimum: 0, maximum: 1 },
          fatigue: { type: 'number', minimum: 0, maximum: 1 }
        },
        required: ['accuracy']
      },
      processingLevel: {
        type: 'string',
        enum: ['tactical', 'operational', 'strategic'],
        default: 'operational'
      }
    },
    required: ['performanceData']
  },
  handler: async (client, args) => {
    try {
      const { performanceData, processingLevel = 'operational' } = args;
      const system = initializeCognitiveSystem();
      
      // Process through pipeline system
      const analysis = await system.pipelineSystem.process(
        'performance-analysis',
        performanceData,
        processingLevel
      );
      
      return {
        status: 'success',
        data: {
          analysis,
          processingLevel,
          timestamp: Date.now()
        }
      };
    } catch (error) {
      return {
        status: 'error',
        error: `Failed to analyze performance: ${error.message}`
      };
    }
  }
};

export const getCognitiveAdvisoryTool: MCPTool = {
  name: 'get_cognitive_advisory',
  description: 'Get AI-powered advisory based on current context and user query',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'User query or situation description'
      },
      context: {
        type: 'object',
        properties: {
          mission: { type: 'object' },
          performance: { type: 'object' },
          environment: { type: 'object' }
        },
        description: 'Additional context information'
      }
    },
    required: ['query']
  },
  handler: async (client, args) => {
    try {
      const { query, context = {} } = args;
      const system = initializeCognitiveSystem();
      
      // Process through context orchestrator
      const response = await system.contextOrchestrator.handleUserQuery(query, context);
      
      return {
        status: 'success',
        data: {
          query,
          response: response.results,
          route: response.route,
          priority: response.priority,
          duration: response.duration,
          timestamp: Date.now()
        }
      };
    } catch (error) {
      return {
        status: 'error',
        error: `Failed to get cognitive advisory: ${error.message}`
      };
    }
  }
};

export const triggerEmergencyResponseTool: MCPTool = {
  name: 'trigger_emergency_response',
  description: 'Trigger emergency response protocol in the cognitive system',
  inputSchema: {
    type: 'object',
    properties: {
      emergencyType: {
        type: 'string',
        description: 'Type of emergency (e.g., collision-warning, system-failure, medical)'
      },
      severity: {
        type: 'string',
        enum: ['low', 'moderate', 'high', 'critical'],
        default: 'high'
      },
      data: {
        type: 'object',
        description: 'Emergency-specific data'
      }
    },
    required: ['emergencyType']
  },
  handler: async (client, args) => {
    try {
      const { emergencyType, severity = 'high', data = {} } = args;
      const system = initializeCognitiveSystem();
      
      const emergencyData = {
        type: emergencyType,
        severity,
        timestamp: Date.now(),
        ...data
      };
      
      // Trigger emergency response
      const response = await system.contextOrchestrator.handleEmergency(emergencyData);
      
      return {
        status: 'success',
        data: {
          emergencyType,
          severity,
          response: response.results,
          route: response.route,
          duration: response.duration,
          timestamp: Date.now()
        }
      };
    } catch (error) {
      return {
        status: 'error',
        error: `Failed to trigger emergency response: ${error.message}`
      };
    }
  }
};

export const getFusionResultsTool: MCPTool = {
  name: 'get_fusion_results',
  description: 'Get results from the information fusion engine',
  inputSchema: {
    type: 'object',
    properties: {
      fusionType: {
        type: 'string',
        enum: ['human-state', 'environmental', 'situational-awareness'],
        description: 'Type of fusion result to retrieve'
      }
    }
  },
  handler: async (client, args) => {
    try {
      const { fusionType } = args;
      const system = initializeCognitiveSystem();
      
      if (fusionType) {
        const result = system.fusionEngine.getFusionResult(fusionType);
        return {
          status: 'success',
          data: { [fusionType]: result }
        };
      } else {
        const allResults = system.fusionEngine.getAllFusionResults();
        return {
          status: 'success',
          data: allResults
        };
      }
    } catch (error) {
      return {
        status: 'error',
        error: `Failed to get fusion results: ${error.message}`
      };
    }
  }
};

export const getTemporalAnalysisTool: MCPTool = {
  name: 'get_temporal_analysis',
  description: 'Get temporal analysis and predictions for a specific state parameter',
  inputSchema: {
    type: 'object',
    properties: {
      statePath: {
        type: 'string',
        description: 'State path to analyze (e.g., human.cognitive.workload)'
      },
      duration: {
        type: 'number',
        default: 60000,
        description: 'Analysis duration in milliseconds'
      },
      predictionSeconds: {
        type: 'number',
        default: 5,
        description: 'Prediction time horizon in seconds'
      }
    },
    required: ['statePath']
  },
  handler: async (client, args) => {
    try {
      const { statePath, duration = 60000, predictionSeconds = 5 } = args;
      const system = initializeCognitiveSystem();
      
      // Get temporal analysis
      const analysis = system.stateManager.getTemporalAnalysis(statePath, duration);
      
      // Get prediction
      const prediction = system.stateManager.getStateWithPredictions(statePath, predictionSeconds);
      
      return {
        status: 'success',
        data: {
          statePath,
          analysis,
          prediction,
          timestamp: Date.now()
        }
      };
    } catch (error) {
      return {
        status: 'error',
        error: `Failed to get temporal analysis: ${error.message}`
      };
    }
  }
};

export const updateEnvironmentalDataTool: MCPTool = {
  name: 'update_environmental_data',
  description: 'Update environmental data (weather, traffic, terrain)',
  inputSchema: {
    type: 'object',
    properties: {
      category: {
        type: 'string',
        enum: ['weather', 'traffic', 'terrain', 'communications'],
        description: 'Category of environmental data'
      },
      data: {
        type: 'object',
        description: 'Environmental data object'
      }
    },
    required: ['category', 'data']
  },
  handler: async (client, args) => {
    try {
      const { category, data } = args;
      const system = initializeCognitiveSystem();
      
      // Add timestamp if not present
      const timestampedData = {
        ...data,
        timestamp: data.timestamp || Date.now(),
        type: `external-${category}`
      };
      
      // Ingest data into fusion engine
      const quality = system.fusionEngine.ingestData('external', category, timestampedData);
      
      // Update state manager
      const statePath = `environment.${category}`;
      system.stateManager.updateState(statePath, timestampedData);
      
      return {
        status: 'success',
        data: {
          category,
          dataQuality: quality,
          timestamp: timestampedData.timestamp
        }
      };
    } catch (error) {
      return {
        status: 'error',
        error: `Failed to update environmental data: ${error.message}`
      };
    }
  }
};

// Export all tools
export const cognitiveTools: MCPTool[] = [
  getCognitiveSystemStatusTool,
  updateHumanStateTool,
  analyzePerformanceTool,
  getCognitiveAdvisoryTool,
  triggerEmergencyResponseTool,
  getFusionResultsTool,
  getTemporalAnalysisTool,
  updateEnvironmentalDataTool
];
