/**
 * Distribution System Routes Module - TypeScript Implementation
 * Handles data distribution, streaming, and client management
 */

export interface DistributionRouteDependencies {
  getDistributionSystem: () => Promise<any>;
  getDistributionOverallStatus?: () => any;
  createDistributionStream: (config: any) => Promise<any>;
  distributionStreams: Map<string, any>;
  distributionClients: Map<string, any>;
  middlewareSystem: any;
  createJSONResponse: (data: any, status?: number, headers?: Record<string, string>) => Response;
  createErrorResponse: (message: string, status?: number, headers?: Record<string, string>) => Response;
  generateSecureId: (prefix?: string) => string;
}

export type RouteDefinition = [string, string, (request: Request, params?: string[]) => Promise<Response>];

export const createDistributionRoutes = ({
  getDistributionSystem,
  getDistributionOverallStatus,
  createDistributionStream,
  distributionStreams,
  distributionClients,
  middlewareSystem,
  createJSONResponse,
  createErrorResponse,
  generateSecureId
}: DistributionRouteDependencies): RouteDefinition[] => {
  const routes: RouteDefinition[] = [];

  // Distribution status
  routes.push(['GET', '^/api/distribution/status$', async (request: Request): Promise<Response> => {
    try {
      
      const status = getDistributionOverallStatus?.();
      return createJSONResponse(status, 200);
    } catch (error: any) {
      
      return createErrorResponse(`Distribution status error: ${error.message}`, 500);
    }
  }]);

  // Service discovery
  routes.push(['GET', '^/api/distribution/discovery$', async (request: Request): Promise<Response> => {
    try {
      
      return createJSONResponse({
        services: ['udp', 'websocket', 'mqtt', 'sse'],
        timestamp: Date.now()
      }, 200);
    } catch (error: any) {
      
      return createErrorResponse(`Discovery error: ${error.message}`, 500);
    }
  }]);

  // Create new distribution stream
  routes.push(['POST', '^/api/distribution/streams$', async (request: Request): Promise<Response> => {
    try {
      const body = await request.json();
      
      
      const stream = await createDistributionStream(body);
      const host = request.headers.get('host') || 'localhost:3000';
      
      return createJSONResponse({
        stream_id: stream.id,
        data: stream,
        websocket_status_url: `ws://${host}/ws/distribution/events?stream=${stream.id}`,
        message: 'Distribution stream created successfully'
      }, 200);
    } catch (error: any) {
      
      return createErrorResponse(`Failed to create stream: ${error.message}`, 400);
    }
  }]);

  // Get all distribution streams
  routes.push(['GET', '^/api/distribution/streams$', async (request: Request): Promise<Response> => {
    try {
      
      const streams = Array.from(distributionStreams.values());
      
      return createJSONResponse({
        streams,
        total: streams.length,
        active: streams.filter(s => s.status === 'active').length
      }, 200);
    } catch (error: any) {
      
      return createErrorResponse(`Failed to get streams: ${error.message}`, 500);
    }
  }]);

  // Get specific distribution stream
  routes.push(['GET', '^/api/distribution/streams/([^/]+)$', async (request: Request, params?: string[]): Promise<Response> => {
    try {
      const streamId = params?.[0];
      if (!streamId) {
        return createErrorResponse('Stream ID is required', 400);
      }
      
      
      const stream = distributionStreams.get(streamId);
      if (!stream) {
        return createErrorResponse('Stream not found', 404);
      }
      
      return createJSONResponse({
        stream,
        clients: Array.from(distributionClients.values()).filter(c => c.streams.includes(streamId))
      }, 200);
    } catch (error: any) {
      
      return createErrorResponse(`Failed to get stream: ${error.message}`, 500);
    }
  }]);

  // Update distribution stream
  routes.push(['PUT', '^/api/distribution/streams/([^/]+)$', async (request: Request, params?: string[]): Promise<Response> => {
    try {
      const streamId = params?.[0];
      if (!streamId) {
        return createErrorResponse('Stream ID is required', 400);
      }
      const body = await request.json();
      
      
      const stream = distributionStreams.get(streamId);
      if (!stream) {
        return createErrorResponse('Stream not found', 404);
      }
      
      // Update stream configuration
      Object.assign(stream.config, body);
      stream.updated_at = Date.now();
      
      return createJSONResponse({
        stream,
        message: 'Stream updated successfully'
      }, 200);
    } catch (error: any) {
      
      return createErrorResponse(`Failed to update stream: ${error.message}`, 400);
    }
  }]);

  // Delete distribution stream
  routes.push(['DELETE', '^/api/distribution/streams/([^/]+)$', async (request: Request, params?: string[]): Promise<Response> => {
    try {
      const streamId = params?.[0];
      if (!streamId) {
        return createErrorResponse('Stream ID is required', 400);
      }
      
      
      const stream = distributionStreams.get(streamId);
      if (!stream) {
        return createErrorResponse('Stream not found', 404);
      }
      
      // Stop stream and remove
      stream.status = 'stopped';
      distributionStreams.delete(streamId);
      
      // Remove from clients
      for (const client of distributionClients.values()) {
        const index = client.streams.indexOf(streamId);
        if (index > -1) {
          client.streams.splice(index, 1);
        }
      }
      
      return createJSONResponse({
        message: 'Stream deleted successfully'
      }, 200);
    } catch (error: any) {
      
      return createErrorResponse(`Failed to delete stream: ${error.message}`, 500);
    }
  }]);

  // Register distribution client
  routes.push(['POST', '^/api/distribution/clients$', async (request: Request): Promise<Response> => {
    try {
      const body = await request.json();
      
      
      const clientId = generateSecureId('client');
      const client = {
        id: clientId,
        ...body,
        streams: body.streams || [],
        registered_at: Date.now(),
        last_seen: Date.now(),
        status: 'active'
      };
      
      distributionClients.set(clientId, client);
      
      return createJSONResponse({
        client_id: clientId,
        client,
        message: 'Client registered successfully'
      }, 200);
    } catch (error: any) {
      
      return createErrorResponse(`Failed to register client: ${error.message}`, 400);
    }
  }]);

  // Get distribution templates
  routes.push(['GET', '^/api/distribution/templates$', async (request: Request): Promise<Response> => {
    try {
      
      const { distributionPresets } = await getDistributionSystem();
      
      return createJSONResponse({
        templates: distributionPresets || {},
        timestamp: Date.now()
      }, 200);
    } catch (error: any) {
      
      return createErrorResponse(`Failed to get templates: ${error.message}`, 500);
    }
  }]);

  return routes;
};