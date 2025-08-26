/**
 * CORS Middleware Module
 * Enhanced Cross-Origin Resource Sharing handling
 */

/**
 * Create CORS middleware
 * @param {Object} config - CORS configuration
 * @returns {Object} CORS middleware functions
 */
export const createCORSMiddleware = (config = {}) => {
  const state = {
    config: {
      allowedOrigins: config.allowedOrigins || [
        'http://localhost:3000',
        'http://127.0.0.1:3000',
        'http://localhost:8080',
        'http://127.0.0.1:8080'
      ],
      allowedMethods: config.allowedMethods || ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: config.allowedHeaders || [
        'Content-Type', 
        'Authorization', 
        'X-API-Key', 
        'X-Requested-With',
        'X-Session-ID'
      ],
      allowCredentials: config.allowCredentials || false,
      maxAge: config.maxAge || 3600, // Preflight cache duration
      exposeHeaders: config.exposeHeaders || ['X-Total-Count', 'X-Rate-Limit'],
      strictMode: config.strictMode !== false,
      logRequests: config.logRequests || false,
      ...config
    },
    stats: {
      totalRequests: 0,
      preflightRequests: 0,
      blockedRequests: 0,
      allowedOrigins: new Map(), // origin -> count
      requestsByMethod: new Map()
    }
  };

  /**
   * Check if origin is allowed
   * @param {string} origin - Request origin
   * @returns {boolean} Whether origin is allowed
   */
  const isOriginAllowed = (origin) => {
    if (!origin) return !state.config.strictMode;

    // Exact match
    if (state.config.allowedOrigins.includes(origin)) {
      return true;
    }

    // Wildcard support (if configured)
    if (state.config.allowedOrigins.includes('*')) {
      return true;
    }

    // Pattern matching for development (localhost with any port)
    if (state.config.allowedOrigins.some(allowed => {
      if (allowed.includes('localhost') && origin.includes('localhost')) {
        return true;
      }
      if (allowed.includes('127.0.0.1') && origin.includes('127.0.0.1')) {
        return true;
      }
      return false;
    })) {
      return true;
    }

    return false;
  };

  /**
   * Create CORS headers for response
   * @param {Request} request - HTTP request
   * @param {string} overrideOrigin - Optional origin override
   * @returns {Object} CORS headers
   */
  const createCORSHeaders = (request, overrideOrigin = null) => {
    const origin = overrideOrigin || request.headers.get('origin');
    const method = request.method;
    
    // Update statistics
    state.stats.totalRequests++;
    state.stats.requestsByMethod.set(method, (state.stats.requestsByMethod.get(method) || 0) + 1);

    if (method === 'OPTIONS') {
      state.stats.preflightRequests++;
    }

    // Determine allowed origin
    let allowedOrigin = 'null';
    if (origin && isOriginAllowed(origin)) {
      allowedOrigin = origin;
      state.stats.allowedOrigins.set(origin, (state.stats.allowedOrigins.get(origin) || 0) + 1);
    } else if (origin && state.config.strictMode) {
      state.stats.blockedRequests++;
      if (state.config.logRequests) {
        console.warn(`🚫 CORS: Blocked request from origin: ${origin}`);
      }
    }

    // Build headers
    const headers = {
      'Access-Control-Allow-Origin': allowedOrigin,
      'Access-Control-Allow-Methods': state.config.allowedMethods.join(', '),
      'Access-Control-Allow-Headers': state.config.allowedHeaders.join(', '),
      'Access-Control-Allow-Credentials': state.config.allowCredentials.toString(),
      'Access-Control-Max-Age': state.config.maxAge.toString()
    };

    // Add expose headers if configured
    if (state.config.exposeHeaders.length > 0) {
      headers['Access-Control-Expose-Headers'] = state.config.exposeHeaders.join(', ');
    }

    // Security headers
    headers['X-Content-Type-Options'] = 'nosniff';
    headers['X-Frame-Options'] = 'DENY';
    headers['X-XSS-Protection'] = '1; mode=block';

    // Log if enabled
    if (state.config.logRequests) {
      console.log(`🌐 CORS: ${method} request from ${origin || 'no-origin'} -> ${allowedOrigin}`);
    }

    return headers;
  };

  /**
   * Handle preflight OPTIONS request
   * @param {Request} request - HTTP request
   * @returns {Response} Preflight response
   */
  const handlePreflight = (request) => {
    const headers = createCORSHeaders(request);
    
    // Check if the requested method is allowed
    const requestedMethod = request.headers.get('access-control-request-method');
    if (requestedMethod && !state.config.allowedMethods.includes(requestedMethod)) {
      headers['Access-Control-Allow-Origin'] = 'null';
      state.stats.blockedRequests++;
      
      if (state.config.logRequests) {
        console.warn(`🚫 CORS: Blocked preflight for method: ${requestedMethod}`);
      }
    }

    // Check if the requested headers are allowed
    const requestedHeaders = request.headers.get('access-control-request-headers');
    if (requestedHeaders) {
      const requestedHeadersList = requestedHeaders.split(',').map(h => h.trim().toLowerCase());
      const allowedHeadersLower = state.config.allowedHeaders.map(h => h.toLowerCase());
      
      const unauthorizedHeaders = requestedHeadersList.filter(h => !allowedHeadersLower.includes(h));
      if (unauthorizedHeaders.length > 0) {
        headers['Access-Control-Allow-Origin'] = 'null';
        state.stats.blockedRequests++;
        
        if (state.config.logRequests) {
          console.warn(`🚫 CORS: Blocked preflight for headers: ${unauthorizedHeaders.join(', ')}`);
        }
      }
    }

    return new Response(null, {
      status: 204,
      headers
    });
  };

  /**
   * Apply CORS headers to existing response
   * @param {Response} response - Original response
   * @param {Request} request - Original request
   * @returns {Response} Response with CORS headers
   */
  const applyCORSHeaders = (response, request) => {
    const corsHeaders = createCORSHeaders(request);
    const newHeaders = new Headers(response.headers);
    
    // Add CORS headers
    Object.entries(corsHeaders).forEach(([key, value]) => {
      newHeaders.set(key, value);
    });

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders
    });
  };

  /**
   * Middleware function for request processing
   * @param {Request} request - HTTP request
   * @param {Function} next - Next middleware function
   * @returns {Response} Response with CORS handling
   */
  const corsMiddleware = async (request, next) => {
    // Handle preflight requests
    if (request.method === 'OPTIONS') {
      return handlePreflight(request);
    }

    // Process request through next middleware/handler
    const response = await next(request);
    
    // Apply CORS headers to response
    return applyCORSHeaders(response, request);
  };

  /**
   * Update CORS configuration
   * @param {Object} updates - Configuration updates
   */
  const updateConfig = (updates) => {
    state.config = { ...state.config, ...updates };
    console.log('🔧 CORS configuration updated');
  };

  /**
   * Add allowed origin
   * @param {string} origin - Origin to allow
   */
  const addAllowedOrigin = (origin) => {
    if (!state.config.allowedOrigins.includes(origin)) {
      state.config.allowedOrigins.push(origin);
      console.log(`✅ CORS: Added allowed origin: ${origin}`);
    }
  };

  /**
   * Remove allowed origin
   * @param {string} origin - Origin to remove
   */
  const removeAllowedOrigin = (origin) => {
    const index = state.config.allowedOrigins.indexOf(origin);
    if (index > -1) {
      state.config.allowedOrigins.splice(index, 1);
      console.log(`❌ CORS: Removed allowed origin: ${origin}`);
    }
  };

  /**
   * Get CORS statistics
   * @returns {Object} CORS statistics
   */
  const getStatistics = () => {
    return {
      totalRequests: state.stats.totalRequests,
      preflightRequests: state.stats.preflightRequests,
      blockedRequests: state.stats.blockedRequests,
      blockRate: state.stats.totalRequests > 0 
        ? state.stats.blockedRequests / state.stats.totalRequests 
        : 0,
      allowedOrigins: Array.from(state.stats.allowedOrigins.entries()),
      requestsByMethod: Array.from(state.stats.requestsByMethod.entries()),
      topOrigins: Array.from(state.stats.allowedOrigins.entries())
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10),
      timestamp: Date.now()
    };
  };

  /**
   * Reset statistics
   */
  const resetStatistics = () => {
    state.stats = {
      totalRequests: 0,
      preflightRequests: 0,
      blockedRequests: 0,
      allowedOrigins: new Map(),
      requestsByMethod: new Map()
    };
    console.log('📊 CORS statistics reset');
  };

  /**
   * Get health status
   * @returns {Object} Health information
   */
  const getHealthStatus = () => {
    const stats = getStatistics();
    const isHealthy = stats.blockRate < 0.1; // Less than 10% blocked

    return {
      status: isHealthy ? 'healthy' : 'warning',
      blockRate: Math.round(stats.blockRate * 100),
      totalRequests: stats.totalRequests,
      issues: isHealthy ? [] : ['High block rate - check allowed origins']
    };
  };

  return {
    // Core middleware function
    corsMiddleware,
    
    // Header utilities
    createCORSHeaders,
    applyCORSHeaders,
    handlePreflight,
    
    // Configuration management
    updateConfig,
    addAllowedOrigin,
    removeAllowedOrigin,
    
    // Monitoring
    getStatistics,
    resetStatistics,
    getHealthStatus,
    
    // Utilities
    isOriginAllowed,
    getConfig: () => ({ ...state.config }),
    
    // Direct access for legacy compatibility
    createHeaders: createCORSHeaders
  };
};