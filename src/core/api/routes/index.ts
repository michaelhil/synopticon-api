/**
 * Route Registry - TypeScript Implementation
 * Combines all route modules and provides a single interface
 */

import { createMediaRoutes } from './media.js';
import { createEmotionRoutes } from './emotion.js';
import { createDistributionRoutes } from './distribution.js';
import { createSystemRoutes } from './system.js';
import { createTelemetryRoutes } from './telemetry.js';
import { routes as cognitiveRoutes } from './cognitive.js';

// Route tuple: [method, pattern, handler]
export type RouteDefinition = [string, string, (request: Request, params?: string[]) => Promise<Response>];

// Route dependencies interface
export interface RouteDependencies {
  // Media streaming dependencies
  getMediaStreamingAPI?: () => Promise<any>;
  getMultiDeviceCoordinator?: () => Promise<any>;
  
  // Core components
  orchestrator?: any;
  memoryOptimizer?: any;
  middlewareSystem?: any;
  
  // Pipeline functions
  initializeEmotionPipeline?: () => Promise<void>;
  decodeFrame?: (frameData: any) => any;
  
  // Distribution system
  getDistributionSystem?: () => Promise<any>;
  getDistributionOverallStatus?: () => any;
  createDistributionStream?: (config: any) => Promise<any>;
  distributionStreams?: Map<string, any>;
  distributionClients?: Map<string, any>;
  
  // Utility functions
  createJSONResponse?: (data: any, status?: number, headers?: Record<string, string>) => Response;
  createErrorResponse?: (message: string, status?: number, headers?: Record<string, string>) => Response;
  generateSecureId?: (prefix?: string) => string;
}

/**
 * Create unified route registry
 * @param dependencies - All dependencies needed by route modules
 * @returns Array of [method, pattern, handler] route definitions
 */
export const createRouteRegistry = (dependencies: RouteDependencies): RouteDefinition[] => {
  const routes: RouteDefinition[] = [];
  
  // Media streaming routes
  if (dependencies.getMediaStreamingAPI && dependencies.getMultiDeviceCoordinator) {
    const mediaRoutes = createMediaRoutes({
      getMediaStreamingAPI: dependencies.getMediaStreamingAPI,
      getMultiDeviceCoordinator: dependencies.getMultiDeviceCoordinator,
      memoryOptimizer: dependencies.memoryOptimizer,
      middlewareSystem: dependencies.middlewareSystem,
      createJSONResponse: dependencies.createJSONResponse,
      createErrorResponse: dependencies.createErrorResponse
    });
    routes.push(...mediaRoutes);
  }

  // Emotion analysis routes
  if (dependencies.orchestrator && dependencies.initializeEmotionPipeline) {
    const emotionRoutes = createEmotionRoutes({
      orchestrator: dependencies.orchestrator,
      initializeEmotionPipeline: dependencies.initializeEmotionPipeline,
      decodeFrame: dependencies.decodeFrame,
      middlewareSystem: dependencies.middlewareSystem,
      createJSONResponse: dependencies.createJSONResponse,
      createErrorResponse: dependencies.createErrorResponse
    });
    routes.push(...emotionRoutes);
  }

  // Distribution system routes
  if (dependencies.getDistributionSystem) {
    const distributionRoutes = createDistributionRoutes({
      getDistributionSystem: dependencies.getDistributionSystem,
      getDistributionOverallStatus: dependencies.getDistributionOverallStatus,
      createDistributionStream: dependencies.createDistributionStream,
      distributionStreams: dependencies.distributionStreams,
      distributionClients: dependencies.distributionClients,
      middlewareSystem: dependencies.middlewareSystem,
      createJSONResponse: dependencies.createJSONResponse,
      createErrorResponse: dependencies.createErrorResponse,
      generateSecureId: dependencies.generateSecureId
    });
    routes.push(...distributionRoutes);
  }

  // System and health routes
  if (dependencies.orchestrator) {
    const systemRoutes = createSystemRoutes({
      orchestrator: dependencies.orchestrator,
      getDistributionOverallStatus: dependencies.getDistributionOverallStatus,
      middlewareSystem: dependencies.middlewareSystem,
      createJSONResponse: dependencies.createJSONResponse,
      createErrorResponse: dependencies.createErrorResponse
    });
    routes.push(...systemRoutes);
  }

  // Telemetry and simulator control routes
  if (dependencies.middlewareSystem) {
    const telemetryRoutes = createTelemetryRoutes({
      middlewareSystem: dependencies.middlewareSystem,
      createJSONResponse: dependencies.createJSONResponse,
      createErrorResponse: dependencies.createErrorResponse,
      distributionStreams: dependencies.distributionStreams,
      createDistributionStream: dependencies.createDistributionStream
    });
    routes.push(...telemetryRoutes);
  }

  // Cognitive advisory system routes (static routes - no dependencies needed)
  routes.push(...cognitiveRoutes);

  console.log(`📝 Route registry created with ${routes.length} routes`);
  
  return routes;
};