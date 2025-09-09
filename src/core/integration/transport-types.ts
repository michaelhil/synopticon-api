/**
 * Transport Layer Type Definitions
 * Comprehensive TypeScript interfaces for real-time data streaming
 */

// Base types for all transport protocols
export type TransportProtocol = 'websocket' | 'http' | 'udp';

// Connection status types
export type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'disconnecting' | 'disconnected' | 'error';

// Transport event types
export type TransportEvent = 'connect' | 'message' | 'disconnect' | 'error';

// Base transport configuration
export interface BaseTransportConfig {
  timeout?: number;
  reconnect?: boolean;
  maxRetries?: number;
  retryDelay?: number;
}

// Connection information
export interface ConnectionInfo {
  id?: string;
  socket?: any;
  connectedAt?: number;
}

// Message data types
export type MessageData = string | object | ArrayBuffer | Uint8Array;

// Callback function types
export type ConnectCallback = (info: ConnectionInfo) => void;
export type MessageCallback = (data: any, socket?: any) => void;
export type DisconnectCallback = (info: ConnectionInfo) => void;
export type ErrorCallback = (error: Error, socket?: any) => void;

// Unsubscribe function type
export type UnsubscribeFunction = () => void;

// Transport response types
export interface TransportResponse {
  success: boolean;
  data?: any;
  error?: string;
  status?: number;
  headers?: Record<string, string>;
}

// Transport statistics
export interface TransportStats {
  connectionCount: number;
  isServer: boolean;
  port?: number;
  reconnectAttempts?: number;
}

// WebSocket specific types
export interface WebSocketConfig extends BaseTransportConfig {
  isServer?: boolean;
  port?: number;
  autoReconnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}

export interface WebSocketData {
  id: string;
  connectedAt: number;
}

export interface ReconnectConfig {
  enabled: boolean;
  interval: number;
  maxAttempts: number;
  attempts: number;
}

export interface WebSocketCallbacks {
  onConnect: ConnectCallback[];
  onMessage: MessageCallback[];
  onDisconnect: DisconnectCallback[];
  onError: ErrorCallback[];
}

export interface WebSocketState {
  connections: Map<string, any>;
  isServer: boolean;
  port: number;
  server: any | null;
  clientSocket: WebSocket | null;
  callbacks: WebSocketCallbacks;
  reconnect: ReconnectConfig;
}

// WebSocket transport interface
export interface WebSocketTransport {
  startServer?: () => any;
  connect?: (url: string) => Promise<WebSocket>;
  stop: () => void;
  send: (data: MessageData) => number;
  sendTo?: (connectionId: string, data: MessageData) => boolean;
  onConnect: (callback: ConnectCallback) => UnsubscribeFunction;
  onMessage: (callback: MessageCallback) => UnsubscribeFunction;
  onDisconnect: (callback: DisconnectCallback) => UnsubscribeFunction;
  onError: (callback: ErrorCallback) => UnsubscribeFunction;
  getConnectionCount: () => number;
  isConnected: () => boolean;
  getStats: () => TransportStats;
}

// HTTP specific types
export interface HttpConfig extends BaseTransportConfig {
  baseUrl?: string;
  headers?: Record<string, string>;
}

export interface HttpOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
}

export interface HttpState {
  baseUrl: string;
  headers: Record<string, string>;
  timeout: number;
}

// HTTP transport interface
export interface HttpTransport {
  send: (endpoint: string, data?: any, options?: HttpOptions) => Promise<TransportResponse>;
  get: (endpoint: string, options?: HttpOptions) => Promise<TransportResponse>;
  post: (endpoint: string, data?: any, options?: HttpOptions) => Promise<TransportResponse>;
  put: (endpoint: string, data?: any, options?: HttpOptions) => Promise<TransportResponse>;
  delete: (endpoint: string, options?: HttpOptions) => Promise<TransportResponse>;
  
  // Eye tracker specific methods
  getStatus: () => Promise<TransportResponse>;
  startRecording: (recordingId: string, config?: any) => Promise<TransportResponse>;
  stopRecording: () => Promise<TransportResponse>;
  getRecordings: () => Promise<TransportResponse>;
  startCalibration: () => Promise<TransportResponse>;
  stopCalibration: () => Promise<TransportResponse>;
  getCalibration: () => Promise<TransportResponse>;
  
  // Configuration methods
  getBaseUrl: () => string;
  setTimeout: (timeout: number) => void;
  setHeaders: (headers: Record<string, string>) => void;
}

// UDP specific types (placeholder for future implementation)
export interface UdpConfig extends BaseTransportConfig {
  port?: number;
  host?: string;
  isServer?: boolean;
}

export interface UdpCallbacks {
  onMessage: MessageCallback[];
  onError: ErrorCallback[];
}

export interface UdpState {
  socket: any | null;
  port: number;
  host: string;
  isServer: boolean;
  callbacks: UdpCallbacks;
}

// UDP transport interface
export interface UdpTransport {
  start: () => Promise<void>;
  send: (data: MessageData) => Promise<void>;
  stop: () => void;
  onMessage: (callback: MessageCallback) => UnsubscribeFunction;
  onError: (callback: ErrorCallback) => UnsubscribeFunction;
}

// Transport factory types
export type TransportFactory<T = any> = (config?: any) => T;

export interface TransportFactoryRegistry {
  register: (protocol: TransportProtocol, factory: TransportFactory) => void;
  create: (protocol: TransportProtocol, config?: any) => any;
  getAvailableProtocols: () => TransportProtocol[];
}

// Generic transport interface (union of all transport types)
export type Transport = WebSocketTransport | HttpTransport | UdpTransport;

// Transport configuration union type
export type TransportConfig = WebSocketConfig | HttpConfig | UdpConfig;

// Recording configuration for eye tracker
export interface RecordingConfig {
  recording_id: string;
  duration?: number;
  format?: string;
  quality?: 'low' | 'medium' | 'high';
  metadata?: Record<string, any>;
}

// Calibration data types
export interface CalibrationPoint {
  x: number;
  y: number;
  timestamp: number;
}

export interface CalibrationData {
  points: CalibrationPoint[];
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  accuracy?: number;
  metadata?: Record<string, any>;
}

// Status response types
export interface DeviceStatus {
  connected: boolean;
  recording: boolean;
  calibrated: boolean;
  battery?: number;
  temperature?: number;
  error?: string;
}

// Recording info types
export interface RecordingInfo {
  id: string;
  status: 'active' | 'stopped' | 'completed';
  duration: number;
  size: number;
  created_at: string;
  metadata?: Record<string, any>;
}
