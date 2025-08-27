/**
 * Synchronization Strategy Definitions
 * Defines available synchronization strategies and their characteristics
 */

// Core synchronization strategy types
export const SynchronizationStrategy = {
  HARDWARE_TIMESTAMP: 'hardware_timestamp',
  SOFTWARE_TIMESTAMP: 'software_timestamp', 
  BUFFER_BASED: 'buffer_based',
  EVENT_DRIVEN: 'event_driven'
};

// Strategy characteristics and performance profiles
export const StrategyProfiles = {
  [SynchronizationStrategy.HARDWARE_TIMESTAMP]: {
    precision: 0.95,
    latency: 1, // ~1ms
    complexity: 'low',
    requirements: ['hardware_timestamps'],
    description: 'Highest precision using hardware timing sources'
  },
  
  [SynchronizationStrategy.SOFTWARE_TIMESTAMP]: {
    precision: 0.85,
    latency: 5, // ~5ms
    complexity: 'medium',
    requirements: ['ntp_sync'],
    description: 'Software-based timing with NTP drift compensation'
  },
  
  [SynchronizationStrategy.BUFFER_BASED]: {
    precision: 0.75,
    latency: 10, // ~10ms
    complexity: 'medium',
    requirements: ['buffering'],
    description: 'Buffer-based alignment for variable latency streams'
  },
  
  [SynchronizationStrategy.EVENT_DRIVEN]: {
    precision: 0.60,
    latency: 20, // ~20ms
    complexity: 'high',
    requirements: ['event_correlation'],
    description: 'Event correlation-based synchronization'
  }
};

// Strategy selection helper
export const selectOptimalStrategy = (requirements = {}) => {
  const {
    maxLatency = 50,
    minPrecision = 0.7,
    availableFeatures = [],
    streamCharacteristics = {}
  } = requirements;

  // Sort strategies by precision (descending)
  const candidates = Object.entries(StrategyProfiles)
    .filter(([, profile]) => {
      // Check precision requirement
      if (profile.precision < minPrecision) return false;
      
      // Check latency requirement
      if (profile.latency > maxLatency) return false;
      
      // Check feature availability
      const hasRequiredFeatures = profile.requirements.every(
        req => availableFeatures.includes(req)
      );
      
      return hasRequiredFeatures;
    })
    .sort((a, b) => b[1].precision - a[1].precision);

  if (candidates.length === 0) {
    // Fallback to most flexible strategy
    return SynchronizationStrategy.BUFFER_BASED;
  }

  return candidates[0][0];
};

// Strategy compatibility matrix
export const StrategyCompatibility = {
  [SynchronizationStrategy.HARDWARE_TIMESTAMP]: {
    compatibleWith: [SynchronizationStrategy.SOFTWARE_TIMESTAMP],
    fallbackTo: SynchronizationStrategy.SOFTWARE_TIMESTAMP,
    upgrade: null
  },
  
  [SynchronizationStrategy.SOFTWARE_TIMESTAMP]: {
    compatibleWith: [SynchronizationStrategy.BUFFER_BASED],
    fallbackTo: SynchronizationStrategy.BUFFER_BASED,
    upgrade: SynchronizationStrategy.HARDWARE_TIMESTAMP
  },
  
  [SynchronizationStrategy.BUFFER_BASED]: {
    compatibleWith: [SynchronizationStrategy.EVENT_DRIVEN],
    fallbackTo: SynchronizationStrategy.EVENT_DRIVEN,
    upgrade: SynchronizationStrategy.SOFTWARE_TIMESTAMP
  },
  
  [SynchronizationStrategy.EVENT_DRIVEN]: {
    compatibleWith: [],
    fallbackTo: null,
    upgrade: SynchronizationStrategy.BUFFER_BASED
  }
};

// Strategy configuration factory
export const createStrategyConfig = (strategy, overrides = {}) => {
  const profile = StrategyProfiles[strategy];
  if (!profile) {
    throw new Error(`Unknown strategy: ${strategy}`);
  }

  return {
    strategy,
    precision: overrides.precision || profile.precision,
    maxLatency: overrides.maxLatency || profile.latency,
    complexity: profile.complexity,
    requirements: profile.requirements,
    description: profile.description,
    ...overrides
  };
};