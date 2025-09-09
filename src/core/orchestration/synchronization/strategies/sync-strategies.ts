/**
 * @fileoverview Synchronization Strategy Definitions
 * 
 * Defines available synchronization strategies, their characteristics,
 * performance profiles, compatibility matrices, and selection algorithms.
 * 
 * @version 1.0.0
 * @author Synopticon Development Team
 */

// ==========================================
// Type Definitions
// ==========================================

/**
 * Available synchronization strategy types
 */
export enum SynchronizationStrategy {
  HARDWARE_TIMESTAMP = 'hardware_timestamp',
  SOFTWARE_TIMESTAMP = 'software_timestamp',
  BUFFER_BASED = 'buffer_based',
  EVENT_DRIVEN = 'event_driven'
}

/**
 * Strategy performance and capability profile
 */
export interface StrategyProfile {
  /** Synchronization precision score (0.0 - 1.0) */
  precision: number;
  /** Expected latency in milliseconds */
  latency: number;
  /** Implementation complexity level */
  complexity: 'low' | 'medium' | 'high';
  /** Required system capabilities */
  requirements: string[];
  /** Human-readable description */
  description: string;
}

/**
 * Strategy compatibility and fallback information
 */
export interface StrategyCompatibility {
  /** Strategies this one can work alongside */
  compatibleWith: SynchronizationStrategy[];
  /** Fallback strategy if this one fails */
  fallbackTo: SynchronizationStrategy | null;
  /** Upgrade path to better strategy */
  upgrade: SynchronizationStrategy | null;
}

/**
 * Strategy selection requirements
 */
export interface StrategyRequirements {
  /** Maximum acceptable latency in milliseconds */
  maxLatency?: number;
  /** Minimum required precision (0.0 - 1.0) */
  minPrecision?: number;
  /** Available system features/capabilities */
  availableFeatures?: string[];
  /** Stream-specific characteristics */
  streamCharacteristics?: Record<string, any>;
}

/**
 * Strategy configuration with runtime parameters
 */
export interface StrategyConfig {
  /** Selected strategy type */
  strategy: SynchronizationStrategy;
  /** Runtime precision override */
  precision?: number;
  /** Maximum latency override */
  maxLatency?: number;
  /** Complexity level */
  complexity: 'low' | 'medium' | 'high';
  /** Required system capabilities */
  requirements: string[];
  /** Strategy description */
  description: string;
  /** Additional configuration overrides */
  [key: string]: any;
}

/**
 * Strategy selection candidate
 */
export interface StrategyCandidate {
  strategy: SynchronizationStrategy;
  profile: StrategyProfile;
  score: number;
}

// ==========================================
// Strategy Profiles
// ==========================================

/**
 * Strategy characteristics and performance profiles
 */
