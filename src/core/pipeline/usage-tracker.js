/**
 * Usage tracking and pattern analysis for pipeline preloader
 */

export const createUsageTracker = (deviceDetector, config) => {
  const usageHistory = new Map();
  const contextHistory = [];

  /**
   * Load usage history from localStorage
   */
  const loadUsageHistory = () => {
    if (!config.enableUsageTracking) return;
    
    try {
      if (typeof localStorage !== 'undefined') {
        const saved = localStorage.getItem('synopticon_usage_history');
        if (saved) {
          const parsed = JSON.parse(saved);
          for (const [key, value] of Object.entries(parsed)) {
            usageHistory.set(key, value);
          }
        }
      }
    } catch (error) {
      console.warn('Failed to load usage history:', error);
    }
  };

  /**
   * Save usage history to localStorage
   */
  const saveUsageHistory = () => {
    if (!config.enableUsageTracking) return;
    
    try {
      if (typeof localStorage !== 'undefined') {
        const toSave = Object.fromEntries(usageHistory);
        localStorage.setItem('synopticon_usage_history', JSON.stringify(toSave));
      }
    } catch (error) {
      console.warn('Failed to save usage history:', error);
    }
  };

  /**
   * Record pipeline usage for intelligent preloading
   * @param {string} pipelineType - Pipeline type used
   * @param {string} specificContext - Specific usage context (optional)
   */
  const recordPipelineUsage = (pipelineType, specificContext = null) => {
    if (!config.enableUsageTracking) return;

    const timestamp = Date.now();
    const context = Array.from(deviceDetector.getCurrentContext());
    
    // Add specific context if provided
    if (specificContext) {
      context.push(specificContext);
    }
    
    // Update usage history
    if (!usageHistory.has(pipelineType)) {
      usageHistory.set(pipelineType, []);
    }
    
    const usage = usageHistory.get(pipelineType);
    usage.push({ timestamp, context });
    
    // Keep only last 50 usage records
    if (usage.length > 50) {
      usage.shift();
    }
    
    // Add to context history
    contextHistory.push({
      timestamp,
      context,
      pipelineType
    });
    
    // Keep only last 200 context records
    if (contextHistory.length > 200) {
      contextHistory.shift();
    }
    
    // Save to localStorage
    saveUsageHistory();
  };

  /**
   * Get pipeline preload priority based on usage patterns
   * @param {string} pipelineType - Pipeline type
   * @returns {number} - Priority score (0-1)
   */
  const calculatePreloadPriority = (pipelineType) => {
    const usage = usageHistory.get(pipelineType) || [];
    
    if (usage.length === 0) {
      return 0.1; // Low priority for unused pipelines
    }

    let score = 0;
    const now = Date.now();
    const currentContext = Array.from(deviceDetector.getCurrentContext());

    // Recent usage boost
    const recentUsage = usage.filter(u => (now - u.timestamp) < 24 * 60 * 60 * 1000); // Last 24 hours
    score += Math.min(recentUsage.length / 5, 0.3); // Up to 30% for recent usage

    // Context similarity boost
    let contextSimilarity = 0;
    for (const usageRecord of usage) {
      const similarity = currentContext.filter(c => usageRecord.context.includes(c)).length / 
                        Math.max(currentContext.length, usageRecord.context.length, 1);
      contextSimilarity += similarity;
    }
    contextSimilarity /= usage.length;
    score += contextSimilarity * 0.4; // Up to 40% for context similarity

    // Frequency boost
    const frequency = usage.length / Math.max(contextHistory.length, 1);
    score += frequency * 0.3; // Up to 30% for frequency

    return Math.min(score, 1);
  };

  /**
   * Get usage statistics
   */
  const getUsageStatistics = () => {
    const totalUsageRecords = Array.from(usageHistory.values())
      .reduce((sum, records) => sum + records.length, 0);

    const pipelineUsage = {};
    for (const [pipeline, records] of usageHistory.entries()) {
      pipelineUsage[pipeline] = {
        totalUsage: records.length,
        recentUsage: records.filter(r => 
          Date.now() - r.timestamp < 24 * 60 * 60 * 1000
        ).length,
        lastUsed: records.length > 0 ? records[records.length - 1].timestamp : null,
        priority: calculatePreloadPriority(pipeline)
      };
    }

    return {
      totalUsageRecords,
      totalPipelines: usageHistory.size,
      pipelineUsage,
      contextHistorySize: contextHistory.length
    };
  };

  // Initialize
  loadUsageHistory();

  return {
    recordPipelineUsage,
    calculatePreloadPriority,
    getUsageStatistics,
    getUsageHistory: () => new Map(usageHistory),
    getContextHistory: () => [...contextHistory]
  };
};