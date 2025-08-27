/**
 * Common types for all distributors and validators
 */

// Distributor configuration interfaces
export interface HttpDistributorConfig {
  type: 'http';
  baseUrl: string;
  timeout?: number;
  retryCount?: number;
  compression?: boolean;
  headers?: Record<string, string>;
  endpoints?: Record<string, string>;
}

export interface WebSocketDistributorConfig {
  type: 'websocket';
  port: number;
  host?: string;
  compression?: boolean;
  maxConnections?: number;
  maxPayload?: number;
  heartbeatInterval?: number;
}

export interface MqttDistributorConfig {
  type: 'mqtt';
  broker: string;
  clientId?: string;
  username?: string;
  password?: string;
  qos?: number;
  retain?: boolean;
  topics?: Record<string, string>;
}

export interface UdpDistributorConfig {
  type: 'udp';
  port: number;
  host?: string;
  maxPayload?: number;
  targets: Array<{ host: string; port: number; }>;
}

export interface SseDistributorConfig {
  type: 'sse';
  port: number;
  endpoint?: string;
  maxConnections?: number;
}

// Union type for all distributor configurations
export type DistributorConfig = 
  | HttpDistributorConfig
  | WebSocketDistributorConfig
  | MqttDistributorConfig
  | UdpDistributorConfig
  | SseDistributorConfig;

// Validation result interface
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

// Base validator interface
export interface BaseValidator<T> {
  validate: (config: T) => ValidationResult;
  getSchema?: () => any;
}

// Field validation helpers
export interface FieldValidator {
  required: (value: any, fieldName: string) => string | null;
  url: (value: string, fieldName: string) => string | null;
  port: (value: number, fieldName: string) => string | null;
  positiveNumber: (value: number, fieldName: string) => string | null;
  nonEmptyString: (value: string, fieldName: string) => string | null;
  array: (value: any[], fieldName: string) => string | null;
  object: (value: any, fieldName: string) => string | null;
}

// Common validation constraints
export const ValidationConstraints = {
  PORT_MIN: 1,
  PORT_MAX: 65535,
  TIMEOUT_MIN: 100,
  TIMEOUT_MAX: 300000,
  RETRY_COUNT_MAX: 10,
  MAX_PAYLOAD_MIN: 1024,
  MAX_PAYLOAD_MAX: 100 * 1024 * 1024, // 100MB
  MAX_CONNECTIONS_MIN: 1,
  MAX_CONNECTIONS_MAX: 10000,
  HEARTBEAT_MIN: 1000,
  HEARTBEAT_MAX: 300000
} as const;