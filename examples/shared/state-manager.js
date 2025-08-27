/**
 * Comprehensive Component State Management
 * Provides centralized state management for demo components
 */

import {
  createHistoryManager,
  applyMiddlewares,
  createPersistenceManager,
  createDevToolsManager,
  createSubscriptionManager,
  createTimerManager
} from './state-helpers.js';
import {
  StateUpdateType,
  createSetOperation,
  createUpdateOperation,
  createDeleteOperation,
  createBatchOperations
} from './state-operations.js';

// Re-export StateUpdateType for compatibility
export { StateUpdateType };

// State subscription types
export const SubscriptionType = {
  IMMEDIATE: 'immediate',
  DEBOUNCED: 'debounced',
  THROTTLED: 'throttled',
  ASYNC: 'async'
};

// Create centralized state manager
export const createStateManager = (config = {}) => {
  // Initialize core state and options
  const store = new Map();
  const middlewares = [];
  const options = {
    enableHistory: config.enableHistory !== false,
    maxHistorySize: config.maxHistorySize || 1000,
    enableDevTools: config.enableDevTools && typeof window !== 'undefined',
    enablePersistence: config.enablePersistence || false,
    persistenceKey: config.persistenceKey || 'demo-state',
    debounceDelay: config.debounceDelay || 100,
    throttleDelay: config.throttleDelay || 50,
    ...config
  };

  // Initialize helper managers
  const historyManager = createHistoryManager(options.maxHistorySize);
  const subscriptionManager = createSubscriptionManager();
  const persistenceManager = createPersistenceManager(options.persistenceKey);
  const timerManager = createTimerManager();
  const devTools = createDevToolsManager();

  // Load persisted state if enabled
  if (options.enablePersistence) {
    const persistedData = persistenceManager.load();
    if (persistedData) {
      for (const [key, value] of Object.entries(persistedData)) {
        store.set(key, value);
      }
    }
  }

  // Helper function to apply middlewares
  const applyMiddlewaresWrapper = (context) => {
    return applyMiddlewares(middlewares, context);
  };

  // Create state operations using helpers
  const setState = createSetOperation(
    store, historyManager, subscriptionManager, persistenceManager, 
    timerManager, applyMiddlewaresWrapper, options
  );
  
  const updateState = createUpdateOperation(
    store, historyManager, subscriptionManager, persistenceManager,
    timerManager, applyMiddlewaresWrapper, options
  );
  
  const deleteState = createDeleteOperation(
    store, historyManager, subscriptionManager, persistenceManager,
    timerManager, options
  );
  
  const { batchSet, batchUpdate } = createBatchOperations(
    store, historyManager, subscriptionManager, persistenceManager,
    timerManager, applyMiddlewaresWrapper, options
  );

  // Register middleware
  const use = (middleware) => {
    if (typeof middleware !== 'function') {
      throw new Error('Middleware must be a function');
    }
    middlewares.push(middleware);
    return () => {
      const index = middlewares.indexOf(middleware);
      if (index !== -1) middlewares.splice(index, 1);
    };
  };



  // Get state value
  const getState = (key, defaultValue = undefined) => {
    return store.has(key) ? store.get(key) : defaultValue;
  };


  // Additional helper functions
  const getAllState = () => Object.fromEntries(store);
  const hasState = (key) => store.has(key);
  const clearState = () => {
    store.clear();
    historyManager.clear();
    if (options.enablePersistence) {
      persistenceManager.clear();
    }
  };
  const getStateSize = () => store.size;
  
  // Reset all state
  const resetState = (newState = {}) => {
    const oldStore = new Map(store);
    store.clear();
    
    // Set new state
    Object.entries(newState).forEach(([key, value]) => {
      store.set(key, value);
    });
    
    // Add to history
    if (options.enableHistory) {
      historyManager.push({
        type: StateUpdateType.RESET,
        key: '*',
        oldValue: Object.fromEntries(oldStore),
        newValue: Object.fromEntries(store)
      });
    }
    
    // Notify all subscribers
    for (const [key, value] of store) {
      subscriptionManager.notify(key, {
        key,
        value,
        oldValue: oldStore.get(key),
        type: StateUpdateType.RESET
      });
    }
    
    // Update dev tools
    if (devTools) {
      devTools.send('RESET', Object.fromEntries(store));
    }
  };
  
  // Subscription functions using helper manager
  const subscribe = (key, callback, options = {}) => {
    return subscriptionManager.subscribe(key, callback, options);
  };
  
  const subscribeAll = (callback) => {
    return subscriptionManager.subscribe('*', callback);
  };
  
  // History functions
  const getHistory = () => historyManager.getHistory();
  const clearHistory = () => historyManager.clear();
  const getLastHistory = (n = 10) => historyManager.getLastN(n);

  return {
    // Core state operations
    setState,
    updateState,
    getState,
    deleteState,
    resetState,
    getAllState,
    hasState,
    clearState,
    getStateSize,
    
    // Batch operations
    batchSet,
    batchUpdate,
    
    // Subscription operations
    subscribe,
    subscribeAll,
    
    // History operations
    getHistory,
    clearHistory,
    getLastHistory,
    
    // Middleware
    use,
    
    // Utility methods
    getKeys: () => Array.from(store.keys()),
    getValues: () => Array.from(store.values()),
    getEntries: () => Array.from(store.entries()),
    
    // Internal access for debugging
    _internal: {
      store,
      historyManager,
      subscriptionManager,
      persistenceManager,
      timerManager
    }
  };
};

// Default state manager instance for convenient usage
export const defaultStateManager = createStateManager({
  enableHistory: true,
  enablePersistence: false,
  enableDevTools: true
});
