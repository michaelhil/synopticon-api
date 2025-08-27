/**
 * State Manager Helper Functions
 * Extracted helper functions to reduce complexity of main state manager
 */

// State history management
export const createHistoryManager = (maxSize = 1000) => {
  const history = [];
  
  return {
    push: (entry) => {
      history.push({
        ...entry,
        timestamp: Date.now()
      });
      
      if (history.length > maxSize) {
        history.shift();
      }
    },
    
    getHistory: () => [...history],
    
    clear: () => {
      history.length = 0;
    },
    
    getLastN: (n) => history.slice(-n)
  };
};

// Middleware execution helper
export const applyMiddlewares = (middlewares, context) => {
  let processedValue = context.value;
  
  for (const middleware of middlewares) {
    try {
      const result = middleware({
        ...context,
        value: processedValue
      });
      
      if (result !== undefined) {
        processedValue = result;
      }
    } catch (error) {
      console.warn('Middleware error:', error);
    }
  }
  
  return processedValue;
};

// State persistence helpers
export const createPersistenceManager = (key) => ({
  save: (data) => {
    try {
      localStorage.setItem(key, JSON.stringify({
        data,
        timestamp: Date.now()
      }));
    } catch (error) {
      console.warn('Failed to save state:', error);
    }
  },
  
  load: () => {
    try {
      const saved = localStorage.getItem(key);
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.data;
      }
    } catch (error) {
      console.warn('Failed to load state:', error);
    }
    return null;
  },
  
  clear: () => {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.warn('Failed to clear state:', error);
    }
  }
});

// DevTools integration helper
export const createDevToolsManager = () => {
  if (typeof window !== 'undefined' && window.__REDUX_DEVTOOLS_EXTENSION__) {
    return window.__REDUX_DEVTOOLS_EXTENSION__.connect({
      name: 'Demo State Manager'
    });
  }
  return null;
};

// Subscription management helper
export const createSubscriptionManager = () => {
  const subscribers = new Map();
  
  return {
    subscribe: (key, callback, options = {}) => {
      if (!subscribers.has(key)) {
        subscribers.set(key, new Set());
      }
      
      const subscription = {
        callback,
        options,
        id: Math.random().toString(36).substr(2, 9)
      };
      
      subscribers.get(key).add(subscription);
      
      // Return unsubscribe function
      return () => {
        const subs = subscribers.get(key);
        if (subs) {
          subs.delete(subscription);
          if (subs.size === 0) {
            subscribers.delete(key);
          }
        }
      };
    },
    
    notify: (key, data) => {
      const subs = subscribers.get(key);
      if (subs) {
        for (const sub of subs) {
          try {
            sub.callback(data);
          } catch (error) {
            console.warn(`Subscriber error for key ${key}:`, error);
          }
        }
      }
    },
    
    notifyAll: (data) => {
      for (const [key, subs] of subscribers) {
        if (key === '*') {
          for (const sub of subs) {
            try {
              sub.callback(data);
            } catch (error) {
              console.warn('Global subscriber error:', error);
            }
          }
        }
      }
    },
    
    hasSubscribers: (key) => {
      return subscribers.has(key) && subscribers.get(key).size > 0;
    },
    
    getSubscriberCount: (key) => {
      const subs = subscribers.get(key);
      return subs ? subs.size : 0;
    },
    
    clearAll: () => {
      subscribers.clear();
    }
  };
};

// Timer management for debounce/throttle
export const createTimerManager = () => {
  const timers = new Map();
  
  return {
    debounce: (key, fn, delay) => {
      if (timers.has(key)) {
        clearTimeout(timers.get(key));
      }
      
      const timerId = setTimeout(() => {
        fn();
        timers.delete(key);
      }, delay);
      
      timers.set(key, timerId);
    },
    
    throttle: (key, fn, delay) => {
      if (!timers.has(key)) {
        fn();
        const timerId = setTimeout(() => {
          timers.delete(key);
        }, delay);
        timers.set(key, timerId);
      }
    },
    
    clear: (key) => {
      if (timers.has(key)) {
        clearTimeout(timers.get(key));
        timers.delete(key);
      }
    },
    
    clearAll: () => {
      for (const timerId of timers.values()) {
        clearTimeout(timerId);
      }
      timers.clear();
    }
  };
};