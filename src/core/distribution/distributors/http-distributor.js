/**
 * HTTP Distributor
 * Handles distribution via HTTP requests (webhooks, REST API calls)
 */

import { createBaseDistributor, DistributorCapabilities } from '../base-distributor.js';

/**
 * Create HTTP distributor for sending data via HTTP requests
 * @param {Object} config - HTTP distributor configuration
 * @returns {Object} HTTP distributor instance
 */
export const createHttpDistributor = (config = {}) => {
  const baseDistributor = createBaseDistributor({
    name: 'http',
    ...config
  });

  const state = {
    config: {
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
        health: '/health',
        ...config.endpoints
      },
      retryCount: config.retryCount || 3,
      retryDelay: config.retryDelay || 1000,
      ...config
    },
    capabilities: [
      DistributorCapabilities.SEND,
      DistributorCapabilities.RELIABLE
    ]
  };

  /**
   * Make HTTP request with retry logic
   */
  const makeRequest = async (method, endpoint, data = null, options = {}) => {
    const url = `${state.config.baseUrl}${endpoint}`;
    const requestOptions = {
      method,
      headers: { ...state.config.headers, ...options.headers },
      ...options
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
      let responseData;

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
  const send = async (event, data, options = {}) => {
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
      baseDistributor._updateHealth('healthy', { lastSuccessfulSend: Date.now() });

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
      baseDistributor._updateHealth('error', { lastError: error.message });

      throw new Error(`HTTP distribution failed: ${error.message}`);
    }
  };

  /**
   * Connect to HTTP service (health check)
   */
  const connect = async () => {
    try {
      const response = await makeRequest('GET', state.config.endpoints.health);
      baseDistributor._updateHealth('healthy', { 
        connected: true,
        lastHealthCheck: Date.now()
      });
      console.log(`🔗 HTTP distributor connected to ${state.config.baseUrl}`);
      return true;
    } catch (error) {
      baseDistributor._updateHealth('error', { 
        connected: false,
        lastError: error.message 
      });
      console.warn(`⚠️ HTTP distributor health check failed: ${error.message}`);
      return false;
    }
  };

  /**
   * Disconnect (no-op for HTTP)
   */
  const disconnect = async () => {
    baseDistributor._updateHealth('disconnected', { connected: false });
    return true;
  };

  /**
   * Broadcast via HTTP (send to multiple endpoints)
   */
  const broadcast = async (event, data, options = {}) => {
    const endpoints = options.endpoints || Object.values(state.config.endpoints);
    const results = [];

    for (const endpoint of endpoints) {
      try {
        const result = await send(event, data, { ...options, endpoint });
        results.push({ endpoint, ...result });
      } catch (error) {
        results.push({
          endpoint,
          success: false,
          error: error.message
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
      protocol: 'http',
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
  const updateConfig = (newConfig) => {
    Object.assign(state.config, newConfig);
    baseDistributor.updateConfig(newConfig);
  };

  // Return enhanced distributor with HTTP-specific methods
  return {
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
    getCapabilities: () => [...state.capabilities],
    getEndpoints: () => ({ ...state.config.endpoints }),
    setEndpoint: (event, endpoint) => {
      state.config.endpoints[event] = endpoint;
    },
    
    // HTTP configuration
    getBaseUrl: () => state.config.baseUrl,
    setBaseUrl: (url) => {
      state.config.baseUrl = url;
    },
    
    // Protocol identifier
    protocol: 'http'
  };
};

export default createHttpDistributor;