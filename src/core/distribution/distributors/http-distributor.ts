/**
 * HTTP Distributor
 * Handles distribution via HTTP requests (webhooks, REST API calls)
 */

import { 
  createBaseDistributor, 
  DistributorCapabilities, 
  BaseDistributor, 
  SendOptions 
} from '../base-distributor.ts';
import { createLogger } from '../../../shared/utils/logger.ts';

const logger = createLogger({ level: 2 });

// HTTP-specific configuration interface
export interface HttpDistributorConfig {
  name?: string;
  baseUrl?: string;
  timeout?: number;
  headers?: Record<string, string>;
  endpoints?: Record<string, string>;
  retryCount?: number;
  retryDelay?: number;
  skipHealthCheck?: boolean;
  enabled?: boolean;
}

// HTTP request options interface
export interface HttpRequestOptions {
  headers?: Record<string, string>;
  method?: string;
  endpoint?: string;
  endpoints?: string[];
  metadata?: Record<string, any>;
  [key: string]: any;
}

// HTTP response interface
export interface HttpResponse {
  status: number;
  statusText: string;
  data: any;
  headers: Record<string, string>;
}

// HTTP send result interface
export interface HttpSendResult {
  success: boolean;
  event: string;
  endpoint: string;
  status: number;
  duration: number;
  response: any;
}

// HTTP broadcast result interface
export interface HttpBroadcastResult {
  broadcast: boolean;
  event: string;
  results: Array<HttpSendResult & { endpoint: string; error?: string; }>;
  summary: {
    total: number;
    successful: number;
    failed: number;
  };
}

// Enhanced HTTP distributor interface
export interface HttpDistributor extends BaseDistributor {
  // HTTP-specific methods
  makeRequest: (method: string, endpoint: string, data?: any, options?: HttpRequestOptions) => Promise<HttpResponse>;
  getCapabilities: () => string[];
  getEndpoints: () => Record<string, string>;
  setEndpoint: (event: string, endpoint: string) => void;
  getBaseUrl: () => string;
  setBaseUrl: (url: string) => void;
  protocol: 'http';
  
  // Override methods with specific types
  send: (event: string, data: any, options?: SendOptions & HttpRequestOptions) => Promise<HttpSendResult>;
  broadcast: (event: string, data: any, options?: SendOptions & HttpRequestOptions) => Promise<HttpBroadcastResult>;
}

// Internal state interface
interface HttpDistributorState {
  config: Required<HttpDistributorConfig> & { endpoints: Record<string, string>; };
  capabilities: string[];
}

/**
 * Create HTTP distributor for sending data via HTTP requests
 */
