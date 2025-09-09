/**
 * @fileoverview Data Quality Assessment System
 * 
 * Multi-dimensional quality assessment for fusion data including staleness,
 * completeness, consistency, and plausibility analysis with source reliability.
 * 
 * @version 1.0.0
 * @author Synopticon Development Team
 */

import type {
  DataSources,
  DataSourceConfig,
  DataQualityAssessment,
  FusionData,
  DataQualityAssessor,
  CompletenessCalculator,
  ConsistencyChecker,
  PlausibilityChecker
} from './types.js';

/**
 * Default data source configurations with reliability weighting
 */
export const DEFAULT_DATA_SOURCES: DataSources = {
  human: {
    physiological: { weight: 0.9, latency: 100, reliability: 0.95 },
    behavioral: { weight: 0.8, latency: 200, reliability: 0.85 },
    self_report: { weight: 0.6, latency: 1000, reliability: 0.7 },
    performance: { weight: 0.85, latency: 150, reliability: 0.9 }
  },
  simulator: {
    telemetry: { weight: 0.95, latency: 16, reliability: 0.98 },
    systems: { weight: 0.9, latency: 50, reliability: 0.95 },
    dynamics: { weight: 0.92, latency: 20, reliability: 0.97 },
    environment: { weight: 0.8, latency: 100, reliability: 0.85 }
  },
  external: {
    weather: { weight: 0.75, latency: 5000, reliability: 0.8 },
    traffic: { weight: 0.85, latency: 1000, reliability: 0.9 },
    navigation: { weight: 0.9, latency: 500, reliability: 0.92 },
    communications: { weight: 0.7, latency: 200, reliability: 0.85 }
  }
};

/**
 * Create data quality assessment system with configurable sources
 */
