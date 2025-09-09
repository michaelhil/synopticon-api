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
 */

import { ErrorCategory, ErrorSeverity, handleError } from '../../shared/utils/error-handler.js'
import { createLogger } from '../../shared/utils/logger.js';

const logger = createLogger({ level: 2 });

// Loading state types
export const LoadingStates = {
  IDLE: 'idle',
  LOADING: 'loading',
  LOADED: 'loaded',
  ERROR: 'error',
  FAILED: 'failed',
  CACHED: 'cached',
  PRELOADING: 'preloading'
} as const;

export type LoadingState = typeof LoadingStates[keyof typeof LoadingStates];

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
} as const;

export type ProgressStage = typeof ProgressStages[keyof typeof ProgressStages];

export interface LoadingStateManagerConfig {
  enableProgressTracking?: boolean;
  progressUpdateInterval?: number;
  stateRetentionTime?: number;
  maxStateHistory?: number;
  [key: string]: unknown;
}

export interface StateData {
  identifier: string;
  state: LoadingState;
  previousState?: LoadingState;
  timestamp: number;
  duration: number;
  [key: string]: unknown;
}

export interface ProgressInfo {
  identifier?: string;
  percentage?: number;
  stage?: ProgressStage;
  message?: string;
  timestamp?: number;
  lastUpdate?: number;
  stageIndex?: number;
  totalStages?: number;
  stageProgress?: number;
  completed?: boolean;
  failed?: boolean;
  error?: string;
  [key: string]: unknown;
}

export interface StateHistoryEntry extends StateData {
  id: string;
}

export interface LoadingStatistics {
  totalResources: number;
  statesByType: Record<string, number>;
  hasActiveLoading: boolean;
  historySize: number;
  progressTrackingEnabled: boolean;
  activeListeners: {
    stateListeners: number;
    progressListeners: number;
  };
}

export interface ProgressTracker {
  nextStage: (message?: string) => void;
  updateProgress: (percentage: number, message?: string) => void;
  complete: (message?: string) => void;
  fail: (error: Error | string, message?: string) => void;
}

export type StateChangeListener = (stateData: StateData) => void;
export type ProgressUpdateListener = (progressInfo: ProgressInfo) => void;
export type UnsubscribeFunction = () => void;

export interface LoadingStateManager {
  // State management
  updateLoadingState: (identifier: string, newState: LoadingState, metadata?: Record<string, unknown>) => void;
  getLoadingState: (identifier: string) => StateData;
  getAllLoadingStates: () => Map<string, StateData>;
  getAllStates: () => Map<string, StateData>;
  clearState: (identifier: string) => void;
  getResourcesInStates: (states?: LoadingState[]) => StateData[];
  hasActiveLoading: () => boolean;
  
  // Progress tracking
  updateProgress: (identifier: string, progressInfo: ProgressInfo) => void;
  getProgress: (identifier: string) => ProgressInfo;
  createProgressTracker: (identifier: string, stages?: string[]) => ProgressTracker;
  
  // Subscriptions
  onLoadingStateChange: (listener: StateChangeListener) => UnsubscribeFunction;
  onProgressUpdate: (listener: ProgressUpdateListener) => UnsubscribeFunction;
  
  // Utilities
  getStatistics: () => LoadingStatistics;
  getStateHistory: (identifier?: string | null) => StateHistoryEntry[];
  clearAll: () => void;
  
  // Configuration
  getConfig: () => LoadingStateManagerConfig;
  updateConfig: (updates: Partial<LoadingStateManagerConfig>) => void;
  
  // Constants export
  LoadingStates: typeof LoadingStates;
  ProgressStages: typeof ProgressStages;
}

interface LoadingStateManagerState {
  config: Required<LoadingStateManagerConfig>;
  currentStates: Map<string, StateData>;
  progressData: Map<string, ProgressInfo>;
  stateHistory: StateHistoryEntry[];
  stateListeners: Set<StateChangeListener>;
  progressListeners: Set<ProgressUpdateListener>;
  cleanupTimers: Map<string, NodeJS.Timeout>;
}

/**
 * Create loading state manager with progress tracking
 */
