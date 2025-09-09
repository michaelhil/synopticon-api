/**
 * Telemetry Analysis Pipeline
 * Processes simulator telemetry data for analysis and anomaly detection
 */

import { createLogger } from '../../shared/utils/logger.js';

const logger = createLogger({ level: 2 });

/**
 * Telemetry data analyzer factory
 */
const createTelemetryAnalyzer = (config = {}) => {
  const state = {
    thresholds: {
      speedLimit: config.speedLimit || 250, // km/h for vehicles, knots for aircraft
      altitudeWarning: config.altitudeWarning || 500, // feet
      gForceLimit: config.gForceLimit || 9, // g-forces
      rollLimit: config.rollLimit || 60, // degrees
      pitchLimit: config.pitchLimit || 30, // degrees
      ...config.thresholds
    },
    history: [],
    maxHistory: config.maxHistory || 100,
    anomalies: []
  };

  const analyzeFlightData = (data) => {
    const analysis = {
      timestamp: Date.now(),
      type: 'flight',
      metrics: {},
      warnings: [],
      anomalies: []
    };

    // Analyze altitude
    if (data.altitude !== undefined) {
      analysis.metrics.altitude = data.altitude;
      if (data.altitude < state.thresholds.altitudeWarning && data.altitude > 0) {
        analysis.warnings.push({
          type: 'low_altitude',
          value: data.altitude,
          threshold: state.thresholds.altitudeWarning
        });
      }
    }

    // Analyze speed
    if (data.airspeed !== undefined) {
      analysis.metrics.airspeed = data.airspeed;
      if (data.airspeed > state.thresholds.speedLimit) {
        analysis.warnings.push({
          type: 'overspeed',
          value: data.airspeed,
          threshold: state.thresholds.speedLimit
        });
      }
    }

    // Analyze attitude
    if (data.roll !== undefined && Math.abs(data.roll) > state.thresholds.rollLimit) {
      analysis.warnings.push({
        type: 'excessive_roll',
        value: data.roll,
        threshold: state.thresholds.rollLimit
      });
    }

    if (data.pitch !== undefined && Math.abs(data.pitch) > state.thresholds.pitchLimit) {
      analysis.warnings.push({
        type: 'excessive_pitch',
        value: data.pitch,
        threshold: state.thresholds.pitchLimit
      });
    }

    // Analyze g-forces
    if (data.gForce !== undefined && Math.abs(data.gForce) > state.thresholds.gForceLimit) {
      analysis.anomalies.push({
        type: 'excessive_g_force',
        value: data.gForce,
        threshold: state.thresholds.gForceLimit,
        severity: 'high'
      });
    }

    return analysis;
  };

  const analyzeVehicleData = (data) => {
    const analysis = {
      timestamp: Date.now(),
      type: 'vehicle',
      metrics: {},
      warnings: [],
      anomalies: []
    };

    // Analyze speed
    if (data.speed !== undefined) {
      analysis.metrics.speed = data.speed;
      if (data.speed > state.thresholds.speedLimit) {
        analysis.warnings.push({
          type: 'overspeed',
          value: data.speed,
          threshold: state.thresholds.speedLimit
        });
      }
    }

    // Analyze engine metrics
    if (data.rpm !== undefined) {
      analysis.metrics.rpm = data.rpm;
      if (data.rpm > 8000) {
        analysis.warnings.push({
          type: 'high_rpm',
          value: data.rpm,
          threshold: 8000
        });
      }
    }

    // Analyze vehicle dynamics
    if (data.wheelSlip !== undefined && data.wheelSlip > 0.3) {
      analysis.warnings.push({
        type: 'wheel_slip',
        value: data.wheelSlip,
        threshold: 0.3
      });
    }

    if (data.damage !== undefined && data.damage > 0) {
      analysis.anomalies.push({
        type: 'vehicle_damage',
        value: data.damage,
        severity: data.damage > 0.5 ? 'high' : 'medium'
      });
    }

    return analysis;
  };

  const detectAnomalies = (currentData) => {
    const anomalies = [];
    
    // Detect sudden changes
    if (state.history.length > 0) {
      const lastData = state.history[state.history.length - 1];
      
      // Check for sudden altitude changes
      if (currentData.altitude && lastData.altitude) {
        const altitudeChange = Math.abs(currentData.altitude - lastData.altitude);
        if (altitudeChange > 1000) {
          anomalies.push({
            type: 'sudden_altitude_change',
            delta: altitudeChange,
            severity: 'medium'
          });
        }
      }
      
      // Check for sudden speed changes
      const speedField = currentData.airspeed ? 'airspeed' : 'speed';
      if (currentData[speedField] && lastData[speedField]) {
        const speedChange = Math.abs(currentData[speedField] - lastData[speedField]);
        if (speedChange > 50) {
          anomalies.push({
            type: 'sudden_speed_change',
            delta: speedChange,
            severity: 'low'
          });
        }
      }
    }
    
    return anomalies;
  };

  const analyze = (telemetryData) => {
    // Detect anomalies based on history
    const anomalies = detectAnomalies(telemetryData);
    
    // Add to history
    state.history.push({
      ...telemetryData,
      timestamp: Date.now()
    });
    
    if (state.history.length > state.maxHistory) {
      state.history.shift();
    }
    
    // Perform type-specific analysis
    let analysis;
    if (telemetryData.simulator === 'msfs' || telemetryData.simulator === 'xplane') {
      analysis = analyzeFlightData(telemetryData);
    } else if (telemetryData.simulator === 'beamng') {
      analysis = analyzeVehicleData(telemetryData);
    } else {
      analysis = {
        timestamp: Date.now(),
        type: 'generic',
        metrics: telemetryData,
        warnings: [],
        anomalies: []
      };
    }
    
    // Add detected anomalies
    analysis.anomalies.push(...anomalies);
    
    // Store anomalies
    if (analysis.anomalies.length > 0) {
      state.anomalies.push(...analysis.anomalies);
      if (state.anomalies.length > 100) {
        state.anomalies = state.anomalies.slice(-100);
      }
    }
    
    return analysis;
  };

  return {
    analyze,
    getHistory: () => [...state.history],
    getAnomalies: () => [...state.anomalies],
    clearHistory: () => { state.history = []; },
    updateThresholds: (newThresholds) => {
      Object.assign(state.thresholds, newThresholds);
    }
  };
};

