/**
 * Secure URL Utilities
 * Replaces deprecated url.parse() with WHATWG URL API
 * Addresses CVE security concerns
 */

/**
 * Secure URL parsing using WHATWG URL API
 * @param {string} urlString - URL to parse
 * @param {string} baseURL - Base URL for relative URLs (optional)
 * @returns {Object} Parsed URL components
 */
export const parseURL = (urlString, baseURL = 'http://localhost') => {
  try {
    const url = new URL(urlString, baseURL);
    
    // Convert searchParams to query object (similar to url.parse behavior)
    const query = {};
    for (const [key, value] of url.searchParams.entries()) {
      if (query[key]) {
        // Handle multiple values for same key
        if (Array.isArray(query[key])) {
          query[key].push(value);
        } else {
          query[key] = [query[key], value];
        }
      } else {
        query[key] = value;
      }
    }
    
    return {
      pathname: url.pathname,
      query,
      search: url.search,
      searchParams: url.searchParams,
      hash: url.hash,
      hostname: url.hostname,
      port: url.port,
      protocol: url.protocol,
      href: url.href,
      origin: url.origin
    };
  } catch (error) {
    throw new Error(`Invalid URL: ${urlString} - ${error.message}`);
  }
};

/**
 * Parse request URL securely (for HTTP servers)
 * @param {string} reqUrl - Request URL from req.url
 * @param {boolean} parseQuery - Whether to parse query parameters
 * @returns {Object} Parsed URL components
 */
export const parseRequestURL = (reqUrl, parseQuery = false) => {
  try {
    // Handle relative URLs from HTTP requests
    const url = new URL(reqUrl, 'http://localhost');
    
    const result = {
      pathname: url.pathname,
      search: url.search,
      hash: url.hash
    };
    
    if (parseQuery) {
      const query = {};
      for (const [key, value] of url.searchParams.entries()) {
        if (query[key]) {
          if (Array.isArray(query[key])) {
            query[key].push(value);
          } else {
            query[key] = [query[key], value];
          }
        } else {
          query[key] = value;
        }
      }
      result.query = query;
    }
    
    return result;
  } catch {
    // Fallback for malformed URLs
    return {
      pathname: reqUrl.split('?')[0],
      search: reqUrl.includes('?') ? reqUrl.substring(reqUrl.indexOf('?')) : '',
      query: parseQuery ? {} : undefined,
      hash: ''
    };
  }
};

/**
 * Validate URL to prevent injection attacks
 * @param {string} urlString - URL to validate
 * @returns {boolean} Whether URL is safe
 */
export const isValidURL = (urlString) => {
  try {
    const url = new URL(urlString);
    
    // Check for dangerous protocols
    const dangerousProtocols = ['javascript:', 'data:', 'vbscript:', 'file:'];
    if (dangerousProtocols.includes(url.protocol.toLowerCase())) {
      return false;
    }
    
    // Check for suspicious characters
    const suspiciousChars = ['<', '>', '"', "'", '`'];
    if (suspiciousChars.some(char => url.href.includes(char))) {
      return false;
    }
    
    return true;
  } catch {
    return false;
  }
};

export default { parseURL, parseRequestURL, isValidURL };