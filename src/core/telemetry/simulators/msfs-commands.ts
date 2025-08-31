/**
 * MSFS SimConnect Command Implementation
 * Real SimConnect event transmission for aircraft control
 */

import type { 
  SimulatorCommand, 
  CommandResult, 
  CommandCapabilities, 
  SimulatorEvent 
} from '../commands/command-system';
import { 
  FLIGHT_COMMANDS, 
  createCommandResultEvent,
  createEventEmitter,
  validateCommand 
} from '../commands/command-system';
import {
  createMessageSerializer,
  SIMCONNECT_MESSAGE_ID,
  SIMCONNECT_PROTOCOL
} from './simconnect-protocol';

// MSFS-specific event mappings
export const MSFS_EVENTS = {
  // Engine controls
  THROTTLE_SET: 'THROTTLE_SET',
  THROTTLE1_SET: 'THROTTLE1_SET',
  THROTTLE2_SET: 'THROTTLE2_SET',
  ENGINE_AUTO_START: 'ENGINE_AUTO_START',
  ENGINE_AUTO_SHUTDOWN: 'ENGINE_AUTO_SHUTDOWN',
  TOGGLE_STARTER1: 'TOGGLE_STARTER1',
  TOGGLE_STARTER2: 'TOGGLE_STARTER2',
  
  // Flight controls
  ELEVATOR_SET: 'ELEVATOR_SET',
  AILERON_SET: 'AILERON_SET',
  RUDDER_SET: 'RUDDER_SET',
  ELEV_TRIM_UP: 'ELEV_TRIM_UP',
  ELEV_TRIM_DN: 'ELEV_TRIM_DN',
  
  // Landing gear and flaps
  GEAR_TOGGLE: 'GEAR_TOGGLE',
  GEAR_UP: 'GEAR_UP',
  GEAR_DOWN: 'GEAR_DOWN',
  FLAPS_SET: 'FLAPS_SET',
  FLAPS_UP: 'FLAPS_UP',
  FLAPS_DOWN: 'FLAPS_DOWN',
  
  // Lights
  LANDING_LIGHTS_TOGGLE: 'LANDING_LIGHTS_TOGGLE',
  NAV_LIGHTS_TOGGLE: 'NAV_LIGHTS_TOGGLE',
  STROBES_TOGGLE: 'STROBES_TOGGLE',
  BEACON_LIGHTS_TOGGLE: 'BEACON_LIGHTS_TOGGLE',
  
  // Autopilot
  AP_MASTER: 'AP_MASTER',
  AP_HDG_HOLD: 'AP_HDG_HOLD',
  AP_ALT_HOLD: 'AP_ALT_HOLD',
  AP_AIRSPEED_HOLD: 'AP_AIRSPEED_HOLD',
  AP_HDG_SET: 'HEADING_BUG_SET',
  AP_ALT_SET: 'AP_ALT_VAR_SET_ENGLISH',
  AP_AIRSPEED_SET: 'AP_SPD_VAR_SET',
  
  // Navigation
  COM_RADIO_SET: 'COM_RADIO_SET',
  NAV_RADIO_SET: 'NAV_RADIO_SET',
  XPNDR_SET: 'XPNDR_SET',
  
  // Simulation
  PAUSE_TOGGLE: 'PAUSE_TOGGLE',
  SIM_RATE_INCR: 'SIM_RATE_INCR',
  SIM_RATE_DECR: 'SIM_RATE_DECR',
} as const;

