/**
 * Configuration management for rate limiting
 */

export type RateLimitAlgorithm = 'fixed-window' | 'sliding-window' | 'token-bucket';

export interface RouteLimit {
  maxRequests?: number;
  windowMs?: number;
  message?: string;
  statusCode?: number;
}

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  algorithm: RateLimitAlgorithm;
  keyGenerator: (req: Request) => string;
  skipSuccessfulRequests: boolean;
  skipFailedRequests: boolean;
  skipList: string[];
  message: string;
  statusCode: number;
  headers: boolean;
  enableVariableWindow: boolean;
  burstAllowance: number;
  routeLimits: Map<string, RouteLimit>;
  enableMonitoring: boolean;
  logViolations: boolean;
}

export interface RateLimitConfigInput {
  windowMs?: number;
  maxRequests?: number;
  algorithm?: RateLimitAlgorithm;
  keyGenerator?: (req: Request) => string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  skipList?: string[];
  message?: string;
  statusCode?: number;
  headers?: boolean;
  enableVariableWindow?: boolean;
  burstAllowance?: number;
  routeLimits?: Map<string, RouteLimit>;
  enableMonitoring?: boolean;
  logViolations?: boolean;
  [key: string]: unknown;
}

export interface RateLimitManager {
  getRouteConfig: (pathname: string) => RateLimitConfig;
  addRouteLimit: (pattern: string, limits: RouteLimit) => void;
  updateConfig: (updates: Partial<RateLimitConfig>) => void;
  getConfig: () => RateLimitConfig;
}

export const createRateLimitConfig = (config: RateLimitConfigInput = {}): RateLimitManager => {
  const rateLimitConfig: RateLimitConfig = {
    // Global defaults
    windowMs: config.windowMs || 15 * 60 * 1000, // 15 minutes
    maxRequests: config.maxRequests || 100,
    algorithm: config.algorithm || 'sliding-window',
    keyGenerator: config.keyGenerator || ((req: Request): string => req.headers.get('x-forwarded-for') || 'anonymous'),
    
    // Skip conditions
    skipSuccessfulRequests: config.skipSuccessfulRequests || false,
    skipFailedRequests: config.skipFailedRequests || false,
    skipList: config.skipList || [], // IPs to skip
    
    // Response configuration
    message: config.message || 'Too Many Requests',
    statusCode: config.statusCode || 429,
    headers: config.headers !== false,
    
    // Advanced features
    enableVariableWindow: config.enableVariableWindow || false,
    burstAllowance: config.burstAllowance || 0.1, // 10% burst allowance
    
    // Route-specific limits
    routeLimits: config.routeLimits || new Map<string, RouteLimit>(),
    
    // Monitoring
    enableMonitoring: config.enableMonitoring !== false,
    logViolations: config.logViolations !== false,
    
    ...config
  };

  /**
   * Get rate limit configuration for specific route
   */
  const getRouteConfig = (pathname: string): RateLimitConfig => {
    // Check for exact match first
    if (rateLimitConfig.routeLimits.has(pathname)) {
      const routeOverrides = rateLimitConfig.routeLimits.get(pathname);
      return { ...rateLimitConfig, ...routeOverrides };
    }
    
    // Check for pattern matches
    for (const [pattern, routeConfig] of rateLimitConfig.routeLimits.entries()) {
      if (pattern.includes('*') || pattern.includes('/')) {
        const regex = new RegExp(pattern.replace(/\*/g, '.*'));
        if (regex.test(pathname)) {
          return { ...rateLimitConfig, ...routeConfig };
        }
      }
    }
    
    return rateLimitConfig;
  };

  /**
   * Add route-specific rate limit
   */
  const addRouteLimit = (pattern: string, limits: RouteLimit): void => {
    rateLimitConfig.routeLimits.set(pattern, limits);
    console.log(`🚦 Added route rate limit: ${pattern} -> ${limits.maxRequests}/${limits.windowMs}ms`);
  };

  /**
   * Update configuration
   */
  const updateConfig = (updates: Partial<RateLimitConfig>): void => {
    Object.assign(rateLimitConfig, updates);
    console.log('🔧 Rate limiting configuration updated');
  };

  return {
    getRouteConfig,
    addRouteLimit,
    updateConfig,
    getConfig: (): RateLimitConfig => ({ ...rateLimitConfig })
  };
};