/**
 * Error Boundary and Fallback System
 * Provides comprehensive error handling for demo page components
 */

// Error recovery strategies
export const RecoveryStrategy = {
  RETRY: 'retry',
  FALLBACK: 'fallback', 
  GRACEFUL_DEGRADATION: 'graceful_degradation',
  USER_INTERVENTION: 'user_intervention',
  RESTART: 'restart'
};

// Error severity levels
export const ErrorSeverity = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical'
};

// Create error boundary wrapper for components
export const createErrorBoundary = (config = {}) => {
  const state = {
    errorHistory: [],
    recoveryAttempts: new Map(),
    fallbackComponents: new Map(),
    errorHandlers: new Map(),
    maxRetries: config.maxRetries || 3,
    retryDelay: config.retryDelay || 1000,
    onError: config.onError || console.error
  };

  // Wrap a component with error boundary
  const wrapComponent = (componentFactory, options = {}) => {
    const componentName = options.name || 'UnnamedComponent';
    const recoveryStrategy = options.recoveryStrategy || RecoveryStrategy.RETRY;
    const fallbackFactory = options.fallback;
    const errorSeverity = options.severity || ErrorSeverity.MEDIUM;

    return async (config) => {
      try {
        const component = await componentFactory(config);
        return createProtectedComponent(component, {
          name: componentName,
          recoveryStrategy,
          fallbackFactory,
          errorSeverity,
          ...options
        });
      } catch (error) {
        return handleComponentCreationError(error, {
          name: componentName,
          fallbackFactory,
          config
        });
      }
    };
  };

  // Create protected component wrapper
  const createProtectedComponent = (component, options) => {
    const protectedMethods = {};
    
    // Wrap all component methods with error handling
    Object.keys(component).forEach(methodName => {
      if (typeof component[methodName] === 'function') {
        protectedMethods[methodName] = createProtectedMethod(
          component[methodName].bind(component),
          methodName,
          options
        );
      } else {
        protectedMethods[methodName] = component[methodName];
      }
    });

    // Add error boundary specific methods
    protectedMethods.getErrorHistory = () => state.errorHistory.filter(e => e.component === options.name);
    protectedMethods.clearErrors = () => {
      state.errorHistory = state.errorHistory.filter(e => e.component !== options.name);
      state.recoveryAttempts.delete(options.name);
    };
    protectedMethods.isHealthy = () => {
      const recentErrors = state.errorHistory
        .filter(e => e.component === options.name)
        .filter(e => Date.now() - e.timestamp < 60000); // Last minute
      return recentErrors.length === 0;
    };

    return protectedMethods;
  };

  // Create protected method wrapper
  const createProtectedMethod = (method, methodName, options) => {
    return async (...args) => {
      const startTime = Date.now();
      const attemptKey = `${options.name}:${methodName}`;
      
      try {
        const result = await method(...args);
        
        // Reset retry count on success
        state.recoveryAttempts.delete(attemptKey);
        
        return result;
      } catch (error) {
        return handleMethodError(error, {
          ...options,
          methodName,
          attemptKey,
          args,
          startTime,
          method
        });
      }
    };
  };

  // Handle method execution errors
  const handleMethodError = async (error, context) => {
    const errorRecord = {
      component: context.name,
      method: context.methodName,
      error: error.message,
      stack: error.stack,
      timestamp: Date.now(),
      severity: context.errorSeverity,
      args: context.args
    };

    state.errorHistory.push(errorRecord);
    state.onError(error, context);

    // Check retry attempts
    const currentAttempts = state.recoveryAttempts.get(context.attemptKey) || 0;
    
    if (currentAttempts < state.maxRetries && shouldRetry(error, context)) {
      return attemptRecovery(error, context, currentAttempts + 1);
    }

    // Apply fallback strategy
    return applyFallbackStrategy(error, context);
  };

  // Handle component creation errors
  const handleComponentCreationError = async (error, context) => {
    state.errorHistory.push({
      component: context.name,
      method: 'constructor',
      error: error.message,
      timestamp: Date.now(),
      severity: ErrorSeverity.HIGH
    });

    if (context.fallbackFactory) {
      console.warn(`Component ${context.name} failed to initialize, using fallback`);
      try {
        return await context.fallbackFactory(context.config);
      } catch (fallbackError) {
        console.error(`Fallback for ${context.name} also failed:`, fallbackError);
        return createNullComponent(context.name);
      }
    }

    return createNullComponent(context.name);
  };

  // Determine if error should trigger retry
  const shouldRetry = (error, context) => {
    // Don't retry certain error types
    const nonRetryableErrors = [
      'PermissionDeniedError',
      'NotSupportedError',
      'SecurityError',
      'InvalidAccessError'
    ];

    const errorName = error.name || error.constructor.name;
    if (nonRetryableErrors.includes(errorName)) {
      return false;
    }

    // Don't retry critical severity errors
    if (context.errorSeverity === ErrorSeverity.CRITICAL) {
      return false;
    }

    return true;
  };

  // Attempt error recovery
  const attemptRecovery = async (error, context, attemptNumber) => {
    state.recoveryAttempts.set(context.attemptKey, attemptNumber);
    
    const delay = state.retryDelay * Math.pow(2, attemptNumber - 1);
    console.log(`🔄 Retrying ${context.name}:${context.methodName} (attempt ${attemptNumber}) in ${delay}ms`);
    
    await new Promise(resolve => setTimeout(resolve, delay));
    
    // Try to re-execute the method
    try {
      return await context.method(...context.args);
    } catch (retryError) {
      // If we've exhausted retries, apply fallback
      const currentAttempts = state.recoveryAttempts.get(context.attemptKey) || 0;
      if (currentAttempts >= state.maxRetries) {
        return applyFallbackStrategy(retryError, context);
      } else {
        throw retryError;
      }
    }
  };

  // Apply fallback strategy based on configuration
  const applyFallbackStrategy = (error, context) => {
    switch (context.recoveryStrategy) {
      case RecoveryStrategy.FALLBACK:
        return applyFallbackComponent(error, context);
      
      case RecoveryStrategy.GRACEFUL_DEGRADATION:
        return applyGracefulDegradation(error, context);
      
      case RecoveryStrategy.USER_INTERVENTION:
        return requireUserIntervention(error, context);
      
      default:
        console.error(`${context.name}:${context.methodName} failed after ${state.maxRetries} attempts`);
        throw error;
    }
  };

  // Apply fallback component
  const applyFallbackComponent = (error, context) => {
    const fallbackKey = `${context.name}:${context.methodName}`;
    if (state.fallbackComponents.has(fallbackKey)) {
      console.log(`Using fallback for ${context.name}:${context.methodName}`);
      return state.fallbackComponents.get(fallbackKey);
    }
    
    // Return safe default based on method name
    return getSafeDefault(context.methodName);
  };

  // Apply graceful degradation
  const applyGracefulDegradation = (error, context) => {
    console.warn(`${context.name}:${context.methodName} degraded due to error:`, error.message);
    
    // Return degraded functionality based on method type
    switch (context.methodName) {
      case 'start':
      case 'initialize':
        return { status: 'degraded', error: error.message };
      
      case 'process':
      case 'analyze':
        return { result: null, error: error.message, degraded: true };
      
      case 'update':
        return false; // Skip update
      
      default:
        return null;
    }
  };

  // Require user intervention
  const requireUserIntervention = (error, context) => {
    const interventionNeeded = {
      component: context.name,
      method: context.methodName,
      error: error.message,
      timestamp: Date.now(),
      requiresIntervention: true
    };

    // Emit event for UI to handle
    if (typeof window !== 'undefined' && window.dispatchEvent) {
      window.dispatchEvent(new CustomEvent('componentInterventionRequired', {
        detail: interventionNeeded
      }));
    }

    throw new Error(`User intervention required for ${context.name}:${context.methodName}`);
  };

  // Get safe default return value
  const getSafeDefault = (methodName) => {
    const defaults = {
      start: false,
      stop: true,
      initialize: false,
      cleanup: true,
      process: null,
      analyze: { result: null, error: 'Service unavailable' },
      update: false,
      render: '',
      connect: false,
      disconnect: true
    };

    return defaults[methodName] || null;
  };

  // Create null object component
  const createNullComponent = (name) => ({
    name: `${name}(null)`,
    initialize: () => Promise.resolve(false),
    start: () => Promise.resolve(false),
    stop: () => Promise.resolve(true),
    cleanup: () => Promise.resolve(true),
    process: () => Promise.resolve(null),
    isHealthy: () => false,
    getStatus: () => ({ status: 'failed', message: 'Component failed to initialize' })
  });

  // Register fallback component for specific method
  const registerFallback = (componentName, methodName, fallbackValue) => {
    const key = `${componentName}:${methodName}`;
    state.fallbackComponents.set(key, fallbackValue);
  };

  // Get error statistics
  const getErrorStats = () => {
    const now = Date.now();
    const recent = state.errorHistory.filter(e => now - e.timestamp < 300000); // 5 minutes
    
    const stats = {
      total: state.errorHistory.length,
      recent: recent.length,
      byComponent: {},
      bySeverity: {},
      recentByComponent: {}
    };

    state.errorHistory.forEach(error => {
      stats.byComponent[error.component] = (stats.byComponent[error.component] || 0) + 1;
      stats.bySeverity[error.severity] = (stats.bySeverity[error.severity] || 0) + 1;
    });

    recent.forEach(error => {
      stats.recentByComponent[error.component] = (stats.recentByComponent[error.component] || 0) + 1;
    });

    return stats;
  };

  return {
    wrapComponent,
    registerFallback,
    getErrorStats,
    getErrorHistory: () => [...state.errorHistory],
    clearErrors: () => {
      state.errorHistory.length = 0;
      state.recoveryAttempts.clear();
    }
  };
};

// Default error boundary instance
export const defaultErrorBoundary = createErrorBoundary({
  maxRetries: 3,
  retryDelay: 1000,
  onError: (error, context) => {
    console.error(`[${context.name}:${context.methodName}] Error:`, error);
  }
});

// Utility to create resilient demo components
export const createResilientDemo = (demoFactory, options = {}) => {
  return defaultErrorBoundary.wrapComponent(demoFactory, {
    name: options.name || 'DemoComponent',
    recoveryStrategy: RecoveryStrategy.GRACEFUL_DEGRADATION,
    severity: ErrorSeverity.MEDIUM,
    fallback: options.fallback,
    ...options
  });
};

// Global error handler for unhandled promise rejections
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
    
    // Try to prevent the default browser error handling
    event.preventDefault();
    
    // Emit custom event for demo pages to handle
    window.dispatchEvent(new CustomEvent('demoError', {
      detail: {
        type: 'unhandledRejection',
        error: event.reason,
        timestamp: Date.now()
      }
    }));
  });

  window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
    
    window.dispatchEvent(new CustomEvent('demoError', {
      detail: {
        type: 'globalError',
        error: event.error,
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        timestamp: Date.now()
      }
    }));
  });
}