/**
 * HTTP Protocol Adapter
 * Consolidation of http-distributor.ts + http-distributor-bun.ts
 * Functional factory pattern with zero external dependencies
 */

import { ProtocolAdapter, AdapterResult } from '../universal-distributor.js';
import { createLogger } from '../../../shared/utils/logger.js';

const logger = createLogger({ level: 2 });

export interface HttpAdapterConfig {
  baseUrl?: string;
  timeout?: number;
  headers?: Record<string, string>;
  endpoints?: Record<string, string>;
  method?: string;
}

export interface HttpAdapterStats {
  requestsSent: number;
  requestsSuccessful: number;
  requestsFailed: number;
  bytesTransmitted: number;
  averageResponseTime: number;
  lastRequestTime: number | null;
}

// HTTP Adapter Factory (ADR 004/005 compliant)
export const createHttpAdapter = (config: HttpAdapterConfig = {}): ProtocolAdapter => {
  const state = {
    stats: {
      requestsSent: 0,
      requestsSuccessful: 0,
      requestsFailed: 0,
      bytesTransmitted: 0,
      averageResponseTime: 0,
      lastRequestTime: null as number | null,
    },
    config: {
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Synopticon-HTTP-Adapter/1.0',
      },
      method: 'POST',
      ...config,
    },
  };

  // Core send function
  const send = async (data: any, targetConfig: any): Promise<AdapterResult> => {
    const startTime = Date.now();
    
    try {
      // Merge configurations
      const effectiveConfig = { ...state.config, ...targetConfig };
      const url = buildUrl(effectiveConfig);
      const headers = { ...state.config.headers, ...effectiveConfig.headers };
      
      // Prepare request body
      const body = typeof data === 'string' ? data : JSON.stringify(data);
      const bodySize = new TextEncoder().encode(body).length;
      
      // Make HTTP request using native fetch
      const response = await fetch(url, {
        method: effectiveConfig.method,
        headers,
        body,
        signal: AbortSignal.timeout(effectiveConfig.timeout),
      });

      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Update stats (immutable)
      updateStats(true, bodySize, duration);
      
      // Handle response
      if (!response.ok) {
        return {
          success: false,
          protocol: 'http',
          error: `HTTP ${response.status}: ${response.statusText}`,
          code: 'HTTP_ERROR',
          timing: { startTime, endTime, duration },
        };
      }

      const responseData = await response.text();
      let parsedData: any = responseData;
      
      try {
        parsedData = JSON.parse(responseData);
      } catch {
        // Keep as text if not JSON
      }

      return {
        success: true,
        protocol: 'http',
        data: {
          status: response.status,
          headers: Object.fromEntries(response.headers.entries()),
          body: parsedData,
        },
        timing: { startTime, endTime, duration },
      };

    } catch (error) {
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      updateStats(false, 0, duration);
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown HTTP error';
      const errorCode = error?.name === 'AbortError' ? 'TIMEOUT' : 'NETWORK_ERROR';
      
      return {
        success: false,
        protocol: 'http',
        error: errorMessage,
        code: errorCode,
        timing: { startTime, endTime, duration },
      };
    }
  };

  // Build full URL from config
  const buildUrl = (config: any): string => {
    const baseUrl = config.baseUrl || config.url || '';
    const endpoint = config.endpoint || config.endpoints?.data || '';
    
    if (!baseUrl) {
      throw new Error('HTTP adapter requires baseUrl or url in configuration');
    }
    
    // Handle full URLs vs relative endpoints
    if (endpoint.startsWith('http')) {
      return endpoint;
    }
    
    const url = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    
    return `${url}${path}`;
  };

  // Update statistics (immutable pattern)
  const updateStats = (success: boolean, bytes: number, duration: number): void => {
    const totalRequests = state.stats.requestsSent + 1;
    const totalResponseTime = (state.stats.averageResponseTime * state.stats.requestsSent) + duration;
    
    state.stats = {
      requestsSent: totalRequests,
      requestsSuccessful: state.stats.requestsSuccessful + (success ? 1 : 0),
      requestsFailed: state.stats.requestsFailed + (success ? 0 : 1),
      bytesTransmitted: state.stats.bytesTransmitted + bytes,
      averageResponseTime: totalResponseTime / totalRequests,
      lastRequestTime: Date.now(),
    };
  };

  // Health check function
  const healthCheck = async (): Promise<boolean> => {
    try {
      // Use configured baseUrl or default to localhost
      const healthUrl = state.config.baseUrl 
        ? `${state.config.baseUrl}/health`
        : 'http://localhost:8080/health';
      
      const response = await fetch(healthUrl, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });
      
      return response.ok;
    } catch (error) {
      logger.debug(`HTTP adapter health check failed: ${error}`);
      return false;
    }
  };

  // Configuration update
  const configure = (newConfig: any): void => {
    state.config = { ...state.config, ...newConfig };
    logger.debug('HTTP adapter configuration updated');
  };

  // Get current statistics
  const getStats = (): HttpAdapterStats => ({ ...state.stats });

  // Return adapter instance
  return {
    protocol: 'http',
    capabilities: ['webhooks', 'rest-api', 'json-data', 'binary-data'],
    send,
    healthCheck,
    configure,
    
    // Additional HTTP-specific methods
    getStats,
    getConfig: () => ({ ...state.config }),
  };
};

export type HttpAdapter = ReturnType<typeof createHttpAdapter>;