export const createDataQualityAssessment = (dataSources = DEFAULT_DATA_SOURCES) => {
  /**
   * Main data quality assessment function
   */
  const assessDataQuality: DataQualityAssessor = (data, source, type) => {
    const sourceConfig = getSourceConfig(dataSources, source, type);
    if (!sourceConfig) {
      return { 
        quality: 0, 
        confidence: 0, 
        issues: ['Unknown source/type'],
        staleness: 0,
        completeness: 0,
        consistency: 0,
        plausibility: 0
      };
    }
    
    const now = Date.now();
    const age = data.timestamp ? now - data.timestamp : 0;
    
    // Calculate individual quality dimensions
    const staleness = calculateStaleness(age, sourceConfig);
    const completeness = calculateCompleteness(data);
    const consistency = checkConsistency(data, source, type);
    const plausibility = checkPlausibility(data, source, type);
    
    // Weighted quality score
    const quality = (
      (staleness * 0.3) +
      (completeness * 0.3) +
      (consistency * 0.2) +
      (plausibility * 0.2)
    );
    
    const confidence = quality * sourceConfig.reliability;
    
    const issues = identifyIssues(staleness, completeness, consistency, plausibility);
    
    return { 
      quality, 
      confidence, 
      issues, 
      staleness, 
      completeness, 
      consistency, 
      plausibility 
    };
  };

  /**
   * Calculate data staleness based on age and source expectations
   */
  const calculateStaleness = (age: number, sourceConfig: DataSourceConfig): number => {
    if (age <= 0) return 1.0; // Fresh data
    
    const expectedLatency = sourceConfig.latency;
    const staleThreshold = expectedLatency * 10; // 10x expected latency is considered stale
    
    if (age <= expectedLatency) return 1.0;
    if (age >= staleThreshold) return 0.0;
    
    // Linear decay between expected and stale threshold
    return Math.max(0, 1 - ((age - expectedLatency) / (staleThreshold - expectedLatency)));
  };

  /**
   * Calculate data completeness based on required fields
   */
  const calculateCompleteness: CompletenessCalculator = (data) => {
    if (!data || typeof data !== 'object') return 0;
    
    const requiredFields = getRequiredFields(data);
    const presentFields = Object.keys(data).filter(key => 
      data[key] !== null && 
      data[key] !== undefined && 
      data[key] !== '' &&
      (typeof data[key] !== 'number' || !isNaN(data[key]))
    );
    
    return requiredFields.length > 0 ? 
      Math.min(1, presentFields.length / requiredFields.length) : 1;
  };

  /**
   * Determine required fields based on data type
   */
  const getRequiredFields = (data: FusionData): string[] => {
    // Type-specific field requirements
    const fieldMap: Record<string, string[]> = {
      'human-physiological': ['heartRate', 'timestamp'],
      'human-behavioral': ['reactionTime', 'timestamp'],
      'human-performance': ['accuracy', 'timestamp'],
      'human-self_report': ['workload', 'timestamp'],
      'simulator-telemetry': ['position', 'velocity', 'timestamp'],
      'simulator-systems': ['status', 'timestamp'],
      'external-weather': ['visibility', 'windSpeed', 'timestamp'],
      'external-traffic': ['density', 'timestamp']
    };

    const dataType = data.type as string;
    return fieldMap[dataType] || ['timestamp'];
  };

  /**
   * Check internal consistency of data values
   */
  const checkConsistency: ConsistencyChecker = (data, source, type) => {
    try {
      if (source === 'human' && type === 'physiological') {
        return checkPhysiologicalConsistency(data);
      }
      
      if (source === 'human' && type === 'behavioral') {
        return checkBehavioralConsistency(data);
      }
      
      if (source === 'simulator' && type === 'telemetry') {
        return checkTelemetryConsistency(data);
      }
      
      if (source === 'external' && type === 'weather') {
        return checkWeatherConsistency(data);
      }

      return 0.9; // Default good consistency for unknown types
    } catch (error) {
      return 0.3; // Low consistency if checking fails
    }
  };

  /**
   * Check physiological data consistency
   */
  const checkPhysiologicalConsistency = (data: FusionData): number => {
    const issues: string[] = [];
    
    // Heart rate bounds
    if (typeof data.heartRate === 'number') {
      if (data.heartRate < 30 || data.heartRate > 220) issues.push('heartRate');
    }
    
    // Body temperature bounds
    if (typeof data.temperature === 'number') {
      if (data.temperature < 35 || data.temperature > 42) issues.push('temperature');
    }
    
    // Heart rate variability (typically 20-50ms)
    if (typeof data.heartRateVariability === 'number') {
      if (data.heartRateVariability < 5 || data.heartRateVariability > 100) issues.push('hrv');
    }
    
    // Cross-validation: high HR should correlate with certain patterns
    if (typeof data.heartRate === 'number' && typeof data.heartRateVariability === 'number') {
      if (data.heartRate > 180 && data.heartRateVariability > 50) issues.push('hr-hrv-correlation');
    }
    
    return Math.max(0.1, 1 - (issues.length * 0.2));
  };

  /**
   * Check behavioral data consistency
   */
  const checkBehavioralConsistency = (data: FusionData): number => {
    const issues: string[] = [];
    
    // Reaction time bounds (typically 150-1500ms)
    if (typeof data.reactionTime === 'number') {
      if (data.reactionTime < 50 || data.reactionTime > 5000) issues.push('reactionTime');
    }
    
    // Error recovery time should be reasonable
    if (typeof data.errorRecoveryTime === 'number') {
      if (data.errorRecoveryTime < 100 || data.errorRecoveryTime > 10000) issues.push('errorRecovery');
    }
    
    return Math.max(0.1, 1 - (issues.length * 0.3));
  };

  /**
   * Check telemetry data consistency
   */
  const checkTelemetryConsistency = (data: FusionData): number => {
    const issues: string[] = [];
    
    // Altitude bounds (should be reasonable for aircraft/vehicles)
    if (typeof data.altitude === 'number') {
      if (data.altitude < -500 || data.altitude > 50000) issues.push('altitude');
    }
    
    // Speed bounds
    if (typeof data.speed === 'number') {
      if (data.speed < 0 || data.speed > 1000) issues.push('speed');
    }
    
    // Position validity
    if (data.position && typeof data.position === 'object') {
      const pos = data.position as any;
      if (pos.latitude < -90 || pos.latitude > 90) issues.push('latitude');
      if (pos.longitude < -180 || pos.longitude > 180) issues.push('longitude');
    }
    
    return Math.max(0.1, 1 - (issues.length * 0.2));
  };

  /**
   * Check weather data consistency
   */
  const checkWeatherConsistency = (data: FusionData): number => {
    const issues: string[] = [];
    
    // Visibility bounds (0-50km)
    if (typeof data.visibility === 'number') {
      if (data.visibility < 0 || data.visibility > 50000) issues.push('visibility');
    }
    
    // Wind speed bounds (0-200 km/h reasonable)
    if (typeof data.windSpeed === 'number') {
      if (data.windSpeed < 0 || data.windSpeed > 200) issues.push('windSpeed');
    }
    
    // Precipitation intensity (0-1)
    if (typeof data.precipitationIntensity === 'number') {
      if (data.precipitationIntensity < 0 || data.precipitationIntensity > 1) issues.push('precipitation');
    }
    
    return Math.max(0.1, 1 - (issues.length * 0.25));
  };

  /**
   * Check plausibility of data values given context
   */
  const checkPlausibility: PlausibilityChecker = (data, source, type) => {
    const issues: string[] = [];
    const now = Date.now();
    
    // Timestamp plausibility (not too far in past/future)
    if (data.timestamp) {
      const age = Math.abs(now - data.timestamp);
      if (age > 300000) issues.push('timestamp'); // 5 minutes
    }
    
    // Value ranges should be contextually reasonable
    if (source === 'human') {
      issues.push(...checkHumanDataPlausibility(data, type));
    } else if (source === 'simulator') {
      issues.push(...checkSimulatorDataPlausibility(data, type));
    } else if (source === 'external') {
      issues.push(...checkExternalDataPlausibility(data, type));
    }
    
    return Math.max(0.1, 1 - (issues.length * 0.2));
  };

  /**
   * Check human data plausibility
   */
  const checkHumanDataPlausibility = (data: FusionData, type: string): string[] => {
    const issues: string[] = [];
    
    if (type === 'physiological') {
      // Extreme values are possible but implausible in normal conditions
      if (typeof data.heartRate === 'number' && data.heartRate > 180) issues.push('extreme-hr');
      if (typeof data.temperature === 'number' && data.temperature > 39) issues.push('fever-temp');
    }
    
    if (type === 'performance') {
      // Perfect performance might be implausible
      if (typeof data.accuracy === 'number' && data.accuracy === 1.0) issues.push('perfect-accuracy');
    }
    
    return issues;
  };

  /**
   * Check simulator data plausibility
   */
  const checkSimulatorDataPlausibility = (data: FusionData, type: string): string[] => {
    const issues: string[] = [];
    
    if (type === 'telemetry') {
      // Extreme maneuvers might be implausible
      if (typeof data.acceleration === 'number' && Math.abs(data.acceleration) > 9.8 * 5) {
        issues.push('extreme-acceleration');
      }
    }
    
    return issues;
  };

  /**
   * Check external data plausibility
   */
  const checkExternalDataPlausibility = (data: FusionData, type: string): string[] => {
    const issues: string[] = [];
    
    if (type === 'weather') {
      // Extreme weather conditions
      if (typeof data.windSpeed === 'number' && data.windSpeed > 100) issues.push('extreme-wind');
      if (typeof data.visibility === 'number' && data.visibility < 100) issues.push('near-zero-visibility');
    }
    
    return issues;
  };

  /**
   * Identify quality issues based on dimension scores
   */
  const identifyIssues = (
    staleness: number,
    completeness: number,
    consistency: number,
    plausibility: number
  ): string[] => {
    const issues: string[] = [];
    
    if (staleness < 0.5) issues.push('Stale data - older than expected');
    if (completeness < 0.7) issues.push('Incomplete data - missing required fields');
    if (consistency < 0.5) issues.push('Inconsistent data - values outside expected ranges');
    if (plausibility < 0.5) issues.push('Implausible values - contextually unlikely data');
    
    return issues;
  };

  /**
   * Get source configuration safely
   */
  const getSourceConfig = (sources: DataSources, source: string, type: string): DataSourceConfig | null => {
    const sourceGroup = sources[source as keyof DataSources];
    if (!sourceGroup) return null;
    
    return sourceGroup[type as keyof typeof sourceGroup] || null;
  };

  return {
    assessDataQuality,
    calculateCompleteness,
    checkConsistency,
    checkPlausibility,
    getSourceConfig: (source: string, type: string) => getSourceConfig(dataSources, source, type)
  };
};

