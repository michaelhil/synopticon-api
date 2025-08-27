/**
 * Quality Controller
 * Handles adaptive quality control, bandwidth monitoring, and optimization
 * Following functional programming patterns with factory functions
 */

/**
 * Quality profiles for different streaming scenarios
 */
export const QUALITY_PROFILES = {
  ultra: {
    name: 'Ultra HD',
    video: { 
      width: 3840, height: 2160, fps: 60, bitrate: '25M', 
      codec: 'vp9', keyFrameInterval: 2000
    },
    audio: { 
      sampleRate: 48000, channels: 2, bitrate: '320k', 
      codec: 'opus', profile: 'fullband'
    },
    priority: 5,
    minBandwidth: 30000000, // 30 Mbps
    cpuIntensive: true
  },
  high: {
    name: 'Full HD',
    video: { 
      width: 1920, height: 1080, fps: 30, bitrate: '8M',
      codec: 'vp9', keyFrameInterval: 2000
    },
    audio: { 
      sampleRate: 48000, channels: 2, bitrate: '192k',
      codec: 'opus', profile: 'fullband'
    },
    priority: 4,
    minBandwidth: 10000000, // 10 Mbps
    cpuIntensive: false
  },
  medium: {
    name: 'HD',
    video: { 
      width: 1280, height: 720, fps: 30, bitrate: '4M',
      codec: 'vp9', keyFrameInterval: 2000
    },
    audio: { 
      sampleRate: 44100, channels: 2, bitrate: '128k',
      codec: 'opus', profile: 'mediumband'
    },
    priority: 3,
    minBandwidth: 5000000, // 5 Mbps
    cpuIntensive: false
  },
  low: {
    name: 'SD',
    video: { 
      width: 640, height: 480, fps: 15, bitrate: '1M',
      codec: 'h264', keyFrameInterval: 4000
    },
    audio: { 
      sampleRate: 22050, channels: 1, bitrate: '64k',
      codec: 'aac', profile: 'narrowband'
    },
    priority: 2,
    minBandwidth: 1500000, // 1.5 Mbps
    cpuIntensive: false
  },
  mobile: {
    name: 'Mobile Optimized',
    video: { 
      width: 480, height: 360, fps: 15, bitrate: '500k',
      codec: 'h264', keyFrameInterval: 6000
    },
    audio: { 
      sampleRate: 16000, channels: 1, bitrate: '32k',
      codec: 'aac', profile: 'narrowband'
    },
    priority: 1,
    minBandwidth: 750000, // 750 Kbps
    cpuIntensive: false,
    batteryOptimized: true
  }
};

/**
 * Create quality controller for adaptive streaming
 * @param {Object} config - Configuration options
 * @returns {Object} Quality controller instance
 */