export const StrategyProfiles: Record<SynchronizationStrategy, StrategyProfile> = {
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

// ==========================================
// Strategy Compatibility Matrix
// ==========================================

/**
 * Strategy compatibility matrix defining relationships between strategies
 */
export const StrategyCompatibility: Record<SynchronizationStrategy, StrategyCompatibility> = {
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

// ==========================================
// Strategy Selection Logic
// ==========================================

/**
 * Selects the optimal synchronization strategy based on requirements
 * 
 * @param requirements - Strategy selection criteria
 * @returns Optimal strategy or fallback
 */
export const selectOptimalStrategy = (requirements: StrategyRequirements = {}): SynchronizationStrategy => {
  const {
    maxLatency = 50,
    minPrecision = 0.7,
    availableFeatures = [],
    streamCharacteristics = {}
  } = requirements;

  // Get all strategies that meet requirements
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
    .sort((a, b) => b[1].precision - a[1].precision); // Sort by precision (descending)

  if (candidates.length === 0) {
    // Fallback to most flexible strategy
    return SynchronizationStrategy.BUFFER_BASED;
  }

  return candidates[0][0] as SynchronizationStrategy;
};

/**
 * Evaluates strategy candidates with scoring
 * 
 * @param requirements - Strategy selection criteria
 * @returns Ranked list of strategy candidates
 */
export const evaluateStrategyCandidates = (requirements: StrategyRequirements = {}): StrategyCandidate[] => {
  const {
    maxLatency = 50,
    minPrecision = 0.7,
    availableFeatures = []
  } = requirements;

  const candidates: StrategyCandidate[] = [];

  for (const [strategy, profile] of Object.entries(StrategyProfiles)) {
    // Calculate base score from precision
    let score = profile.precision;

    // Penalty for exceeding latency requirement
    if (profile.latency > maxLatency) {
      score *= 0.5;
    }

    // Penalty for not meeting precision requirement
    if (profile.precision < minPrecision) {
      score *= 0.3;
    }

    // Penalty for missing required features
    const missingFeatures = profile.requirements.filter(
      req => !availableFeatures.includes(req)
    );
    if (missingFeatures.length > 0) {
      score *= Math.max(0.1, 1 - (missingFeatures.length * 0.3));
    }

    // Bonus for low complexity
    if (profile.complexity === 'low') {
      score *= 1.1;
    } else if (profile.complexity === 'high') {
      score *= 0.9;
    }

    candidates.push({
      strategy: strategy as SynchronizationStrategy,
      profile,
      score
    });
  }

  return candidates.sort((a, b) => b.score - a.score);
};

// ==========================================
// Strategy Configuration Factory
// ==========================================

/**
 * Creates a strategy configuration with runtime parameters
 * 
 * @param strategy - Target synchronization strategy
 * @param overrides - Configuration overrides
 * @returns Complete strategy configuration
 */
export const createStrategyConfig = (strategy: SynchronizationStrategy, overrides: Partial<StrategyConfig> = {}): StrategyConfig => {
  const profile = StrategyProfiles[strategy];
  if (!profile) {
    throw new Error(`Unknown strategy: ${strategy}`);
  }

  return {
    strategy,
    precision: overrides.precision || profile.precision,
    maxLatency: overrides.maxLatency || profile.latency,
    complexity: profile.complexity,
    requirements: [...profile.requirements],
    description: profile.description,
    ...overrides
  };
};

// ==========================================
// Strategy Validation Utilities
// ==========================================

/**
 * Validates if a strategy is compatible with system capabilities
 * 
 * @param strategy - Strategy to validate
 * @param availableFeatures - Available system features
 * @returns Validation result with details
 */
export const validateStrategyCompatibility = (
  strategy: SynchronizationStrategy, 
  availableFeatures: string[] = []
): { isValid: boolean; missingRequirements: string[]; warnings: string[] } => {
  const profile = StrategyProfiles[strategy];
  if (!profile) {
    return {
      isValid: false,
      missingRequirements: [],
      warnings: [`Unknown strategy: ${strategy}`]
    };
  }

  const missingRequirements = profile.requirements.filter(
    req => !availableFeatures.includes(req)
  );

  const warnings: string[] = [];
  if (profile.complexity === 'high') {
    warnings.push('High complexity strategy may impact performance');
  }
  if (profile.latency > 15) {
    warnings.push('Strategy has higher than average latency');
  }

  return {
    isValid: missingRequirements.length === 0,
    missingRequirements,
    warnings
  };
};

/**
 * Gets fallback strategy chain for a given strategy
 * 
 * @param strategy - Starting strategy
 * @param maxDepth - Maximum fallback depth
 * @returns Array of fallback strategies in order
 */
export const getFallbackChain = (
  strategy: SynchronizationStrategy, 
  maxDepth: number = 3
): SynchronizationStrategy[] => {
  const chain: SynchronizationStrategy[] = [];
  let current: SynchronizationStrategy | null = strategy;
  let depth = 0;

  while (current && depth < maxDepth) {
    const compatibility = StrategyCompatibility[current];
    if (!compatibility || !compatibility.fallbackTo) {
      break;
    }

    chain.push(compatibility.fallbackTo);
    current = compatibility.fallbackTo;
    depth++;

    // Prevent infinite loops
    if (chain.includes(current)) {
      break;
    }
  }

  return chain;
};

/**
 * Gets upgrade path for a given strategy
 * 
 * @param strategy - Current strategy
 * @param availableFeatures - Available system features
 * @returns Potential upgrade strategy or null
 */
export const getUpgradePath = (
  strategy: SynchronizationStrategy,
  availableFeatures: string[] = []
): SynchronizationStrategy | null => {
  const compatibility = StrategyCompatibility[strategy];
  if (!compatibility || !compatibility.upgrade) {
    return null;
  }

  const upgradeStrategy = compatibility.upgrade;
  const validation = validateStrategyCompatibility(upgradeStrategy, availableFeatures);
  
  return validation.isValid ? upgradeStrategy : null;
};

// ==========================================
// Strategy Analysis Utilities
// ==========================================

/**
 * Compares two strategies across multiple dimensions
 * 
 * @param strategyA - First strategy to compare
 * @param strategyB - Second strategy to compare
 * @returns Comparison results
 */
export const compareStrategies = (
  strategyA: SynchronizationStrategy,
  strategyB: SynchronizationStrategy
): {
  precision: 'A' | 'B' | 'equal';
  latency: 'A' | 'B' | 'equal';
  complexity: 'A' | 'B' | 'equal';
  overall: 'A' | 'B' | 'equal';
} => {
  const profileA = StrategyProfiles[strategyA];
  const profileB = StrategyProfiles[strategyB];

  if (!profileA || !profileB) {
    throw new Error('Invalid strategies for comparison');
  }

  const complexityOrder = { low: 1, medium: 2, high: 3 };

  const precision = profileA.precision > profileB.precision ? 'A' : 
                   profileA.precision < profileB.precision ? 'B' : 'equal';

  const latency = profileA.latency < profileB.latency ? 'A' : 
                 profileA.latency > profileB.latency ? 'B' : 'equal';

  const complexity = complexityOrder[profileA.complexity] < complexityOrder[profileB.complexity] ? 'A' :
                    complexityOrder[profileA.complexity] > complexityOrder[profileB.complexity] ? 'B' : 'equal';

  // Overall winner based on precision (weighted highest), then latency, then complexity
  const scoreA = profileA.precision * 0.5 + (1 / profileA.latency) * 0.3 + (1 / complexityOrder[profileA.complexity]) * 0.2;
  const scoreB = profileB.precision * 0.5 + (1 / profileB.latency) * 0.3 + (1 / complexityOrder[profileB.complexity]) * 0.2;

  const overall = scoreA > scoreB ? 'A' : scoreA < scoreB ? 'B' : 'equal';

  return { precision, latency, complexity, overall };
};

/**
 * Gets comprehensive strategy statistics
 * 
 * @returns Strategy statistics and analysis
 */
export const getStrategyStatistics = () => {
  const strategies = Object.values(SynchronizationStrategy);
  const profiles = Object.values(StrategyProfiles);

  const avgPrecision = profiles.reduce((sum, p) => sum + p.precision, 0) / profiles.length;
  const avgLatency = profiles.reduce((sum, p) => sum + p.latency, 0) / profiles.length;

  const complexityDistribution = profiles.reduce((acc, p) => {
    acc[p.complexity] = (acc[p.complexity] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const bestPrecision = strategies.find(s => 
    StrategyProfiles[s].precision === Math.max(...profiles.map(p => p.precision))
  );

  const bestLatency = strategies.find(s => 
    StrategyProfiles[s].latency === Math.min(...profiles.map(p => p.latency))
  );

  return {
    totalStrategies: strategies.length,
    averagePrecision: Number(avgPrecision.toFixed(3)),
    averageLatency: Number(avgLatency.toFixed(1)),
    complexityDistribution,
    bestForPrecision: bestPrecision,
    bestForLatency: bestLatency,
    strategiesByPrecision: strategies.sort((a, b) => 
      StrategyProfiles[b].precision - StrategyProfiles[a].precision
    ),
    strategiesByLatency: strategies.sort((a, b) => 
      StrategyProfiles[a].latency - StrategyProfiles[b].latency
    )
  };
};