/**
 * Create telemetry analysis pipeline
 */
export const createTelemetryAnalysisPipeline = (config = {}) => {
  const state = {
    name: 'telemetry-analysis',
    version: '1.0.0',
    isInitialized: false,
    analyzer: null,
    config: {
      enableAnalysis: true,
      enableAnomalyDetection: true,
      enableMetrics: true,
      ...config
    },
    stats: {
      processed: 0,
      errors: 0,
      anomaliesDetected: 0
    }
  };

  const initialize = async () => {
    if (state.isInitialized) {
      return;
    }

    try {
      state.analyzer = createTelemetryAnalyzer(state.config);
      state.isInitialized = true;
      logger.info('✅ Telemetry analysis pipeline initialized');
    } catch (error) {
      logger.error('Failed to initialize telemetry pipeline:', error);
      throw error;
    }
  };

  const process = async (data) => {
    if (!state.isInitialized) {
      await initialize();
    }

    try {
      state.stats.processed++;
      
      // Skip if analysis is disabled
      if (!state.config.enableAnalysis) {
        return {
          data,
          metadata: {
            processed: true,
            analyzed: false
          }
        };
      }
      
      // Analyze telemetry data
      const analysis = state.analyzer.analyze(data);
      
      // Track anomalies
      if (analysis.anomalies.length > 0) {
        state.stats.anomaliesDetected += analysis.anomalies.length;
        logger.warn(`Telemetry anomalies detected: ${analysis.anomalies.length}`);
      }
      
      return {
        data,
        analysis,
        metadata: {
          processed: true,
          analyzed: true,
          pipeline: state.name,
          timestamp: Date.now()
        }
      };
    } catch (error) {
      state.stats.errors++;
      logger.error('Telemetry processing error:', error);
      throw error;
    }
  };

  const getCapabilities = () => ({
    name: state.name,
    version: state.version,
    capabilities: [
      'telemetry_analysis',
      'anomaly_detection',
      'flight_analysis',
      'vehicle_analysis',
      'metrics_extraction'
    ],
    supportedSimulators: ['msfs', 'xplane', 'beamng', 'vatsim'],
    analysisTypes: ['flight', 'vehicle', 'generic']
  });

  const getStatistics = () => ({
    ...state.stats,
    isInitialized: state.isInitialized,
    history: state.analyzer?.getHistory().length || 0,
    recentAnomalies: state.analyzer?.getAnomalies() || []
  });

  const shutdown = async () => {
    if (state.analyzer) {
      state.analyzer.clearHistory();
    }
    state.isInitialized = false;
    logger.info('Telemetry analysis pipeline shut down');
  };

  return {
    name: state.name,
    initialize,
    process,
    getCapabilities,
    getStatistics,
    shutdown,
    // Pipeline-specific methods
    getAnalyzer: () => state.analyzer,
    updateConfig: (newConfig) => {
      Object.assign(state.config, newConfig);
      if (state.analyzer) {
        state.analyzer.updateThresholds(newConfig.thresholds || {});
      }
    }
  };
};
