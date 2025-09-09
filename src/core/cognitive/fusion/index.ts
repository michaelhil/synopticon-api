/**
 * @fileoverview Information Fusion Engine - Main Export
 * 
 * Comprehensive information fusion system for combining multi-modal data
 * (human state, simulator telemetry, environment) into coherent situational
 * awareness with confidence scoring and advanced cognitive integration.
 * 
 * @version 1.0.0
 * @author Synopticon Development Team
 */

// Core fusion engine
export { createInformationFusionEngine } from './fusion-engine.js';

// Component modules
export { createDataQualityAssessment, QualityAssessmentUtils } from './data-quality-assessment.js';
export { createFusionAlgorithms } from './fusion-algorithms.js';
export { createTemporalFusion, TemporalAnalysisUtils } from './temporal-fusion.js';

// Type definitions
export type * from './types.js';

// Re-export data source constants for convenience
export { DEFAULT_DATA_SOURCES } from './data-quality-assessment.js';

/**
 * Quick-start factory for creating a fusion engine with common configurations
 */
export const createFusionSystem = (config: {
  sources?: string[];
  enableTemporal?: boolean;
  enableQuality?: boolean;
  qualityThreshold?: number;
} = {}) => {
  const fusionEngine = createInformationFusionEngine({
    enableTemporalAnalysis: config.enableTemporal ?? true,
    enableQualityAssessment: config.enableQuality ?? true,
    fusionThresholds: {
      human: config.qualityThreshold || 0.3,
      environmental: config.qualityThreshold || 0.2,
      situational: config.qualityThreshold || 0.4
    },
    maxHistory: 1000
  });

  return {
    engine: fusionEngine,
    
    // Simplified interface
    ingest: fusionEngine.ingestData,
    getResult: fusionEngine.getFusionResult,
    getAllResults: fusionEngine.getAllFusionResults,
    getQuality: fusionEngine.getDataQuality,
    getTrends: fusionEngine.getTrends,
    
    // Event shortcuts
    onFusionComplete: (callback: (data: any) => void) => {
      fusionEngine.on('fusionCompleted', callback);
    },
    onDataIngested: (callback: (data: any) => void) => {
      fusionEngine.on('dataIngested', callback);
    },
    
    // Integration shortcuts
    integrate: fusionEngine.integrateAdvancedCognitiveComponents
  };
};

/**
 * Preset configurations for common fusion scenarios
 */
export const FusionPresets = {
  /**
   * High-precision fusion for research and laboratory environments
   */
  research: () => createFusionSystem({
    enableTemporal: true,
    enableQuality: true,
    qualityThreshold: 0.8
  }),

  /**
   * Real-time fusion for operational environments
   */
  operational: () => createFusionSystem({
    enableTemporal: true,
    enableQuality: true,
    qualityThreshold: 0.5
  }),

  /**
   * Lightweight fusion for resource-constrained environments
   */
  lightweight: () => createFusionSystem({
    enableTemporal: false,
    enableQuality: false,
    qualityThreshold: 0.3
  }),

  /**
   * Development and testing configuration
   */
  development: () => createFusionSystem({
    enableTemporal: true,
    enableQuality: true,
    qualityThreshold: 0.2
  }),

  /**
   * Production-ready configuration with balanced settings
   */
  production: () => createFusionSystem({
    enableTemporal: true,
    enableQuality: true,
    qualityThreshold: 0.4
  })
};

/**
 * Utility functions for fusion system management
 */
