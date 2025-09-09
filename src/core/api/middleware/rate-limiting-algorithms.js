/**
 * Rate limiting algorithms for different strategies
 */

/**
 * Fixed window rate limiting algorithm
 * @param {Map} storage - Storage for fixed window data
 * @param {string} key - Client identifier
 * @param {Object} routeConfig - Route-specific config
 * @returns {Object} Rate limit result
 */
export const checkFixedWindow = (storage, key, routeConfig) => {
  const now = Date.now();
  const windowStart = Math.floor(now / routeConfig.windowMs) * routeConfig.windowMs;
  const resetTime = windowStart + routeConfig.windowMs;
  
  if (!storage.has(key)) {
    storage.set(key, { count: 0, resetTime });
  }
  
  const record = storage.get(key);
  
  // Reset if window has passed
  if (now >= record.resetTime) {
    record.count = 0;
    record.resetTime = resetTime;
  }
  
  const allowed = record.count < routeConfig.maxRequests;
  const remaining = Math.max(0, routeConfig.maxRequests - record.count - (allowed ? 1 : 0));
  
  if (allowed) {
    record.count++;
  }
  
  return {
    allowed,
    limit: routeConfig.maxRequests,
    remaining,
    resetTime,
    retryAfter: Math.ceil((resetTime - now) / 1000)
  };
};

/**
 * Sliding window rate limiting algorithm
 * @param {Map} storage - Storage for sliding window data
 * @param {string} key - Client identifier
 * @param {Object} routeConfig - Route-specific config
 * @returns {Object} Rate limit result
 */
export const checkSlidingWindow = (storage, key, routeConfig) => {
  const now = Date.now();
  const windowStart = now - routeConfig.windowMs;
  
  if (!storage.has(key)) {
    storage.set(key, { requests: [] });
  }
  
  const record = storage.get(key);
  
  // Remove old requests outside the window
  record.requests = record.requests.filter(timestamp => timestamp > windowStart);
  
  const currentRequests = record.requests.length;
  const allowed = currentRequests < routeConfig.maxRequests;
  
  if (allowed) {
    record.requests.push(now);
  }
  
  // Calculate when the oldest request will expire
  const oldestRequest = record.requests[0] || now;
  const resetTime = oldestRequest + routeConfig.windowMs;
  const retryAfter = Math.ceil((resetTime - now) / 1000);
  
  return {
    allowed,
    limit: routeConfig.maxRequests,
    remaining: Math.max(0, routeConfig.maxRequests - currentRequests - (allowed ? 1 : 0)),
    resetTime,
    retryAfter: Math.max(1, retryAfter)
  };
};

/**
 * Token bucket rate limiting algorithm
 * @param {Map} storage - Storage for token bucket data
 * @param {string} key - Client identifier
 * @param {Object} routeConfig - Route-specific config
 * @returns {Object} Rate limit result
 */
export const checkTokenBucket = (storage, key, routeConfig) => {
  const now = Date.now();
  const refillRate = routeConfig.maxRequests / (routeConfig.windowMs / 1000); // tokens per second
  const bucketSize = routeConfig.maxRequests + Math.floor(routeConfig.maxRequests * routeConfig.burstAllowance);
  
  if (!storage.has(key)) {
    storage.set(key, { 
      tokens: bucketSize, 
      lastRefill: now 
    });
  }
  
  const bucket = storage.get(key);
  
  // Refill tokens based on time passed
  const timePassed = (now - bucket.lastRefill) / 1000;
  const tokensToAdd = timePassed * refillRate;
  bucket.tokens = Math.min(bucketSize, bucket.tokens + tokensToAdd);
  bucket.lastRefill = now;
  
  const allowed = bucket.tokens >= 1;
  
  if (allowed) {
    bucket.tokens -= 1;
  }
  
  // Calculate retry after based on when next token will be available
  const retryAfter = allowed ? 0 : Math.ceil((1 - bucket.tokens) / refillRate);
  
  return {
    allowed,
    limit: routeConfig.maxRequests,
    remaining: Math.floor(bucket.tokens),
    resetTime: now + (routeConfig.windowMs * (1 - bucket.tokens / bucketSize)),
    retryAfter
  };
};
