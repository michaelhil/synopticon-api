/**
 * URL Validator Utility
 * Security-focused URL validation for API endpoints
 * Following functional programming patterns with factory functions
 */

// Create URL validator factory
export const createUrlValidator = (config = {}) => {
  const state = {
    allowedProtocols: config.allowedProtocols || ['http:', 'https:'],
    allowedHosts: config.allowedHosts || ['localhost', '127.0.0.1', '::1'],
    allowedPorts: config.allowedPorts || [3000, 3001, 8080, 8081, 11434],
    blockPrivateIPs: config.blockPrivateIPs !== false,
    blockLocalhost: config.blockLocalhost || false,
    maxUrlLength: config.maxUrlLength || 2048
  };

  // Check if IP is private
  const isPrivateIP = (ip) => {
    const parts = ip.split('.');
    if (parts.length !== 4) return false;
    
    const first = parseInt(parts[0]);
    const second = parseInt(parts[1]);
    
    // Check for private IP ranges
    return (
      first === 10 || // 10.0.0.0 - 10.255.255.255
      (first === 172 && second >= 16 && second <= 31) || // 172.16.0.0 - 172.31.255.255
      (first === 192 && second === 168) || // 192.168.0.0 - 192.168.255.255
      first === 127 // 127.0.0.0 - 127.255.255.255 (loopback)
    );
  };

  // Check if hostname is localhost variant
  const isLocalhost = (hostname) => {
    const localhostVariants = [
      'localhost',
      '127.0.0.1',
      '::1',
      '0.0.0.0',
      'local'
    ];
    
    return localhostVariants.includes(hostname.toLowerCase());
  };

  // Validate URL
  const validate = (urlString) => {
    // Check URL length
    if (urlString.length > state.maxUrlLength) {
      return {
        valid: false,
        error: `URL exceeds maximum length of ${state.maxUrlLength} characters`
      };
    }

    let url;
    try {
      url = new URL(urlString);
    } catch (error) {
      return {
        valid: false,
        error: 'Invalid URL format'
      };
    }

    // Check protocol
    if (!state.allowedProtocols.includes(url.protocol)) {
      return {
        valid: false,
        error: `Protocol '${url.protocol}' not allowed. Allowed: ${state.allowedProtocols.join(', ')}`
      };
    }

    // Check for localhost if blocking is enabled
    if (state.blockLocalhost && isLocalhost(url.hostname)) {
      return {
        valid: false,
        error: 'Localhost URLs are not allowed'
      };
    }

    // Check for private IPs if blocking is enabled
    if (state.blockPrivateIPs && isPrivateIP(url.hostname)) {
      return {
        valid: false,
        error: 'Private IP addresses are not allowed'
      };
    }

    // Check allowed hosts
    if (state.allowedHosts.length > 0) {
      const isAllowedHost = state.allowedHosts.some(host => {
        if (host.startsWith('*.')) {
          // Wildcard subdomain matching
          const domain = host.slice(2);
          return url.hostname === domain || url.hostname.endsWith('.' + domain);
        }
        return url.hostname === host;
      });

      if (!isAllowedHost) {
        return {
          valid: false,
          error: `Host '${url.hostname}' not in allowed list`
        };
      }
    }

    // Check port
    const port = url.port || (url.protocol === 'https:' ? 443 : 80);
    if (state.allowedPorts.length > 0 && !state.allowedPorts.includes(parseInt(port))) {
      return {
        valid: false,
        error: `Port ${port} not allowed. Allowed ports: ${state.allowedPorts.join(', ')}`
      };
    }

    // Check for suspicious patterns (more refined)
    const suspiciousPatterns = [
      /\.\.[\\/]/,     // Path traversal attempts (more specific)
      /%00/,           // Null byte injection
      /<script/i,      // XSS attempts
      /javascript:/i,  // JavaScript protocol
      /data:/i,        // Data protocol
      /file:/i,        // File protocol
      /vbscript:/i,    // VBScript protocol
      /about:/i,       // About protocol
      /jar:/i,         // JAR protocol
      /%2e%2e/i,       // URL-encoded path traversal
      /\x00-\x1f/,     // Control characters
      /[\u202e\u202d]/  // Unicode direction override attacks
    ];

    for (const pattern of suspiciousPatterns) {
      if (pattern.test(urlString)) {
        return {
          valid: false,
          error: 'URL contains suspicious patterns'
        };
      }
    }

    return {
      valid: true,
      url: url.toString(),
      protocol: url.protocol,
      hostname: url.hostname,
      port: port,
      pathname: url.pathname
    };
  };

  // Sanitize URL (remove dangerous parts)
  const sanitize = (urlString) => {
    const validation = validate(urlString);
    
    if (!validation.valid) {
      return null;
    }

    try {
      const url = new URL(urlString);
      
      // Remove hash and search params for safety
      url.hash = '';
      url.search = '';
      
      // Normalize path
      url.pathname = url.pathname.replace(/\/+/g, '/');
      
      return url.toString();
    } catch (error) {
      return null;
    }
  };

  // Update configuration
  const updateConfig = (newConfig) => {
    Object.assign(state, newConfig);
  };

  // Add allowed host
  const addAllowedHost = (host) => {
    if (!state.allowedHosts.includes(host)) {
      state.allowedHosts.push(host);
    }
  };

  // Remove allowed host
  const removeAllowedHost = (host) => {
    const index = state.allowedHosts.indexOf(host);
    if (index !== -1) {
      state.allowedHosts.splice(index, 1);
    }
  };

  return {
    validate,
    sanitize,
    updateConfig,
    addAllowedHost,
    removeAllowedHost,
    getConfig: () => ({ ...state }),
    isPrivateIP,
    isLocalhost
  };
};

// Create default validators for common use cases

// Development validator (allows localhost and common dev patterns)
export const createDevValidator = () => createUrlValidator({
  allowedHosts: ['localhost', '127.0.0.1', '::1', '*.local', '*.localhost'],
  allowedPorts: [3000, 3001, 3002, 8000, 8080, 8081, 8443, 5000, 5001, 9000, 11434, 80, 443],
  blockLocalhost: false,
  blockPrivateIPs: false,
  maxUrlLength: 4096 // More lenient for development
});

// Production validator (strict)
export const createProdValidator = () => createUrlValidator({
  allowedHosts: [], // Must be configured
  blockLocalhost: true,
  blockPrivateIPs: true,
  allowedProtocols: ['https:']
});

// API validator (for backend services)
export const createApiValidator = () => createUrlValidator({
  allowedHosts: ['localhost', '127.0.0.1', 'api.openai.com', 'api.anthropic.com'],
  allowedPorts: [3000, 3001, 8080, 11434, 443, 80],
  blockPrivateIPs: false,
  blockLocalhost: false
});

// Export default configuration
export const DEFAULT_VALIDATOR_CONFIG = {
  allowedProtocols: ['http:', 'https:'],
  allowedHosts: ['localhost', '127.0.0.1'],
  allowedPorts: [3000, 3001, 8080, 443, 80],
  blockPrivateIPs: false,
  blockLocalhost: false,
  maxUrlLength: 2048
};