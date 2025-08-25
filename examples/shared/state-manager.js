/**
 * Comprehensive Component State Management
 * Provides centralized state management for demo components
 */

// State update types
export const StateUpdateType = {
  SET: 'set',
  UPDATE: 'update',
  MERGE: 'merge',
  DELETE: 'delete',
  RESET: 'reset'
};

// State subscription types
export const SubscriptionType = {
  IMMEDIATE: 'immediate',
  DEBOUNCED: 'debounced',
  THROTTLED: 'throttled',
  ASYNC: 'async'
};

// Create centralized state manager
export const createStateManager = (config = {}) => {
  const state = {
    store: new Map(),
    subscribers: new Map(),
    middlewares: [],
    history: [],
    options: {
      enableHistory: config.enableHistory !== false,
      maxHistorySize: config.maxHistorySize || 1000,
      enableDevTools: config.enableDevTools && typeof window !== 'undefined',
      enablePersistence: config.enablePersistence || false,
      persistenceKey: config.persistenceKey || 'demo-state',
      debounceDelay: config.debounceDelay || 100,
      throttleDelay: config.throttleDelay || 50,
      ...config
    },
    timers: new Map()
  };

  // Initialize dev tools if enabled
  if (state.options.enableDevTools && window.__REDUX_DEVTOOLS_EXTENSION__) {
    state.devTools = window.__REDUX_DEVTOOLS_EXTENSION__.connect({
      name: 'Demo State Manager'
    });
  }

  // Load persisted state
  if (state.options.enablePersistence) {
    loadPersistedState();
  }

  // Register middleware
  const use = (middleware) => {
    if (typeof middleware !== 'function') {
      throw new Error('Middleware must be a function');
    }
    state.middlewares.push(middleware);
    return () => {
      const index = state.middlewares.indexOf(middleware);
      if (index !== -1) state.middlewares.splice(index, 1);
    };
  };

  // Set state value
  const setState = (key, value, options = {}) => {
    const oldValue = state.store.get(key);
    const updateType = StateUpdateType.SET;
    
    // Apply middlewares
    const context = { key, value, oldValue, type: updateType, options };
    const processedValue = applyMiddlewares(context);
    
    if (processedValue === undefined) {
      return; // Middleware cancelled the update
    }
    
    // Update store
    state.store.set(key, processedValue);
    
    // Record history
    if (state.options.enableHistory) {
      recordStateChange(key, oldValue, processedValue, updateType);
    }
    
    // Notify subscribers
    notifySubscribers(key, processedValue, oldValue, updateType);
    
    // Update dev tools
    if (state.devTools) {
      state.devTools.send(`SET ${key}`, Object.fromEntries(state.store));
    }
    
    // Persist if enabled
    if (state.options.enablePersistence) {
      persistState();
    }
  };

  // Update state value (shallow merge for objects)
  const updateState = (key, updater, options = {}) => {
    const oldValue = state.store.get(key);
    let newValue;
    
    if (typeof updater === 'function') {
      newValue = updater(oldValue);
    } else if (typeof oldValue === 'object' && oldValue !== null && !Array.isArray(oldValue)) {
      newValue = { ...oldValue, ...updater };
    } else {
      newValue = updater;
    }
    
    const updateType = StateUpdateType.UPDATE;
    
    // Apply middlewares
    const context = { key, value: newValue, oldValue, type: updateType, options };
    const processedValue = applyMiddlewares(context);
    
    if (processedValue === undefined) {
      return;
    }
    
    // Update store
    state.store.set(key, processedValue);
    
    // Record history
    if (state.options.enableHistory) {
      recordStateChange(key, oldValue, processedValue, updateType);
    }
    
    // Notify subscribers
    notifySubscribers(key, processedValue, oldValue, updateType);
    
    // Update dev tools
    if (state.devTools) {
      state.devTools.send(`UPDATE ${key}`, Object.fromEntries(state.store));
    }
    
    // Persist if enabled
    if (state.options.enablePersistence) {
      persistState();
    }
  };

  // Get state value
  const getState = (key, defaultValue = undefined) => {
    return state.store.has(key) ? state.store.get(key) : defaultValue;
  };

  // Delete state value
  const deleteState = (key) => {
    if (!state.store.has(key)) return;
    
    const oldValue = state.store.get(key);
    const updateType = StateUpdateType.DELETE;
    
    // Apply middlewares
    const context = { key, value: undefined, oldValue, type: updateType };
    if (applyMiddlewares(context) === undefined) {
      return; // Middleware cancelled the delete
    }
    
    state.store.delete(key);
    
    // Record history
    if (state.options.enableHistory) {
      recordStateChange(key, oldValue, undefined, updateType);
    }
    
    // Notify subscribers
    notifySubscribers(key, undefined, oldValue, updateType);
    
    // Update dev tools
    if (state.devTools) {
      state.devTools.send(`DELETE ${key}`, Object.fromEntries(state.store));
    }
    
    // Persist if enabled
    if (state.options.enablePersistence) {
      persistState();
    }
  };

  // Reset all state
  const resetState = (newState = {}) => {
    const oldStore = new Map(state.store);
    state.store.clear();
    
    // Set new state
    Object.entries(newState).forEach(([key, value]) => {
      state.store.set(key, value);
    });
    
    // Record history
    if (state.options.enableHistory) {
      recordStateChange('*', Object.fromEntries(oldStore), Object.fromEntries(state.store), StateUpdateType.RESET);
    }
    
    // Notify all subscribers
    for (const [key, value] of state.store) {
      notifySubscribers(key, value, oldStore.get(key), StateUpdateType.RESET);
    }
    
    // Update dev tools
    if (state.devTools) {
      state.devTools.send('RESET', Object.fromEntries(state.store));
    }
    
    // Persist if enabled
    if (state.options.enablePersistence) {
      persistState();
    }
  };

  // Subscribe to state changes
  const subscribe = (key, callback, options = {}) => {
    const subscriptionType = options.type || SubscriptionType.IMMEDIATE;
    const subscription = {
      callback,
      type: subscriptionType,
      options,
      id: Math.random().toString(36).substr(2, 9)
    };
    
    if (!state.subscribers.has(key)) {
      state.subscribers.set(key, []);
    }
    
    state.subscribers.get(key).push(subscription);
    
    // Return unsubscribe function
    return () => {
      const subscribers = state.subscribers.get(key);
      if (subscribers) {
        const index = subscribers.indexOf(subscription);
        if (index !== -1) {
          subscribers.splice(index, 1);
          
          // Clean up timers
          const timerKey = `${key}:${subscription.id}`;
          if (state.timers.has(timerKey)) {
            clearTimeout(state.timers.get(timerKey));
            state.timers.delete(timerKey);
          }
        }
      }
    };
  };

  // Subscribe to multiple keys
  const subscribeMultiple = (keys, callback, options = {}) => {
    const unsubscribers = keys.map(key => 
      subscribe(key, (value, oldValue, updateType) => {
        const currentState = Object.fromEntries(
          keys.map(k => [k, getState(k)])
        );
        callback(currentState, { key, value, oldValue, updateType });
      }, options)
    );
    
    return () => unsubscribers.forEach(unsub => unsub());
  };

  // Create computed state
  const createComputed = (keys, computeFn, options = {}) => {
    const computedKey = options.key || `computed_${Math.random().toString(36).substr(2, 9)}`;
    
    const recompute = () => {
      const values = keys.map(key => getState(key));
      const computedValue = computeFn(...values);
      setState(computedKey, computedValue, { computed: true });
    };
    
    // Initial computation
    recompute();
    
    // Subscribe to dependencies
    const unsubscribers = keys.map(key => 
      subscribe(key, recompute, { type: SubscriptionType.DEBOUNCED })
    );
    
    return {
      key: computedKey,
      destroy: () => {
        unsubscribers.forEach(unsub => unsub());
        deleteState(computedKey);
      }
    };
  };

  // Apply middlewares to state change
  const applyMiddlewares = (context) => {
    let result = context.value;
    
    for (const middleware of state.middlewares) {
      try {
        const middlewareResult = middleware({ ...context, value: result });
        if (middlewareResult === null || middlewareResult === false) {
          return undefined; // Cancel update
        }
        if (middlewareResult !== undefined) {
          result = middlewareResult;
        }
      } catch (error) {
        console.error('Middleware error:', error);
      }
    }
    
    return result;
  };

  // Notify subscribers
  const notifySubscribers = (key, value, oldValue, updateType) => {
    const subscribers = state.subscribers.get(key) || [];
    
    subscribers.forEach(subscription => {
      try {
        switch (subscription.type) {
          case SubscriptionType.IMMEDIATE:
            subscription.callback(value, oldValue, updateType);
            break;
            
          case SubscriptionType.DEBOUNCED:
            handleDebouncedCallback(subscription, key, value, oldValue, updateType);
            break;
            
          case SubscriptionType.THROTTLED:
            handleThrottledCallback(subscription, key, value, oldValue, updateType);
            break;
            
          case SubscriptionType.ASYNC:
            handleAsyncCallback(subscription, value, oldValue, updateType);
            break;
        }
      } catch (error) {
        console.error(`Subscriber error for key ${key}:`, error);
      }
    });
  };

  // Handle debounced callback
  const handleDebouncedCallback = (subscription, key, value, oldValue, updateType) => {
    const timerKey = `${key}:${subscription.id}`;
    
    if (state.timers.has(timerKey)) {
      clearTimeout(state.timers.get(timerKey));
    }
    
    const timer = setTimeout(() => {
      subscription.callback(value, oldValue, updateType);
      state.timers.delete(timerKey);
    }, subscription.options.delay || state.options.debounceDelay);
    
    state.timers.set(timerKey, timer);
  };

  // Handle throttled callback
  const handleThrottledCallback = (subscription, key, value, oldValue, updateType) => {
    const timerKey = `${key}:${subscription.id}`;
    
    if (!state.timers.has(timerKey)) {
      subscription.callback(value, oldValue, updateType);
      
      const timer = setTimeout(() => {
        state.timers.delete(timerKey);
      }, subscription.options.delay || state.options.throttleDelay);
      
      state.timers.set(timerKey, timer);
    }
  };

  // Handle async callback
  const handleAsyncCallback = (subscription, value, oldValue, updateType) => {
    Promise.resolve().then(() => {
      return subscription.callback(value, oldValue, updateType);
    }).catch(error => {
      console.error('Async subscriber error:', error);
    });
  };

  // Record state change in history
  const recordStateChange = (key, oldValue, newValue, updateType) => {
    const change = {
      key,
      oldValue: oldValue === undefined ? undefined : JSON.parse(JSON.stringify(oldValue)),
      newValue: newValue === undefined ? undefined : JSON.parse(JSON.stringify(newValue)),
      type: updateType,
      timestamp: Date.now()
    };
    
    state.history.push(change);
    
    // Limit history size
    if (state.history.length > state.options.maxHistorySize) {
      state.history.shift();
    }
  };

  // Persist state to localStorage
  const persistState = () => {
    if (typeof localStorage === 'undefined') return;
    
    try {
      const stateObj = Object.fromEntries(state.store);
      localStorage.setItem(state.options.persistenceKey, JSON.stringify(stateObj));
    } catch (error) {
      console.error('Failed to persist state:', error);
    }
  };

  // Load persisted state from localStorage
  const loadPersistedState = () => {
    if (typeof localStorage === 'undefined') return;
    
    try {
      const persistedData = localStorage.getItem(state.options.persistenceKey);
      if (persistedData) {
        const stateObj = JSON.parse(persistedData);
        Object.entries(stateObj).forEach(([key, value]) => {
          state.store.set(key, value);
        });
      }
    } catch (error) {
      console.error('Failed to load persisted state:', error);
    }
  };

  // Get state snapshot
  const getSnapshot = () => ({
    state: Object.fromEntries(state.store),
    timestamp: Date.now(),
    size: state.store.size
  });

  // Get history
  const getHistory = (key = null) => {
    if (key) {
      return state.history.filter(change => change.key === key);
    }
    return [...state.history];
  };

  // Clear history
  const clearHistory = () => {
    state.history.length = 0;
  };

  // Get all state keys
  const getKeys = () => [...state.store.keys()];

  // Check if key exists
  const hasState = (key) => state.store.has(key);

  // Get state size
  const getSize = () => state.store.size;

  // Batch state updates
  const batch = (updateFn) => {
    const originalNotify = notifySubscribers;
    const batchedNotifications = [];
    
    // Collect notifications during batch
    notifySubscribers = (key, value, oldValue, updateType) => {
      batchedNotifications.push({ key, value, oldValue, updateType });
    };
    
    try {
      updateFn({
        setState,
        updateState,
        deleteState
      });
    } finally {
      // Restore original notification function
      notifySubscribers = originalNotify;
      
      // Send batched notifications
      batchedNotifications.forEach(({ key, value, oldValue, updateType }) => {
        originalNotify(key, value, oldValue, updateType);
      });
    }
  };

  return {
    setState,
    updateState,
    getState,
    deleteState,
    resetState,
    subscribe,
    subscribeMultiple,
    createComputed,
    use,
    getSnapshot,
    getHistory,
    clearHistory,
    getKeys,
    hasState,
    getSize,
    batch
  };
};

// Built-in middlewares
export const createLoggerMiddleware = (options = {}) => {
  const logLevel = options.level || 'log';
  const prefix = options.prefix || '[State]';
  
  return (context) => {
    const { key, value, oldValue, type } = context;
    console[logLevel](`${prefix} ${type.toUpperCase()} ${key}:`, { oldValue, newValue: value });
    return value;
  };
};

export const createValidationMiddleware = (validators = {}) => {
  return (context) => {
    const { key, value } = context;
    const validator = validators[key];
    
    if (validator && typeof validator === 'function') {
      const isValid = validator(value, context);
      if (!isValid) {
        console.warn(`Validation failed for ${key}:`, value);
        return null; // Cancel update
      }
    }
    
    return value;
  };
};

export const createThrottleMiddleware = (delay = 100) => {
  const lastUpdate = new Map();
  
  return (context) => {
    const { key } = context;
    const now = Date.now();
    const last = lastUpdate.get(key) || 0;
    
    if (now - last < delay) {
      return null; // Cancel update
    }
    
    lastUpdate.set(key, now);
    return context.value;
  };
};

// Default state manager instance
export const defaultStateManager = createStateManager({
  enableHistory: true,
  enablePersistence: false,
  enableDevTools: true
});