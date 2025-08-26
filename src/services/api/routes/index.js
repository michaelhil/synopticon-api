/**
 * Route Registry
 * Combines all route modules and provides a single interface
 */

import { createMediaRoutes } from './media.js';
import { createEmotionRoutes } from './emotion.js';
import { createDistributionRoutes } from './distribution.js';
import { createSystemRoutes } from './system.js';

/**
 * Create unified route registry
 * @param {Object} dependencies - All dependencies needed by route modules
 * @returns {Array} - Array of [method, pattern, handler] route definitions
 */
export const createRouteRegistry = (dependencies) => {
  const routes = [];
  
  // Media streaming routes
  const mediaRoutes = createMediaRoutes({
    getMediaStreamingAPI: dependencies.getMediaStreamingAPI,
    getMultiDeviceCoordinator: dependencies.getMultiDeviceCoordinator,
    memoryOptimizer: dependencies.memoryOptimizer,
    middlewareSystem: dependencies.middlewareSystem,
    createJSONResponse: dependencies.createJSONResponse,
    createErrorResponse: dependencies.createErrorResponse
  });
  routes.push(...mediaRoutes);

  // Emotion analysis routes
  const emotionRoutes = createEmotionRoutes({
    orchestrator: dependencies.orchestrator,
    initializeEmotionPipeline: dependencies.initializeEmotionPipeline,
    decodeFrame: dependencies.decodeFrame,
    middlewareSystem: dependencies.middlewareSystem,
    createJSONResponse: dependencies.createJSONResponse,
    createErrorResponse: dependencies.createErrorResponse
  });
  routes.push(...emotionRoutes);

  // Distribution system routes
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

  // System and health routes
  const systemRoutes = createSystemRoutes({
    orchestrator: dependencies.orchestrator,
    getDistributionOverallStatus: dependencies.getDistributionOverallStatus,
    middlewareSystem: dependencies.middlewareSystem,
    createJSONResponse: dependencies.createJSONResponse,
    createErrorResponse: dependencies.createErrorResponse
  });
  routes.push(...systemRoutes);

  console.log(`📝 Route registry created with ${routes.length} routes`);
  
  return routes;
};