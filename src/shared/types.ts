/**
 * Universal data types for Synopticon multi-modal system
 * Supports both sensor data (visual/audio) and telemetry data (numerical)
 */

// Base data interface - all data types extend this
export interface BaseDataFrame {
  timestamp: bigint;
  sequenceNumber: number;
  sourceId: string;
  sourceType: 'sensor' | 'telemetry';
}

// Sensor data types (existing)
export interface FrameData extends BaseDataFrame {
  sourceType: 'sensor';
  width: number;
  height: number;
  format: 'rgb' | 'rgba' | 'yuv' | 'bgr';
  data: Uint8Array | Float32Array;
  metadata?: Record<string, unknown>;
}

// Telemetry data types (new)
export interface TelemetryFrame extends BaseDataFrame {
  sourceType: 'telemetry';
  simulator: 'msfs' | 'xplane' | 'beamng' | 'vatsim' | 'custom';
  vehicle: VehicleState;
  environment?: EnvironmentState;
  controls?: ControlState;
  performance?: PerformanceMetrics;
  events?: TelemetryEvent[];
  metadata?: {
    callsign?: string;
    pilotName?: string;
    aircraft?: string;
    departure?: string;
    arrival?: string;
    route?: string;
    custom?: Record<string, unknown>;
  };
}

// Vehicle state for simulators
export interface VehicleState {
  position: [number, number, number]; // x, y, z in meters
  velocity: [number, number, number]; // m/s
  acceleration?: [number, number, number]; // m/s²
  rotation: [number, number, number, number]; // quaternion
  heading: number; // degrees
}

// Environment conditions
export interface EnvironmentState {
  weather?: {
    temperature: number;
    humidity: number;
    windSpeed: number;
    windDirection: number;
  };
  visibility?: number;
  timeOfDay?: string; // ISO 8601
  traffic?: unknown[];
  network?: {
    server: string;
    transponder: string;
    lastUpdate: string;
  };
}

// Control inputs
export interface ControlState {
  throttle: number; // 0-1
  brake: number; // 0-1
  steering: number; // -1 to 1
  gear?: number;
  custom?: Record<string, number>;
}

// Performance metrics
export interface PerformanceMetrics {
  speed: number; // current speed in m/s
  fuel?: number; // 0-1 (percentage)
  engineRpm?: number;
  lapTime?: number; // milliseconds
  damage?: number; // 0-1 (percentage)
}

// Telemetry events
export interface TelemetryEvent {
  type: string;
  timestamp: bigint;
  data: unknown;
  severity: 'info' | 'warning' | 'error';
}

// Correlated data combining sensors and telemetry
export interface CorrelatedFrame {
  timestamp: bigint;
  sequenceNumber: number;
  sensors?: FrameData[];
  telemetry?: TelemetryFrame[];
  derived: DerivedMetrics;
  events: CrossModalEvent[];
  confidence: number; // 0-1
}

// Derived metrics from correlation
export interface DerivedMetrics {
  stressLevel?: number; // 0-1
  attentionFocus?: {
    x: number;
    y: number;
    confidence: number;
  };
  workloadIndex?: number; // 0-1
  performanceScore?: number; // 0-1
  reactionTime?: number; // milliseconds
}

// Cross-modal events
export interface CrossModalEvent {
  type: string;
  timestamp: bigint;
  sources: string[]; // source IDs that contributed
  confidence: number;
  data: unknown;
}

// Universal data union type
export type UniversalData = FrameData | TelemetryFrame | CorrelatedFrame;

// Data source capabilities
export interface SourceCapabilities {
  dataTypes: ('frame' | 'telemetry')[];
  maxFrequency: number; // Hz
  latency: number; // milliseconds
  reliability: number; // 0-1
  features: string[];
}

// Connection status for any source
export interface ConnectionStatus {
  connected: boolean;
  lastSeen: number;
  reconnectAttempts: number;
  errors: string[];
  latency?: number;
  reliability?: number;
}
