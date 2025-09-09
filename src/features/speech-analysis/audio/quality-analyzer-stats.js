/**
 * Quality Analysis Statistics Manager
 * Manages quality statistics and trends
 */

export const createQualityStatsManager = (state) => {
  // Update quality statistics
  const updateStats = (overallQuality, qualityLevel) => {
    state.stats.totalFrames++;
    
    // Update running average
    const alpha = 0.1; // Smoothing factor
    if (state.stats.totalFrames === 1) {
      state.stats.overallQuality = overallQuality;
    } else {
      state.stats.overallQuality = alpha * overallQuality + (1 - alpha) * state.stats.overallQuality;
    }
    
    // Update quality distribution
    state.stats.qualityDistribution[qualityLevel]++;
    
    // Add to quality trend (keep last 100 samples)
    state.stats.qualityTrend.push({
      quality: overallQuality,
      level: qualityLevel,
      timestamp: Date.now()
    });
    
    if (state.stats.qualityTrend.length > 100) {
      state.stats.qualityTrend.shift();
    }
  };

  // Get quality trend analysis
  const getTrendAnalysis = () => {
    if (state.stats.qualityTrend.length < 5) {
      return { trend: 'insufficient_data', confidence: 0 };
    }
    
    const recent = state.stats.qualityTrend.slice(-10);
    const older = state.stats.qualityTrend.slice(-20, -10);
    
    if (older.length === 0) {
      return { trend: 'stable', confidence: 0.5 };
    }
    
    const recentAvg = recent.reduce((sum, s) => sum + s.quality, 0) / recent.length;
    const olderAvg = older.reduce((sum, s) => sum + s.quality, 0) / older.length;
    
    const change = recentAvg - olderAvg;
    const confidence = Math.min(1.0, Math.abs(change) / 10);
    
    let trend;
    if (Math.abs(change) < 2) {
      trend = 'stable';
    } else if (change > 0) {
      trend = change > 5 ? 'improving_significantly' : 'improving';
    } else {
      trend = change < -5 ? 'degrading_significantly' : 'degrading';
    }
    
    return { trend, confidence, change };
  };

  // Get comprehensive statistics
  const getComprehensiveStats = () => ({
    ...state.stats,
    qualityTrendAnalysis: getTrendAnalysis(),
    averageQualityByLevel: {
      excellent: state.stats.qualityDistribution.excellent / Math.max(1, state.stats.totalFrames) * 100,
      good: state.stats.qualityDistribution.good / Math.max(1, state.stats.totalFrames) * 100,
      fair: state.stats.qualityDistribution.fair / Math.max(1, state.stats.totalFrames) * 100,
      poor: state.stats.qualityDistribution.poor / Math.max(1, state.stats.totalFrames) * 100
    }
  });

  return {
    updateStats,
    getTrendAnalysis,
    getComprehensiveStats
  };
};
