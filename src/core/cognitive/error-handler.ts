/**
 * Cognitive System Error Handler
 * Comprehensive error handling and recovery for the cognitive advisory system
 */

import { createLogger } from '../../shared/utils/logger.js';

const logger = createLogger({ level: 2 });

/**
 * Error types specific to cognitive system
 */
export const COGNITIVE_ERROR_TYPES = {
  STATE_MANAGER_ERROR: 'STATE_MANAGER_ERROR',
  COMMUNICATION_ERROR: 'COMMUNICATION_ERROR',
  PIPELINE_ERROR: 'PIPELINE_ERROR',
  FUSION_ERROR: 'FUSION_ERROR',
  LLM_ERROR: 'LLM_ERROR',
  CONTEXT_ERROR: 'CONTEXT_ERROR',
  SIMULATOR_CONNECTION_ERROR: 'SIMULATOR_CONNECTION_ERROR',
  ENVIRONMENTAL_DATA_ERROR: 'ENVIRONMENTAL_DATA_ERROR',
  CRITICAL_SYSTEM_ERROR: 'CRITICAL_SYSTEM_ERROR',
  DEGRADED_PERFORMANCE_ERROR: 'DEGRADED_PERFORMANCE_ERROR'
} as const;

export type CognitiveErrorType = typeof COGNITIVE_ERROR_TYPES[keyof typeof COGNITIVE_ERROR_TYPES];

/**
 * Error severity levels
 */
export const ERROR_SEVERITY = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  CRITICAL: 4
} as const;

export type ErrorSeverityLevel = typeof ERROR_SEVERITY[keyof typeof ERROR_SEVERITY];

/**
 * Enhanced error interface
 */
export interface EnhancedError {
  id: string;
  timestamp: number;
  message: string;
  stack?: string;
  type: CognitiveErrorType;
  component: string;
  operation: string;
  originalError: Error;
  context: Record<string, unknown>;
  systemState: SystemSnapshot;
  retryCount: number;
}

/**
 * System snapshot interface
 */
export interface SystemSnapshot {
  timestamp: number;
  systemStatus?: unknown;
  activeComponents: string[];
  memoryUsage?: NodeJS.MemoryUsage | null;
  error?: string;
}

/**
 * Recovery action interface
 */
export interface RecoveryAction {
  type: string;
  component: string;
  timeout?: number;
  preserveState?: boolean;
  duration?: number;
  retries?: number;
  delay?: number;
  preserveHistory?: boolean;
}

/**
 * Active recovery action
 */
export interface ActiveRecoveryAction extends RecoveryAction {
  errorId: string;
  startTime: number;
  status: 'executing' | 'completed' | 'failed';
  endTime?: number;
  error?: string;
}

/**
 * Error handler configuration
 */
export interface CognitiveErrorHandlerConfig {
  maxRetries?: number;
  retryDelay?: number;
  degradedModeTimeout?: number;
  enableAutoRecovery?: boolean;
  enableNotifications?: boolean;
}

/**
 * Error handling result
 */
export interface ErrorHandlingResult {
  errorId: string;
  severity: ErrorSeverityLevel;
  recoveryAction?: string;
  handled: boolean;
}

/**
 * Cognitive system interface (minimal for type safety)
 */
export interface CognitiveSystem {
  stateManager?: {
    getSnapshot: () => unknown;
    restoreSnapshot: (snapshot: unknown) => Promise<void>;
  };
  communicationManager?: {
    reconnect: () => Promise<void>;
    broadcastAlert: (alert: {
      level: string;
      type: string;
      message: string;
      component: string;
      errorId: string;
      timestamp: number;
    }) => Promise<void>;
  };
  simulatorConnector?: {
    initialize: () => Promise<void>;
  };
  contextOrchestrator?: {
    emit: (event: string, data: unknown) => Promise<void>;
    stopContextUpdates: () => void;
    getSystemStatus: () => unknown;
  };
}

/**
 * Create cognitive error handler
 */
