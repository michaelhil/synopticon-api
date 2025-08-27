/**
 * State Manager Operations
 * Core state operations extracted for better organization
 */

// State update types
export const StateUpdateType = {
  SET: 'set',
  UPDATE: 'update',
  DELETE: 'delete',
  BATCH: 'batch',
  ASYNC: 'async'
};

// Create setState operation
export const createSetOperation = (
  store, 
  historyManager, 
  subscriptionManager, 
  persistenceManager, 
  timerManager,
  applyMiddlewares,
  options = {}
) => (key, value, operationOptions = {}) => {
  const oldValue = store.get(key);
  const updateType = StateUpdateType.SET;
  
  // Apply middlewares
  const context = { key, value, oldValue, type: updateType, options: operationOptions };
  const processedValue = applyMiddlewares(context);
  
  // Update store
  store.set(key, processedValue);
  
  // Add to history
  if (options.enableHistory) {
    historyManager.push({
      type: updateType,
      key,
      oldValue,
      newValue: processedValue,
      options: operationOptions
    });
  }
  
  // Notify subscribers
  subscriptionManager.notify(key, {
    key,
    value: processedValue,
    oldValue,
    type: updateType
  });
  
  // Global notification
  subscriptionManager.notifyAll({
    key,
    value: processedValue,
    oldValue,
    type: updateType
  });
  
  // Persist if enabled
  if (options.enablePersistence) {
    if (operationOptions.debounce) {
      timerManager.debounce(`persist-${key}`, () => {
        persistenceManager.save(Object.fromEntries(store));
      }, options.debounceDelay || 100);
    } else {
      persistenceManager.save(Object.fromEntries(store));
    }
  }
  
  return processedValue;
};

// Create updateState operation
export const createUpdateOperation = (
  store,
  historyManager,
  subscriptionManager,
  persistenceManager,
  timerManager,
  applyMiddlewares,
  options = {}
) => (key, updater, operationOptions = {}) => {
  const oldValue = store.get(key);
  
  if (typeof updater !== 'function') {
    throw new Error('Updater must be a function');
  }
  
  const newValue = updater(oldValue);
  const updateType = StateUpdateType.UPDATE;
  
  // Apply middlewares
  const context = { key, value: newValue, oldValue, type: updateType, options: operationOptions };
  const processedValue = applyMiddlewares(context);
  
  // Update store
  store.set(key, processedValue);
  
  // Add to history
  if (options.enableHistory) {
    historyManager.push({
      type: updateType,
      key,
      oldValue,
      newValue: processedValue,
      updater: updater.toString(),
      options: operationOptions
    });
  }
  
  // Notify subscribers
  subscriptionManager.notify(key, {
    key,
    value: processedValue,
    oldValue,
    type: updateType
  });
  
  // Global notification
  subscriptionManager.notifyAll({
    key,
    value: processedValue,
    oldValue,
    type: updateType
  });
  
  // Persist if enabled
  if (options.enablePersistence) {
    if (operationOptions.debounce) {
      timerManager.debounce(`persist-${key}`, () => {
        persistenceManager.save(Object.fromEntries(store));
      }, options.debounceDelay || 100);
    } else {
      persistenceManager.save(Object.fromEntries(store));
    }
  }
  
  return processedValue;
};

// Create deleteState operation
export const createDeleteOperation = (
  store,
  historyManager,
  subscriptionManager,
  persistenceManager,
  timerManager,
  options = {}
) => (key) => {
  const oldValue = store.get(key);
  const existed = store.has(key);
  
  if (!existed) return false;
  
  store.delete(key);
  
  // Add to history
  if (options.enableHistory) {
    historyManager.push({
      type: StateUpdateType.DELETE,
      key,
      oldValue,
      newValue: undefined
    });
  }
  
  // Notify subscribers
  subscriptionManager.notify(key, {
    key,
    value: undefined,
    oldValue,
    type: StateUpdateType.DELETE
  });
  
  // Global notification
  subscriptionManager.notifyAll({
    key,
    value: undefined,
    oldValue,
    type: StateUpdateType.DELETE
  });
  
  // Persist if enabled
  if (options.enablePersistence) {
    timerManager.debounce('persist-delete', () => {
      persistenceManager.save(Object.fromEntries(store));
    }, options.debounceDelay || 100);
  }
  
  return true;
};

// Create batch operations
export const createBatchOperations = (
  store,
  historyManager,
  subscriptionManager,
  persistenceManager,
  timerManager,
  applyMiddlewares,
  options = {}
) => ({
  batchSet: (updates) => {
    const changes = [];
    
    for (const [key, value] of Object.entries(updates)) {
      const oldValue = store.get(key);
      const context = { key, value, oldValue, type: StateUpdateType.BATCH };
      const processedValue = applyMiddlewares(context);
      
      store.set(key, processedValue);
      changes.push({ key, oldValue, newValue: processedValue });
    }
    
    // Add to history
    if (options.enableHistory) {
      historyManager.push({
        type: StateUpdateType.BATCH,
        changes,
        count: changes.length
      });
    }
    
    // Notify all affected subscribers
    for (const change of changes) {
      subscriptionManager.notify(change.key, {
        key: change.key,
        value: change.newValue,
        oldValue: change.oldValue,
        type: StateUpdateType.BATCH
      });
    }
    
    // Global notification
    subscriptionManager.notifyAll({
      type: StateUpdateType.BATCH,
      changes
    });
    
    // Persist if enabled
    if (options.enablePersistence) {
      persistenceManager.save(Object.fromEntries(store));
    }
    
    return changes;
  },
  
  batchUpdate: (updates) => {
    const changes = [];
    
    for (const [key, updater] of Object.entries(updates)) {
      if (typeof updater !== 'function') continue;
      
      const oldValue = store.get(key);
      const newValue = updater(oldValue);
      const context = { key, value: newValue, oldValue, type: StateUpdateType.BATCH };
      const processedValue = applyMiddlewares(context);
      
      store.set(key, processedValue);
      changes.push({ key, oldValue, newValue: processedValue });
    }
    
    // Add to history
    if (options.enableHistory) {
      historyManager.push({
        type: StateUpdateType.BATCH,
        changes,
        count: changes.length
      });
    }
    
    // Notify all affected subscribers
    for (const change of changes) {
      subscriptionManager.notify(change.key, {
        key: change.key,
        value: change.newValue,
        oldValue: change.oldValue,
        type: StateUpdateType.BATCH
      });
    }
    
    // Global notification
    subscriptionManager.notifyAll({
      type: StateUpdateType.BATCH,
      changes
    });
    
    // Persist if enabled
    if (options.enablePersistence) {
      persistenceManager.save(Object.fromEntries(store));
    }
    
    return changes;
  }
});