// Command to MSFS event mapping
const COMMAND_TO_EVENT_MAP: Record<string, { event: string; paramType?: 'value' | 'boolean' | 'index' }> = {
  [FLIGHT_COMMANDS.SET_THROTTLE]: { event: MSFS_EVENTS.THROTTLE_SET, paramType: 'value' },
  [FLIGHT_COMMANDS.SET_ELEVATOR]: { event: MSFS_EVENTS.ELEVATOR_SET, paramType: 'value' },
  [FLIGHT_COMMANDS.SET_AILERON]: { event: MSFS_EVENTS.AILERON_SET, paramType: 'value' },
  [FLIGHT_COMMANDS.SET_RUDDER]: { event: MSFS_EVENTS.RUDDER_SET, paramType: 'value' },
  
  [FLIGHT_COMMANDS.START_ENGINE]: { event: MSFS_EVENTS.ENGINE_AUTO_START },
  [FLIGHT_COMMANDS.STOP_ENGINE]: { event: MSFS_EVENTS.ENGINE_AUTO_SHUTDOWN },
  
  [FLIGHT_COMMANDS.TOGGLE_GEAR]: { event: MSFS_EVENTS.GEAR_TOGGLE },
  [FLIGHT_COMMANDS.SET_FLAPS]: { event: MSFS_EVENTS.FLAPS_SET, paramType: 'value' },
  
  [FLIGHT_COMMANDS.TOGGLE_LIGHTS]: { event: MSFS_EVENTS.LANDING_LIGHTS_TOGGLE }, // Default to landing lights
  
  [FLIGHT_COMMANDS.AP_MASTER]: { event: MSFS_EVENTS.AP_MASTER, paramType: 'boolean' },
  [FLIGHT_COMMANDS.AP_HEADING]: { event: MSFS_EVENTS.AP_HDG_SET, paramType: 'value' },
  [FLIGHT_COMMANDS.AP_ALTITUDE]: { event: MSFS_EVENTS.AP_ALT_SET, paramType: 'value' },
  [FLIGHT_COMMANDS.AP_SPEED]: { event: MSFS_EVENTS.AP_AIRSPEED_SET, paramType: 'value' },
};

// Light type mapping for TOGGLE_LIGHTS command
const LIGHT_TYPE_MAP: Record<string, string> = {
  landing: MSFS_EVENTS.LANDING_LIGHTS_TOGGLE,
  nav: MSFS_EVENTS.NAV_LIGHTS_TOGGLE,
  strobe: MSFS_EVENTS.STROBES_TOGGLE,
  beacon: MSFS_EVENTS.BEACON_LIGHTS_TOGGLE,
};

