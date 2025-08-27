/**
 * System Routes Module
 * Handles health checks, pipeline management, and system utilities
 * TypeScript implementation with comprehensive type safety
 */

import type { 
  SystemDependencies, 
  PipelineListResponse,
  HealthCheckResponse,
  PipelineInfo
} from '../types/system-types.js';
import type { Routes } from '../types/media-types.js';

interface PipelineRegistrationRequest {
  name: string;
  type: string;
  capabilities?: string[];
}

interface SystemCapabilities {
  pipelines: string[];
  features: string[];
}

interface SystemInfo {
  node_version: string;
  platform: string;
  memory_usage: NodeJS.MemoryUsage;
}

interface EndpointMap {
  analysis: {
    emotions: string;
    labels: string;
  };
  media: {
    devices: string;
    streams: string;
    health: string;
  };
  distribution: {
    streams: string;
    status: string;
    discovery: string;
    clients: string;
    templates: string;
  };
  system: {
    health: string;
    pipelines: string;
  };
}

export const createSystemRoutes = ({
  orchestrator,
  getDistributionOverallStatus,
  middlewareSystem,
  createJSONResponse,
  createErrorResponse
}: SystemDependencies): Routes => {
  const routes: Routes = [];

  // Get registered pipelines
  routes.push(['GET', '^/api/pipelines$', async (request: Request) => {
    try {
      const pipelines = orchestrator.getRegisteredPipelines();
      
      const response: PipelineListResponse = {
        pipelines: pipelines.map((p: any): PipelineInfo => ({
          name: p.name,
          type: p.type || 'unknown',
          status: p.getStatus ? p.getStatus() : 'active',
          capabilities: p.capabilities || []
        })),
        total: pipelines.length,
        timestamp: Date.now()
      };
      
      return createJSONResponse(response, 200);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return createErrorResponse(`Pipeline listing failed: ${message}`, 500);
    }
  }]);

  // System health check
  routes.push(['GET', '^/api/health$', async (request: Request) => {
    try {
      const pipelines = orchestrator.getRegisteredPipelines();
      
      const capabilities: SystemCapabilities = {
        pipelines: pipelines.map((p: any) => p.name),
        features: [
          'face_analysis',
          'emotion_detection', 
          'media_streaming',
          'distribution_system',
          'websocket_streaming'
        ]
      };

      const systemInfo: SystemInfo = {
        node_version: process.version,
        platform: process.platform,
        memory_usage: process.memoryUsage()
      };

      const endpoints: EndpointMap = {
        analysis: {
          emotions: '/api/emotion/analyze',
          labels: '/api/emotion/labels'
        },
        media: {
          devices: '/api/media/devices',
          streams: '/api/media/streams',
          health: '/api/media/health'
        },
        distribution: {
          streams: '/api/distribution/streams',
          status: '/api/distribution/status',
          discovery: '/api/distribution/discovery',
          clients: '/api/distribution/clients',
          templates: '/api/distribution/templates'
        },
        system: {
          health: '/api/health',
          pipelines: '/api/pipelines'
        }
      };

      const distributionStatus = await getDistributionOverallStatus();

      const healthResponse: HealthCheckResponse = {
        status: 'healthy',
        version: '2.0.0',
        uptime: process.uptime() * 1000,
        timestamp: Date.now(),
        services: {
          orchestrator: { status: 'up' },
          distribution: { status: distributionStatus.status === 'healthy' ? 'up' : 'degraded' },
          pipelines: { status: pipelines.length > 0 ? 'up' : 'down' }
        }
      };

      const response = {
        ...healthResponse,
        capabilities,
        system: systemInfo,
        endpoints,
        distribution: {
          overall_status: distributionStatus
        }
      };
      
      return createJSONResponse(response, 200);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return createErrorResponse(`Health check failed: ${message}`, 500);
    }
  }]);

  // Register new pipeline
  routes.push(['POST', '^/api/pipelines/register$', async (request: Request) => {
    try {
      const body = await request.json() as PipelineRegistrationRequest;
      
      if (!body.name || !body.type) {
        return createErrorResponse('Pipeline name and type are required', 400);
      }
      
      // This would need actual pipeline creation logic
      // For now, return a placeholder response
      return createJSONResponse({
        success: true,
        message: 'Pipeline registration endpoint - implementation needed',
        requested: body
      }, 200);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return createErrorResponse(`Pipeline registration failed: ${message}`, 500);
    }
  }]);

  // Speech analysis (placeholder)
  routes.push(['POST', '^/api/speech/analyze$', async (request: Request) => {
    try {
      return createJSONResponse({
        message: 'Speech analysis endpoint - implementation needed',
        status: 'placeholder'
      }, 200);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return createErrorResponse(`Speech analysis failed: ${message}`, 500);
    }
  }]);

  // Speech recognition (placeholder)
  routes.push(['POST', '^/api/speech/recognition$', async (request: Request) => {
    try {
      return createJSONResponse({
        message: 'Speech recognition endpoint - implementation needed',
        status: 'placeholder'
      }, 200);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return createErrorResponse(`Speech recognition failed: ${message}`, 500);
    }
  }]);

  return routes;
};