/**
 * Quality assessment utilities
 */
export const QualityAssessmentUtils = {
  /**
   * Grade overall quality into human-readable categories
   */
  gradeQuality: (quality: number): 'excellent' | 'good' | 'fair' | 'poor' => {
    if (quality >= 0.9) return 'excellent';
    if (quality >= 0.7) return 'good';
    if (quality >= 0.5) return 'fair';
    return 'poor';
  },

  /**
   * Calculate weighted quality score
   */
  calculateWeightedQuality: (assessments: DataQualityAssessment[], weights: number[]): number => {
    if (assessments.length !== weights.length) {
      throw new Error('Assessments and weights arrays must have same length');
    }

    const totalWeight = weights.reduce((sum, w) => sum + w, 0);
    if (totalWeight === 0) return 0;

    const weightedSum = assessments.reduce((sum, assessment, index) => {
      return sum + (assessment.quality * weights[index]);
    }, 0);

    return weightedSum / totalWeight;
  },

  /**
   * Identify most critical quality issues
   */
  identifyCriticalIssues: (assessments: DataQualityAssessment[]): string[] => {
    const issueFrequency = new Map<string, number>();
    
    assessments.forEach(assessment => {
      assessment.issues.forEach(issue => {
        issueFrequency.set(issue, (issueFrequency.get(issue) || 0) + 1);
      });
    });

    return Array.from(issueFrequency.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([issue]) => issue);
  },

  /**
   * Generate quality improvement recommendations
   */
  generateQualityRecommendations: (assessment: DataQualityAssessment): string[] => {
    const recommendations: string[] = [];
    
    if (assessment.staleness < 0.5) {
      recommendations.push('Increase data collection frequency or reduce processing latency');
    }
    
    if (assessment.completeness < 0.7) {
      recommendations.push('Ensure all required fields are populated before ingestion');
    }
    
    if (assessment.consistency < 0.5) {
      recommendations.push('Review sensor calibration and data validation rules');
    }
    
    if (assessment.plausibility < 0.5) {
      recommendations.push('Investigate data sources for potential corruption or interference');
    }
    
    return recommendations;
  }
};