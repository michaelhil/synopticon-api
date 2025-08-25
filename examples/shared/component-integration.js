/**
 * Enhanced Component Integration System
 * Provides robust component lifecycle management and error handling
 */

// Component states
export const ComponentState = {
  UNINITIALIZED: 'uninitialized',
  INITIALIZING: 'initializing', 
  INITIALIZED: 'initialized',
  STARTING: 'starting',
  RUNNING: 'running',
  STOPPING: 'stopping',
  STOPPED: 'stopped',
  ERROR: 'error',
  RECOVERING: 'recovering'
};

// Error types
export const ErrorType = {
  INITIALIZATION_ERROR: 'initialization_error',
  RUNTIME_ERROR: 'runtime_error',
  NETWORK_ERROR: 'network_error',
  PERMISSION_ERROR: 'permission_error',
  RESOURCE_ERROR: 'resource_error',
  VALIDATION_ERROR: 'validation_error'
};

// Component integration manager
export const createComponentIntegrationManager = (config = {}) => {
  const state = {
    components: new Map(),
    dependencies: new Map(),
    eventBus: createEventBus(),
    retryConfig: {
      maxRetries: config.maxRetries || 3,
      retryDelay: config.retryDelay || 1000,
      backoffMultiplier: config.backoffMultiplier || 2
    },
    globalErrorHandlers: []
  };

  // Register a component with dependencies
  const registerComponent = (name, componentFactory, options = {}) => {
    const component = {
      name,
      factory: componentFactory,
      instance: null,
      state: ComponentState.UNINITIALIZED,
      dependencies: options.dependencies || [],
      optional: options.optional || false,
      retryCount: 0,
      lastError: null,
      config: options.config || {},
      onStateChange: options.onStateChange || (() => {}),
      onError: options.onError || (() => {})
    };

    state.components.set(name, component);
    
    // Register dependencies
    if (component.dependencies.length > 0) {
      state.dependencies.set(name, component.dependencies);
    }

    console.log(`📦 Registered component: ${name} with ${component.dependencies.length} dependencies`);
    return component;
  };

  // Initialize a single component with error handling
  const initializeComponent = async (name) => {
    const component = state.components.get(name);
    if (!component) {
      throw new Error(`Component ${name} not found`);
    }

    if (component.state === ComponentState.INITIALIZED) {
      return component.instance;
    }

    try {
      setComponentState(component, ComponentState.INITIALIZING);

      // Check dependencies first
      const dependenciesReady = await checkDependencies(name);
      if (!dependenciesReady && !component.optional) {
        throw new Error(`Dependencies not ready for component ${name}`);
      }

      // Initialize the component
      component.instance = await component.factory(component.config);
      
      // Call initialize if available
      if (component.instance?.initialize) {
        await component.instance.initialize();
      }

      setComponentState(component, ComponentState.INITIALIZED);
      state.eventBus.emit('component:initialized', { name, component });
      
      console.log(`✅ Initialized component: ${name}`);
      return component.instance;

    } catch (error) {
      await handleComponentError(component, error, ErrorType.INITIALIZATION_ERROR);
      throw error;
    }
  };

  // Initialize all components in dependency order
  const initializeAll = async () => {
    console.log('🚀 Initializing all components...');
    const initOrder = getInitializationOrder();
    const results = {};

    for (const componentName of initOrder) {
      try {
        results[componentName] = await initializeComponent(componentName);
      } catch (error) {
        console.error(`Failed to initialize ${componentName}:`, error.message);
        
        const component = state.components.get(componentName);
        if (!component.optional) {
          throw new Error(`Critical component ${componentName} failed to initialize`);
        }
        
        results[componentName] = null;
      }
    }

    return results;
  };

  // Get component initialization order based on dependencies
  const getInitializationOrder = () => {
    const visited = new Set();
    const visiting = new Set();
    const order = [];

    const visit = (name) => {
      if (visiting.has(name)) {
        throw new Error(`Circular dependency detected involving ${name}`);
      }
      if (visited.has(name)) return;

      visiting.add(name);
      
      const deps = state.dependencies.get(name) || [];
      for (const dep of deps) {
        if (state.components.has(dep)) {
          visit(dep);
        }
      }
      
      visiting.delete(name);
      visited.add(name);
      order.push(name);
    };

    for (const name of state.components.keys()) {
      visit(name);
    }

    return order;
  };

  // Check if component dependencies are ready
  const checkDependencies = async (componentName) => {
    const deps = state.dependencies.get(componentName) || [];
    
    for (const depName of deps) {
      const depComponent = state.components.get(depName);
      if (!depComponent || depComponent.state !== ComponentState.INITIALIZED) {
        console.warn(`Dependency ${depName} not ready for ${componentName}`);
        return false;
      }
    }
    
    return true;
  };

  // Set component state and notify listeners
  const setComponentState = (component, newState) => {
    const oldState = component.state;
    component.state = newState;
    
    component.onStateChange(newState, oldState);
    state.eventBus.emit('component:stateChanged', {
      name: component.name,
      state: newState,
      oldState
    });
  };

  // Handle component errors with retry logic
  const handleComponentError = async (component, error, errorType) => {
    component.lastError = { error, type: errorType, timestamp: Date.now() };
    
    console.error(`❌ Component ${component.name} error (${errorType}):`, error.message);
    
    // Notify component-specific error handler
    component.onError(error, errorType);
    
    // Notify global error handlers
    state.globalErrorHandlers.forEach(handler => {
      try {
        handler(component.name, error, errorType);
      } catch (handlerError) {
        console.error('Error handler failed:', handlerError);
      }
    });

    // Emit error event
    state.eventBus.emit('component:error', {
      name: component.name,
      error,
      type: errorType
    });

    // Attempt recovery if configured
    if (shouldRetry(component, errorType)) {
      await attemptRecovery(component);
    } else {
      setComponentState(component, ComponentState.ERROR);
    }
  };

  // Determine if component should retry
  const shouldRetry = (component, errorType) => {
    if (component.retryCount >= state.retryConfig.maxRetries) {
      return false;
    }

    // Don't retry certain error types
    const nonRetryableErrors = [
      ErrorType.PERMISSION_ERROR,
      ErrorType.VALIDATION_ERROR
    ];
    
    return !nonRetryableErrors.includes(errorType);
  };

  // Attempt component recovery
  const attemptRecovery = async (component) => {
    setComponentState(component, ComponentState.RECOVERING);
    component.retryCount++;

    const delay = state.retryConfig.retryDelay * 
      Math.pow(state.retryConfig.backoffMultiplier, component.retryCount - 1);
    
    console.log(`🔄 Attempting recovery for ${component.name} (attempt ${component.retryCount}) in ${delay}ms`);
    
    await new Promise(resolve => setTimeout(resolve, delay));

    try {
      // Reset component state
      if (component.instance?.cleanup) {
        await component.instance.cleanup();
      }
      component.instance = null;
      
      // Reinitialize
      await initializeComponent(component.name);
      component.retryCount = 0; // Reset on success
      
    } catch (error) {
      await handleComponentError(component, error, ErrorType.RUNTIME_ERROR);
    }
  };

  // Start a component
  const startComponent = async (name) => {
    const component = state.components.get(name);
    if (!component?.instance) {
      throw new Error(`Component ${name} not initialized`);
    }

    if (component.state === ComponentState.RUNNING) {
      return component.instance;
    }

    try {
      setComponentState(component, ComponentState.STARTING);
      
      if (component.instance.start) {
        await component.instance.start();
      }
      
      setComponentState(component, ComponentState.RUNNING);
      state.eventBus.emit('component:started', { name, component });
      
      return component.instance;
      
    } catch (error) {
      await handleComponentError(component, error, ErrorType.RUNTIME_ERROR);
      throw error;
    }
  };

  // Stop a component
  const stopComponent = async (name) => {
    const component = state.components.get(name);
    if (!component?.instance) {
      return;
    }

    try {
      setComponentState(component, ComponentState.STOPPING);
      
      if (component.instance.stop) {
        await component.instance.stop();
      }
      
      setComponentState(component, ComponentState.STOPPED);
      state.eventBus.emit('component:stopped', { name, component });
      
    } catch (error) {
      await handleComponentError(component, error, ErrorType.RUNTIME_ERROR);
    }
  };

  // Get component by name
  const getComponent = (name) => {
    const component = state.components.get(name);
    return component?.instance || null;
  };

  // Get component state
  const getComponentState = (name) => {
    const component = state.components.get(name);
    return component?.state || ComponentState.UNINITIALIZED;
  };

  // Get all component states
  const getAllStates = () => {
    const states = {};
    for (const [name, component] of state.components) {
      states[name] = {
        state: component.state,
        retryCount: component.retryCount,
        lastError: component.lastError
      };
    }
    return states;
  };

  // Add global error handler
  const addErrorHandler = (handler) => {
    state.globalErrorHandlers.push(handler);
    return () => {
      const index = state.globalErrorHandlers.indexOf(handler);
      if (index !== -1) state.globalErrorHandlers.splice(index, 1);
    };
  };

  // Cleanup all components
  const cleanup = async () => {
    console.log('🧹 Cleaning up all components...');
    
    const componentNames = Array.from(state.components.keys()).reverse();
    
    for (const name of componentNames) {
      try {
        await stopComponent(name);
        const component = state.components.get(name);
        if (component?.instance?.cleanup) {
          await component.instance.cleanup();
        }
      } catch (error) {
        console.error(`Failed to cleanup ${name}:`, error);
      }
    }
    
    state.components.clear();
    state.dependencies.clear();
  };

  return {
    registerComponent,
    initializeComponent,
    initializeAll,
    startComponent,
    stopComponent,
    getComponent,
    getComponentState,
    getAllStates,
    addErrorHandler,
    cleanup,
    on: state.eventBus.on.bind(state.eventBus),
    emit: state.eventBus.emit.bind(state.eventBus)
  };
};

