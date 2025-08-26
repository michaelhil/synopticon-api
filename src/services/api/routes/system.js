/**
 * System Routes Module
 * Handles health checks, pipeline management, and system utilities
 */

export const createSystemRoutes = ({
  orchestrator,
  getDistributionOverallStatus,
  middlewareSystem,
  createJSONResponse,
  createErrorResponse
}) => {
  const routes = [];

  // Get registered pipelines
  routes.push(['GET', '^/api/pipelines$', async (request) => {
    try {
      
      const pipelines = orchestrator.getRegisteredPipelines();
      
      return createJSONResponse({
        pipelines: pipelines.map(p => ({
          name: p.name,
          type: p.type || 'unknown',
          status: p.getStatus ? p.getStatus() : 'active',
          capabilities: p.capabilities || []
        })),
        total: pipelines.length,
        timestamp: Date.now()
      }, 200);
    } catch (error) {
      
      return createErrorResponse(`Pipeline listing failed: ${error.message}`, 500);
    }
  }]);

  // System health check
  routes.push(['GET', '^/api/health$', async (request) => {
    try {
      
      const pipelines = orchestrator.getRegisteredPipelines();
      
      return createJSONResponse({
        status: 'healthy',
        timestamp: Date.now(),
        uptime: process.uptime() * 1000,
        version: '2.0.0',
        capabilities: {
          pipelines: pipelines.map(p => p.name),
          features: [
            'face_analysis',
            'emotion_detection', 
            'media_streaming',
            'distribution_system',
            'websocket_streaming'
          ]
        },
        system: {
          node_version: process.version,
          platform: process.platform,
          memory_usage: process.memoryUsage()
        },
        endpoints: {
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
        },
        distribution: {
          overall_status: getDistributionOverallStatus()
        }
      }, 200);
    } catch (error) {
      
      return createErrorResponse(`Health check failed: ${error.message}`, 500);
    }
  }]);

  // Register new pipeline
  routes.push(['POST', '^/api/pipelines/register$', async (request) => {
    try {
      const body = await request.json();
      
      
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
      
      return createErrorResponse(`Pipeline registration failed: ${error.message}`, 500);
    }
  }]);

  // Speech analysis (placeholder)
  routes.push(['POST', '^/api/speech/analyze$', async (request) => {
    try {
      
      return createJSONResponse({
        message: 'Speech analysis endpoint - implementation needed',
        status: 'placeholder'
      }, 200);
    } catch (error) {
      
      return createErrorResponse(`Speech analysis failed: ${error.message}`, 500);
    }
  }]);

  // Speech recognition (placeholder)
  routes.push(['POST', '^/api/speech/recognition$', async (request) => {
    try {
      
      return createJSONResponse({
        message: 'Speech recognition endpoint - implementation needed',
        status: 'placeholder'
      }, 200);
    } catch (error) {
      
      return createErrorResponse(`Speech recognition failed: ${error.message}`, 500);
    }
  }]);

  return routes;
};