/**
 * BeamNG.drive Real Protocol Implementation
 * TCP/UDP communication with BeamNG.drive via research/telemetry API
 */

import { connect as netConnect, type Socket } from 'net';
import type { SimulatorCommand, CommandResult, SimulatorEvent } from '../commands/command-system';
import { VEHICLE_COMMANDS, createCommandResultEvent, createEventEmitter } from '../commands/command-system';

export interface BeamNGConnectionConfig {
  host: string;
  port: number;
  protocol: 'tcp' | 'udp';
  timeout: number;
  reconnectDelay: number;
  heartbeatInterval: number;
}

export interface BeamNGVehicleData {
  id: string;
  position: [number, number, number];
  velocity: [number, number, number];
  acceleration: [number, number, number];
  rotation: [number, number, number, number];
  wheelSpeed: number[];
  engineRpm: number;
  throttleInput: number;
  brakeInput: number;
  steeringInput: number;
  clutchInput: number;
  gear: number;
  fuel: number;
  damage: number;
  engineTemp: number;
  wheelTemp: number[];
  tirePressure: number[];
}

// BeamNG message types
export const BEAMNG_MESSAGE_TYPES = {
  HELLO: 'Hello',
  DATA_REQUEST: 'DataRequest',
  DATA_RESPONSE: 'DataResponse',
  CONTROL_INPUT: 'ControlInput',
  VEHICLE_RESET: 'VehicleReset',
  SCENARIO_LOAD: 'ScenarioLoad',
  LUA_EXECUTE: 'LuaExecute',
  ERROR: 'Error',
} as const;

// BeamNG control message structure
export interface BeamNGControlMessage {
  type: string;
  vehicle: string;
  data: {
    throttle?: number;      // 0-1
    brake?: number;         // 0-1
    steering?: number;      // -1 to 1
    clutch?: number;        // 0-1
    gear?: number;          // -1 (reverse), 0 (neutral), 1+ (forward)
    parkingbrake?: boolean;
    [key: string]: unknown;
  };
}