// Simple event bus implementation
const createEventBus = () => {
  const events = new Map();

  return {
    on: (event, callback) => {
      if (!events.has(event)) {
        events.set(event, []);
      }
      events.get(event).push(callback);
      
      return () => {
        const callbacks = events.get(event);
        if (callbacks) {
          const index = callbacks.indexOf(callback);
          if (index !== -1) callbacks.splice(index, 1);
        }
      };
    },

    emit: (event, data) => {
      const callbacks = events.get(event) || [];
      callbacks.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Event callback error for ${event}:`, error);
        }
      });
    }
  };
};

// Enhanced component factory wrapper
export const createEnhancedComponent = (baseFactory, options = {}) => {
  return async (config) => {
    const component = await baseFactory(config);
    
    // Add error boundary wrapper
    const withErrorBoundary = (method) => {
      const originalMethod = component[method];
      if (typeof originalMethod === 'function') {
        component[method] = async (...args) => {
          try {
            return await originalMethod.call(component, ...args);
          } catch (error) {
            console.error(`Error in ${method}:`, error);
            
            // Emit error event if component has event system
            if (component.emit) {
              component.emit('error', { method, error, args });
            }
            
            // Re-throw for upstream handling
            throw error;
          }
        };
      }
    };

    // Wrap common methods with error boundaries
    ['initialize', 'start', 'stop', 'process', 'update'].forEach(withErrorBoundary);
    
    // Add health check capability
    component.healthCheck = async () => {
      try {
        if (component.isHealthy) {
          return await component.isHealthy();
        }
        return { status: 'healthy', timestamp: Date.now() };
      } catch (error) {
        return { status: 'unhealthy', error: error.message, timestamp: Date.now() };
      }
    };

    // Add graceful shutdown
    const originalCleanup = component.cleanup;
    component.cleanup = async () => {
      try {
        if (originalCleanup) {
          await originalCleanup.call(component);
        }
      } catch (error) {
        console.warn('Cleanup error (non-critical):', error);
      }
    };

    return component;
  };
};

// Utility for creating resilient components
export const createResilientComponent = (factory, resilientOptions = {}) => {
  return createEnhancedComponent(factory, {
    retryCount: resilientOptions.retryCount || 3,
    retryDelay: resilientOptions.retryDelay || 1000,
    healthCheckInterval: resilientOptions.healthCheckInterval || 30000,
    ...resilientOptions
  });
};