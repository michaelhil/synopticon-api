/**
 * Loading State Manager
 * 
 * Centralized management of loading states with advanced progress tracking,
 * UI integration, and comprehensive analytics. Provides real-time feedback
 * for pipeline loading operations with cleanup automation.
 * 
 * Features:
 * - Centralized loading state management
 * - Advanced progress tracking with stages
 * - Automatic resource cleanup and timers
 * - Real-time listener notifications
 * - State history for debugging
 * - Performance metrics collection
 * - Configurable retention policies
 * 
 * States: idle, loading, loaded, error, failed, cached, preloading
 * Progress Stages: initializing, fetching, downloading, parsing, compiling, executing, caching, complete
 * 
 * @example
 * ```javascript
 * import { createLoadingStateManager } from './src/core/loading-state-manager.js';
 * 
 * const stateManager = createLoadingStateManager({
 *   enableProgressTracking: true,
 *   stateRetentionTime: 30000,
 *   maxStateHistory: 100
 * });
 * 
 * // Update loading state
 * stateManager.updateLoadingState('mediapipe-face', 'loading', { startTime: Date.now() });
 * 
 * // Track progress
 * const tracker = stateManager.createProgressTracker('mediapipe-face', ['initializing', 'loading', 'complete']);
 * tracker.nextStage('Loading MediaPipe...');
 * tracker.updateProgress(50, 'Halfway loaded');
 * tracker.complete('Ready');
 * 
 * // Listen to state changes
 * const unsubscribe = stateManager.onLoadingStateChange((stateData) => {
 *   console.log(`${stateData.identifier}: ${stateData.state}`);
 * });
 * ```
 */

import { handleError, ErrorCategory, ErrorSeverity } from '../utils/error-handler.js';

// Loading state types
export const LoadingStates = {
  IDLE: 'idle',
  LOADING: 'loading',
  LOADED: 'loaded',
  ERROR: 'error',
  FAILED: 'failed',
  CACHED: 'cached',
  PRELOADING: 'preloading'
};

// Progress stages for detailed loading feedback
export const ProgressStages = {
  INITIALIZING: 'initializing',
  FETCHING: 'fetching',
  DOWNLOADING: 'downloading',
  PARSING: 'parsing',
  COMPILING: 'compiling',
  EXECUTING: 'executing',
  CACHING: 'caching',
  COMPLETE: 'complete'
};

/**
 * Create loading state manager with progress tracking
 * @param {Object} config - Manager configuration
 * @returns {Object} - State manager instance
 */
