/**
 * @fileoverview Simulator Connector for Cognitive System
 * 
 * Connects cognitive advisory system to real MSFS/BeamNG simulators,
 * providing bidirectional data flow and command execution capabilities.
 * Following functional programming patterns with factory functions.
 * 
 * @version 1.0.0
 * @author Synopticon Development Team
 */

import { createMSFSConnector } from '../telemetry/simulators/msfs-connector.js';
import { createBeamNGConnector } from '../telemetry/simulators/beamng-connector.js';
import { createLogger } from '../../shared/utils/logger.js';

/**
 * Logger configuration
 */
const logger = createLogger({ level: 2 });

/**
 * Position coordinates
 */
export interface Position {
  latitude?: number;
  longitude?: number;
  altitude?: number;
  x?: number;
  y?: number;
  z?: number;
}

/**
 * Vehicle dynamics data
 */
export interface VehicleDynamics {
  airspeed?: number;
  groundSpeed?: number;
  verticalSpeed?: number;
  speed?: number;
  heading?: number;
  pitch?: number;
  roll?: number;
  yaw?: number;
  steering?: number;
  throttle?: number;
  brake?: number;
  acceleration?: {
    x: number;
    y: number;
    z: number;
  };
  rotation?: {
    pitch: number;
    roll: number;
    yaw: number;
  };
}

/**
 * System status data
 */
export interface SystemStatus {
  engines?: string;
  engine?: string;
  fuel?: number;
  hydraulics?: number;
  electrical?: string;
  autopilot?: boolean;
  transmission?: number;
  damage?: number;
  temperature?: number;
}

/**
 * Environmental conditions
 */
export interface EnvironmentalConditions {
  weather?: any;
  visibility?: number;
  windSpeed?: number;
  windDirection?: number;
  road?: string;
  surface?: string;
  weatherCondition?: string;
  timeOfDay?: string;
}

/**
 * Flight telemetry data
 */
export interface FlightTelemetry {
  position: Position;
  dynamics: VehicleDynamics;
  systems: SystemStatus;
  environment: EnvironmentalConditions;
  timestamp: number;
}

/**
 * Vehicle telemetry data
 */
export interface VehicleTelemetry {
  position: Position;
  dynamics: VehicleDynamics;
  systems: SystemStatus;
  environment: EnvironmentalConditions;
  timestamp: number;
}

/**
 * Simulator command structure
 */
export interface SimulatorCommand {
  simulator: 'msfs' | 'beamng' | 'auto';
  action: string;
  parameters: Record<string, any>;
}

/**
 * Emergency event data
 */
export interface EmergencyEvent {
  type: string;
  source: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  data: any;
  timestamp: number;
}

/**
 * Emergency response data
 */
export interface EmergencyResponse {
  results?: {
    actions?: string[];
  };
}

/**
 * Connection status for individual simulator
 */
export interface SimulatorConnectionStatus {
  enabled: boolean;
  connected: boolean;
  status: string;
}

/**
 * Overall connection status
 */
export interface ConnectionStatus {
  isRunning: boolean;
  msfs: SimulatorConnectionStatus;
  beamng: SimulatorConnectionStatus;
  dataUpdateInterval: number;
  lastUpdate: number;
}

/**
 * Simulator connector configuration
 */
export interface SimulatorConnectorConfig {
  enableMSFS?: boolean;
  enableBeamNG?: boolean;
  dataUpdateInterval?: number;
  msfsConfig?: Record<string, any>;
  beamngConfig?: Record<string, any>;
}

/**
 * MSFS connector interface (simplified)
 */
interface MSFSConnector {
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  getTelemetry: () => Promise<any>;
  sendCommand: (action: string, parameters: Record<string, any>) => Promise<any>;
  pause: () => Promise<void>;
  subscribeToEvents: (eventType: string, callback: (event: any) => void) => void;
  isConnected: () => boolean;
  getConnectionStatus: () => string;
}

/**
 * BeamNG connector interface (simplified)
 */
