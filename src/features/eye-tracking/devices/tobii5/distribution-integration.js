/**
 * Tobii 5 Distribution System Integration
 * Multi-protocol data distribution for Tobii 5 eye tracking data
 * Supports OpenTrack UDP compatibility, WebSocket, MQTT, and SSE
 */

import { createLogger } from '../../../../shared/utils/logger.js';
import { COGNITIVE_MESSAGE_TYPES } from '../../../../core/cognitive/distribution-adapter.js';

const logger = createLogger({ level: 2, component: 'Tobii5Distribution' });

/**
 * OpenTrack UDP packet structure
 * Compatible with existing OpenTrack installations
 */
const createOpenTrackPacket = (headData) => {
  // OpenTrack expects 6DOF data: yaw, pitch, roll, x, y, z
  return {
    yaw: headData.yaw || 0,
    pitch: headData.pitch || 0,
    roll: headData.roll || 0,
    x: headData.position?.x || 0,
    y: headData.position?.y || 0,
    z: headData.position?.z || 0,
    timestamp: Date.now()
  };
};

/**
 * Create Tobii 5 distribution integration
 */
export const createTobii5DistributionIntegration = (tobiiDevice, distributionSystem) => {
  const state = {
    active: false,
    subscriptions: new Map(),
    distributionChannels: new Map(),
    stats: {
      packetsDistributed: 0,
      udpPackets: 0,
      websocketPackets: 0,
      mqttPackets: 0,
      ssePackets: 0,
      errors: 0
    }
  };

  /**
   * Start distribution integration
   */
  const start = () => {
    if (state.active) {
      logger.warn('Tobii 5 distribution integration already active');
      return;
    }

    logger.info('📡 Starting Tobii 5 distribution integration');
    state.active = true;

    // Subscribe to Tobii gaze data
    const gazeSubscription = tobiiDevice.onGazeData((data) => {
      distributeGazeData(data);
    });
    state.subscriptions.set('gazeData', gazeSubscription);

    // Initialize distribution channels
    initializeDistributionChannels();
  };

  /**
   * Stop distribution integration
   */
  const stop = () => {
    if (!state.active) return;

    logger.info('📡 Stopping Tobii 5 distribution integration');
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

    // Clear distribution channels
    state.distributionChannels.clear();
  };

  /**
   * Initialize distribution channels
   */
  const initializeDistributionChannels = () => {
    // OpenTrack UDP compatibility channel
    state.distributionChannels.set('opentrack-udp', {
      name: 'OpenTrack UDP Compatibility',
      protocol: 'UDP',
      port: 4242,
      format: 'opentrack',
      description: 'Head tracking data compatible with OpenTrack protocol'
    });

    // WebSocket full data channel
    state.distributionChannels.set('websocket-full', {
      name: 'WebSocket Full Data',
      protocol: 'WebSocket',
      format: 'json',
      description: 'Complete Tobii 5 data including gaze, head, presence, and cognitive analysis'
    });

    // MQTT topic-based distribution
    state.distributionChannels.set('mqtt-topics', {
      name: 'MQTT Topic Distribution',
      protocol: 'MQTT',
      format: 'json',
      topics: {
        'synopticon/tobii5/gaze': 'Gaze point data',
        'synopticon/tobii5/head': 'Head pose data',
        'synopticon/tobii5/presence': 'Presence detection',
        'synopticon/tobii5/attention': 'Attention state analysis',
        'synopticon/tobii5/cognitive': 'Cognitive load analysis'
      },
      description: 'Topic-based MQTT distribution for selective data access'
    });

    // Server-Sent Events for web clients
    state.distributionChannels.set('sse-stream', {
      name: 'Server-Sent Events Stream',
      protocol: 'SSE',
      format: 'json',
      description: 'Real-time streaming for web applications'
    });
  };

  /**
   * Distribute Tobii gaze data through all configured channels
   */
  const distributeGazeData = async (data) => {
    if (!state.active || !distributionSystem) return;

    try {
      // Create distribution payload
      const distributionData = createDistributionPayload(data);

      // Distribute via OpenTrack UDP (head tracking only)
      await distributeOpenTrackUDP(distributionData);

      // Distribute via WebSocket (full data)
      await distributeWebSocketFull(distributionData);

      // Distribute via MQTT topics
      await distributeMQTTTopics(distributionData);

      // Distribute via Server-Sent Events
      await distributeSSE(distributionData);

      state.stats.packetsDistributed++;

    } catch (error) {
      logger.error('Failed to distribute Tobii data:', error);
      state.stats.errors++;
    }
  };

  /**
   * Create comprehensive distribution payload
   */
  const createDistributionPayload = (data) => {
    return {
      timestamp: data.timestamp,
      source: 'tobii-5',
      
      // Raw Tobii data
      gaze: data.gaze,
      head: data.head,
      presence: data.presence,
      quality: data.quality,
      metadata: data.metadata,
      
      // OpenTrack compatibility data
      opentrack: data.head && data.head.valid ? createOpenTrackPacket(data.head) : null,
      
      // Enhanced data
      enhanced: {
        attentionArea: calculateAttentionArea(data.gaze),
        gazeVelocity: calculateGazeVelocity(data),
        headStability: calculateHeadStability(data.head),
        overallQuality: data.quality.overall
      }
    };
  };

  /**
   * Distribute via OpenTrack UDP protocol
   */
  const distributeOpenTrackUDP = async (data) => {
    if (!data.opentrack || !distributionSystem.distribute) return;

    try {
      const udpMessage = {
        type: 'opentrack-head-tracking',
        protocol: 'UDP',
        port: 4242,
        data: data.opentrack
      };

      await distributionSystem.distribute('opentrack-udp', udpMessage);
      state.stats.udpPackets++;
      
    } catch (error) {
      logger.error('Failed to distribute via OpenTrack UDP:', error);
    }
  };

  /**
   * Distribute via WebSocket (full data)
   */
  const distributeWebSocketFull = async (data) => {
    try {
      const wsMessage = {
        type: 'tobii-5-full-data',
        timestamp: Date.now(),
        source: 'synopticon-tobii5',
        data: {
          gaze: data.gaze,
          head: data.head,
          presence: data.presence,
          quality: data.quality,
          enhanced: data.enhanced,
          metadata: data.metadata
        }
      };

      await distributionSystem.distribute('tobii5-websocket', wsMessage);
      state.stats.websocketPackets++;
      
    } catch (error) {
      logger.error('Failed to distribute via WebSocket:', error);
    }
  };

  /**
   * Distribute via MQTT topics
   */
  const distributeMQTTTopics = async (data) => {
    try {
      const topicData = {
        // Individual topic messages
        'synopticon/tobii5/gaze': {
          position: data.gaze,
          timestamp: data.timestamp,
          quality: data.quality.gaze
        },
        
        'synopticon/tobii5/head': {
          orientation: data.head ? {
            yaw: data.head.yaw,
            pitch: data.head.pitch,
            roll: data.head.roll
          } : null,
          position: data.head?.position,
          timestamp: data.timestamp,
          quality: data.quality.head
        },
        
        'synopticon/tobii5/presence': {
          detected: data.presence.detected,
          confidence: data.presence.confidence,
          timestamp: data.timestamp
        },
        
        'synopticon/tobii5/attention': {
          area: data.enhanced.attentionArea,
          velocity: data.enhanced.gazeVelocity,
          timestamp: data.timestamp
        },
        
        'synopticon/tobii5/cognitive': {
          quality: data.enhanced.overallQuality,
          headStability: data.enhanced.headStability,
          latency: data.metadata.latency,
          timestamp: data.timestamp
        }
      };

      // Distribute each topic
      for (const [topic, payload] of Object.entries(topicData)) {
        await distributionSystem.distribute('mqtt', {
          topic,
          payload: JSON.stringify(payload)
        });
      }

      state.stats.mqttPackets++;
      
    } catch (error) {
      logger.error('Failed to distribute via MQTT:', error);
    }
  };

  /**
   * Distribute via Server-Sent Events
   */
  const distributeSSE = async (data) => {
    try {
      const sseMessage = {
        event: 'tobii5-data',
        data: JSON.stringify({
          gaze: data.gaze,
          head: data.head,
          presence: data.presence,
          enhanced: data.enhanced,
          timestamp: data.timestamp
        })
      };

      await distributionSystem.distribute('sse', sseMessage);
      state.stats.ssePackets++;
      
    } catch (error) {
      logger.error('Failed to distribute via SSE:', error);
    }
  };

  /**
   * Calculate attention area from gaze position
   */
  const calculateAttentionArea = (gaze) => {
    if (!gaze || !gaze.valid) return null;

    // Simple screen region calculation
    const screenWidth = 1920; // Would be configurable
    const screenHeight = 1080;
    
    const normalizedX = gaze.x / screenWidth;
    const normalizedY = gaze.y / screenHeight;

    if (normalizedX >= 0.3 && normalizedX <= 0.7 && normalizedY >= 0.3 && normalizedY <= 0.7) {
      return 'center';
    } else if (normalizedX < 0.3) {
      return 'left';
    } else if (normalizedX > 0.7) {
      return 'right';
    } else if (normalizedY < 0.3) {
      return 'top';
    } else if (normalizedY > 0.7) {
      return 'bottom';
    }
    
    return 'peripheral';
  };

  /**
   * Calculate gaze velocity (simplified)
   */
  const calculateGazeVelocity = (data) => {
    // This would need previous data point for real calculation
    // Placeholder implementation
    return {
      magnitude: 0,
      direction: 0,
      unit: 'pixels_per_ms'
    };
  };

  /**
   * Calculate head stability metric
   */
  const calculateHeadStability = (headData) => {
    if (!headData || !headData.valid) return null;

    // Simple stability metric based on rotation magnitudes
    const rotationMagnitude = Math.sqrt(
      Math.pow(headData.yaw, 2) + 
      Math.pow(headData.pitch, 2) + 
      Math.pow(headData.roll, 2)
    );

    return {
      rotationMagnitude,
      stability: rotationMagnitude < 5 ? 'stable' : rotationMagnitude < 15 ? 'moderate' : 'unstable'
    };
  };

  /**
   * Create cognitive system distribution integration
   */
  const integrateCognitiveDistribution = (cognitiveSystem) => {
    if (!cognitiveSystem || !cognitiveSystem.stateManager) {
      logger.warn('Cognitive system not available for distribution integration');
      return;
    }

    // Subscribe to cognitive state changes related to Tobii data
    const cognitiveSubscription = cognitiveSystem.stateManager.on('stateChange', (event) => {
      if (event.path.startsWith('human.gaze') || event.path.startsWith('human.head')) {
        distributeCognitiveAnalysis(event);
      }
    });

    state.subscriptions.set('cognitiveState', cognitiveSubscription);
  };

  /**
   * Distribute cognitive analysis results
   */
  const distributeCognitiveAnalysis = async (analysisData) => {
    try {
      const cognitiveMessage = {
        type: COGNITIVE_MESSAGE_TYPES.STATE_UPDATE,
        timestamp: Date.now(),
        source: 'tobii5-cognitive-integration',
        data: {
          path: analysisData.path,
          value: analysisData.newValue,
          analysis: analysisData.metadata?.analysis,
          confidence: analysisData.metadata?.confidence || 0.8
        }
      };

      await distributionSystem.distribute('cognitive-tobii5', cognitiveMessage);
      
    } catch (error) {
      logger.error('Failed to distribute cognitive analysis:', error);
    }
  };

  /**
   * Get distribution statistics
   */
  const getDistributionStats = () => {
    return {
      ...state.stats,
      channels: Array.from(state.distributionChannels.keys()),
      active: state.active,
      uptime: state.active ? Date.now() - state.startTime : 0
    };
  };

  /**
   * Configure distribution channels
   */
  const configureChannels = (channelConfig) => {
    try {
      Object.entries(channelConfig).forEach(([channelId, config]) => {
        if (state.distributionChannels.has(channelId)) {
          const existingChannel = state.distributionChannels.get(channelId);
          state.distributionChannels.set(channelId, {
            ...existingChannel,
            ...config
          });
        }
      });
      
      logger.info('Distribution channels reconfigured');
      
    } catch (error) {
      logger.error('Failed to configure distribution channels:', error);
    }
  };

  // Set start time when created
  state.startTime = Date.now();

  // Public API
  return {
    start,
    stop,
    
    // Status
    isActive: () => state.active,
    getStats: getDistributionStats,
    getChannels: () => new Map(state.distributionChannels),
    
    // Configuration
    configureChannels,
    
    // Cognitive integration
    integrateCognitiveDistribution,
    
    // Manual distribution
    distributeData: distributeGazeData,
    
    // Cleanup
    cleanup: () => {
      stop();
      state.distributionChannels.clear();
      state.stats = {
        packetsDistributed: 0,
        udpPackets: 0,
        websocketPackets: 0,
        mqttPackets: 0,
        ssePackets: 0,
        errors: 0
      };
      logger.info('🧹 Tobii 5 distribution integration cleaned up');
    }
  };
};