export const createLoadingStateManager = (config = {}) => {
  const state = {
    config: {
      enableProgressTracking: config.enableProgressTracking !== false,
      progressUpdateInterval: config.progressUpdateInterval || 100,
      stateRetentionTime: config.stateRetentionTime || 30000, // 30 seconds
      maxStateHistory: config.maxStateHistory || 100,
      ...config
    },
    
    // Current states
    currentStates: new Map(),
    progressData: new Map(),
    
    // State history for debugging
    stateHistory: [],
    
    // Listeners
    stateListeners: new Set(),
    progressListeners: new Set(),
    
    // Timers for cleanup
    cleanupTimers: new Map()
  };

  /**
   * Add state to history with cleanup
   * @param {Object} stateChange - State change information
   */
  const addToHistory = (stateChange) => {
    state.stateHistory.push({
      ...stateChange,
      id: `${stateChange.identifier}_${Date.now()}`
    });
    
    // Limit history size
    if (state.stateHistory.length > state.config.maxStateHistory) {
      state.stateHistory.shift();
    }
  };

  /**
   * Schedule cleanup for completed/failed states
   * @param {string} identifier - Resource identifier
   */
  const scheduleCleanup = (identifier) => {
    // Clear existing timer
    if (state.cleanupTimers.has(identifier)) {
      clearTimeout(state.cleanupTimers.get(identifier));
    }
    
    // Schedule new cleanup
    const timer = setTimeout(() => {
      state.currentStates.delete(identifier);
      state.progressData.delete(identifier);
      state.cleanupTimers.delete(identifier);
      
      handleError(
        `Loading state cleaned up for: ${identifier}`,
        ErrorCategory.INITIALIZATION,
        ErrorSeverity.DEBUG,
        { identifier }
      );
    }, state.config.stateRetentionTime);
    
    state.cleanupTimers.set(identifier, timer);
  };

  /**
   * Update loading state for a resource
   * @param {string} identifier - Resource identifier (e.g., pipeline name)
   * @param {string} newState - New loading state
   * @param {Object} metadata - Additional metadata
   */
  const updateLoadingState = (identifier, newState, metadata = {}) => {
    if (!identifier || !newState) {
      throw new Error('Identifier and state are required');
    }

    if (!Object.values(LoadingStates).includes(newState)) {
      throw new Error(`Invalid loading state: ${newState}`);
    }

    const timestamp = Date.now();
    const previousState = state.currentStates.get(identifier);
    
    const stateData = {
      identifier,
      state: newState,
      previousState: previousState?.state,
      timestamp,
      duration: previousState ? timestamp - previousState.timestamp : 0,
      ...metadata
    };

    // Update current state
    state.currentStates.set(identifier, stateData);
    
    // Add to history
    addToHistory(stateData);

    // Schedule cleanup for terminal states
    if ([LoadingStates.LOADED, LoadingStates.FAILED, LoadingStates.CACHED].includes(newState)) {
      scheduleCleanup(identifier);
    }

    // Notify state listeners
    state.stateListeners.forEach(listener => {
      try {
        listener(stateData);
      } catch (error) {
        console.warn(`Loading state listener error for ${identifier}:`, error);
      }
    });

    handleError(
      `Loading state updated: ${identifier} -> ${newState}`,
      ErrorCategory.INITIALIZATION,
      ErrorSeverity.DEBUG,
      { identifier, state: newState, metadata }
    );
  };

  /**
   * Update loading progress for a resource
   * @param {string} identifier - Resource identifier
   * @param {Object} progressInfo - Progress information
   */
  const updateProgress = (identifier, progressInfo) => {
    if (!identifier) {
      throw new Error('Identifier is required for progress updates');
    }

    if (!state.config.enableProgressTracking) {
      return; // Progress tracking disabled
    }

    const timestamp = Date.now();
    const currentProgress = state.progressData.get(identifier) || {};
    
    const updatedProgress = {
      ...currentProgress,
      ...progressInfo,
      identifier,
      timestamp,
      lastUpdate: timestamp
    };

    // Validate progress percentage
    if (updatedProgress.percentage !== undefined) {
      updatedProgress.percentage = Math.max(0, Math.min(100, updatedProgress.percentage));
    }

    state.progressData.set(identifier, updatedProgress);

    // Notify progress listeners
    state.progressListeners.forEach(listener => {
      try {
        listener(updatedProgress);
      } catch (error) {
        console.warn(`Progress listener error for ${identifier}:`, error);
      }
    });
  };

  /**
   * Get current loading state for a resource
   * @param {string} identifier - Resource identifier
   * @returns {Object} - Current loading state
   */
  const getLoadingState = (identifier) => {
    return state.currentStates.get(identifier) || {
      identifier,
      state: LoadingStates.IDLE,
      timestamp: null,
      duration: 0
    };
  };

  /**
   * Get current progress for a resource
   * @param {string} identifier - Resource identifier
   * @returns {Object} - Current progress information
   */
  const getProgress = (identifier) => {
    return state.progressData.get(identifier) || {
      identifier,
      percentage: 0,
      stage: ProgressStages.INITIALIZING,
      message: 'Initializing...',
      timestamp: null
    };
  };

  /**
   * Get all current loading states
   * @returns {Map} - Map of all current states
   */
  const getAllLoadingStates = () => {
    return new Map(state.currentStates);
  };

  /**
   * Get resources in specific loading states
   * @param {Array<string>} states - States to filter by
   * @returns {Array} - Resources in specified states
   */
  const getResourcesInStates = (states = []) => {
    const results = [];
    
    for (const [identifier, stateData] of state.currentStates.entries()) {
      if (states.includes(stateData.state)) {
        results.push(stateData);
      }
    }
    
    return results;
  };

  /**
   * Check if any resources are currently loading
   * @returns {boolean} - True if any resources are loading
   */
  const hasActiveLoading = () => {
    return getResourcesInStates([LoadingStates.LOADING, LoadingStates.PRELOADING]).length > 0;
  };

  /**
   * Subscribe to loading state changes
   * @param {Function} listener - State change listener
   * @returns {Function} - Unsubscribe function
   */
  const onLoadingStateChange = (listener) => {
    if (typeof listener !== 'function') {
      throw new Error('Loading state listener must be a function');
    }
    
    state.stateListeners.add(listener);
    
    return () => {
      state.stateListeners.delete(listener);
    };
  };

  /**
   * Subscribe to progress updates
   * @param {Function} listener - Progress update listener
   * @returns {Function} - Unsubscribe function
   */
  const onProgressUpdate = (listener) => {
    if (typeof listener !== 'function') {
      throw new Error('Progress listener must be a function');
    }
    
    state.progressListeners.add(listener);
    
    return () => {
      state.progressListeners.delete(listener);
    };
  };

  /**
   * Create a progress tracker for a specific resource
   * @param {string} identifier - Resource identifier
   * @param {Array<string>} stages - Progress stages for this resource
   * @returns {Object} - Progress tracker instance
   */
  const createProgressTracker = (identifier, stages = Object.values(ProgressStages)) => {
    let currentStageIndex = 0;
    let stageStartTime = Date.now();
    
    const tracker = {
      // Update to next stage
      nextStage: (message = '') => {
        if (currentStageIndex < stages.length - 1) {
          currentStageIndex++;
          stageStartTime = Date.now();
          
          const percentage = Math.round((currentStageIndex / stages.length) * 100);
          
          updateProgress(identifier, {
            stage: stages[currentStageIndex],
            percentage,
            message: message || `${stages[currentStageIndex]}...`,
            stageIndex: currentStageIndex,
            totalStages: stages.length
          });
        }
      },
      
      // Update progress within current stage
      updateProgress: (percentage, message = '') => {
        const stageProgress = (currentStageIndex / stages.length) * 100;
        const withinStageProgress = (percentage / 100) * (100 / stages.length);
        const totalPercentage = Math.round(stageProgress + withinStageProgress);
        
        updateProgress(identifier, {
          stage: stages[currentStageIndex],
          percentage: totalPercentage,
          message: message || `${stages[currentStageIndex]}... ${percentage}%`,
          stageIndex: currentStageIndex,
          totalStages: stages.length,
          stageProgress: percentage
        });
      },
      
      // Complete progress tracking
      complete: (message = 'Complete') => {
        updateProgress(identifier, {
          stage: ProgressStages.COMPLETE,
          percentage: 100,
          message,
          stageIndex: stages.length - 1,
          totalStages: stages.length,
          completed: true
        });
      },
      
      // Mark as failed
      fail: (error, message = 'Failed') => {
        updateProgress(identifier, {
          stage: stages[currentStageIndex],
          percentage: 0,
          message,
          error: error.message || error,
          failed: true
        });
      }
    };
    
    // Initialize first stage
    tracker.updateProgress(0, `Starting ${stages[0]}...`);
    
    return tracker;
  };

  /**
   * Get loading statistics
   * @returns {Object} - Loading statistics
   */
  const getStatistics = () => {
    const totalStates = state.currentStates.size;
    const statesByType = {};
    
    // Count states by type
    for (const stateData of state.currentStates.values()) {
      statesByType[stateData.state] = (statesByType[stateData.state] || 0) + 1;
    }
    
    return {
      totalResources: totalStates,
      statesByType,
      hasActiveLoading: hasActiveLoading(),
      historySize: state.stateHistory.length,
      progressTrackingEnabled: state.config.enableProgressTracking,
      activeListeners: {
        stateListeners: state.stateListeners.size,
        progressListeners: state.progressListeners.size
      }
    };
  };

  /**
   * Clear all states and progress data
   */
  const clearAll = () => {
    // Clear all timers
    for (const timer of state.cleanupTimers.values()) {
      clearTimeout(timer);
    }
    
    // Clear state
    state.currentStates.clear();
    state.progressData.clear();
    state.stateHistory = [];
    state.cleanupTimers.clear();
    
    handleError(
      'All loading states cleared',
      ErrorCategory.INITIALIZATION,
      ErrorSeverity.INFO
    );
  };

  /**
   * Get state history for debugging
   * @param {string} identifier - Optional identifier filter
   * @returns {Array} - State history
   */
  const getStateHistory = (identifier = null) => {
    if (identifier) {
      return state.stateHistory.filter(entry => entry.identifier === identifier);
    }
    return [...state.stateHistory];
  };

  return {
    // State management
    updateLoadingState,
    getLoadingState,
    getAllLoadingStates,
    getAllStates: () => state.currentStates,
    clearState: (identifier) => {
      state.currentStates.delete(identifier);
      state.progressData.delete(identifier);
      if (state.cleanupTimers.has(identifier)) {
        clearTimeout(state.cleanupTimers.get(identifier));
        state.cleanupTimers.delete(identifier);
      }
    },
    getResourcesInStates,
    hasActiveLoading,
    
    // Progress tracking
    updateProgress,
    getProgress,
    createProgressTracker,
    
    // Subscriptions
    onLoadingStateChange,
    onProgressUpdate,
    
    // Utilities
    getStatistics,
    getStateHistory,
    clearAll,
    
    // Configuration
    getConfig: () => ({ ...state.config }),
    updateConfig: (updates) => {
      state.config = { ...state.config, ...updates };
    },
    
    // Constants export
    LoadingStates,
    ProgressStages
  };
};