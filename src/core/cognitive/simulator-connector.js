/**
 * Simulator Connector for Cognitive System
 * Connects cognitive advisory system to real MSFS/BeamNG simulators
 */

import { createMSFSConnector } from '../telemetry/simulators/msfs-connector.js';
import { createBeamNGConnector } from '../telemetry/simulators/beamng-connector.js';
import { createLogger } from '../../shared/utils/logger.js';

const logger = createLogger({ level: 2 });

/**
 * Create simulator connector for cognitive system
 */
export const createSimulatorConnector = (cognitiveSystem, config = {}) => {
  const {
    enableMSFS = true,
    enableBeamNG = true,
    dataUpdateInterval = 100, // 10Hz data updates
    msfsConfig = {},
    beamngConfig = {}
  } = config;
  
  let msfsConnector = null;
  let beamngConnector = null;
  let dataUpdateTimer = null;
  let isRunning = false;
  
  /**
   * Initialize simulator connections
   */
  const initialize = async () => {
    try {
      // Initialize MSFS connector
      if (enableMSFS) {
        msfsConnector = createMSFSConnector({
          useNativeProtocol: true,
          fallbackToMock: true,
          autoReconnect: true,
          ...msfsConfig
        });
        
        await msfsConnector.connect();
        logger.info('✅ MSFS connector initialized for cognitive system');
      }
      
      // Initialize BeamNG connector
      if (enableBeamNG) {
        beamngConnector = createBeamNGConnector({
          useRealProtocol: true,
          fallbackToMock: true,
          autoReconnect: true,
          ...beamngConfig
        });
        
        await beamngConnector.connect();
        logger.info('✅ BeamNG connector initialized for cognitive system');
      }
      
      // Set up data flow from simulators to cognitive system
      setupDataFlow();
      
      // Set up command flow from cognitive system to simulators
      setupCommandFlow();
      
      isRunning = true;
      logger.info('✅ Simulator connector fully initialized');
      
    } catch (error) {
      logger.error('Failed to initialize simulator connector:', error);
      throw error;
    }
  };
  
  /**
   * Set up data flow from simulators to cognitive system
   */
  const setupDataFlow = () => {
    // Start periodic data collection
    dataUpdateTimer = setInterval(async () => {
      await collectAndProcessSimulatorData();
    }, dataUpdateInterval);
    
    // Set up event-based data collection for critical events
    if (msfsConnector && msfsConnector.subscribeToEvents) {
      msfsConnector.subscribeToEvents('emergency', (event) => {
        // Immediately forward emergency events to cognitive system
        cognitiveSystem.contextOrchestrator.handleEmergency({
          type: 'simulator-emergency',
          source: 'msfs',
          severity: 'critical',
          data: event,
          timestamp: Date.now()
        });
      });
      
      msfsConnector.subscribeToEvents('system-alert', (event) => {
        // Forward system alerts
        cognitiveSystem.fusionEngine.ingestData('simulator', 'alert', {
          source: 'msfs',
          type: 'system-alert',
          alert: event,
          timestamp: Date.now()
        });
      });
    }
    
    if (beamngConnector && beamngConnector.subscribeToEvents) {
      beamngConnector.subscribeToEvents('collision', (event) => {
        // Forward collision events
        cognitiveSystem.contextOrchestrator.handleEmergency({
          type: 'collision-detected',
          source: 'beamng',
          severity: 'high',
          data: event,
          timestamp: Date.now()
        });
      });
      
      beamngConnector.subscribeToEvents('vehicle-damage', (event) => {
        // Forward vehicle damage events
        cognitiveSystem.fusionEngine.ingestData('simulator', 'vehicle-status', {
          source: 'beamng',
          type: 'damage-report',
          damage: event,
          timestamp: Date.now()
        });
      });
    }
  };
  
  /**
   * Collect and process simulator data
   */
  const collectAndProcessSimulatorData = async () => {
    try {
      const timestamp = Date.now();
      
      // Collect MSFS data
      if (msfsConnector && msfsConnector.getTelemetry) {
        const msfsData = await msfsConnector.getTelemetry();
        
        if (msfsData) {
          // Process flight telemetry
          await processFlightTelemetry(msfsData, timestamp);
        }
      }
      
      // Collect BeamNG data
      if (beamngConnector && beamngConnector.getTelemetry) {
        const beamngData = await beamngConnector.getTelemetry();
        
        if (beamngData) {
          // Process vehicle telemetry
          await processVehicleTelemetry(beamngData, timestamp);
        }
      }
      
    } catch (error) {
      logger.warn('Error collecting simulator data:', error);
    }
  };
  
  /**
   * Process flight telemetry data
   */
  const processFlightTelemetry = async (data, timestamp) => {
    // Extract key flight parameters
    const flightData = {
      position: {
        latitude: data.latitude || 0,
        longitude: data.longitude || 0,
        altitude: data.altitude || 0
      },
      dynamics: {
        airspeed: data.airspeed || 0,
        groundSpeed: data.groundSpeed || 0,
        verticalSpeed: data.verticalSpeed || 0,
        heading: data.heading || 0,
        pitch: data.pitch || 0,
        roll: data.roll || 0,
        yaw: data.yaw || 0
      },
      systems: {
        engines: data.engineStatus || 'unknown',
        fuel: data.fuelLevel || 0,
        hydraulics: data.hydraulicPressure || 0,
        electrical: data.electricalSystem || 'unknown',
        autopilot: data.autopilotActive || false
      },
      environment: {
        weather: data.weather || {},
        visibility: data.visibility || 10000,
        windSpeed: data.windSpeed || 0,
        windDirection: data.windDirection || 0
      },
      timestamp
    };
    
    // Ingest into cognitive system
    cognitiveSystem.fusionEngine.ingestData('simulator', 'telemetry', {
      source: 'msfs',
      type: 'flight-telemetry',
      ...flightData
    });
    
    // Update system state
    cognitiveSystem.stateManager.updateState('system.vehicle', flightData);
    cognitiveSystem.stateManager.updateState('environment.weather', flightData.environment);
    
    // Process through tactical pipeline for immediate analysis
    if (data.emergencyCondition || data.systemAlert) {
      await cognitiveSystem.pipelineSystem.process(
        'collision-detection',
        {
          position: flightData.position,
          velocity: { 
            x: data.velocityX || 0, 
            y: data.velocityY || 0, 
            z: data.velocityZ || 0 
          },
          obstacles: data.nearbyTraffic || []
        },
        'tactical'
      );
    }
  };
  
  /**
   * Process vehicle telemetry data
   */
  const processVehicleTelemetry = async (data, timestamp) => {
    // Extract key vehicle parameters
    const vehicleData = {
      position: {
        x: data.positionX || 0,
        y: data.positionY || 0,
        z: data.positionZ || 0
      },
      dynamics: {
        speed: data.speed || 0,
        acceleration: {
          x: data.accelX || 0,
          y: data.accelY || 0,
          z: data.accelZ || 0
        },
        rotation: {
          pitch: data.pitch || 0,
          roll: data.roll || 0,
          yaw: data.yaw || 0
        },
        steering: data.steeringAngle || 0,
        throttle: data.throttle || 0,
        brake: data.brake || 0
      },
      systems: {
        engine: data.engineStatus || 'unknown',
        transmission: data.gearPosition || 0,
        fuel: data.fuelLevel || 0,
        damage: data.damageLevel || 0,
        temperature: data.engineTemp || 0
      },
      environment: {
        road: data.roadType || 'unknown',
        surface: data.surfaceType || 'unknown',
        weather: data.weatherCondition || 'clear',
        timeOfDay: data.timeOfDay || 'day'
      },
      timestamp
    };
    
    // Ingest into cognitive system
    cognitiveSystem.fusionEngine.ingestData('simulator', 'telemetry', {
      source: 'beamng',
      type: 'vehicle-telemetry',
      ...vehicleData
    });
    
    // Update system state
    cognitiveSystem.stateManager.updateState('system.vehicle', vehicleData);
    cognitiveSystem.stateManager.updateState('environment', vehicleData.environment);
    
    // Process through tactical pipeline if high risk conditions
    if (data.collisionRisk || vehicleData.dynamics.speed > 100) {
      await cognitiveSystem.pipelineSystem.process(
        'collision-detection',
        {
          position: vehicleData.position,
          velocity: vehicleData.dynamics.acceleration,
          obstacles: data.nearbyVehicles || []
        },
        'tactical'
      );
    }
  };
  
  /**
   * Set up command flow from cognitive system to simulators
   */
  const setupCommandFlow = () => {
    // Listen for cognitive system commands that should be sent to simulators
    cognitiveSystem.communicationManager.on('simulatorCommand', async (command) => {
      try {
        await executeSimulatorCommand(command);
      } catch (error) {
        logger.error('Failed to execute simulator command:', error);
      }
    });
    
    // Listen for emergency responses that require simulator actions
    cognitiveSystem.contextOrchestrator.on('emergencyResponse', async (response) => {
      if (response.results && response.results.actions) {
        for (const action of response.results.actions) {
          if (action.startsWith('simulator-')) {
            await executeEmergencyAction(action, response);
          }
        }
      }
    });
  };
  
  /**
   * Execute command on appropriate simulator
   */
  const executeSimulatorCommand = async (command) => {
    const { simulator, action, parameters } = command;
    
    if (simulator === 'msfs' && msfsConnector && msfsConnector.sendCommand) {
      return await msfsConnector.sendCommand(action, parameters);
    } else if (simulator === 'beamng' && beamngConnector && beamngConnector.sendCommand) {
      return await beamngConnector.sendCommand(action, parameters);
    } else if (simulator === 'auto') {
      // Send to whichever simulator is connected and appropriate
      if (msfsConnector && msfsConnector.sendCommand) {
        return await msfsConnector.sendCommand(action, parameters);
      } else if (beamngConnector && beamngConnector.sendCommand) {
        return await beamngConnector.sendCommand(action, parameters);
      }
    }
    
    throw new Error(`Cannot execute command: simulator ${simulator} not available`);
  };
  
  /**
   * Execute emergency actions on simulators
   */
  const executeEmergencyAction = async (action, response) => {
    switch (action) {
      case 'simulator-pause':
        if (msfsConnector && msfsConnector.pause) {
          await msfsConnector.pause();
        }
        if (beamngConnector && beamngConnector.pause) {
          await beamngConnector.pause();
        }
        break;
        
      case 'simulator-autopilot-engage':
        if (msfsConnector && msfsConnector.sendCommand) {
          await msfsConnector.sendCommand('engage-autopilot', { level: 'full' });
        }
        break;
        
      case 'simulator-emergency-brake':
        if (beamngConnector && beamngConnector.sendCommand) {
          await beamngConnector.sendCommand('emergency-brake', { force: 1.0 });
        }
        break;
    }
  };
  
  /**
   * Get connection status
   */
  const getConnectionStatus = () => {
    return {
      isRunning,
      msfs: {
        enabled: enableMSFS,
        connected: msfsConnector ? msfsConnector.isConnected() : false,
        status: msfsConnector ? msfsConnector.getConnectionStatus() : 'disabled'
      },
      beamng: {
        enabled: enableBeamNG,
        connected: beamngConnector ? beamngConnector.isConnected() : false,
        status: beamngConnector ? beamngConnector.getConnectionStatus() : 'disabled'
      },
      dataUpdateInterval,
      lastUpdate: Date.now()
    };
  };
  
  /**
   * Cleanup and disconnect
   */
  const disconnect = async () => {
    isRunning = false;
    
    if (dataUpdateTimer) {
      clearInterval(dataUpdateTimer);
      dataUpdateTimer = null;
    }
    
    if (msfsConnector) {
      await msfsConnector.disconnect();
      msfsConnector = null;
    }
    
    if (beamngConnector) {
      await beamngConnector.disconnect();
      beamngConnector = null;
    }
    
    logger.info('🔌 Simulator connector disconnected');
  };
  
  return {
    initialize,
    disconnect,
    getConnectionStatus,
    executeSimulatorCommand,
    collectAndProcessSimulatorData,
    isRunning: () => isRunning
  };
};