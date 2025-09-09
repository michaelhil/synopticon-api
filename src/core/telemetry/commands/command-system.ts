/**
 * Universal Simulator Command System
 * Standardized interface for sending commands to any simulator
 */

// Universal command types
export type CommandType = 
  | 'flight-control'    // Aircraft control surfaces, throttle, etc.
  | 'vehicle-control'   // Ground vehicle steering, throttle, brake
  | 'system-control'    // Landing gear, lights, avionics
  | 'environment'       // Weather, time, scenery
  | 'simulation'        // Pause, speed, restart
  | 'navigation'        // Autopilot, GPS, radio
  | 'custom';           // Simulator-specific commands

// Universal command structure
export interface SimulatorCommand {
  id: string;
  type: CommandType;
  action: string;
  parameters?: Record<string, unknown>;
  timestamp?: number;
  priority?: 'low' | 'normal' | 'high' | 'critical';
  timeout?: number; // milliseconds
}

// Command execution result
export interface CommandResult {
  commandId: string;
  success: boolean;
  executedAt: number;
  duration?: number; // milliseconds
  response?: unknown;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

// Command capabilities per simulator
export interface CommandCapabilities {
  supportedTypes: CommandType[];
  supportedActions: Record<CommandType, string[]>;
  maxConcurrentCommands: number;
  supportsQueuing: boolean;
  supportsUndo: boolean;
}

// Event system for command responses and simulator events
export interface SimulatorEvent {
  id: string;
  type: 'command-result' | 'state-change' | 'error' | 'notification';
  timestamp: number;
  source: string; // simulator id
  data: unknown;
  severity?: 'info' | 'warning' | 'error' | 'critical';
}

// Standard flight control commands
export const FLIGHT_COMMANDS = {
  // Primary controls
  SET_THROTTLE: 'set-throttle',           // { value: 0-1 }
  SET_ELEVATOR: 'set-elevator',           // { value: -1 to 1 }
  SET_AILERON: 'set-aileron',            // { value: -1 to 1 }
  SET_RUDDER: 'set-rudder',              // { value: -1 to 1 }
  
  // Engine controls
  START_ENGINE: 'start-engine',           // { engine: number }
  STOP_ENGINE: 'stop-engine',            // { engine: number }
  SET_MIXTURE: 'set-mixture',            // { value: 0-1, engine?: number }
  SET_PROPELLER: 'set-propeller',        // { value: 0-1, engine?: number }
  
  // Systems
  TOGGLE_GEAR: 'toggle-gear',            // {}
  SET_FLAPS: 'set-flaps',               // { position: 0-1 }
  TOGGLE_LIGHTS: 'toggle-lights',        // { type: 'landing'|'nav'|'strobe' }
  
  // Autopilot
  AP_MASTER: 'autopilot-master',         // { enabled: boolean }
  AP_HEADING: 'autopilot-heading',       // { heading: degrees }
  AP_ALTITUDE: 'autopilot-altitude',     // { altitude: feet }
  AP_SPEED: 'autopilot-speed'          // { speed: knots }
} as const;

// Standard vehicle control commands  
export const VEHICLE_COMMANDS = {
  // Primary controls
  SET_STEERING: 'set-steering',          // { angle: -1 to 1 }
  SET_THROTTLE: 'set-throttle',          // { value: 0-1 }
  SET_BRAKE: 'set-brake',               // { value: 0-1 }
  SET_HANDBRAKE: 'set-handbrake',       // { engaged: boolean }
  
  // Transmission
  SET_GEAR: 'set-gear',                 // { gear: number | 'P'|'R'|'N'|'D' }
  SHIFT_UP: 'shift-up',                 // {}
  SHIFT_DOWN: 'shift-down',             // {}
  
  // Vehicle systems
  TOGGLE_LIGHTS: 'toggle-lights',        // { type: 'headlight'|'hazard'|'turn' }
  TOGGLE_ENGINE: 'toggle-engine',        // {}
  RESET_VEHICLE: 'reset-vehicle',        // {}
  
  // Advanced
  SET_ABS: 'set-abs',                   // { enabled: boolean }
  SET_TC: 'set-traction-control',       // { enabled: boolean }
  SET_ESC: 'set-stability-control'     // { enabled: boolean }
} as const;

// Command builder utilities
export const createCommand = (
  type: CommandType,
  action: string,
  parameters: Record<string, unknown> = {},
  options: Partial<Pick<SimulatorCommand, 'priority' | 'timeout'>> = {}
): SimulatorCommand => ({
  id: `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  type,
  action,
  parameters,
  timestamp: Date.now(),
  priority: 'normal',
  timeout: 5000,
  ...options
});

// Pre-built command factories
export const createFlightCommand = (
  action: string,
  parameters: Record<string, unknown> = {},
  options: Partial<Pick<SimulatorCommand, 'priority' | 'timeout'>> = {}
): SimulatorCommand => createCommand('flight-control', action, parameters, options);

export const createVehicleCommand = (
  action: string,
  parameters: Record<string, unknown> = {},
  options: Partial<Pick<SimulatorCommand, 'priority' | 'timeout'>> = {}
): SimulatorCommand => createCommand('vehicle-control', action, parameters, options);

// Command queue manager
export const createCommandQueue = (maxSize = 100) => {
  let queue: SimulatorCommand[] = [];
  const processing = false;

  const add = (command: SimulatorCommand): boolean => {
    if (queue.length >= maxSize) {
      // Remove oldest non-critical command
      const removeIndex = queue.findIndex(cmd => cmd.priority !== 'critical');
      if (removeIndex === -1) return false; // All critical, reject
      queue.splice(removeIndex, 1);
    }
    
    // Insert by priority
    const insertIndex = queue.findIndex(cmd => 
      getPriorityValue(command.priority) > getPriorityValue(cmd.priority)
    );
    
    if (insertIndex === -1) {
      queue.push(command);
    } else {
      queue.splice(insertIndex, 0, command);
    }
    
    return true;
  };

  const next = (): SimulatorCommand | null => {
    return queue.shift() || null;
  };

  const clear = (): void => {
    queue = [];
  };

  const size = (): number => queue.length;

  const peek = (): SimulatorCommand | null => {
    return queue[0] || null;
  };

  return { add, next, clear, size, peek };
};

const getPriorityValue = (priority: SimulatorCommand['priority'] = 'normal'): number => {
  const values = { low: 1, normal: 2, high: 3, critical: 4 };
  return values[priority];
};

// Event emitter for simulator events
export const createEventEmitter = () => {
  const listeners = new Map<string, Array<(event: SimulatorEvent) => void>>();

  const on = (eventType: string, callback: (event: SimulatorEvent) => void) => {
    if (!listeners.has(eventType)) {
      listeners.set(eventType, []);
    }
    listeners.get(eventType)!.push(callback);
    
    return () => {
      const callbacks = listeners.get(eventType);
      if (callbacks) {
        const index = callbacks.indexOf(callback);
        if (index > -1) {
          callbacks.splice(index, 1);
        }
      }
    };
  };

  const emit = (event: SimulatorEvent): void => {
    const callbacks = listeners.get(event.type) || [];
    const allCallbacks = listeners.get('*') || [];
    
    [...callbacks, ...allCallbacks].forEach(callback => {
      try {
        callback(event);
      } catch (error) {
        console.error('Event callback error:', error);
      }
    });
  };

  const removeAllListeners = (eventType?: string): void => {
    if (eventType) {
      listeners.delete(eventType);
    } else {
      listeners.clear();
    }
  };

  return { on, emit, removeAllListeners };
};

// Command validation utilities
export const validateCommand = (command: SimulatorCommand): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (!command.id) errors.push('Command ID is required');
  if (!command.type) errors.push('Command type is required');
  if (!command.action) errors.push('Command action is required');
  
  if (command.timeout && command.timeout <= 0) {
    errors.push('Timeout must be positive');
  }
  
  if (command.priority && !['low', 'normal', 'high', 'critical'].includes(command.priority)) {
    errors.push('Invalid priority level');
  }

  return {
    valid: errors.length === 0,
    errors
  };
};

// Common command parameter validators
export const VALIDATORS = {
  throttle: (value: unknown): boolean => 
    typeof value === 'number' && value >= 0 && value <= 1,
    
  angle: (value: unknown): boolean => 
    typeof value === 'number' && value >= -1 && value <= 1,
    
  boolean: (value: unknown): boolean => 
    typeof value === 'boolean',
    
  positiveNumber: (value: unknown): boolean => 
    typeof value === 'number' && value > 0,
    
  heading: (value: unknown): boolean => 
    typeof value === 'number' && value >= 0 && value < 360,
    
  altitude: (value: unknown): boolean => 
    typeof value === 'number' && value >= -1000 && value <= 100000,
    
  speed: (value: unknown): boolean => 
    typeof value === 'number' && value >= 0 && value <= 1000
};

// Utility to create event from command result
export const createCommandResultEvent = (
  result: CommandResult, 
  sourceId: string
): SimulatorEvent => ({
  id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  type: 'command-result',
  timestamp: Date.now(),
  source: sourceId,
  data: result,
  severity: result.success ? 'info' : 'error'
});