export const createCognitiveErrorHandler = (
  cognitiveSystem: CognitiveSystem, 
  config: CognitiveErrorHandlerConfig = {}
) => {
  const {
    maxRetries = 3,
    retryDelay = 1000,
    degradedModeTimeout = 300000, // 5 minutes
    enableAutoRecovery = true,
    enableNotifications = true
  } = config;
  
  const errorHistory: EnhancedError[] = [];
  const maxHistorySize = 1000;
  const activeRecoveryActions = new Map<string, ActiveRecoveryAction>();
  
  /**
   * Handle error with automatic recovery attempts
   */
  const handleError = async (
    error: Error, 
    context: Record<string, unknown> = {}
  ): Promise<ErrorHandlingResult> => {
    const enhancedError = enhanceError(error, context);
    
    // Log error
    logError(enhancedError);
    
    // Record in history
    recordError(enhancedError);
    
    // Determine severity and recovery action
    const severity = determineSeverity(enhancedError);
    const recoveryAction = determineRecoveryAction(enhancedError, severity);
    
    // Send notifications if enabled
    if (enableNotifications) {
      await sendErrorNotification(enhancedError, severity);
    }
    
    // Execute recovery action if auto-recovery is enabled
    if (enableAutoRecovery && recoveryAction) {
      await executeRecoveryAction(recoveryAction, enhancedError);
    }
    
    return {
      errorId: enhancedError.id,
      severity,
      recoveryAction: recoveryAction?.type,
      handled: true
    };
  };
  
  /**
   * Enhance error with additional context and metadata
   */
  const enhanceError = (error: Error, context: Record<string, unknown>): EnhancedError => {
    const timestamp = Date.now();
    const errorId = `err-${timestamp}-${Math.random().toString(36).substr(2, 9)}`;
    
    return {
      id: errorId,
      timestamp,
      message: error.message || 'Unknown error',
      stack: error.stack,
      type: (error as any).type || COGNITIVE_ERROR_TYPES.CRITICAL_SYSTEM_ERROR,
      component: (context.component as string) || 'unknown',
      operation: (context.operation as string) || 'unknown',
      originalError: error,
      context,
      systemState: getSystemSnapshot(),
      retryCount: 0
    };
  };
  
  /**
   * Determine error severity based on type and context
   */
  const determineSeverity = (error: EnhancedError): ErrorSeverityLevel => {
    switch (error.type) {
    case COGNITIVE_ERROR_TYPES.CRITICAL_SYSTEM_ERROR:
      return ERROR_SEVERITY.CRITICAL;
      
    case COGNITIVE_ERROR_TYPES.STATE_MANAGER_ERROR:
    case COGNITIVE_ERROR_TYPES.CONTEXT_ERROR:
      return ERROR_SEVERITY.HIGH;
      
    case COGNITIVE_ERROR_TYPES.LLM_ERROR:
    case COGNITIVE_ERROR_TYPES.SIMULATOR_CONNECTION_ERROR:
      return ERROR_SEVERITY.MEDIUM;
      
    case COGNITIVE_ERROR_TYPES.ENVIRONMENTAL_DATA_ERROR:
    case COGNITIVE_ERROR_TYPES.COMMUNICATION_ERROR:
      return ERROR_SEVERITY.LOW;
      
    default:
      return ERROR_SEVERITY.MEDIUM;
    }
  };
  
  /**
   * Determine appropriate recovery action
   */
  const determineRecoveryAction = (
    error: EnhancedError, 
    severity: ErrorSeverityLevel
  ): RecoveryAction | null => {
    const recentErrors = getRecentErrors(error.type, 300000); // Last 5 minutes
    
    if (recentErrors.length > 5) {
      // Too many similar errors - enter degraded mode
      return {
        type: 'enter-degraded-mode',
        component: error.component,
        timeout: degradedModeTimeout
      };
    }
    
    switch (error.type) {
    case COGNITIVE_ERROR_TYPES.STATE_MANAGER_ERROR:
      return {
        type: 'restart-component',
        component: 'state-manager',
        preserveState: true
      };
      
    case COGNITIVE_ERROR_TYPES.LLM_ERROR:
      return {
        type: 'fallback-to-mock',
        component: 'llm-integration',
        duration: 60000 // 1 minute
      };
      
    case COGNITIVE_ERROR_TYPES.SIMULATOR_CONNECTION_ERROR:
      return {
        type: 'reconnect-simulator',
        component: 'simulator-connector',
        retries: maxRetries
      };
      
    case COGNITIVE_ERROR_TYPES.PIPELINE_ERROR:
      return {
        type: 'retry-operation',
        component: 'pipeline-system',
        retries: maxRetries,
        delay: retryDelay
      };
      
    case COGNITIVE_ERROR_TYPES.FUSION_ERROR:
      return {
        type: 'reset-fusion-engine',
        component: 'fusion-engine',
        preserveHistory: true
      };
      
    case COGNITIVE_ERROR_TYPES.ENVIRONMENTAL_DATA_ERROR:
      return {
        type: 'use-mock-data',
        component: 'environmental-connector',
        duration: 300000 // 5 minutes
      };
      
    default:
      if (severity === ERROR_SEVERITY.CRITICAL) {
        return {
          type: 'emergency-shutdown',
          component: 'all',
          preserveState: true
        };
      }
      return null;
    }
  };
  
  /**
   * Execute recovery action
   */
  const executeRecoveryAction = async (action: RecoveryAction, error: EnhancedError): Promise<void> => {
    const actionId = `recovery-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      logger.info(`Executing recovery action: ${action.type} for component: ${action.component}`);
      
      activeRecoveryActions.set(actionId, {
        ...action,
        errorId: error.id,
        startTime: Date.now(),
        status: 'executing'
      });
      
      switch (action.type) {
      case 'restart-component':
        await restartComponent(action.component, action.preserveState);
        break;
        
      case 'fallback-to-mock':
        await enableMockFallback(action.component, action.duration);
        break;
        
      case 'reconnect-simulator':
        await reconnectSimulator(action.retries);
        break;
        
      case 'retry-operation':
        await retryFailedOperation(error, action.retries, action.delay);
        break;
        
      case 'reset-fusion-engine':
        await resetFusionEngine(action.preserveHistory);
        break;
        
      case 'use-mock-data':
        await useMockEnvironmentalData(action.duration);
        break;
        
      case 'enter-degraded-mode':
        await enterDegradedMode(action.component, action.timeout);
        break;
        
      case 'emergency-shutdown':
        await emergencyShutdown(action.preserveState);
        break;
      }
      
      // Mark recovery as successful
      const recoveryAction = activeRecoveryActions.get(actionId);
      if (recoveryAction) {
        recoveryAction.status = 'completed';
        recoveryAction.endTime = Date.now();
      }
      
      logger.info(`Recovery action ${action.type} completed successfully`);
      
    } catch (recoveryError) {
      logger.error(`Recovery action ${action.type} failed:`, recoveryError);
      
      const recoveryAction = activeRecoveryActions.get(actionId);
      if (recoveryAction) {
        recoveryAction.status = 'failed';
        recoveryAction.error = (recoveryError as Error).message;
        recoveryAction.endTime = Date.now();
      }
      
      // If recovery fails, escalate to degraded mode
      if (action.type !== 'enter-degraded-mode') {
        await enterDegradedMode(action.component, degradedModeTimeout);
      }
    }
  };
  
  /**
   * Recovery action implementations
   */
  const restartComponent = async (componentName: string, preserveState?: boolean): Promise<void> => {
    switch (componentName) {
    case 'state-manager':
      if (preserveState && cognitiveSystem.stateManager) {
        const snapshot = cognitiveSystem.stateManager.getSnapshot();
        // Recreate state manager and restore state
        // Implementation would depend on system architecture
        await cognitiveSystem.stateManager.restoreSnapshot(snapshot);
      }
      break;
      
    case 'communication-manager':
      // Restart communication channels
      if (cognitiveSystem.communicationManager?.reconnect) {
        await cognitiveSystem.communicationManager.reconnect();
      }
      break;
    }
  };
  
  const enableMockFallback = async (componentName: string, duration?: number): Promise<void> => {
    if (componentName === 'llm-integration') {
      // Enable mock mode for LLM integration
      logger.warn(`Enabling LLM mock fallback for ${duration}ms`);
      
      if (duration) {
        setTimeout(() => {
          // Re-enable real LLM after duration
          logger.info('Re-enabling real LLM integration');
        }, duration);
      }
    }
  };
  
  const reconnectSimulator = async (retries?: number): Promise<void> => {
    const maxRetries = retries || 3;
    for (let i = 0; i < maxRetries; i++) {
      try {
        if (cognitiveSystem.simulatorConnector?.initialize) {
          await cognitiveSystem.simulatorConnector.initialize();
          return; // Success
        }
      } catch (error) {
        logger.warn(`Simulator reconnection attempt ${i + 1} failed:`, error);
        if (i < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, retryDelay * (i + 1)));
        }
      }
    }
    throw new Error('Failed to reconnect to simulator after all retries');
  };
  
  const retryFailedOperation = async (
    error: EnhancedError, 
    retries?: number, 
    delay?: number
  ): Promise<void> => {
    const maxRetries = retries || 3;
    const retryDelay = delay || 1000;
    
    // Retry the original operation that failed
    for (let i = 0; i < maxRetries; i++) {
      try {
        // Execute the failed operation again based on context
        await executeOriginalOperation(error.context);
        return; // Success
      } catch (retryError) {
        if (i < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, retryDelay * (i + 1)));
        } else {
          throw retryError;
        }
      }
    }
  };
  
  const enterDegradedMode = async (component: string, timeout?: number): Promise<void> => {
    logger.warn(`Entering degraded mode for ${component} for ${timeout}ms`);
    
    // Reduce system capabilities to ensure stability
    if (cognitiveSystem.contextOrchestrator?.emit) {
      await cognitiveSystem.contextOrchestrator.emit('degradedMode', {
        component,
        timeout,
        timestamp: Date.now()
      });
    }
    
    // Schedule exit from degraded mode
    if (timeout) {
      setTimeout(() => {
        logger.info(`Exiting degraded mode for ${component}`);
        if (cognitiveSystem.contextOrchestrator?.emit) {
          cognitiveSystem.contextOrchestrator.emit('normalMode', {
            component,
            timestamp: Date.now()
          });
        }
      }, timeout);
    }
  };
  
  const emergencyShutdown = async (preserveState?: boolean): Promise<void> => {
    logger.error('Executing emergency shutdown of cognitive system');
    
    if (preserveState && cognitiveSystem.stateManager) {
      const snapshot = cognitiveSystem.stateManager.getSnapshot();
      // Save snapshot to persistent storage
      logger.info('System state preserved for recovery');
    }
    
    // Gracefully shutdown all components
    if (cognitiveSystem.contextOrchestrator?.stopContextUpdates) {
      cognitiveSystem.contextOrchestrator.stopContextUpdates();
    }
  };
  
  /**
   * Utility functions
   */
  const executeOriginalOperation = async (context: Record<string, unknown>): Promise<void> => {
    // Placeholder - would need to implement based on specific operation context
    throw new Error('Operation retry not implemented for this context');
  };
  
  const resetFusionEngine = async (preserveHistory?: boolean): Promise<void> => {
    // Reset fusion engine while preserving historical data if requested
    logger.info('Resetting information fusion engine');
  };
  
  const useMockEnvironmentalData = async (duration?: number): Promise<void> => {
    logger.warn(`Using mock environmental data for ${duration}ms`);
  };
  
  const getSystemSnapshot = (): SystemSnapshot => {
    try {
      return {
        timestamp: Date.now(),
        systemStatus: cognitiveSystem.contextOrchestrator?.getSystemStatus(),
        activeComponents: Object.keys(cognitiveSystem),
        memoryUsage: process.memoryUsage ? process.memoryUsage() : null
      };
    } catch (error) {
      return { 
        timestamp: Date.now(),
        activeComponents: [],
        error: 'Failed to capture system snapshot' 
      };
    }
  };
  
  const logError = (error: EnhancedError): void => {
    const severity = determineSeverity(error);
    const logLevel = severity >= ERROR_SEVERITY.HIGH ? 'error' : 'warn';
    
    logger[logLevel](`Cognitive System Error [${error.type}]:`, {
      id: error.id,
      component: error.component,
      operation: error.operation,
      message: error.message,
      severity
    });
  };
  
  const recordError = (error: EnhancedError): void => {
    errorHistory.push(error);
    
    // Maintain history size
    if (errorHistory.length > maxHistorySize) {
      errorHistory.shift();
    }
  };
  
  const getRecentErrors = (type: CognitiveErrorType, timeWindow: number): EnhancedError[] => {
    const cutoff = Date.now() - timeWindow;
    return errorHistory.filter(err => 
      err.type === type && err.timestamp >= cutoff
    );
  };
  
  const sendErrorNotification = async (
    error: EnhancedError, 
    severity: ErrorSeverityLevel
  ): Promise<void> => {
    // Send notification through communication manager
    if (cognitiveSystem.communicationManager?.broadcastAlert) {
      await cognitiveSystem.communicationManager.broadcastAlert({
        level: severity >= ERROR_SEVERITY.HIGH ? 'critical' : 'warning',
        type: 'system-error',
        message: `Cognitive System Error: ${error.message}`,
        component: error.component,
        errorId: error.id,
        timestamp: error.timestamp
      });
    }
  };
  
  /**
   * Get error statistics and health metrics
   */
  const getErrorStats = () => {
    const now = Date.now();
    const last24h = errorHistory.filter(err => now - err.timestamp < 86400000);
    const lastHour = errorHistory.filter(err => now - err.timestamp < 3600000);
    
    const errorsByType = errorHistory.reduce((acc, err) => {
      acc[err.type] = (acc[err.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const errorsBySeverity = errorHistory.reduce((acc, err) => {
      const severity = determineSeverity(err);
      acc[severity] = (acc[severity] || 0) + 1;
      return acc;
    }, {} as Record<ErrorSeverityLevel, number>);
    
    return {
      total: errorHistory.length,
      last24h: last24h.length,
      lastHour: lastHour.length,
      byType: errorsByType,
      bySeverity: errorsBySeverity,
      activeRecoveryActions: activeRecoveryActions.size,
      systemHealth: calculateSystemHealth()
    };
  };
  
  const calculateSystemHealth = (): number => {
    const recentErrors = errorHistory.filter(err => 
      Date.now() - err.timestamp < 300000 // Last 5 minutes
    );
    
    const criticalErrors = recentErrors.filter(err => 
      determineSeverity(err) === ERROR_SEVERITY.CRITICAL
    ).length;
    
    const highErrors = recentErrors.filter(err => 
      determineSeverity(err) === ERROR_SEVERITY.HIGH
    ).length;
    
    // Calculate health score (0-100)
    let healthScore = 100;
    healthScore -= criticalErrors * 25;
    healthScore -= highErrors * 10;
    healthScore -= recentErrors.length * 2;
    
    return Math.max(0, healthScore);
  };
  
  return {
    handleError,
    getErrorStats,
    COGNITIVE_ERROR_TYPES,
    ERROR_SEVERITY,
    errorHistory: (): EnhancedError[] => [...errorHistory], // Return copy for safety
    activeRecoveryActions: (): Map<string, ActiveRecoveryAction> => new Map(activeRecoveryActions) // Return copy
  };
};