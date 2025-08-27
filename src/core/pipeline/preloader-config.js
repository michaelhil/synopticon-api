/**
 * Configuration management for pipeline preloader
 */

// Preloading strategies
export const PreloadingStrategies = {
  IMMEDIATE: 'immediate',      // Preload immediately on app start
  LAZY: 'lazy',               // Load only when requested
  INTELLIGENT: 'intelligent', // ML-based preloading based on usage patterns
  CONTEXT_AWARE: 'context_aware', // Load based on detected usage context
  ON_HOVER: 'on_hover',       // Preload when user hovers over related UI
  ON_INTERACTION: 'on_interaction', // Preload on first user interaction
  USAGE_BASED: 'usage_based', // Preload based on usage patterns
  TIME_BASED: 'time_based',   // Preload during idle time
  CONNECTION_AWARE: 'connection_aware' // Consider network conditions
};

// Pipeline usage contexts
export const UsageContexts = {
  REAL_TIME: 'real_time',
  VIDEO_ANALYSIS: 'video_analysis',
  IMAGE_PROCESSING: 'image_processing',
  BATCH_PROCESSING: 'batch_processing',
  WEBCAM_ACTIVE: 'webcam_active',
  MOBILE_DEVICE: 'mobile_device',
  HIGH_BANDWIDTH: 'high_bandwidth',
  LOW_BANDWIDTH: 'low_bandwidth',
  BATTERY_CRITICAL: 'battery_critical',
  FIRST_VISIT: 'first_visit',
  RETURNING_USER: 'returning_user'
};

export const createPreloaderConfig = (config = {}) => ({
  enableIntelligentPreloading: config.enableIntelligentPreloading !== false,
  maxConcurrentPreloads: config.maxConcurrentPreloads || 2,
  preloadTimeoutMs: config.preloadTimeoutMs || 30000,
  enableUsageTracking: config.enableUsageTracking !== false,
  enableNetworkAwareness: config.enableNetworkAwareness !== false,
  enableBatteryAwareness: config.enableBatteryAwareness !== false,
  showLoadingNotifications: config.showLoadingNotifications === true,
  ...config
});