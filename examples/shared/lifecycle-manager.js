/**
 * Enhanced Component Lifecycle Management
 * Provides comprehensive lifecycle orchestration for demo components
 */

import { ComponentState } from './component-integration.js';
import { createErrorBoundary, ErrorSeverity, RecoveryStrategy } from './error-boundaries.js';
import { calculateExecutionOrder } from './lifecycle-helpers.js';
import { 
  createInitializeAllOperation,
  createStartAllOperation, 
  createStopAllOperation,
  createCleanupAllOperation
} from './lifecycle-bulk-operations.js';

// Lifecycle phases
export const LifecyclePhase = {
  PRE_INIT: 'pre_init',
  INIT: 'init', 
  POST_INIT: 'post_init',
  PRE_START: 'pre_start',
  START: 'start',
  POST_START: 'post_start',
  RUNNING: 'running',
  PRE_STOP: 'pre_stop',
  STOP: 'stop',
  POST_STOP: 'post_stop',
  PRE_CLEANUP: 'pre_cleanup',
  CLEANUP: 'cleanup',
  POST_CLEANUP: 'post_cleanup'
};

// Lifecycle hooks
export const LifecycleHook = {
  BEFORE_INIT: 'beforeInit',
  AFTER_INIT: 'afterInit',
  BEFORE_START: 'beforeStart', 
  AFTER_START: 'afterStart',
  BEFORE_STOP: 'beforeStop',
  AFTER_STOP: 'afterStop',
  BEFORE_CLEANUP: 'beforeCleanup',
  AFTER_CLEANUP: 'afterCleanup',
  ON_ERROR: 'onError',
  ON_STATE_CHANGE: 'onStateChange'
};