export const createLoadingStateManager = (config: LoadingStateManagerConfig = {}): LoadingStateManager => {
  const state: LoadingStateManagerState = {
    config: {
      enableProgressTracking: config.enableProgressTracking !== false,
      progressUpdateInterval: config.progressUpdateInterval || 100,
      stateRetentionTime: config.stateRetentionTime || 30000, // 30 seconds
      maxStateHistory: config.maxStateHistory || 100,
      ...config
    } as Required<LoadingStateManagerConfig>,
    
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
   */
  const addToHistory = (stateChange: StateData): void => {
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
   */
  const scheduleCleanup = (identifier: string): void => {
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
   */
  const updateLoadingState = (identifier: string, newState: LoadingState, metadata: Record<string, unknown> = {}): void => {
    if (!identifier || !newState) {
      throw new Error('Identifier and state are required');
    }

    if (!Object.values(LoadingStates).includes(newState)) {
      throw new Error(`Invalid loading state: ${newState}`);
    }

    const timestamp = Date.now();
    const previousState = state.currentStates.get(identifier);
    
    const stateData: StateData = {
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
   */
  const updateProgress = (identifier: string, progressInfo: ProgressInfo): void => {
    if (!identifier) {
      throw new Error('Identifier is required for progress updates');
    }

    if (!state.config.enableProgressTracking) {
      return; // Progress tracking disabled
    }

    const timestamp = Date.now();
    const currentProgress = state.progressData.get(identifier) || {};
    
    const updatedProgress: ProgressInfo = {
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
   */
  const getLoadingState = (identifier: string): StateData => {
    return state.currentStates.get(identifier) || {
      identifier,
      state: LoadingStates.IDLE,
      timestamp: Date.now(),
      duration: 0
    };
  };

  /**
   * Get current progress for a resource
   */
  const getProgress = (identifier: string): ProgressInfo => {
    return state.progressData.get(identifier) || {
      identifier,
      percentage: 0,
      stage: ProgressStages.INITIALIZING,
      message: 'Initializing...',
      timestamp: Date.now()
    };
  };

  /**
   * Get all current loading states
   */
  const getAllLoadingStates = (): Map<string, StateData> => {
    return new Map(state.currentStates);
  };

  /**
   * Get resources in specific loading states
   */
  const getResourcesInStates = (states: LoadingState[] = []): StateData[] => {
    const results: StateData[] = [];
    
    for (const [identifier, stateData] of state.currentStates.entries()) {
      if (states.includes(stateData.state)) {
        results.push(stateData);
      }
    }
    
    return results;
  };

  /**
   * Check if any resources are currently loading
   */
  const hasActiveLoading = (): boolean => {
    return getResourcesInStates([LoadingStates.LOADING, LoadingStates.PRELOADING]).length > 0;
  };

  /**
   * Subscribe to loading state changes
   */
  const onLoadingStateChange = (listener: StateChangeListener): UnsubscribeFunction => {
    if (typeof listener !== 'function') {
      throw new Error('Loading state listener must be a function');
    }
    
    state.stateListeners.add(listener);
    
    return (): void => {
      state.stateListeners.delete(listener);
    };
  };

  /**
   * Subscribe to progress updates
   */
  const onProgressUpdate = (listener: ProgressUpdateListener): UnsubscribeFunction => {
    if (typeof listener !== 'function') {
      throw new Error('Progress listener must be a function');
    }
    
    state.progressListeners.add(listener);
    
    return (): void => {
      state.progressListeners.delete(listener);
    };
  };

  /**
   * Create a progress tracker for a specific resource
   */
  const createProgressTracker = (identifier: string, stages: string[] = Object.values(ProgressStages)): ProgressTracker => {
    let currentStageIndex = 0;
    let stageStartTime = Date.now();
    
    const tracker: ProgressTracker = {
      // Update to next stage
      nextStage: (message: string = ''): void => {
        if (currentStageIndex < stages.length - 1) {
          currentStageIndex++;
          stageStartTime = Date.now();
          
          const percentage = Math.round((currentStageIndex / stages.length) * 100);
          
          updateProgress(identifier, {
            stage: stages[currentStageIndex] as ProgressStage,
            percentage,
            message: message || `${stages[currentStageIndex]}...`,
            stageIndex: currentStageIndex,
            totalStages: stages.length
          });
        }
      },
      
      // Update progress within current stage
      updateProgress: (percentage: number, message: string = ''): void => {
        const stageProgress = (currentStageIndex / stages.length) * 100;
        const withinStageProgress = (percentage / 100) * (100 / stages.length);
        const totalPercentage = Math.round(stageProgress + withinStageProgress);
        
        updateProgress(identifier, {
          stage: stages[currentStageIndex] as ProgressStage,
          percentage: totalPercentage,
          message: message || `${stages[currentStageIndex]}... ${percentage}%`,
          stageIndex: currentStageIndex,
          totalStages: stages.length,
          stageProgress: percentage
        });
      },
      
      // Complete progress tracking
      complete: (message: string = 'Complete'): void => {
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
      fail: (error: Error | string, message: string = 'Failed'): void => {
        updateProgress(identifier, {
          stage: stages[currentStageIndex] as ProgressStage,
          percentage: 0,
          message,
          error: typeof error === 'string' ? error : error.message,
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
   */
  const getStatistics = (): LoadingStatistics => {
    const totalStates = state.currentStates.size;
    const statesByType: Record<string, number> = {};
    
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
  const clearAll = (): void => {
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
   */
  const getStateHistory = (identifier: string | null = null): StateHistoryEntry[] => {
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
    clearState: (identifier: string): void => {
      state.currentStates.delete(identifier);
      state.progressData.delete(identifier);
      if (state.cleanupTimers.has(identifier)) {
        clearTimeout(state.cleanupTimers.get(identifier)!);
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
    getConfig: (): LoadingStateManagerConfig => ({ ...state.config }),
    updateConfig: (updates: Partial<LoadingStateManagerConfig>): void => {
      state.config = { ...state.config, ...updates } as Required<LoadingStateManagerConfig>;
    },
    
    // Constants export
    LoadingStates,
    ProgressStages
  };
};