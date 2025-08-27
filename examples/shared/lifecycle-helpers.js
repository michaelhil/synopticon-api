/**
 * Lifecycle Manager Helper Functions
 * Extracted helper functions to reduce complexity of main lifecycle manager
 */

import { ComponentState } from './component-integration.js';

// Component state management helpers
export const createComponentConfig = (name, factory, options = {}) => ({
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
    timeout: options.timeout || 30000,
    enableMetrics: options.enableMetrics !== false,
    config: options.config || {}
  }
});

// Hook execution helper
export const executeHooks = async (component, globalHooks, hook, context = {}) => {
  const hooks = [];
  
  // Add component-specific hooks
  if (component?.hooks.has(hook)) {
    hooks.push(...component.hooks.get(hook));
  }
  
  // Add global hooks
  if (globalHooks.has(hook)) {
    hooks.push(...globalHooks.get(hook));
  }
  
  // Execute hooks in sequence
  for (const hookFn of hooks) {
    try {
      await hookFn({
        component: component.name,
        state: component.state,
        ...context
      });
    } catch (error) {
      console.warn(`Hook ${hook} failed for ${component.name}:`, error);
    }
  }
};

// State transition helper
export const updateComponentState = (component, newState, globalHooks) => {
  const oldState = component.state;
  component.state = newState;
  
  // Execute state change hooks if available
  if (globalHooks.has('onStateChange')) {
    executeHooks(component, globalHooks, 'onStateChange', { oldState, newState });
  }
  
  return { oldState, newState };
};

// Error recording helper
export const recordError = (error, context, components) => {
  const component = components.get(context.component);
  if (component) {
    component.metadata.errorCount++;
  }
  
  console.error(`Lifecycle error in ${context.component}:`, error);
  
  return {
    timestamp: Date.now(),
    component: context.component,
    error: error.message,
    context
  };
};

// Dependency graph calculation
export const calculateExecutionOrder = (components) => {
  const visited = new Set();
  const visiting = new Set();
  const order = [];
  
  const visit = (name) => {
    if (visiting.has(name)) {
      throw new Error(`Circular dependency detected involving ${name}`);
    }
    if (visited.has(name)) return;
    
    visiting.add(name);
    const component = components.get(name);
    
    if (component) {
      for (const dep of component.dependencies) {
        if (components.has(dep)) {
          visit(dep);
        }
      }
    }
    
    visiting.delete(name);
    visited.add(name);
    order.push(name);
  };
  
  for (const name of components.keys()) {
    if (!visited.has(name)) {
      visit(name);
    }
  }
  
  return order;
};

// Metrics calculation helper
export const calculateMetrics = (components) => {
  const metrics = {
    totalComponents: components.size,
    successfulInits: 0,
    failedInits: 0,
    averageInitTime: 0,
    totalRuntime: 0
  };
  
  const initTimes = [];
  let totalRuntime = 0;
  
  for (const component of components.values()) {
    if (component.state !== ComponentState.UNINITIALIZED) {
      if (component.state === ComponentState.ERROR) {
        metrics.failedInits++;
      } else {
        metrics.successfulInits++;
      }
    }
    
    if (component.metadata.initTime) {
      initTimes.push(component.metadata.initTime);
    }
    
    totalRuntime += component.metadata.totalRuntime;
  }
  
  if (initTimes.length > 0) {
    metrics.averageInitTime = initTimes.reduce((a, b) => a + b, 0) / initTimes.length;
  }
  
  metrics.totalRuntime = totalRuntime;
  return metrics;
};

// Component initialization promise helper
export const createInitializationPromise = async (component, timeout) => {
  const initPromise = component.factory(component.options.config || {});
  const timeoutPromise = new Promise((_, reject) => 
    setTimeout(() => reject(new Error(`Component ${component.name} initialization timeout`)), timeout)
  );
  
  return Promise.race([initPromise, timeoutPromise]);
};