// Create enhanced lifecycle manager
export const createLifecycleManager = (config = {}) => {
  const state = {
    components: new Map(),
    lifecycleHooks: new Map(),
    dependencyGraph: new Map(),
    executionOrder: [],
    globalHooks: new Map(),
    metrics: {
      totalComponents: 0,
      successfulInits: 0,
      failedInits: 0,
      averageInitTime: 0,
      totalRuntime: 0
    },
    options: {
      enableMetrics: config.enableMetrics !== false,
      enableHooks: config.enableHooks !== false,
      strictMode: config.strictMode || false,
      timeout: config.timeout || 30000,
      ...config
    }
  };

  const errorBoundary = createErrorBoundary({
    maxRetries: 3,
    retryDelay: 1000,
    onError: (error, context) => recordError(error, context)
  });

  // Register component with lifecycle management
  const registerComponent = (name, factory, options = {}) => {
    const componentConfig = {
      name,
      factory,
      instance: null,
      state: ComponentState.UNINITIALIZED,
      dependencies: options.dependencies || [],
      hooks: new Map(),
      metadata: {
        registeredAt: Date.now(),
        initTime: null,
        startTime: null,
        totalRuntime: 0,
        restartCount: 0,
        errorCount: 0
      },
      options: {
        required: options.required !== false,
        timeout: options.timeout || state.options.timeout,
        enableMetrics: options.enableMetrics !== false,
        autoStart: options.autoStart || false,
        restartOnError: options.restartOnError || false,
        maxRestarts: options.maxRestarts || 3,
        ...options
      }
    };

    // Wrap factory with error boundary
    componentConfig.factory = errorBoundary.wrapComponent(factory, {
      name,
      severity: options.required ? ErrorSeverity.HIGH : ErrorSeverity.MEDIUM,
      recoveryStrategy: RecoveryStrategy.GRACEFUL_DEGRADATION
    });

    state.components.set(name, componentConfig);
    state.metrics.totalComponents++;

    // Register component-specific hooks
    Object.values(LifecycleHook).forEach(hook => {
      if (options[hook]) {
        addComponentHook(name, hook, options[hook]);
      }
    });

    console.log(`📦 Registered component: ${name} (${componentConfig.options.required ? 'required' : 'optional'})`);
    return componentConfig;
  };

  // Add lifecycle hook for specific component
  const addComponentHook = (componentName, hook, callback) => {
    const component = state.components.get(componentName);
    if (!component) {
      throw new Error(`Component ${componentName} not found`);
    }

    if (!component.hooks.has(hook)) {
      component.hooks.set(hook, []);
    }
    component.hooks.get(hook).push(callback);
  };

  // Add global lifecycle hook
  const addGlobalHook = (hook, callback) => {
    if (!state.globalHooks.has(hook)) {
      state.globalHooks.set(hook, []);
    }
    state.globalHooks.get(hook).push(callback);
  };

  // Execute hooks for component
  const executeHooks = async (componentName, hook, context = {}) => {
    if (!state.options.enableHooks) return;

    const component = state.components.get(componentName);
    const hooks = [];

    // Add global hooks
    if (state.globalHooks.has(hook)) {
      hooks.push(...state.globalHooks.get(hook));
    }

    // Add component-specific hooks
    if (component?.hooks.has(hook)) {
      hooks.push(...component.hooks.get(hook));
    }

    // Execute hooks in sequence
    for (const hookCallback of hooks) {
      try {
        await hookCallback({
          component: componentName,
          hook,
          state: component?.state,
          instance: component?.instance,
          ...context
        });
      } catch (error) {
        console.error(`Hook ${hook} failed for ${componentName}:`, error);
        if (state.options.strictMode) {
          throw error;
        }
      }
    }
  };

  // Initialize component with full lifecycle
  const initializeComponent = async (name) => {
    const component = state.components.get(name);
    if (!component) {
      throw new Error(`Component ${name} not found`);
    }

    if (component.state >= ComponentState.INITIALIZED) {
      return component.instance;
    }

    const startTime = Date.now();

    try {
      // Pre-initialization phase
      await executeHooks(name, LifecycleHook.BEFORE_INIT, { phase: LifecyclePhase.PRE_INIT });
      updateComponentState(component, ComponentState.INITIALIZING);

      // Check dependencies
      await ensureDependencies(name);

      // Initialize with timeout
      const initPromise = component.factory(component.options.config || {});
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error(`Initialization timeout for ${name}`)), component.options.timeout)
      );

      component.instance = await Promise.race([initPromise, timeoutPromise]);

      // Call component's initialize method if available
      if (component.instance?.initialize) {
        await component.instance.initialize();
      }

      // Post-initialization phase
      updateComponentState(component, ComponentState.INITIALIZED);
      component.metadata.initTime = Date.now() - startTime;
      state.metrics.successfulInits++;

      await executeHooks(name, LifecycleHook.AFTER_INIT, { 
        phase: LifecyclePhase.POST_INIT,
        initTime: component.metadata.initTime
      });

      // Auto-start if configured
      if (component.options.autoStart) {
        await startComponent(name);
      }

      console.log(`✅ Initialized ${name} in ${component.metadata.initTime}ms`);
      return component.instance;

    } catch (error) {
      state.metrics.failedInits++;
      component.metadata.errorCount++;
      recordError(error, { component: name, phase: 'initialization' });

      if (component.options.required) {
        throw error;
      }

      console.warn(`⚠️ Optional component ${name} failed to initialize:`, error.message);
      return null;
    }
  };

  // Start component with lifecycle hooks
  const startComponent = async (name) => {
    const component = state.components.get(name);
    if (!component?.instance) {
      throw new Error(`Component ${name} not initialized`);
    }

    if (component.state === ComponentState.RUNNING) {
      return component.instance;
    }

    try {
      await executeHooks(name, LifecycleHook.BEFORE_START, { phase: LifecyclePhase.PRE_START });
      updateComponentState(component, ComponentState.STARTING);

      const startTime = Date.now();
      
      if (component.instance.start) {
        await component.instance.start();
      }

      updateComponentState(component, ComponentState.RUNNING);
      component.metadata.startTime = startTime;

      await executeHooks(name, LifecycleHook.AFTER_START, { phase: LifecyclePhase.POST_START });

      console.log(`🚀 Started ${name}`);
      return component.instance;

    } catch (error) {
      component.metadata.errorCount++;
      
      if (component.options.restartOnError && 
          component.metadata.restartCount < component.options.maxRestarts) {
        await attemptRestart(name);
      } else {
        updateComponentState(component, ComponentState.ERROR);
        throw error;
      }
    }
  };

  // Stop component with lifecycle hooks
  const stopComponent = async (name) => {
    const component = state.components.get(name);
    if (!component?.instance) {
      return;
    }

    try {
      await executeHooks(name, LifecycleHook.BEFORE_STOP, { phase: LifecyclePhase.PRE_STOP });
      updateComponentState(component, ComponentState.STOPPING);

      if (component.instance.stop) {
        await component.instance.stop();
      }

      // Update runtime metrics
      if (component.metadata.startTime) {
        const runtime = Date.now() - component.metadata.startTime;
        component.metadata.totalRuntime += runtime;
        state.metrics.totalRuntime += runtime;
      }

      updateComponentState(component, ComponentState.STOPPED);
      await executeHooks(name, LifecycleHook.AFTER_STOP, { phase: LifecyclePhase.POST_STOP });

      console.log(`⏹️ Stopped ${name}`);

    } catch (error) {
      console.error(`Error stopping ${name}:`, error);
      updateComponentState(component, ComponentState.ERROR);
    }
  };

  // Cleanup component with lifecycle hooks
  const cleanupComponent = async (name) => {
    const component = state.components.get(name);
    if (!component) return;

    try {
      await executeHooks(name, LifecycleHook.BEFORE_CLEANUP, { phase: LifecyclePhase.PRE_CLEANUP });

      if (component.instance?.cleanup) {
        await component.instance.cleanup();
      }

      component.instance = null;
      updateComponentState(component, ComponentState.UNINITIALIZED);

      await executeHooks(name, LifecycleHook.AFTER_CLEANUP, { phase: LifecyclePhase.POST_CLEANUP });

      console.log(`🧹 Cleaned up ${name}`);

    } catch (error) {
      console.error(`Error cleaning up ${name}:`, error);
    }
  };

  // Restart component
  const restartComponent = async (name) => {
    await stopComponent(name);
    await cleanupComponent(name);
    await initializeComponent(name);
    return startComponent(name);
  };

  // Attempt automatic restart
  const attemptRestart = async (name) => {
    const component = state.components.get(name);
    component.metadata.restartCount++;

    console.log(`🔄 Restarting ${name} (attempt ${component.metadata.restartCount})`);

    try {
      await restartComponent(name);
      console.log(`✅ Successfully restarted ${name}`);
    } catch (error) {
      console.error(`❌ Failed to restart ${name}:`, error);
      updateComponentState(component, ComponentState.ERROR);
    }
  };

  // Ensure dependencies are ready
  const ensureDependencies = async (componentName) => {
    const component = state.components.get(componentName);
    
    for (const depName of component.dependencies) {
      const dependency = state.components.get(depName);
      
      if (!dependency) {
        throw new Error(`Dependency ${depName} not found for ${componentName}`);
      }
      
      if (dependency.state < ComponentState.INITIALIZED) {
        await initializeComponent(depName);
      }
    }
  };

  // Update component state with notifications
  const updateComponentState = (component, newState) => {
    const oldState = component.state;
    component.state = newState;

    executeHooks(component.name, LifecycleHook.ON_STATE_CHANGE, {
      oldState,
      newState,
      timestamp: Date.now()
    }).catch(error => console.error('State change hook error:', error));
  };

  // Record error for metrics
  const recordError = (error, context) => {
    const component = state.components.get(context.component);
    if (component) {
      component.metadata.errorCount++;
    }

    executeHooks(context.component, LifecycleHook.ON_ERROR, {
      error,
      context,
      timestamp: Date.now()
    }).catch(hookError => console.error('Error hook failed:', hookError));
  };

  // Initialize all components in dependency order
  const initializeAll = createInitializeAllOperation(state, initializeComponent);

  // Start all initialized components
  const startAll = createStartAllOperation(state, startComponent);

  // Stop all running components
  const stopAll = createStopAllOperation(state, stopComponent);

  // Cleanup all components
  const cleanupAll = createCleanupAllOperation(state, cleanupComponent);

  // Calculate execution order based on dependencies
  const getExecutionOrder = () => {
    if (state.executionOrder.length === 0) {
      state.executionOrder = calculateExecutionOrder(state.components);
    }
    return state.executionOrder;
  };


  // Get comprehensive status
  const getStatus = () => ({
    components: Object.fromEntries(
      [...state.components.entries()].map(([name, comp]) => [
        name,
        {
          state: comp.state,
          metadata: comp.metadata,
          isRequired: comp.options.required,
          dependencies: comp.dependencies
        }
      ])
    ),
    metrics: { ...state.metrics },
    executionOrder: getExecutionOrder()
  });

  return {
    registerComponent,
    addComponentHook,
    addGlobalHook,
    initializeComponent,
    startComponent,
    stopComponent,
    cleanupComponent,
    restartComponent,
    initializeAll,
    startAll,
    stopAll,
    cleanupAll,
    getStatus,
    getComponent: (name) => state.components.get(name)?.instance,
    getComponentState: (name) => state.components.get(name)?.state || ComponentState.UNINITIALIZED
  };
};