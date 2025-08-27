/**
 * API Middleware Type Definitions
 * Comprehensive TypeScript interfaces for API middleware system
 */

// Base middleware types
export type MiddlewareType = 'cors' | 'rateLimiting' | 'errorHandler' | 'authentication' | 'logging';

// HTTP method types
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'OPTIONS' | 'HEAD';

// Request handler types
export type RequestHandler = (request: Request, ...args: any[]) => Promise<Response> | Response;
export type MiddlewareHandler = (request: Request, next: RequestHandler) => Promise<Response> | Response;

// CORS configuration
export interface CORSConfig {
  allowedOrigins?: string[];
  allowedMethods?: HttpMethod[];
  allowedHeaders?: string[];
  exposedHeaders?: string[];
  allowCredentials?: boolean;
  maxAge?: number;
  logRequests?: boolean;
  preflightContinue?: boolean;
  optionsSuccessStatus?: number;
}

// Rate limiting configuration
export interface RateLimitConfig {
  windowMs?: number;
  maxRequests?: number;
  algorithm?: 'fixed-window' | 'sliding-window' | 'token-bucket' | 'leaky-bucket';
  keyGenerator?: (request: Request) => string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  resetOnSuccess?: boolean;
  message?: string;
  statusCode?: number;
  headers?: Record<string, string>;
}

// Error handler configuration
export interface ErrorHandlerConfig {
  enableDetailedErrors?: boolean;
  enableErrorLogging?: boolean;
  customErrorMessages?: Record<number, string>;
  logLevel?: 'error' | 'warn' | 'info' | 'debug';
  includeStackTrace?: boolean;
  sanitizeErrors?: boolean;
}

// Authentication configuration
export interface AuthConfig {
  type?: 'bearer' | 'basic' | 'api-key' | 'jwt';
  secret?: string;
  realm?: string;
  headerName?: string;
  queryParam?: string;
  validateToken?: (token: string) => Promise<boolean> | boolean;
  extractUser?: (token: string) => Promise<any> | any;
}

// Logging configuration
export interface LoggingConfig {
  enabled?: boolean;
  level?: 'error' | 'warn' | 'info' | 'debug';
  format?: 'json' | 'text' | 'combined';
  logRequests?: boolean;
  logResponses?: boolean;
  logHeaders?: boolean;
  logBody?: boolean;
  maxBodySize?: number;
}

// Combined middleware configuration
export interface MiddlewareConfig {
  cors?: CORSConfig;
  rateLimiting?: RateLimitConfig;
  errorHandler?: ErrorHandlerConfig;
  authentication?: AuthConfig;
  logging?: LoggingConfig;
}

// Statistics interfaces
export interface CORSStatistics {
  totalRequests: number;
  allowedRequests: number;
  blockedRequests: number;
  preflightRequests: number;
  requestsByOrigin: Record<string, number>;
  requestsByMethod: Record<string, number>;
}

export interface RateLimitStatistics {
  totalRequests: number;
  allowedRequests: number;
  blockedRequests: number;
  activeClients: number;
  resetCount: number;
  requestsByAlgorithm: Record<string, number>;
  averageProcessingTime: number;
}

export interface ErrorHandlerStatistics {
  totalErrors: number;
  errorsByStatus: Record<number, number>;
  errorsByType: Record<string, number>;
  handledErrors: number;
  unhandledErrors: number;
}

export interface AuthStatistics {
  totalAttempts: number;
  successfulAttempts: number;
  failedAttempts: number;
  tokenValidations: number;
  unauthorizedRequests: number;
}

export interface LoggingStatistics {
  totalLogs: number;
  logsByLevel: Record<string, number>;
  requestsLogged: number;
  responsesLogged: number;
  logSize: number;
}

// Combined statistics
export interface MiddlewareStatistics {
  cors?: CORSStatistics;
  rateLimiting?: RateLimitStatistics;
  errorHandling?: ErrorHandlerStatistics;
  authentication?: AuthStatistics;
  logging?: LoggingStatistics;
  timestamp: number;
}

// Health status interfaces
export interface ComponentHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  uptime?: number;
  lastCheck?: number;
  issues?: string[];
  metrics?: Record<string, any>;
}

export interface MiddlewareHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  components: {
    cors?: ComponentHealth;
    rateLimiting?: ComponentHealth;
    errorHandling?: ComponentHealth;
    authentication?: ComponentHealth;
    logging?: ComponentHealth;
  };
  issues: string[];
  timestamp: number;
}

// Rate limit client information
export interface RateLimitClient {
  key: string;
  requests: number;
  resetTime: number;
  windowStart: number;
  blocked: boolean;
  lastRequest: number;
}

// Route-specific rate limits
export interface RouteRateLimit {
  pattern: RegExp | string;
  config: RateLimitConfig;
  priority?: number;
}

// Error context
export interface ErrorContext {
  request: Request;
  timestamp: number;
  userAgent?: string;
  ip?: string;
  path: string;
  method: string;
  headers: Record<string, string>;
  params?: any;
  body?: any;
}

// Custom error types
export interface MiddlewareError extends Error {
  status: number;
  code?: string;
  context?: ErrorContext;
  details?: any;
}

