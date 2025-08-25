/**
 * HTTP Distributor - Bun Native Implementation  
 * Uses native fetch for HTTP requests instead of Node.js http module
 * Zero external dependencies with optimal performance
 */

export const createHttpDistributor = (config) => {
  const state = {
    isActive: false,
    config: {
      baseUrl: 'http://localhost:3001',
      endpoints: {
        data: '/api/data',
        batch: '/api/batch'
      },
      timeout: 5000,
      retryAttempts: 3,
      retryDelay: 1000,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Synopticon-Distributor/1.0'
      },
      ...config
    },
    stats: {
      requestsSent: 0,
      requestsSuccessful: 0,
      requestsFailed: 0,
      bytesTransmitted: 0,
      averageResponseTime: 0,
      lastRequestTime: null
    },
    healthStatus: 'unknown'
  };

  // Health check function
  const checkHealth = async () => {
    try {
      const healthUrl = `${state.config.baseUrl}/health`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), state.config.timeout);
      
      const response = await fetch(healthUrl, {
        method: 'GET',
        headers: { ...state.config.headers },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        state.healthStatus = 'healthy';
        return true;
      } else {
        state.healthStatus = 'unhealthy';
        return false;
      }
    } catch (error) {
      state.healthStatus = 'unhealthy';
      console.warn('⚠️ HTTP distributor health check failed:', error.message);
      return false;
    }
  };

  const distribute = async (data) => {
    if (!state.isActive) {
      return false;
    }

    const startTime = performance.now();
    state.stats.lastRequestTime = Date.now();

    const payload = {
      timestamp: Date.now(),
      type: data.type || 'data',
      source: data.source,
      data: data
    };

    const requestBody = JSON.stringify(payload);
    const endpoint = state.config.endpoints.data;
    const url = `${state.config.baseUrl}${endpoint}`;

    let attempt = 0;
    
    while (attempt <= state.config.retryAttempts) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), state.config.timeout);
        
        const response = await fetch(url, {
          method: 'POST',
          headers: { ...state.config.headers },
          body: requestBody,
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        const endTime = performance.now();
        const responseTime = endTime - startTime;
        
        // Update stats
        state.stats.requestsSent++;
        state.stats.bytesTransmitted += new TextEncoder().encode(requestBody).length;
        state.stats.averageResponseTime = 
          (state.stats.averageResponseTime + responseTime) / 2;

        if (response.ok) {
          state.stats.requestsSuccessful++;
          state.healthStatus = 'healthy';
          return true;
        } else {
          console.warn(`HTTP distributor received ${response.status}: ${response.statusText}`);
          state.stats.requestsFailed++;
          
          // Don't retry for client errors (4xx)
          if (response.status >= 400 && response.status < 500) {
            return false;
          }
          
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
      } catch (error) {
        attempt++;
        state.stats.requestsFailed++;
        
        if (error.name === 'AbortError') {
          console.warn(`HTTP distributor timeout after ${state.config.timeout}ms`);
        } else {
          console.warn(`HTTP distributor error (attempt ${attempt}):`, error.message);
        }
        
        if (attempt <= state.config.retryAttempts) {
          // Exponential backoff
          const delay = state.config.retryDelay * Math.pow(2, attempt - 1);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    state.healthStatus = 'unhealthy';
    return false;
  };

  const distributeBatch = async (dataArray) => {
    if (!state.isActive || !Array.isArray(dataArray) || dataArray.length === 0) {
      return false;
    }

    const payload = {
      timestamp: Date.now(),
      type: 'batch',
      count: dataArray.length,
      data: dataArray
    };

    const requestBody = JSON.stringify(payload);
    const endpoint = state.config.endpoints.batch;
    const url = `${state.config.baseUrl}${endpoint}`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), state.config.timeout * 2); // Longer timeout for batch
      
      const response = await fetch(url, {
        method: 'POST',
        headers: { ...state.config.headers },
        body: requestBody,
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      state.stats.requestsSent++;
      state.stats.bytesTransmitted += new TextEncoder().encode(requestBody).length;

      if (response.ok) {
        state.stats.requestsSuccessful++;
        state.healthStatus = 'healthy';
        return true;
      } else {
        state.stats.requestsFailed++;
        console.warn(`HTTP batch distributor failed: ${response.status} ${response.statusText}`);
        return false;
      }
      
    } catch (error) {
      state.stats.requestsFailed++;
      console.error('HTTP batch distributor error:', error.message);
      return false;
    }
  };

  const initialize = async () => {
    if (state.isActive) {
      throw new Error('HTTP distributor already initialized');
    }

    try {
      console.log(`🌐 Initializing HTTP distributor for ${state.config.baseUrl}`);
      
      // Perform initial health check
      const isHealthy = await checkHealth();
      if (!isHealthy) {
        console.warn('⚠️ HTTP distributor health check failed during initialization');
      }
      
      state.isActive = true;
      console.log(`✅ HTTP distributor initialized for ${state.config.baseUrl}`);
      
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize HTTP distributor:', error.message);
      state.isActive = false;
      throw error;
    }
  };

  const cleanup = async () => {
    if (!state.isActive) return;

    try {
      state.isActive = false;
      state.healthStatus = 'stopped';
      console.log('✅ HTTP distributor stopped');
    } catch (error) {
      console.error('Error during HTTP distributor cleanup:', error);
      throw error;
    }
  };

  const getStatus = () => ({
    type: 'http',
    active: state.isActive,
    config: {
      baseUrl: state.config.baseUrl,
      endpoints: state.config.endpoints,
      timeout: state.config.timeout
    },
    stats: { ...state.stats },
    health: state.healthStatus
  });

  const testConnection = async () => {
    return await checkHealth();
  };

  return {
    type: 'http',
    distribute,
    distributeBatch,
    initialize,
    cleanup,
    getStatus,
    testConnection,
    checkHealth,
    isHealthy: () => state.isActive && state.healthStatus === 'healthy'
  };
};