/**
 * Network monitoring and statistics for multi-device coordinator
 */

export const createNetworkMonitor = (deviceManager, qualityController) => {
  let networkStats = {
    totalBandwidth: 0,
    averageLatency: 0,
    packetLoss: 0,
    lastUpdated: null
  };

  // Update network statistics
  const updateNetworkStats = () => {
    const pipelines = deviceManager.getAllPipelines();
    let totalBandwidth = 0;
    let totalLatency = 0;
    let maxPacketLoss = 0;
    let activeCount = 0;

    for (const pipeline of pipelines.values()) {
      if (pipeline.isStreaming()) {
        const stats = pipeline.getStats();
        const metrics = pipeline.getQualityMetrics();
        
        if (metrics) {
          totalBandwidth += metrics.networkStats?.bandwidth || 0;
          totalLatency += metrics.networkStats?.latency || 0;
          maxPacketLoss = Math.max(maxPacketLoss, metrics.networkStats?.packetLoss || 0);
          activeCount++;
        }
      }
    }

    networkStats = {
      totalBandwidth,
      averageLatency: activeCount > 0 ? totalLatency / activeCount : 0,
      packetLoss: maxPacketLoss,
      lastUpdated: Date.now()
    };

    // Update global quality controller with aggregated stats
    if (qualityController) {
      qualityController.updateNetworkStats(networkStats);
    }
  };

  // Start network monitoring
  const startNetworkMonitoring = (intervalMs = 5000) => {
    const monitoringInterval = setInterval(() => {
      updateNetworkStats();
    }, intervalMs);

    return () => clearInterval(monitoringInterval);
  };

  // Get current network statistics
  const getNetworkStats = () => ({ ...networkStats });

  return {
    updateNetworkStats,
    startNetworkMonitoring,
    getNetworkStats
  };
};
