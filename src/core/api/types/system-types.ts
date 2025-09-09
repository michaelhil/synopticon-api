/**
 * System API Types
 * Type definitions for system and pipeline management endpoints
 */

export interface PipelineInfo {
  name: string;
  type: string;
  status: 'active' | 'inactive' | 'error' | 'unknown';
  capabilities: string[];
}

export interface PipelineListResponse {
  pipelines: PipelineInfo[];
  total: number;
  timestamp: number;
}

export interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  uptime: number;
  timestamp: number;
  services: {
    [key: string]: {
      status: 'up' | 'down' | 'degraded';
      message?: string;
    };
  };
}

export interface DistributionStatus {
  status: string;
  activeDistributors: number;
  totalConnections: number;
  errors?: any[];
}

export interface SystemDependencies {
  orchestrator: {
    getRegisteredPipelines: () => any[];
    getStatus: () => any;
  };
  getDistributionOverallStatus: () => Promise<DistributionStatus>;
  middlewareSystem: any;
  createJSONResponse: (data: any, status?: number) => Response;
  createErrorResponse: (message: string, status?: number) => Response;
}
