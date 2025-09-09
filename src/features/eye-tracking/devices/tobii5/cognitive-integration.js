/**
 * Tobii 5 Cognitive System Integration
 * Connects Tobii 5 eye tracking data with Synopticon's cognitive advisory system
 * Implements specialized pipelines for gaze and attention analysis
 */

import { createLogger } from '../../../../shared/utils/logger.js';

const logger = createLogger({ level: 2, component: 'Tobii5CognitiveIntegration' });

/**
 * Create cognitive integration for Tobii 5 device
 */
export const createTobii5CognitiveIntegration = (tobiiDevice, cognitiveSystem) => {
  const state = {
    active: false,
    subscriptions: new Map(),
    gazeHistory: [],
    attentionMetrics: {
      lastUpdate: 0,
      currentFocus: null,
      scanPattern: [],
      cognitiveLoad: 0
    }
  };

  /**
   * Start cognitive integration
   */
  const start = () => {
    if (state.active) {
      logger.warn('Tobii 5 cognitive integration already active');
      return;
    }

    logger.info('🧠 Starting Tobii 5 cognitive integration');
    state.active = true;

    // Subscribe to Tobii gaze data
    const gazeSubscription = tobiiDevice.onGazeData((data) => {
      processGazeData(data);
    });
    state.subscriptions.set('gazeData', gazeSubscription);

    // Subscribe to device status changes
    const statusSubscription = tobiiDevice.on('connected', () => {
      handleDeviceConnected();
    });
    state.subscriptions.set('deviceStatus', statusSubscription);

    // Initialize cognitive pipelines
    initializeCognitivePipelines();
  };

  /**
   * Stop cognitive integration
   */
  const stop = () => {
    if (!state.active) return;

    logger.info('🧠 Stopping Tobii 5 cognitive integration');
    state.active = false;

    // Unsubscribe from all events
    state.subscriptions.forEach((unsubscribe, key) => {
      try {
        if (typeof unsubscribe === 'function') {
          unsubscribe();
        }
      } catch (error) {
        logger.error(`Failed to unsubscribe from ${key}:`, error);
      }
    });
    state.subscriptions.clear();
  };

  /**
   * Process incoming gaze data through cognitive pipelines
   */
  const processGazeData = async (data) => {
    if (!state.active || !cognitiveSystem) return;

    try {
      // Update gaze history
      updateGazeHistory(data);

      // Process through fusion engine
      await ingestIntoFusionEngine(data);

      // Update state manager
      updateCognitiveState(data);

      // Process through specialized pipelines
      await processGazePipelines(data);

      // Update attention metrics
      updateAttentionMetrics(data);

    } catch (error) {
      logger.error('Failed to process gaze data in cognitive system:', error);
    }
  };

  /**
   * Update gaze history buffer
   */
  const updateGazeHistory = (data) => {
    state.gazeHistory.push({
      timestamp: data.timestamp,
      gaze: data.gaze,
      head: data.head,
      presence: data.presence,
      quality: data.quality
    });

    // Keep only last 1000 data points (approximately 16 seconds at 60Hz)
    if (state.gazeHistory.length > 1000) {
      state.gazeHistory = state.gazeHistory.slice(-1000);
    }
  };

  /**
   * Ingest data into cognitive fusion engine
   */
  const ingestIntoFusionEngine = async (data) => {
    // Gaze tracking data
    if (data.gaze && data.gaze.valid) {
      const gazeData = {
        category: 'behavioral',
        type: 'gaze-tracking',
        timestamp: data.timestamp,
        data: {
          position: { x: data.gaze.x, y: data.gaze.y },
          confidence: data.gaze.confidence,
          quality: data.quality.gaze,
          deviceType: 'tobii-5'
        }
      };

      cognitiveSystem.fusionEngine.ingestData('human', 'gaze-tracking', gazeData);
    }

    // Head tracking data
    if (data.head && data.head.valid) {
      const headData = {
        category: 'behavioral',
        type: 'head-tracking',
        timestamp: data.timestamp,
        data: {
          orientation: {
            yaw: data.head.yaw,
            pitch: data.head.pitch,
            roll: data.head.roll
          },
          position: data.head.position,
          confidence: data.head.confidence,
          quality: data.quality.head,
          deviceType: 'tobii-5'
        }
      };

      cognitiveSystem.fusionEngine.ingestData('human', 'head-tracking', headData);
    }

    // Presence data
    const presenceData = {
      category: 'behavioral',
      type: 'presence-detection',
      timestamp: data.timestamp,
      data: {
        present: data.presence.detected,
        confidence: data.presence.confidence,
        deviceType: 'tobii-5'
      }
    };

    cognitiveSystem.fusionEngine.ingestData('human', 'presence-detection', presenceData);
  };

  /**
   * Update cognitive state manager
   */
  const updateCognitiveState = (data) => {
    // Update human gaze state
    if (data.gaze && data.gaze.valid) {
      cognitiveSystem.stateManager.updateState('human.gaze', {
        position: { x: data.gaze.x, y: data.gaze.y },
        timestamp: data.timestamp,
        confidence: data.gaze.confidence,
        source: 'tobii-5'
      });
    }

    // Update human head state
    if (data.head && data.head.valid) {
      cognitiveSystem.stateManager.updateState('human.head', {
        orientation: {
          yaw: data.head.yaw,
          pitch: data.head.pitch,
          roll: data.head.roll
        },
        position: data.head.position,
        timestamp: data.timestamp,
        confidence: data.head.confidence,
        source: 'tobii-5'
      });
    }

    // Update presence state
    cognitiveSystem.stateManager.updateState('human.presence', {
      detected: data.presence.detected,
      confidence: data.presence.confidence,
      timestamp: data.timestamp,
      source: 'tobii-5'
    });
  };

  /**
   * Process data through specialized gaze analysis pipelines
   */
  const processGazePipelines = async (data) => {
    if (!data.gaze || !data.gaze.valid) return;

    // Tactical gaze analysis (<50ms)
    const tacticalAnalysis = await cognitiveSystem.pipelineSystem.process(
      'gaze-analysis-tactical',
      {
        currentGaze: data.gaze,
        history: state.gazeHistory.slice(-10), // Last 10 samples
        timestamp: data.timestamp
      },
      'tactical'
    );

    // Operational attention analysis (<500ms)
    if (state.gazeHistory.length >= 30) { // Need sufficient history
      const operationalAnalysis = await cognitiveSystem.pipelineSystem.process(
        'attention-monitoring-operational',
        {
          gazeHistory: state.gazeHistory.slice(-30),
          headData: data.head,
          presenceData: data.presence,
          timestamp: data.timestamp
        },
        'operational'
      );
    }
  };

  /**
   * Update attention metrics
   */
  const updateAttentionMetrics = (data) => {
    const now = data.timestamp;

    if (data.gaze && data.gaze.valid) {
      // Update focus area
      state.attentionMetrics.currentFocus = {
        x: data.gaze.x,
        y: data.gaze.y,
        timestamp: now,
        confidence: data.gaze.confidence
      };

      // Update scan pattern
      state.attentionMetrics.scanPattern.push({
        x: data.gaze.x,
        y: data.gaze.y,
        timestamp: now
      });

      // Keep only recent scan pattern data (last 5 seconds)
      const cutoff = now - 5000;
      state.attentionMetrics.scanPattern = state.attentionMetrics.scanPattern
        .filter(point => point.timestamp > cutoff);

      // Calculate cognitive load based on scan pattern
      state.attentionMetrics.cognitiveLoad = calculateCognitiveLoad(
        state.attentionMetrics.scanPattern
      );
    }

    state.attentionMetrics.lastUpdate = now;
  };

  /**
   * Calculate cognitive load from gaze scan pattern
   */
  const calculateCognitiveLoad = (scanPattern) => {
    if (scanPattern.length < 2) return 0;

    // Calculate gaze velocity and dispersion
    let totalDistance = 0;
    let fixationCount = 0;
    const fixationThreshold = 50; // pixels

    for (let i = 1; i < scanPattern.length; i++) {
      const prev = scanPattern[i - 1];
      const curr = scanPattern[i];
      
      const distance = Math.sqrt(
        Math.pow(curr.x - prev.x, 2) + Math.pow(curr.y - prev.y, 2)
      );
      
      totalDistance += distance;
      
      if (distance < fixationThreshold) {
        fixationCount++;
      }
    }

    // High velocity and low fixation count = high cognitive load
    const avgVelocity = totalDistance / scanPattern.length;
    const fixationRatio = fixationCount / scanPattern.length;
    
    // Normalize to 0-1 scale
    const loadScore = Math.min(1, (avgVelocity / 1000) + (1 - fixationRatio));
    
    return loadScore;
  };

  /**
   * Handle device connection events
   */
  const handleDeviceConnected = () => {
    logger.info('🔗 Tobii 5 device connected - cognitive integration active');
    
    // Reset metrics
    state.attentionMetrics = {
      lastUpdate: Date.now(),
      currentFocus: null,
      scanPattern: [],
      cognitiveLoad: 0
    };
    
    // Clear history
    state.gazeHistory = [];
  };

  /**
   * Initialize specialized cognitive pipelines for gaze analysis
   */
  const initializeCognitivePipelines = () => {
    // Register tactical gaze analysis pipeline
    if (cognitiveSystem.pipelineSystem.registerPipeline) {
      cognitiveSystem.pipelineSystem.registerPipeline({
        name: 'gaze-analysis-tactical',
        level: 'tactical',
        maxProcessingTime: 50,
        
        process: async (data) => {
          const { currentGaze, history } = data;
          
          return {
            gazePosition: currentGaze,
            fixation: detectFixation(history),
            saccade: detectSaccade(history),
            attentionArea: calculateAttentionArea(currentGaze),
            quality: currentGaze.confidence
          };
        }
      });

      // Register operational attention monitoring pipeline
      cognitiveSystem.pipelineSystem.registerPipeline({
        name: 'attention-monitoring-operational',
        level: 'operational',
        maxProcessingTime: 500,
        
        process: async (data) => {
          const { gazeHistory, headData, presenceData } = data;
          
          return {
            attentionState: assessAttentionState(gazeHistory),
            cognitiveLoad: calculateCognitiveLoad(gazeHistory),
            alertness: assessAlertness(gazeHistory, presenceData),
            scanPattern: analyzeScanPattern(gazeHistory),
            workloadIndicators: analyzeWorkloadIndicators(gazeHistory, headData)
          };
        }
      });
    }
  };

  /**
   * Detect fixation in gaze history
   */
  const detectFixation = (history) => {
    if (history.length < 3) return null;

    const recent = history.slice(-3);
    const dispersion = calculateDispersion(recent.map(h => h.gaze).filter(g => g && g.valid));
    
    return {
      isFixation: dispersion < 50, // pixels
      duration: recent.length * 16.7, // ~60Hz assumption
      dispersion,
      center: calculateCentroid(recent.map(h => h.gaze).filter(g => g && g.valid))
    };
  };

  /**
   * Detect saccade in gaze history
   */
  const detectSaccade = (history) => {
    if (history.length < 2) return null;

    const last = history[history.length - 1];
    const prev = history[history.length - 2];
    
    if (!last.gaze || !prev.gaze || !last.gaze.valid || !prev.gaze.valid) {
      return null;
    }

    const velocity = Math.sqrt(
      Math.pow(last.gaze.x - prev.gaze.x, 2) + 
      Math.pow(last.gaze.y - prev.gaze.y, 2)
    ) / 16.7; // pixels per ms

    return {
      isSaccade: velocity > 30, // pixels per ms threshold
      velocity,
      direction: Math.atan2(last.gaze.y - prev.gaze.y, last.gaze.x - prev.gaze.x),
      amplitude: Math.sqrt(
        Math.pow(last.gaze.x - prev.gaze.x, 2) + 
        Math.pow(last.gaze.y - prev.gaze.y, 2)
      )
    };
  };

  /**
   * Calculate attention area from gaze position
   */
  const calculateAttentionArea = (gaze) => {
    if (!gaze || !gaze.valid) return null;

    // Define attention regions (example for typical screen layout)
    const regions = {
      'center': { x: 0.3, y: 0.3, width: 0.4, height: 0.4 },
      'left': { x: 0, y: 0, width: 0.3, height: 1 },
      'right': { x: 0.7, y: 0, width: 0.3, height: 1 },
      'top': { x: 0, y: 0, width: 1, height: 0.3 },
      'bottom': { x: 0, y: 0.7, width: 1, height: 0.3 }
    };

    // Convert gaze to normalized coordinates (0-1)
    // This would need actual screen dimensions in a real implementation
    const normalizedX = gaze.x / 1920; // Assuming 1920px width
    const normalizedY = gaze.y / 1080; // Assuming 1080px height

    for (const [region, bounds] of Object.entries(regions)) {
      if (normalizedX >= bounds.x && normalizedX <= bounds.x + bounds.width &&
          normalizedY >= bounds.y && normalizedY <= bounds.y + bounds.height) {
        return region;
      }
    }

    return 'peripheral';
  };

  /**
   * Helper functions for gaze analysis
   */
  const calculateDispersion = (gazePoints) => {
    if (gazePoints.length < 2) return 0;

    let maxDistance = 0;
    for (let i = 0; i < gazePoints.length; i++) {
      for (let j = i + 1; j < gazePoints.length; j++) {
        const distance = Math.sqrt(
          Math.pow(gazePoints[j].x - gazePoints[i].x, 2) +
          Math.pow(gazePoints[j].y - gazePoints[i].y, 2)
        );
        maxDistance = Math.max(maxDistance, distance);
      }
    }
    
    return maxDistance;
  };

  const calculateCentroid = (gazePoints) => {
    if (gazePoints.length === 0) return null;

    const sum = gazePoints.reduce(
      (acc, point) => ({
        x: acc.x + point.x,
        y: acc.y + point.y
      }),
      { x: 0, y: 0 }
    );

    return {
      x: sum.x / gazePoints.length,
      y: sum.y / gazePoints.length
    };
  };

  // Placeholder implementations for operational-level analysis
  const assessAttentionState = (gazeHistory) => ({ state: 'focused', confidence: 0.8 });
  const assessAlertness = (gazeHistory, presenceData) => ({ level: 'alert', confidence: 0.9 });
  const analyzeScanPattern = (gazeHistory) => ({ pattern: 'systematic', efficiency: 0.7 });
  const analyzeWorkloadIndicators = (gazeHistory, headData) => ({ workload: 'moderate', indicators: [] });

  // Public API
  return {
    start,
    stop,
    
    // Status
    isActive: () => state.active,
    getAttentionMetrics: () => ({ ...state.attentionMetrics }),
    getGazeHistory: () => [...state.gazeHistory],
    
    // Analytics
    calculateCognitiveLoad: () => state.attentionMetrics.cognitiveLoad,
    getCurrentFocus: () => state.attentionMetrics.currentFocus,
    getScanPattern: () => [...state.attentionMetrics.scanPattern],
    
    // Cleanup
    cleanup: () => {
      stop();
      state.gazeHistory = [];
      state.attentionMetrics = {
        lastUpdate: 0,
        currentFocus: null,
        scanPattern: [],
        cognitiveLoad: 0
      };
      logger.info('🧹 Tobii 5 cognitive integration cleaned up');
    }
  };
};
