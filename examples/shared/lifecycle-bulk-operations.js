/**
 * Lifecycle Manager Bulk Operations
 * Extracted bulk operation functions to reduce main function complexity
 */

import { ComponentState } from './component-integration.js';
import { calculateExecutionOrder } from './lifecycle-helpers.js';

// Initialize all components in dependency order
export const createInitializeAllOperation = (state, initializeComponent) => async () => {
  console.log('🚀 Initializing all components...');
  
  const initOrder = calculateExecutionOrder(state.components);
  const results = {};
  
  for (const componentName of initOrder) {
    try {
      const component = state.components.get(componentName);
      if (component && component.state === ComponentState.UNINITIALIZED) {
        console.log(`  📦 Initializing ${componentName}...`);
        results[componentName] = await initializeComponent(componentName);
      }
    } catch (error) {
      console.error(`❌ Failed to initialize ${componentName}:`, error.message);
      results[componentName] = { error: error.message };
    }
  }
  
  console.log('✅ All components initialization completed');
  return results;
};

// Start all initialized components
export const createStartAllOperation = (state, startComponent) => async () => {
  console.log('▶️ Starting all components...');
  
  const startOrder = calculateExecutionOrder(state.components);
  const results = {};
  
  for (const componentName of startOrder) {
    try {
      const component = state.components.get(componentName);
      if (component && component.state === ComponentState.INITIALIZED) {
        results[componentName] = await startComponent(componentName);
      }
    } catch (error) {
      console.error(`❌ Failed to start ${componentName}:`, error.message);
      results[componentName] = { error: error.message };
    }
  }
  
  return results;
};

// Stop all running components
export const createStopAllOperation = (state, stopComponent) => async () => {
  console.log('⏹️ Stopping all components...');
  
  const stopOrder = [...calculateExecutionOrder(state.components)].reverse();
  
  for (const componentName of stopOrder) {
    try {
      await stopComponent(componentName);
    } catch (error) {
      console.error(`❌ Failed to stop ${componentName}:`, error.message);
    }
  }
};

// Clean up all components
export const createCleanupAllOperation = (state, cleanupComponent) => async () => {
  console.log('🧹 Cleaning up all components...');
  
  const cleanupOrder = [...calculateExecutionOrder(state.components)].reverse();
  
  for (const componentName of cleanupOrder) {
    try {
      await cleanupComponent(componentName);
    } catch (error) {
      console.error(`❌ Failed to cleanup ${componentName}:`, error.message);
    }
  }
};