// Middleware interfaces
export interface CORSMiddleware {
  corsMiddleware: MiddlewareHandler;
  updateConfig: (config: Partial<CORSConfig>) => void;
  addAllowedOrigin: (origin: string) => void;
  removeAllowedOrigin: (origin: string) => void;
  getStatistics: () => CORSStatistics;
  getHealthStatus: () => ComponentHealth;
  resetStatistics: () => void;
}

export interface RateLimitMiddleware {
  rateLimitMiddleware: MiddlewareHandler;
  updateConfig: (config: Partial<RateLimitConfig>) => void;
  addRouteLimit: (pattern: string | RegExp, config: RateLimitConfig) => void;
  removeRouteLimit: (pattern: string | RegExp) => void;
  resetClient: (clientKey: string) => void;
  getClient: (clientKey: string) => RateLimitClient | null;
  getStatistics: () => RateLimitStatistics;
  getHealthStatus: () => ComponentHealth;
  destroy: () => void;
}

export interface ErrorHandlerMiddleware {
  handleError: (error: Error | MiddlewareError, request?: Request) => Response;
  createError: (message: string, status?: number, code?: string) => MiddlewareError;
  updateConfig: (config: Partial<ErrorHandlerConfig>) => void;
  getStatistics: () => ErrorHandlerStatistics;
  getHealthStatus: () => ComponentHealth;
  resetStatistics: () => void;
}

export interface AuthMiddleware {
  authMiddleware: MiddlewareHandler;
  updateConfig: (config: Partial<AuthConfig>) => void;
  validateToken: (token: string) => Promise<boolean>;
  extractUser: (request: Request) => Promise<any> | any;
  getStatistics: () => AuthStatistics;
  getHealthStatus: () => ComponentHealth;
  resetStatistics: () => void;
}

export interface LoggingMiddleware {
  loggingMiddleware: MiddlewareHandler;
  updateConfig: (config: Partial<LoggingConfig>) => void;
  log: (level: string, message: string, context?: any) => void;
  getStatistics: () => LoggingStatistics;
  getHealthStatus: () => ComponentHealth;
  resetStatistics: () => void;
}

// Main middleware system interface
export interface MiddlewareSystem {
  // Core middleware processing
  processRequest: (request: Request, handler: RequestHandler) => Promise<Response>;
  withMiddleware: (handler: RequestHandler) => RequestHandler;
  
  // Individual middleware access
  cors?: CORSMiddleware;
  errorHandler: ErrorHandlerMiddleware;
  rateLimiter?: RateLimitMiddleware;
  auth?: AuthMiddleware;
  logging?: LoggingMiddleware;
  
  // Management functions
  getStatistics: () => MiddlewareStatistics;
  getHealthStatus: () => MiddlewareHealth;
  updateMiddlewareConfig: (middleware: MiddlewareType, updates: any) => void;
  addAllowedOrigin?: (origin: string) => void;
  addRouteRateLimit?: (pattern: string, limits: RateLimitConfig) => void;
  resetClientRateLimit?: (clientKey: string) => void;
  cleanup: () => void;
  
  // Utility functions for common error responses
  createError: (message: string, status?: number, code?: string) => MiddlewareError;
  
  // Direct middleware functions (for legacy compatibility)
  handleCORS?: MiddlewareHandler;
  handleError: (error: Error | MiddlewareError, request?: Request) => Response;
  handleRateLimit?: MiddlewareHandler;
}

// Factory function types
export type CORSMiddlewareFactory = (config?: CORSConfig) => CORSMiddleware;
export type RateLimitMiddlewareFactory = (config?: RateLimitConfig) => RateLimitMiddleware;
export type ErrorHandlerMiddlewareFactory = (config?: ErrorHandlerConfig) => ErrorHandlerMiddleware;
export type AuthMiddlewareFactory = (config?: AuthConfig) => AuthMiddleware;
export type LoggingMiddlewareFactory = (config?: LoggingConfig) => LoggingMiddleware;
export type MiddlewareSystemFactory = (config?: MiddlewareConfig) => MiddlewareSystem;

// Middleware pipeline types
export interface MiddlewarePipeline {
  middlewares: MiddlewareHandler[];
  execute: (request: Request, finalHandler: RequestHandler) => Promise<Response>;
  add: (middleware: MiddlewareHandler) => void;
  remove: (middleware: MiddlewareHandler) => void;
  clear: () => void;
}

// Request context for middleware
export interface RequestContext {
  startTime: number;
  requestId: string;
  clientIp: string;
  userAgent: string;
  path: string;
  method: string;
  headers: Record<string, string>;
  query: Record<string, string>;
  params: Record<string, string>;
  metadata: Record<string, any>;
}

// Response context for middleware
export interface ResponseContext {
  status: number;
  headers: Record<string, string>;
  body?: any;
  size: number;
  duration: number;
  cached?: boolean;
}

// Middleware execution result
export interface MiddlewareResult {
  success: boolean;
  response?: Response;
  error?: MiddlewareError;
  context?: RequestContext;
  duration: number;
}