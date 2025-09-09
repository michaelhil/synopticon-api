/**
 * Media API Types
 * Type definitions for media streaming and device management endpoints
 */

export interface DeviceInfo {
  id: string;
  label: string;
  type: string;
  capabilities?: string[];
  status?: 'available' | 'busy' | 'offline';
}

export interface NetworkInfo {
  localIP: string;
  interfaces: string[];
  port?: number;
}

export interface DeviceStatistics {
  totalDevices: number;
  availableDevices: number;
  activeStreams: number;
}

export interface DiscoveryResult {
  status: 'success' | 'error';
  data?: {
    devices: DeviceInfo[];
    networkInfo: NetworkInfo;
    statistics: DeviceStatistics;
  };
  error?: {
    message: string;
    code?: string;
  };
  timestamp: number;
}

export interface DeviceRegistrationResult {
  deviceId: string;
  registered: boolean;
  error?: string;
}

export interface CreateStreamRequest {
  deviceId: string;
  quality?: 'low' | 'medium' | 'high';
  autoStart?: boolean;
}

export interface StreamInfo {
  id: string;
  deviceId: string;
  quality: string;
  status: 'starting' | 'active' | 'stopped' | 'error';
  endpoints?: {
    hls?: string;
    webrtc?: string;
    websocket?: string;
  };
  metadata?: {
    resolution?: string;
    fps?: number;
    bitrate?: number;
  };
}

export interface StreamResponse {
  success: boolean;
  stream?: StreamInfo;
  device?: string;
  message?: string;
  error?: string;
}

export interface MediaDependencies {
  getMediaStreamingAPI: () => Promise<any>;
  getMultiDeviceCoordinator: () => Promise<any>;
  memoryOptimizer: any;
  middlewareSystem: any;
  createJSONResponse: (data: any, status?: number) => Response;
  createErrorResponse: (message: string, status?: number) => Response;
}

export type RouteHandler = (request: Request) => Promise<Response>;
export type Route = [string, string, RouteHandler];
export type Routes = Route[];
