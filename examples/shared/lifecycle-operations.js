/**
 * Individual Lifecycle Operations
 * Core component lifecycle operations extracted for better organization
 */

import { ComponentState } from './component-integration.js';
import { LifecycleHook } from './lifecycle-manager.js';

// Create initialization operation
export const createInitializeOperation = (state, executeHooks, updateComponentState, recordError) => async (name) => {
  const component = state.components.get(name);
  if (!component) {
    throw new Error(`Component ${name} not found`);
  }
  
  if (component.state !== ComponentState.UNINITIALIZED) {
    return component.instance;
  }
  
  const startTime = Date.now();
  
  try {
    await executeHooks(name, LifecycleHook.BEFORE_INIT);
    
    // Ensure dependencies are ready
    await ensureDependencies(name, state.components);
    
    // Initialize with timeout
    const initPromise = component.factory(component.options.config || {});
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error(`Component ${name} initialization timeout`)), component.options.timeout)
    );
    
    component.instance = await Promise.race([initPromise, timeoutPromise]);
    
    // Update metrics
    component.metadata.initTime = Date.now() - startTime;
    updateComponentState(component, ComponentState.INITIALIZED);
    
    if (state.options.enableMetrics) {
      state.metrics.successfulInits++;
    }
    
    await executeHooks(name, LifecycleHook.AFTER_INIT, { instance: component.instance });
    
    console.log(`✅ ${name} initialized (${component.metadata.initTime}ms)`);
    return component.instance;
    
  } catch (error) {
    component.metadata.errorCount++;
    updateComponentState(component, ComponentState.ERROR);
    
    if (state.options.enableMetrics) {
      state.metrics.failedInits++;
    }
    
    recordError(error, { component: name, operation: 'initialize' });
    throw error;
  }
};

// Create start operation
export const createStartOperation = (state, executeHooks, updateComponentState, recordError) => async (name) => {
  const component = state.components.get(name);
  if (!component) {
    throw new Error(`Component ${name} not found`);
  }
  
  if (component.state !== ComponentState.INITIALIZED) {
    throw new Error(`Component ${name} must be initialized before starting`);
  }
  
  try {
    await executeHooks(name, LifecycleHook.BEFORE_START);
    
    if (component.instance.start) {
      const startTime = Date.now();
      await component.instance.start();
      component.metadata.startTime = Date.now();
      component.metadata.totalRuntime += Date.now() - startTime;
    }
    
    updateComponentState(component, ComponentState.RUNNING);
    await executeHooks(name, LifecycleHook.AFTER_START);
    
    console.log(`▶️ ${name} started`);
    return component.instance;
    
  } catch (error) {
    recordError(error, { component: name, operation: 'start' });
    updateComponentState(component, ComponentState.ERROR);
    throw error;
  }
};

// Create stop operation
export const createStopOperation = (state, executeHooks, updateComponentState) => async (name) => {
  const component = state.components.get(name);
  if (!component) {
    return; // Component doesn't exist, nothing to stop
  }
  
  if (component.state !== ComponentState.RUNNING) {
    return; // Component not running
  }
  
  try {
    await executeHooks(name, LifecycleHook.BEFORE_STOP);
    
    if (component.instance && component.instance.stop) {
      await component.instance.stop();
      
      if (component.metadata.startTime) {
        const runtime = Date.now() - component.metadata.startTime;
        component.metadata.totalRuntime += runtime;
      }
    }
    
    updateComponentState(component, ComponentState.STOPPED);
    await executeHooks(name, LifecycleHook.AFTER_STOP);
    
    console.log(`⏹️ ${name} stopped`);
    
  } catch (error) {
    console.error(`Error stopping ${name}:`, error);
    updateComponentState(component, ComponentState.ERROR);
  }
};

// Create cleanup operation  
export const createCleanupOperation = (state, executeHooks, updateComponentState) => async (name) => {
  const component = state.components.get(name);
  if (!component) {
    return;
  }
  
  try {
    await executeHooks(name, LifecycleHook.BEFORE_CLEANUP);
    
    if (component.instance && component.instance.cleanup) {
      await component.instance.cleanup();
    }
    
    component.instance = null;
    updateComponentState(component, ComponentState.UNINITIALIZED);
    
    await executeHooks(name, LifecycleHook.AFTER_CLEANUP);
    console.log(`🧹 ${name} cleaned up`);
    
  } catch (error) {
    console.error(`Error cleaning up ${name}:`, error);
  }
};

// Helper function to ensure dependencies
const ensureDependencies = async (componentName, components) => {
  const component = components.get(componentName);
  for (const depName of component.dependencies) {
    const dependency = components.get(depName);
    if (!dependency) {
      throw new Error(`Missing dependency: ${depName} for ${componentName}`);
    }
    if (dependency.state === ComponentState.UNINITIALIZED) {
      throw new Error(`Dependency ${depName} not initialized for ${componentName}`);
    }
  }
};