export const createHttpDistributor = (config: HttpDistributorConfig = {}): HttpDistributor => {
  const baseDistributor = createBaseDistributor({
    name: 'http',
    ...config
  });

  const state: HttpDistributorState = {
    config: {
      name: config.name || 'http',
      enabled: config.enabled !== false,
      baseUrl: config.baseUrl || 'http://localhost:3000',
      timeout: config.timeout || 10000,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Synopticon-API/1.0',
        ...config.headers
      },
      endpoints: {
        webhook: '/webhook',
        events: '/events',
        health: '/api/health',
        ...config.endpoints
      },
      retryCount: config.retryCount || 3,
      retryDelay: config.retryDelay || 1000,
      skipHealthCheck: config.skipHealthCheck || false
    },
    capabilities: [
      DistributorCapabilities.SEND,
      DistributorCapabilities.RELIABLE
    ]
  };

  /**
   * Make HTTP request with retry logic
   */
  const makeRequest = async (
    method: string, 
    endpoint: string, 
    data: any = null, 
    options: HttpRequestOptions = {}
  ): Promise<HttpResponse> => {
    const url = `${state.config.baseUrl}${endpoint}`;
    const requestOptions: RequestInit = {
      method,
      headers: { ...state.config.headers, ...options.headers }
    };

    if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      requestOptions.body = typeof data === 'string' ? data : JSON.stringify(data);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), state.config.timeout);

    try {
      const response = await fetch(url, {
        ...requestOptions,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type');
      let responseData: any;

      if (contentType && contentType.includes('application/json')) {
        responseData = await response.json();
      } else {
        responseData = await response.text();
      }

      return {
        status: response.status,
        statusText: response.statusText,
        data: responseData,
        headers: Object.fromEntries(response.headers.entries())
      };
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  };

  /**
   * Send data via HTTP request
   */
  const send = async (event: string, data: any, options: SendOptions & HttpRequestOptions = {}): Promise<HttpSendResult> => {
    const startTime = Date.now();
    
    try {
      // Determine endpoint based on event type or options
      const endpoint = options.endpoint || 
        state.config.endpoints[event] || 
        `${state.config.endpoints.events}/${event}`;

      // Prepare payload
      const payload = {
        event,
        data,
        timestamp: Date.now(),
        metadata: {
          source: 'synopticon-api',
          distributor: 'http',
          ...options.metadata
        }
      };

      // Make HTTP request
      const response = await makeRequest(
        options.method || 'POST',
        endpoint,
        payload,
        options
      );

      const duration = Date.now() - startTime;
      baseDistributor._updateStats('messagesSent');
      baseDistributor._updateHealth('connected', { lastSuccessfulSend: Date.now() });

      return {
        success: true,
        event,
        endpoint,
        status: response.status,
        duration,
        response: response.data
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      baseDistributor._updateStats('errors');
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      baseDistributor._updateHealth('error', { lastError: errorMessage });

      throw new Error(`HTTP distribution failed: ${errorMessage}`);
    }
  };

  /**
   * Connect to HTTP service (health check with fallbacks)
   */
  const connect = async (): Promise<boolean> => {
    // Define health check endpoints in order of preference
    const healthEndpoints = [
      state.config.endpoints.health,
      '/api/health',
      '/health',
      '/status',
      '/' // Last resort - just check if server responds
    ];

    let lastError: Error | null = null;

    for (const endpoint of healthEndpoints) {
      try {
        const response = await makeRequest('GET', endpoint);
        baseDistributor._updateHealth('connected', { 
          connected: true,
          lastHealthCheck: Date.now(),
          healthEndpoint: endpoint
        });
        console.log(`🔗 HTTP distributor connected to ${state.config.baseUrl}${endpoint}`);
        return true;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        console.log(`⏭️ Health check failed for ${endpoint}, trying next...`);
        continue;
      }
    }

    // If all health checks failed, try one final connection test with disabled health check
    if (state.config.skipHealthCheck) {
      console.log(`⚠️ Skipping health check as configured, marking as connected`);
      baseDistributor._updateHealth('connected', { 
        connected: true,
        lastHealthCheck: Date.now(),
        healthCheckSkipped: true
      });
      return true;
    }

    // All health checks failed
    baseDistributor._updateHealth('error', { 
      connected: false,
      lastError: lastError?.message || 'All health check endpoints failed'
    });
    console.warn(`⚠️ HTTP distributor health check failed: ${lastError?.message}`);
    return false;
  };

  /**
   * Disconnect (no-op for HTTP)
   */
  const disconnect = async (): Promise<boolean> => {
    baseDistributor._updateHealth('disconnected', { connected: false });
    return true;
  };

  /**
   * Broadcast via HTTP (send to multiple endpoints)
   */
  const broadcast = async (event: string, data: any, options: SendOptions & HttpRequestOptions = {}): Promise<HttpBroadcastResult> => {
    const endpoints = options.endpoints || Object.values(state.config.endpoints);
    const results: Array<HttpSendResult & { endpoint: string; error?: string; }> = [];

    for (const endpoint of endpoints) {
      try {
        const result = await send(event, data, { ...options, endpoint });
        results.push({ endpoint, ...result });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        results.push({
          endpoint,
          success: false,
          error: errorMessage,
          event,
          status: 0,
          duration: 0,
          response: null
        });
      }
    }

    return {
      broadcast: true,
      event,
      results,
      summary: {
        total: endpoints.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length
      }
    };
  };

  /**
   * Get HTTP-specific health information
   */
  const getHealth = () => {
    const baseHealth = baseDistributor.getHealth();
    const httpState = baseDistributor._getState();
    
    return {
      ...baseHealth,
      protocol: 'http' as const,
      baseUrl: state.config.baseUrl,
      endpoints: Object.keys(state.config.endpoints),
      capabilities: state.capabilities,
      lastHealthCheck: httpState.health.lastHealthCheck,
      connected: httpState.health.connected || false
    };
  };

  /**
   * Update HTTP configuration
   */
  const updateConfig = (newConfig: Partial<HttpDistributorConfig>): void => {
    Object.assign(state.config, newConfig);
    baseDistributor.updateConfig(newConfig);
  };

  // Return enhanced distributor with HTTP-specific methods
  const httpDistributor: HttpDistributor = {
    ...baseDistributor,
    
    // Override base methods
    send,
    connect,
    disconnect,
    broadcast,
    getHealth,
    updateConfig,
    
    // HTTP-specific methods
    makeRequest,
    getCapabilities: (): string[] => [...state.capabilities],
    getEndpoints: (): Record<string, string> => ({ ...state.config.endpoints }),
    setEndpoint: (event: string, endpoint: string): void => {
      state.config.endpoints[event] = endpoint;
    },
    
    // HTTP configuration
    getBaseUrl: (): string => state.config.baseUrl,
    setBaseUrl: (url: string): void => {
      state.config.baseUrl = url;
    },
    
    // Protocol identifier
    protocol: 'http'
  };

  return httpDistributor;
};

