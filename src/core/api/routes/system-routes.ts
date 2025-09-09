/**
 * System status and health routes for media streaming API - TypeScript Implementation
 */

export interface SystemRoutesState {
  orchestrator: any;
  distributionManager: any;
  activeStreams: Map<string, any>;
  isInitialized: boolean;
}

export interface SystemRoutesApp {
  get: (path: string, handler: (req: any, res: any) => Promise<void>) => void;
}

export const setupSystemRoutes = (app: SystemRoutesApp, state: SystemRoutesState): void => {
  // Get system health
  app.get('/api/media/health', async (req: any, res: any): Promise<void> => {
    try {
      const orchestratorStatus = state.orchestrator.getStatus();
      const sessionStatus = await state.distributionManager.getSessionStatus('media-streaming');
      
      res.json({
        success: true,
        health: {
          overall: state.isInitialized ? 'healthy' : 'unhealthy',
          orchestrator: orchestratorStatus,
          distribution: sessionStatus,
          activeStreams: state.activeStreams.size,
          timestamp: Date.now()
        }
      });

    } catch (error: any) {
      console.error('Health check failed:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // Get system statistics
  app.get('/api/media/stats', async (req: any, res: any): Promise<void> => {
    try {
      const session = state.distributionManager.getSession('media-streaming');
      let distributionStats = null;
      
      if (session) {
        const mediaDistributor = session.activeDistributors.get('media-websocket');
        if (mediaDistributor) {
          distributionStats = mediaDistributor.instance.getStreamingStats();
        }
      }

      res.json({
        success: true,
        stats: {
          system: state.orchestrator.getMetrics(),
          distribution: distributionStats,
          activeStreams: state.activeStreams.size,
          pipelines: state.orchestrator.getRegisteredPipelines().length
        }
      });

    } catch (error: any) {
      console.error('Stats retrieval failed:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });
};