export const FusionUtils = {
  /**
   * Validate fusion data before ingestion
   */
  validateFusionData: (source: string, type: string, data: any): { valid: boolean; issues: string[] } => {
    const issues: string[] = [];
    
    if (!source || typeof source !== 'string') {
      issues.push('Source must be a non-empty string');
    }
    
    if (!type || typeof type !== 'string') {
      issues.push('Type must be a non-empty string');
    }
    
    if (!data || typeof data !== 'object') {
      issues.push('Data must be an object');
    }
    
    if (data && !data.timestamp && typeof data.timestamp !== 'number') {
      issues.push('Data should include a timestamp');
    }
    
    return {
      valid: issues.length === 0,
      issues
    };
  },

  /**
   * Create sample data for testing fusion algorithms
   */
  createSampleData: (source: string, type: string, values: Record<string, number> = {}) => {
    const timestamp = Date.now();
    const baseData: Record<string, unknown> = {
      timestamp,
      ...values
    };

    // Add type-specific realistic values
    if (source === 'human' && type === 'physiological') {
      return {
        heartRate: values.heartRate || 75,
        heartRateVariability: values.heartRateVariability || 35,
        temperature: values.temperature || 36.5,
        eyeBlinkRate: values.eyeBlinkRate || 12,
        timestamp
      };
    }

    if (source === 'human' && type === 'behavioral') {
      return {
        reactionTime: values.reactionTime || 250,
        taskSwitchingRate: values.taskSwitchingRate || 3,
        errorRecoveryTime: values.errorRecoveryTime || 800,
        timestamp
      };
    }

    if (source === 'human' && type === 'performance') {
      return {
        accuracy: values.accuracy || 0.85,
        errorRate: values.errorRate || 0.05,
        variability: values.variability || 0.15,
        timestamp
      };
    }

    if (source === 'external' && type === 'weather') {
      return {
        visibility: values.visibility || 8000,
        windSpeed: values.windSpeed || 15,
        precipitationIntensity: values.precipitationIntensity || 0.1,
        timestamp
      };
    }

    if (source === 'external' && type === 'traffic') {
      return {
        density: values.density || 25,
        conflicts: new Array(Math.floor(values.conflicts || 1)).fill({}),
        timestamp
      };
    }

    return baseData;
  },

  /**
   * Calculate fusion system health score
   */
  calculateSystemHealth: (fusionSystem: any): {
    score: number;
    status: 'excellent' | 'good' | 'fair' | 'poor';
    factors: Record<string, number>;
  } => {
    try {
      const quality = fusionSystem.getQuality();
      const results = fusionSystem.getAllResults();
      
      const factors = {
        dataQuality: quality.averageQuality || 0,
        dataAvailability: Math.min(1, quality.sources / 5), // Assume 5 sources is good
        fusionCoverage: Object.keys(results).length / 3, // human, env, situational
        confidenceLevel: Object.values(results).reduce((avg: number, result: any) => 
          avg + (result.confidence || 0), 0) / Math.max(Object.values(results).length, 1)
      };
      
      const score = Object.values(factors).reduce((sum, factor) => sum + factor, 0) / Object.keys(factors).length;
      
      let status: 'excellent' | 'good' | 'fair' | 'poor';
      if (score >= 0.9) status = 'excellent';
      else if (score >= 0.7) status = 'good';
      else if (score >= 0.5) status = 'fair';
      else status = 'poor';
      
      return { score, status, factors };
    } catch (error) {
      return { 
        score: 0, 
        status: 'poor', 
        factors: { error: 1 }
      };
    }
  },

  /**
   * Generate fusion performance report
   */
  generatePerformanceReport: (fusionSystem: any): string => {
    try {
      const health = FusionUtils.calculateSystemHealth(fusionSystem);
      const quality = fusionSystem.getQuality();
      const results = fusionSystem.getAllResults();
      
      const lines = [
        `📊 Fusion System Performance Report`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `Overall Health: ${health.status.toUpperCase()} (${(health.score * 100).toFixed(0)}%)`,
        ``,
        `📈 Data Quality`,
        `Sources: ${quality.sources}`,
        `Average Quality: ${(quality.averageQuality * 100).toFixed(0)}%`,
        `Average Confidence: ${(quality.averageConfidence * 100).toFixed(0)}%`,
        `Issues: ${quality.issues.length}`,
        ``,
        `🔄 Fusion Results`,
        `Active Fusions: ${Object.keys(results).length}`,
        ...Object.entries(results).map(([type, result]: [string, any]) => 
          `  ${type}: ${((result.confidence || 0) * 100).toFixed(0)}% confidence`
        ),
        ``,
        `🎯 Performance Factors`,
        ...Object.entries(health.factors).map(([factor, score]) => 
          `  ${factor}: ${(score * 100).toFixed(0)}%`
        )
      ];
      
      return lines.join('\n');
    } catch (error) {
      return `Error generating performance report: ${(error as Error).message}`;
    }
  },

  /**
   * Create fusion data validator with custom rules
   */
  createCustomValidator: (rules: Record<string, (data: any) => boolean>) => {
    return (source: string, type: string, data: any): { valid: boolean; failedRules: string[] } => {
      const key = `${source}-${type}`;
      const applicableRules = Object.entries(rules).filter(([ruleName]) => 
        ruleName === key || ruleName === source || ruleName === type || ruleName === 'global'
      );
      
      const failedRules: string[] = [];
      
      for (const [ruleName, ruleFunction] of applicableRules) {
        try {
          if (!ruleFunction(data)) {
            failedRules.push(ruleName);
          }
        } catch (error) {
          failedRules.push(`${ruleName} (error: ${(error as Error).message})`);
        }
      }
      
      return {
        valid: failedRules.length === 0,
        failedRules
      };
    };
  }
};

/**
 * Debug utilities for fusion system development
 */
export const FusionDebug = {
  /**
   * Create comprehensive fusion system monitor
   */
  createMonitor: () => {
    const stats = {
      ingestions: 0,
      fusions: 0,
      errors: 0,
      startTime: Date.now()
    };

    return {
      onDataIngested: () => { stats.ingestions++; },
      onFusionCompleted: () => { stats.fusions++; },
      onError: () => { stats.errors++; },
      
      getStats: () => ({
        ...stats,
        uptime: (Date.now() - stats.startTime) / 1000,
        rate: stats.ingestions / Math.max((Date.now() - stats.startTime) / 1000, 1)
      }),
      
      reset: () => {
        stats.ingestions = 0;
        stats.fusions = 0;
        stats.errors = 0;
        stats.startTime = Date.now();
      }
    };
  },

  /**
   * Create fusion data logger
   */
  createLogger: (prefix = 'FUSION') => ({
    logIngestion: (source: string, type: string, quality: any) => {
      console.log(`[${prefix}] Data ingested: ${source}-${type} (quality: ${(quality.quality * 100).toFixed(0)}%)`);
    },
    
    logFusion: (type: string, result: any) => {
      const confidence = (result.confidence || 0) * 100;
      console.log(`[${prefix}] Fusion completed: ${type} (confidence: ${confidence.toFixed(0)}%)`);
    },
    
    logError: (error: Error) => {
      console.error(`[${prefix}] Error:`, error.message);
    }
  })
};

// Version and build information
export const FUSION_VERSION = '1.0.0';
export const BUILD_INFO = {
  version: FUSION_VERSION,
  algorithms: ['human-state-fusion', 'environmental-fusion', 'situational-awareness-fusion'],
  features: [
    'Multi-modal data integration',
    'Quality assessment and monitoring', 
    'Temporal trend analysis',
    'Confidence scoring',
    'Advanced cognitive integration',
    'Real-time fusion processing',
    'Situational awareness calculation'
  ],
  compatibility: {
    browser: true,
    node: true,
    realtime: true,
    streaming: true
  }
};