interface BeamNGConnector {
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  getTelemetry: () => Promise<any>;
  sendCommand: (action: string, parameters: Record<string, any>) => Promise<any>;
  pause: () => Promise<void>;
  subscribeToEvents: (eventType: string, callback: (event: any) => void) => void;
  isConnected: () => boolean;
  getConnectionStatus: () => string;
}

/**
 * Cognitive system interface (simplified)
 */
interface CognitiveSystem {
  contextOrchestrator: {
    handleEmergency: (event: EmergencyEvent) => void;
    on: (event: string, callback: (response: EmergencyResponse) => void) => void;
  };
  fusionEngine: {
    ingestData: (source: string, type: string, data: any) => void;
  };
  stateManager: {
    updateState: (path: string, data: any) => void;
  };
  pipelineSystem: {
    process: (pipeline: string, data: any, mode: string) => Promise<void>;
  };
  communicationManager: {
    on: (event: string, callback: (command: SimulatorCommand) => void) => void;
  };
}

/**
 * Simulator connector interface
 */
export interface SimulatorConnector {
  initialize: () => Promise<void>;
  disconnect: () => Promise<void>;
  getConnectionStatus: () => ConnectionStatus;
  executeSimulatorCommand: (command: SimulatorCommand) => Promise<any>;
  collectAndProcessSimulatorData: () => Promise<void>;
  isRunning: () => boolean;
}

/**
 * Create simulator connector for cognitive system
 */