// BeamNG protocol client
export const createBeamNGProtocolClient = (config: BeamNGConnectionConfig) => {
  let socket: Socket | null = null;
  let isConnected = false;
  let reconnectTimer: Timer | null = null;
  let heartbeatTimer: Timer | null = null;
  let messageBuffer = '';
  
  const eventEmitter = createEventEmitter();
  let dataCallback: ((data: BeamNGVehicleData) => void) | null = null;
  
  const connect = async (): Promise<boolean> => {
    return new Promise((resolve) => {
      try {
        socket = netConnect({
          host: config.host,
          port: config.port,
          timeout: config.timeout,
        });
        
        socket.on('connect', () => {
          console.log(`Connected to BeamNG on ${config.host}:${config.port}`);
          isConnected = true;
          
          // Send hello message
          sendMessage({
            type: BEAMNG_MESSAGE_TYPES.HELLO,
            data: { version: '1.0' }
          });
          
          startHeartbeat();
          resolve(true);
        });
        
        socket.on('data', handleIncomingData);
        
        socket.on('error', (error) => {
          console.error('BeamNG connection error:', error);
          isConnected = false;
          resolve(false);
        });
        
        socket.on('close', () => {
          console.log('BeamNG connection closed');
          isConnected = false;
          scheduleReconnect();
        });
        
      } catch (error) {
        console.error('BeamNG connection failed:', error);
        resolve(false);
      }
    });
  };
  
  const disconnect = async (): Promise<void> => {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
    
    if (socket) {
      socket.destroy();
      socket = null;
    }
    
    isConnected = false;
  };
  
  const handleIncomingData = (data: Buffer) => {
    messageBuffer += data.toString();
    
    // Process complete messages (assuming JSON lines protocol)
    const lines = messageBuffer.split('\n');
    messageBuffer = lines.pop() || ''; // Keep incomplete line in buffer
    
    for (const line of lines) {
      if (line.trim()) {
        try {
          const message = JSON.parse(line);
          processMessage(message);
        } catch (error) {
          console.error('Failed to parse BeamNG message:', error);
        }
      }
    }
  };
  
  const processMessage = (message: any) => {
    switch (message.type) {
      case BEAMNG_MESSAGE_TYPES.DATA_RESPONSE:
        if (message.data && dataCallback) {
          const vehicleData = convertToVehicleData(message.data);
          dataCallback(vehicleData);
        }
        break;
        
      case BEAMNG_MESSAGE_TYPES.ERROR:
        console.error('BeamNG error:', message.data);
        eventEmitter.emit({
          id: `error_${Date.now()}`,
          type: 'error',
          timestamp: Date.now(),
          source: 'beamng-protocol',
          data: message.data,
          severity: 'error'
        });
        break;
        
      default:
        console.log('Unhandled BeamNG message:', message.type);
    }
  };
  
  const convertToVehicleData = (data: any): BeamNGVehicleData => ({
    id: data.vehicleId || 'vehicle0',
    position: data.position || [0, 0, 0],
    velocity: data.velocity || [0, 0, 0],
    acceleration: data.acceleration || [0, 0, 0],
    rotation: data.rotation || [0, 0, 0, 1],
    wheelSpeed: data.wheelSpeed || [0, 0, 0, 0],
    engineRpm: data.engineRpm || 0,
    throttleInput: data.throttleInput || 0,
    brakeInput: data.brakeInput || 0,
    steeringInput: data.steeringInput || 0,
    clutchInput: data.clutchInput || 0,
    gear: data.gear || 0,
    fuel: data.fuel || 1,
    damage: data.damage || 0,
    engineTemp: data.engineTemp || 90,
    wheelTemp: data.wheelTemp || [25, 25, 25, 25],
    tirePressure: data.tirePressure || [2.2, 2.2, 2.2, 2.2],
  });
  
  const sendMessage = (message: any): boolean => {
    if (!socket || !isConnected) return false;
    
    try {
      const jsonMessage = JSON.stringify(message) + '\n';
      socket.write(jsonMessage);
      return true;
    } catch (error) {
      console.error('Failed to send BeamNG message:', error);
      return false;
    }
  };
  
  const startHeartbeat = () => {
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    
    heartbeatTimer = setInterval(() => {
      if (isConnected) {
        // Request vehicle data as heartbeat
        sendMessage({
          type: BEAMNG_MESSAGE_TYPES.DATA_REQUEST,
          data: { vehicle: 'current' }
        });
      }
    }, config.heartbeatInterval);
  };
  
  const scheduleReconnect = () => {
    if (reconnectTimer) return;
    
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      if (!isConnected) {
        console.log('Attempting to reconnect to BeamNG...');
        connect();
      }
    }, config.reconnectDelay);
  };
  
  const sendControlInput = async (command: SimulatorCommand): Promise<CommandResult> => {
    const startTime = Date.now();
    
    if (!isConnected) {
      return {
        commandId: command.id,
        success: false,
        executedAt: startTime,
        error: {
          code: 'NOT_CONNECTED',
          message: 'Not connected to BeamNG'
        }
      };
    }
    
    try {
      const controlMessage = convertCommandToControl(command);
      const sent = sendMessage(controlMessage);
      
      if (sent) {
        return {
          commandId: command.id,
          success: true,
          executedAt: startTime,
          duration: Date.now() - startTime,
          response: controlMessage
        };
      } else {
        return {
          commandId: command.id,
          success: false,
          executedAt: startTime,
          error: {
            code: 'SEND_FAILED',
            message: 'Failed to send control message'
          }
        };
      }
    } catch (error) {
      return {
        commandId: command.id,
        success: false,
        executedAt: startTime,
        error: {
          code: 'CONVERSION_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  };
  
  const convertCommandToControl = (command: SimulatorCommand): BeamNGControlMessage => {
    const controlData: BeamNGControlMessage['data'] = {};
    
    switch (command.action) {
      case VEHICLE_COMMANDS.SET_STEERING:
        controlData.steering = command.parameters?.angle as number;
        break;
      case VEHICLE_COMMANDS.SET_THROTTLE:
        controlData.throttle = command.parameters?.value as number;
        break;
      case VEHICLE_COMMANDS.SET_BRAKE:
        controlData.brake = command.parameters?.value as number;
        break;
      case VEHICLE_COMMANDS.SET_HANDBRAKE:
        controlData.parkingbrake = command.parameters?.engaged as boolean;
        break;
      case VEHICLE_COMMANDS.SET_GEAR:
        controlData.gear = command.parameters?.gear as number;
        break;
      case VEHICLE_COMMANDS.TOGGLE_ENGINE:
        // BeamNG doesn't have direct engine toggle - send via Lua
        return {
          type: BEAMNG_MESSAGE_TYPES.LUA_EXECUTE,
          vehicle: 'current',
          data: {
            script: 'controller.getController("engine").setIgnitionLevel(controller.getController("engine").ignitionLevel == 0 and 3 or 0)'
          }
        };
      case VEHICLE_COMMANDS.RESET_VEHICLE:
        return {
          type: BEAMNG_MESSAGE_TYPES.VEHICLE_RESET,
          vehicle: 'current',
          data: {}
        };
      default:
        throw new Error(`Unsupported BeamNG command: ${command.action}`);
    }
    
    return {
      type: BEAMNG_MESSAGE_TYPES.CONTROL_INPUT,
      vehicle: 'current',
      data: controlData
    };
  };
  
  const onData = (callback: (data: BeamNGVehicleData) => void) => {
    dataCallback = callback;
  };
  
  const subscribeToEvents = (callback: (event: SimulatorEvent) => void) => {
    return eventEmitter.on('*', callback);
  };
  
  return {
    connect,
    disconnect,
    isConnected: () => isConnected,
    sendControlInput,
    onData,
    subscribeToEvents,
  };
};