// MSFS command processor factory
export const createMSFSCommandProcessor = (
  sendMessage: (message: Uint8Array) => Promise<boolean>
) => {
  const eventEmitter = createEventEmitter();
  const serializer = createMessageSerializer();
  let eventIdCounter = 1000;
  const pendingCommands = new Map<string, SimulatorCommand>();
  
  // Map client events to SimConnect events
  const mapClientEventToSimEvent = async (eventName: string, eventId: number): Promise<boolean> => {
    const eventNameBuffer = serializer.serializeString(eventName, 256);
    const eventIdBuffer = serializer.serializeUint32(eventId);
    
    const messageBody = serializer.combineBuffers([eventIdBuffer, eventNameBuffer]);
    const header = serializer.createHeader(
      SIMCONNECT_MESSAGE_ID.MAP_CLIENT_EVENT_TO_SIM_EVENT,
      16 + messageBody.length
    );
    
    const message = serializer.combineBuffers([header, messageBody]);
    return await sendMessage(message);
  };
  
  // Transmit client event
  const transmitClientEvent = async (
    eventId: number, 
    data?: number, 
    groupId = 0, 
    flags = 0
  ): Promise<boolean> => {
    const eventIdBuffer = serializer.serializeUint32(eventId);
    const dataBuffer = serializer.serializeUint32(data || 0);
    const groupIdBuffer = serializer.serializeUint32(groupId);
    const flagsBuffer = serializer.serializeUint32(flags);
    
    const messageBody = serializer.combineBuffers([
      eventIdBuffer,
      dataBuffer,
      groupIdBuffer,
      flagsBuffer
    ]);
    
    const header = serializer.createHeader(
      SIMCONNECT_MESSAGE_ID.TRANSMIT_CLIENT_EVENT,
      16 + messageBody.length
    );
    
    const message = serializer.combineBuffers([header, messageBody]);
    return await sendMessage(message);
  };
  
  // Convert parameter value based on type
  const convertParameterValue = (value: unknown, paramType?: string): number => {
    if (typeof value !== 'number') return 0;
    
    switch (paramType) {
      case 'value':
        // Many MSFS events expect values scaled to 16384 (0-1 becomes 0-16384)
        return Math.round(value * 16384);
      case 'boolean':
        return value ? 1 : 0;
      case 'index':
        return Math.round(value);
      default:
        return Math.round(value);
    }
  };
  
  // Process individual command
  const processCommand = async (command: SimulatorCommand): Promise<CommandResult> => {
    const startTime = Date.now();
    
    try {
      // Validate command
      const validation = validateCommand(command);
      if (!validation.valid) {
        return {
          commandId: command.id,
          success: false,
          executedAt: startTime,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Command validation failed',
            details: validation.errors
          }
        };
      }
      
      // Get MSFS event mapping
      let eventMapping = COMMAND_TO_EVENT_MAP[command.action];
      let msfsEvent = eventMapping?.event;
      
      // Handle special cases
      if (command.action === FLIGHT_COMMANDS.TOGGLE_LIGHTS) {
        const lightType = command.parameters?.type as string || 'landing';
        msfsEvent = LIGHT_TYPE_MAP[lightType] || MSFS_EVENTS.LANDING_LIGHTS_TOGGLE;
        eventMapping = { event: msfsEvent };
      }
      
      if (!msfsEvent) {
        return {
          commandId: command.id,
          success: false,
          executedAt: startTime,
          error: {
            code: 'UNSUPPORTED_COMMAND',
            message: `Command action '${command.action}' not supported in MSFS`,
          }
        };
      }
      
      // Generate unique event ID
      const eventId = eventIdCounter++;
      
      // Map client event to SimConnect event
      const mapped = await mapClientEventToSimEvent(msfsEvent, eventId);
      if (!mapped) {
        return {
          commandId: command.id,
          success: false,
          executedAt: startTime,
          error: {
            code: 'EVENT_MAPPING_FAILED',
            message: 'Failed to map event to SimConnect',
          }
        };
      }
      
      // Prepare parameter data
      let parameterValue: number | undefined;
      if (eventMapping.paramType && command.parameters) {
        const rawValue = command.parameters.value ?? command.parameters.enabled;
        parameterValue = convertParameterValue(rawValue, eventMapping.paramType);
      }
      
      // Store pending command for response tracking
      pendingCommands.set(command.id, command);
      
      // Transmit the event
      const transmitted = await transmitClientEvent(eventId, parameterValue);
      
      if (transmitted) {
        const result: CommandResult = {
          commandId: command.id,
          success: true,
          executedAt: startTime,
          duration: Date.now() - startTime,
          response: {
            eventId,
            eventName: msfsEvent,
            parameterValue
          }
        };
        
        // Emit success event
        const event = createCommandResultEvent(result, 'msfs-connector');
        eventEmitter.emit(event);
        
        return result;
      } else {
        return {
          commandId: command.id,
          success: false,
          executedAt: startTime,
          duration: Date.now() - startTime,
          error: {
            code: 'TRANSMISSION_FAILED',
            message: 'Failed to transmit event to simulator',
          }
        };
      }
      
    } catch (error) {
      return {
        commandId: command.id,
        success: false,
        executedAt: startTime,
        duration: Date.now() - startTime,
        error: {
          code: 'PROCESSING_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
          details: error
        }
      };
    } finally {
      pendingCommands.delete(command.id);
    }
  };
  
  // Get MSFS capabilities
  const getCapabilities = (): CommandCapabilities => ({
    supportedTypes: ['flight-control', 'system-control', 'navigation', 'simulation'],
    supportedActions: {
      'flight-control': [
        FLIGHT_COMMANDS.SET_THROTTLE,
        FLIGHT_COMMANDS.SET_ELEVATOR,
        FLIGHT_COMMANDS.SET_AILERON,
        FLIGHT_COMMANDS.SET_RUDDER,
        FLIGHT_COMMANDS.START_ENGINE,
        FLIGHT_COMMANDS.STOP_ENGINE,
        FLIGHT_COMMANDS.TOGGLE_GEAR,
        FLIGHT_COMMANDS.SET_FLAPS,
      ],
      'system-control': [
        FLIGHT_COMMANDS.TOGGLE_LIGHTS,
      ],
      'navigation': [
        FLIGHT_COMMANDS.AP_MASTER,
        FLIGHT_COMMANDS.AP_HEADING,
        FLIGHT_COMMANDS.AP_ALTITUDE,
        FLIGHT_COMMANDS.AP_SPEED,
      ],
      'simulation': [
        'pause-toggle',
        'sim-rate-increase',
        'sim-rate-decrease',
      ],
      'vehicle-control': [], // Not applicable for aircraft
      'environment': [], // Not implemented
      'custom': [], // Not implemented
    },
    maxConcurrentCommands: 10,
    supportsQueuing: true,
    supportsUndo: false,
  });
  
  // Subscribe to command events
  const subscribeToEvents = (callback: (event: SimulatorEvent) => void): (() => void) => {
    return eventEmitter.on('*', callback);
  };
  
  return {
    processCommand,
    getCapabilities,
    subscribeToEvents,
  };
};