export const createQualityController = (config = {}) => {
  const state = {
    currentProfile: config.defaultProfile || 'medium',
    targetProfile: config.defaultProfile || 'medium',
    adaptiveMode: config.adaptiveMode !== false,
    networkStats: {
      bandwidth: 0,
      latency: 0,
      packetLoss: 0,
      jitter: 0,
      lastMeasurement: 0
    },
    qualityHistory: [],
    adaptationRules: {
      bandwidthThreshold: config.bandwidthThreshold || 0.8, // 80% of available
      latencyThreshold: config.latencyThreshold || 200, // 200ms
      packetLossThreshold: config.packetLossThreshold || 0.02, // 2%
      stabilityPeriod: config.stabilityPeriod || 5000, // 5 seconds
      adaptationCooldown: config.adaptationCooldown || 3000 // 3 seconds
    },
    callbacks: {
      onQualityChange: [],
      onAdaptation: [],
      onNetworkUpdate: []
    },
    lastAdaptation: 0,
    measurementInterval: null
  };

  /**
   * Update network statistics
   * @param {Object} stats - Network measurement stats
   */
  const updateNetworkStats = (stats) => {
    const now = Date.now();
    
    // Update network stats with smoothing
    const smoothing = 0.3; // 30% new value, 70% old value
    state.networkStats = {
      bandwidth: state.networkStats.bandwidth * (1 - smoothing) + (stats.bandwidth || 0) * smoothing,
      latency: state.networkStats.latency * (1 - smoothing) + (stats.latency || 0) * smoothing,
      packetLoss: state.networkStats.packetLoss * (1 - smoothing) + (stats.packetLoss || 0) * smoothing,
      jitter: state.networkStats.jitter * (1 - smoothing) + (stats.jitter || 0) * smoothing,
      lastMeasurement: now
    };

    // Notify network update callbacks
    state.callbacks.onNetworkUpdate.forEach(callback => {
      try {
        callback(state.networkStats);
      } catch (error) {
        console.warn('Network update callback error:', error);
      }
    });

    // Trigger adaptation check if in adaptive mode
    if (state.adaptiveMode) {
      checkAdaptation();
    }
  };

  /**
   * Check if quality adaptation is needed
   */
  const checkAdaptation = () => {
    const now = Date.now();
    
    // Respect cooldown period
    if (now - state.lastAdaptation < state.adaptationRules.adaptationCooldown) {
      return;
    }

    const currentProfile = QUALITY_PROFILES[state.currentProfile];
    const { networkStats, adaptationRules } = state;

    let recommendedProfile = state.currentProfile;
    let adaptationReason = null;

    // Check bandwidth constraint
    if (networkStats.bandwidth > 0) {
      const requiredBandwidth = currentProfile.minBandwidth;
      const availableBandwidth = networkStats.bandwidth * adaptationRules.bandwidthThreshold;
      
      if (availableBandwidth < requiredBandwidth) {
        // Need to downgrade
        recommendedProfile = findLowerQualityProfile(state.currentProfile);
        adaptationReason = `bandwidth_constraint: ${Math.round(availableBandwidth/1000)}kbps < ${Math.round(requiredBandwidth/1000)}kbps`;
      } else if (availableBandwidth > requiredBandwidth * 1.5) {
        // Can potentially upgrade
        const higherProfile = findHigherQualityProfile(state.currentProfile);
        if (higherProfile && QUALITY_PROFILES[higherProfile].minBandwidth <= availableBandwidth) {
          recommendedProfile = higherProfile;
          adaptationReason = `bandwidth_available: ${Math.round(availableBandwidth/1000)}kbps > ${Math.round(QUALITY_PROFILES[higherProfile].minBandwidth/1000)}kbps`;
        }
      }
    }

    // Check latency constraint
    if (networkStats.latency > adaptationRules.latencyThreshold) {
      const lowerProfile = findLowerQualityProfile(state.currentProfile);
      if (lowerProfile && (!adaptationReason || recommendedProfile === state.currentProfile)) {
        recommendedProfile = lowerProfile;
        adaptationReason = `high_latency: ${Math.round(networkStats.latency)}ms > ${adaptationRules.latencyThreshold}ms`;
      }
    }

    // Check packet loss constraint
    if (networkStats.packetLoss > adaptationRules.packetLossThreshold) {
      const lowerProfile = findLowerQualityProfile(state.currentProfile);
      if (lowerProfile && (!adaptationReason || recommendedProfile === state.currentProfile)) {
        recommendedProfile = lowerProfile;
        adaptationReason = `packet_loss: ${(networkStats.packetLoss * 100).toFixed(2)}% > ${(adaptationRules.packetLossThreshold * 100).toFixed(2)}%`;
      }
    }

    // Apply adaptation if needed
    if (recommendedProfile !== state.currentProfile && adaptationReason) {
      console.log(`📊 Quality adaptation: ${state.currentProfile} → ${recommendedProfile} (${adaptationReason})`);
      
      state.targetProfile = recommendedProfile;
      state.lastAdaptation = now;
      
      // Add to history
      state.qualityHistory.push({
        timestamp: now,
        from: state.currentProfile,
        to: recommendedProfile,
        reason: adaptationReason,
        networkStats: { ...networkStats }
      });

      // Keep history limited
      if (state.qualityHistory.length > 50) {
        state.qualityHistory = state.qualityHistory.slice(-25);
      }

      // Notify adaptation callbacks
      state.callbacks.onAdaptation.forEach(callback => {
        try {
          callback({
            from: state.currentProfile,
            to: recommendedProfile,
            reason: adaptationReason,
            networkStats: { ...networkStats }
          });
        } catch (error) {
          console.warn('Adaptation callback error:', error);
        }
      });

      return true;
    }

    return false;
  };

  /**
   * Find a lower quality profile
   */
  const findLowerQualityProfile = (currentProfile) => {
    const currentPriority = QUALITY_PROFILES[currentProfile]?.priority || 0;
    
    let bestProfile = null;
    let bestPriority = -1;
    
    for (const [profileName, profile] of Object.entries(QUALITY_PROFILES)) {
      if (profile.priority < currentPriority && profile.priority > bestPriority) {
        bestProfile = profileName;
        bestPriority = profile.priority;
      }
    }
    
    return bestProfile;
  };

  /**
   * Find a higher quality profile
   */
  const findHigherQualityProfile = (currentProfile) => {
    const currentPriority = QUALITY_PROFILES[currentProfile]?.priority || 0;
    
    let bestProfile = null;
    let bestPriority = Infinity;
    
    for (const [profileName, profile] of Object.entries(QUALITY_PROFILES)) {
      if (profile.priority > currentPriority && profile.priority < bestPriority) {
        bestProfile = profileName;
        bestPriority = profile.priority;
      }
    }
    
    return bestProfile;
  };

  /**
   * Manually set quality profile
   * @param {string} profileName - Target quality profile
   * @param {Object} options - Options
   */
  const setQuality = async (profileName, options = {}) => {
    if (!QUALITY_PROFILES[profileName]) {
      throw new Error(`Invalid quality profile: ${profileName}`);
    }

    const oldProfile = state.currentProfile;
    state.currentProfile = profileName;
    state.targetProfile = profileName;

    // Disable adaptive mode if manual override
    if (options.disableAdaptive) {
      state.adaptiveMode = false;
    }

    console.log(`📊 Manual quality change: ${oldProfile} → ${profileName}`);

    // Add to history
    state.qualityHistory.push({
      timestamp: Date.now(),
      from: oldProfile,
      to: profileName,
      reason: 'manual_override',
      networkStats: { ...state.networkStats }
    });

    // Notify callbacks
    state.callbacks.onQualityChange.forEach(callback => {
      try {
        callback({
          from: oldProfile,
          to: profileName,
          profile: QUALITY_PROFILES[profileName],
          manual: true
        });
      } catch (error) {
        console.warn('Quality change callback error:', error);
      }
    });

    return QUALITY_PROFILES[profileName];
  };

  /**
   * Apply target quality (called by streaming pipeline)
   */
  const applyTargetQuality = () => {
    if (state.targetProfile !== state.currentProfile) {
      const oldProfile = state.currentProfile;
      state.currentProfile = state.targetProfile;

      // Notify callbacks
      state.callbacks.onQualityChange.forEach(callback => {
        try {
          callback({
            from: oldProfile,
            to: state.currentProfile,
            profile: QUALITY_PROFILES[state.currentProfile],
            adaptive: true
          });
        } catch (error) {
          console.warn('Quality change callback error:', error);
        }
      });

      return QUALITY_PROFILES[state.currentProfile];
    }
    return null;
  };

  /**
   * Get current quality information
   */
  const getQualityInfo = () => ({
    current: state.currentProfile,
    target: state.targetProfile,
    profile: QUALITY_PROFILES[state.currentProfile],
    targetProfile: QUALITY_PROFILES[state.targetProfile],
    adaptiveMode: state.adaptiveMode,
    networkStats: { ...state.networkStats },
    lastAdaptation: state.lastAdaptation,
    adaptationHistory: [...state.qualityHistory.slice(-10)] // Last 10 adaptations
  });

  /**
   * Get quality statistics
   */
  const getQualityStats = () => {
    const now = Date.now();
    const recentHistory = state.qualityHistory.filter(h => now - h.timestamp < 300000); // Last 5 minutes
    
    return {
      totalAdaptations: state.qualityHistory.length,
      recentAdaptations: recentHistory.length,
      averageQuality: calculateAverageQuality(recentHistory),
      stabilityScore: calculateStabilityScore(recentHistory),
      networkHealth: calculateNetworkHealth(state.networkStats),
      currentProfile: {
        name: state.currentProfile,
        ...QUALITY_PROFILES[state.currentProfile]
      }
    };
  };

  /**
   * Calculate average quality over time
   */
  const calculateAverageQuality = (history) => {
    if (history.length === 0) {
      return QUALITY_PROFILES[state.currentProfile].priority;
    }

    const totalPriority = history.reduce((sum, h) => {
      return sum + (QUALITY_PROFILES[h.to]?.priority || 0);
    }, 0);

    return totalPriority / history.length;
  };

  /**
   * Calculate stability score (lower is better)
   */
  const calculateStabilityScore = (history) => {
    if (history.length < 2) return 1.0;

    let changes = 0;
    for (let i = 1; i < history.length; i++) {
      if (history[i].from !== history[i-1].to) {
        changes++;
      }
    }

    return Math.max(0, 1 - (changes / history.length));
  };

  /**
   * Calculate network health score
   */
  const calculateNetworkHealth = (stats) => {
    let score = 1.0;

    // Bandwidth health (assume 10Mbps is excellent)
    if (stats.bandwidth > 0) {
      const bandwidthScore = Math.min(1.0, stats.bandwidth / 10000000);
      score *= bandwidthScore;
    }

    // Latency health (lower is better)
    const latencyScore = Math.max(0, 1 - (stats.latency / 500)); // 500ms is poor
    score *= latencyScore;

    // Packet loss health
    const lossScore = Math.max(0, 1 - (stats.packetLoss / 0.05)); // 5% is poor
    score *= lossScore;

    return Math.max(0, Math.min(1, score));
  };

  /**
   * Start automatic network monitoring
   */
  const startNetworkMonitoring = (interval = 5000) => {
    if (state.measurementInterval) {
      clearInterval(state.measurementInterval);
    }

    state.measurementInterval = setInterval(() => {
      // Simulate network measurements (in real implementation, would use actual measurements)
      const mockStats = generateMockNetworkStats();
      updateNetworkStats(mockStats);
    }, interval);

    console.log('📊 Started network monitoring');
  };

  /**
   * Stop automatic network monitoring
   */
  const stopNetworkMonitoring = () => {
    if (state.measurementInterval) {
      clearInterval(state.measurementInterval);
      state.measurementInterval = null;
    }
    console.log('📊 Stopped network monitoring');
  };

  /**
   * Generate mock network stats (replace with real measurements)
   */
  const generateMockNetworkStats = () => {
    // Simulate varying network conditions
    const baseLatency = 50 + Math.random() * 100; // 50-150ms
    const baseBandwidth = 5000000 + Math.random() * 10000000; // 5-15 Mbps
    const packetLoss = Math.random() * 0.03; // 0-3%
    
    return {
      bandwidth: baseBandwidth,
      latency: baseLatency,
      packetLoss,
      jitter: Math.random() * 20 // 0-20ms jitter
    };
  };

  /**
   * Event subscription methods
   */
  const onQualityChange = (callback) => {
    state.callbacks.onQualityChange.push(callback);
    return () => {
      const index = state.callbacks.onQualityChange.indexOf(callback);
      if (index !== -1) state.callbacks.onQualityChange.splice(index, 1);
    };
  };

  const onAdaptation = (callback) => {
    state.callbacks.onAdaptation.push(callback);
    return () => {
      const index = state.callbacks.onAdaptation.indexOf(callback);
      if (index !== -1) state.callbacks.onAdaptation.splice(index, 1);
    };
  };

  const onNetworkUpdate = (callback) => {
    state.callbacks.onNetworkUpdate.push(callback);
    return () => {
      const index = state.callbacks.onNetworkUpdate.indexOf(callback);
      if (index !== -1) state.callbacks.onNetworkUpdate.splice(index, 1);
    };
  };

  /**
   * Cleanup resources
   */
  const cleanup = () => {
    stopNetworkMonitoring();
    state.callbacks.onQualityChange = [];
    state.callbacks.onAdaptation = [];
    state.callbacks.onNetworkUpdate = [];
    state.qualityHistory = [];
  };

  return {
    // Quality control
    setQuality,
    applyTargetQuality,
    getQualityInfo,
    getQualityStats,
    
    // Network monitoring
    updateNetworkStats,
    startNetworkMonitoring,
    stopNetworkMonitoring,
    
    // Adaptive features
    checkAdaptation,
    
    // Event handlers
    onQualityChange,
    onAdaptation,
    onNetworkUpdate,
    
    // Configuration
    setAdaptiveMode: (enabled) => { state.adaptiveMode = enabled; },
    isAdaptiveMode: () => state.adaptiveMode,
    
    // Utilities
    getAvailableProfiles: () => Object.keys(QUALITY_PROFILES),
    getProfile: (name) => QUALITY_PROFILES[name],
    
    // Cleanup
    cleanup
  };
};