export const createSimulatorConnector = (
  cognitiveSystem: CognitiveSystem, 
  config: SimulatorConnectorConfig = {}
): SimulatorConnector => {
  const {
    enableMSFS = true,
    enableBeamNG = true,
    dataUpdateInterval = 100, // 10Hz data updates
    msfsConfig = {},
    beamngConfig = {}
  } = config;
  
  let msfsConnector: MSFSConnector | null = null;
  let beamngConnector: BeamNGConnector | null = null;
  let dataUpdateTimer: NodeJS.Timeout | null = null;
  let isRunning = false;
  
  /**
   * Initialize simulator connections
   */
  const initialize = async (): Promise<void> => {
    try {
      // Initialize MSFS connector
      if (enableMSFS) {
        msfsConnector = createMSFSConnector({
          useNativeProtocol: true,
          fallbackToMock: true,
          autoReconnect: true,
          ...msfsConfig
        }) as MSFSConnector;
        
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
        }) as BeamNGConnector;
        
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
  const setupDataFlow = (): void => {
    // Start periodic data collection
    dataUpdateTimer = setInterval(async () => {
      await collectAndProcessSimulatorData();
    }, dataUpdateInterval);
    
    // Set up event-based data collection for critical events
    if (msfsConnector && msfsConnector.subscribeToEvents) {
      msfsConnector.subscribeToEvents('emergency', (event: any) => {
        // Immediately forward emergency events to cognitive system
        cognitiveSystem.contextOrchestrator.handleEmergency({
          type: 'simulator-emergency',
          source: 'msfs',
          severity: 'critical',
          data: event,
          timestamp: Date.now()
        });
      });
      
      msfsConnector.subscribeToEvents('system-alert', (event: any) => {
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
      beamngConnector.subscribeToEvents('collision', (event: any) => {
        // Forward collision events
        cognitiveSystem.contextOrchestrator.handleEmergency({
          type: 'collision-detected',
          source: 'beamng',
          severity: 'high',
          data: event,
          timestamp: Date.now()
        });
      });
      
      beamngConnector.subscribeToEvents('vehicle-damage', (event: any) => {
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
  const collectAndProcessSimulatorData = async (): Promise<void> => {
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
  const processFlightTelemetry = async (data: any, timestamp: number): Promise<void> => {
    // Extract key flight parameters
    const flightData: FlightTelemetry = {
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
  const processVehicleTelemetry = async (data: any, timestamp: number): Promise<void> => {
    // Extract key vehicle parameters
    const vehicleData: VehicleTelemetry = {
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
    if (data.collisionRisk || (vehicleData.dynamics.speed && vehicleData.dynamics.speed > 100)) {
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
  const setupCommandFlow = (): void => {
    // Listen for cognitive system commands that should be sent to simulators
    cognitiveSystem.communicationManager.on('simulatorCommand', async (command: SimulatorCommand) => {
      try {
        await executeSimulatorCommand(command);
      } catch (error) {
        logger.error('Failed to execute simulator command:', error);
      }
    });
    
    // Listen for emergency responses that require simulator actions
    cognitiveSystem.contextOrchestrator.on('emergencyResponse', async (response: EmergencyResponse) => {
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
  const executeSimulatorCommand = async (command: SimulatorCommand): Promise<any> => {
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
  const executeEmergencyAction = async (action: string, response: EmergencyResponse): Promise<void> => {
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
  const getConnectionStatus = (): ConnectionStatus => {
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
  const disconnect = async (): Promise<void> => {
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

/**
 * Simulator connector utility functions
 */
export const SimulatorConnectorUtils = {
  /**
   * Validate simulator connector configuration
   */
  validateConfig: (config: SimulatorConnectorConfig): boolean => {
    if (config.dataUpdateInterval !== undefined && config.dataUpdateInterval < 10) {
      return false;
    }
    
    if (!config.enableMSFS && !config.enableBeamNG) {
      return false;
    }
    
    return true;
  },

  /**
   * Create default simulator configuration
   */
  createDefaultConfig: (overrides: Partial<SimulatorConnectorConfig> = {}): SimulatorConnectorConfig => ({
    enableMSFS: true,
    enableBeamNG: true,
    dataUpdateInterval: 100,
    msfsConfig: {},
    beamngConfig: {},
    ...overrides
  }),

  /**
   * Calculate telemetry data quality score
   */
  calculateDataQuality: (telemetry: FlightTelemetry | VehicleTelemetry): number => {
    let quality = 1.0;
    
    // Check for missing position data
    if (!telemetry.position || Object.values(telemetry.position).every(v => v === 0)) {
      quality *= 0.7;
    }
    
    // Check for missing dynamics data
    if (!telemetry.dynamics || Object.values(telemetry.dynamics).every(v => v === 0)) {
      quality *= 0.8;
    }
    
    // Check timestamp freshness (within last 5 seconds)
    const age = Date.now() - telemetry.timestamp;
    if (age > 5000) {
      quality *= Math.max(0.1, 1 - (age / 30000));
    }
    
    return Math.max(0, Math.min(1, quality));
  },

  /**
   * Detect potential emergency conditions from telemetry
   */
  detectEmergencyConditions: (telemetry: FlightTelemetry | VehicleTelemetry): {
    hasEmergency: boolean;
    conditions: string[];
    severity: 'low' | 'medium' | 'high' | 'critical';
  } => {
    const conditions: string[] = [];
    let maxSeverity: 'low' | 'medium' | 'high' | 'critical' = 'low';
    
    // Check for extreme dynamics
    if ('airspeed' in telemetry.dynamics && telemetry.dynamics.airspeed) {
      if (telemetry.dynamics.airspeed > 500) {
        conditions.push('Excessive airspeed');
        maxSeverity = 'high';
      }
    }
    
    if ('speed' in telemetry.dynamics && telemetry.dynamics.speed) {
      if (telemetry.dynamics.speed > 200) {
        conditions.push('Excessive ground speed');
        maxSeverity = 'high';
      }
    }
    
    // Check for extreme attitudes
    if (telemetry.dynamics.pitch && Math.abs(telemetry.dynamics.pitch) > 60) {
      conditions.push('Extreme pitch attitude');
      maxSeverity = 'critical';
    }
    
    if (telemetry.dynamics.roll && Math.abs(telemetry.dynamics.roll) > 90) {
      conditions.push('Extreme roll attitude');
      maxSeverity = 'critical';
    }
    
    // Check system health
    if (telemetry.systems.fuel !== undefined && telemetry.systems.fuel < 0.1) {
      conditions.push('Low fuel');
      maxSeverity = maxSeverity === 'critical' ? 'critical' : 'medium';
    }
    
    return {
      hasEmergency: conditions.length > 0,
      conditions,
      severity: maxSeverity
    };
  }
};
