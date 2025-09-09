/**
 * Execution Scheduler
 * Advanced scheduling system for composition execution with priority queues and resource management
 */

import type { BaseComposition, CompositionResult, CompositionEngineConfig } from '../composition-engine.js';

export interface ScheduledExecution {
  id: string;
  composition: BaseComposition;
  priority: number;
  scheduledTime: number;
  executeAt?: number;
  timeout?: number;
  maxRetries?: number;
  retryCount: number;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  result?: CompositionResult;
  error?: Error;
  metadata?: Record<string, any>;
}

export interface ScheduleOptions {
  priority?: number;
  delay?: number;
  executeAt?: number;
  timeout?: number;
  maxRetries?: number;
  metadata?: Record<string, any>;
}

export interface SchedulerStats {
  totalScheduled: number;
  pending: number;
  running: number;
  completed: number;
  failed: number;
  cancelled: number;
  avgWaitTime: number;
  avgExecutionTime: number;
  queueUtilization: number;
  workerUtilization: number;
}

export interface ExecutionSchedulerConfig extends CompositionEngineConfig {
  maxConcurrentExecutions?: number;
  defaultPriority?: number;
  maxQueueSize?: number;
  executionTimeout?: number;
  retryDelay?: number;
  enablePriorityBoost?: boolean;
  schedulingInterval?: number;
}

/**
 * Creates execution scheduler
 */
export const createExecutionScheduler = (config: ExecutionSchedulerConfig) => {
  const schedulerConfig = {
    maxConcurrentExecutions: config.maxConcurrentExecutions || 5,
    defaultPriority: config.defaultPriority || 5,
    maxQueueSize: config.maxQueueSize || 1000,
    executionTimeout: config.executionTimeout || 300000, // 5 minutes
    retryDelay: config.retryDelay || 5000,
    enablePriorityBoost: config.enablePriorityBoost !== false,
    schedulingInterval: config.schedulingInterval || 1000,
    ...config
  };

  const state = {
    scheduledExecutions: new Map<string, ScheduledExecution>(),
    priorityQueues: new Map<number, ScheduledExecution[]>(), // priority -> executions
    runningExecutions: new Map<string, ScheduledExecution>(),
    completedExecutions: new Map<string, ScheduledExecution>(),
    
    metrics: {
      totalScheduled: 0,
      totalCompleted: 0,
      totalFailed: 0,
      totalCancelled: 0,
      avgWaitTime: 0,
      avgExecutionTime: 0,
      lastSchedulingTime: 0
    },

    schedulerTimer: null as NodeJS.Timeout | null,
    isRunning: false
  };

  // Priority queue management
  const addToPriorityQueue = (execution: ScheduledExecution): void => {
    let queue = state.priorityQueues.get(execution.priority);
    if (!queue) {
      queue = [];
      state.priorityQueues.set(execution.priority, queue);
    }
    
    queue.push(execution);
    
    // Sort by scheduled time within the same priority
    queue.sort((a, b) => a.scheduledTime - b.scheduledTime);
  };

  const removeFromPriorityQueue = (executionId: string): boolean => {
    for (const [priority, queue] of state.priorityQueues) {
      const index = queue.findIndex(exec => exec.id === executionId);
      if (index !== -1) {
        queue.splice(index, 1);
        if (queue.length === 0) {
          state.priorityQueues.delete(priority);
        }
        return true;
      }
    }
    return false;
  };

  const getNextExecution = (): ScheduledExecution | null => {
    const now = Date.now();
    
    // Get all priorities sorted descending (higher priority first)
    const priorities = Array.from(state.priorityQueues.keys()).sort((a, b) => b - a);
    
    for (const priority of priorities) {
      const queue = state.priorityQueues.get(priority);
      if (!queue || queue.length === 0) {
        continue;
      }

      // Find first execution that's ready to run
      for (let i = 0; i < queue.length; i++) {
        const execution = queue[i];
        const executeAt = execution.executeAt || execution.scheduledTime;
        
        if (executeAt <= now) {
          queue.splice(i, 1);
          if (queue.length === 0) {
            state.priorityQueues.delete(priority);
          }
          return execution;
        }
      }
    }

    return null;
  };

  // Schedule composition for execution
  const schedule = async (
    composition: BaseComposition,
    options: ScheduleOptions = {}
  ): Promise<string> => {
    if (state.scheduledExecutions.size >= schedulerConfig.maxQueueSize) {
      throw new Error(`Queue size limit exceeded: ${schedulerConfig.maxQueueSize}`);
    }

    const executionId = `sched_${composition.id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = Date.now();
    const executeAt = options.executeAt || (now + (options.delay || 0));

    const scheduledExecution: ScheduledExecution = {
      id: executionId,
      composition: { ...composition }, // Deep copy
      priority: options.priority || schedulerConfig.defaultPriority,
      scheduledTime: now,
      executeAt,
      timeout: options.timeout || schedulerConfig.executionTimeout,
      maxRetries: options.maxRetries || 0,
      retryCount: 0,
      status: 'pending',
      metadata: options.metadata || {}
    };

    state.scheduledExecutions.set(executionId, scheduledExecution);
    addToPriorityQueue(scheduledExecution);
    state.metrics.totalScheduled++;

    // Start scheduler if not running
    if (!state.isRunning) {
      startScheduler();
    }

    return executionId;
  };

  // Execute composition (would integrate with composition engine)
  const executeComposition = async (execution: ScheduledExecution): Promise<CompositionResult> => {
    // This is a placeholder - in practice would call the composition engine
    const startTime = Date.now();
    
    try {
      // Simulate execution time based on composition complexity
      const simulatedTime = Math.random() * 2000 + 500; // 500ms - 2.5s
      await new Promise(resolve => setTimeout(resolve, simulatedTime));
      
      const result: CompositionResult = {
        compositionId: execution.composition.id,
        pattern: execution.composition.pattern,
        success: Math.random() > 0.1, // 90% success rate simulation
        results: [{ pipelineId: 'simulated', result: { status: 'completed' } }],
        errors: [],
        executionTime: Date.now() - startTime,
        timestamp: startTime
      };

      return result;
    } catch (error) {
      throw error;
    }
  };

  // Execute single scheduled item
  const executeScheduledItem = async (execution: ScheduledExecution): Promise<void> => {
    const startTime = Date.now();
    execution.status = 'running';
    state.runningExecutions.set(execution.id, execution);

    // Update wait time metrics
    const waitTime = startTime - execution.scheduledTime;
    const totalWait = state.metrics.avgWaitTime * (state.metrics.totalCompleted + state.metrics.totalFailed);
    state.metrics.avgWaitTime = (totalWait + waitTime) / (state.metrics.totalCompleted + state.metrics.totalFailed + 1);

    try {
      // Execute with timeout
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Execution timeout')), execution.timeout);
      });

      const executionPromise = executeComposition(execution);
      const result = await Promise.race([executionPromise, timeoutPromise]);

      // Handle successful execution
      execution.result = result;
      execution.status = result.success ? 'completed' : 'failed';

      if (result.success) {
        state.metrics.totalCompleted++;
      } else {
        state.metrics.totalFailed++;
        
        // Handle retries
        if (execution.retryCount < (execution.maxRetries || 0)) {
          execution.retryCount++;
          execution.status = 'pending';
          execution.executeAt = Date.now() + schedulerConfig.retryDelay;
          
          // Re-add to queue for retry
          addToPriorityQueue(execution);
          state.runningExecutions.delete(execution.id);
          return;
        }
      }

      // Update execution time metrics
      const executionTime = Date.now() - startTime;
      const totalExecTime = state.metrics.avgExecutionTime * (state.metrics.totalCompleted + state.metrics.totalFailed - 1);
      state.metrics.avgExecutionTime = (totalExecTime + executionTime) / (state.metrics.totalCompleted + state.metrics.totalFailed);

    } catch (error) {
      execution.error = error as Error;
      execution.status = 'failed';
      state.metrics.totalFailed++;

      // Handle retries for errors
      if (execution.retryCount < (execution.maxRetries || 0)) {
        execution.retryCount++;
        execution.status = 'pending';
        execution.executeAt = Date.now() + schedulerConfig.retryDelay;
        
        addToPriorityQueue(execution);
        state.runningExecutions.delete(execution.id);
        return;
      }
    } finally {
      // Move to completed executions
      state.runningExecutions.delete(execution.id);
      state.completedExecutions.set(execution.id, execution);
      
      // Clean up old completed executions (keep last 1000)
      if (state.completedExecutions.size > 1000) {
        const oldestId = state.completedExecutions.keys().next().value;
        state.completedExecutions.delete(oldestId);
      }
    }
  };

  // Priority boosting for long-waiting executions
  const boostPriorities = (): void => {
    if (!schedulerConfig.enablePriorityBoost) return;

    const now = Date.now();
    const boostThreshold = 30000; // 30 seconds
    const maxPriority = 10;

    for (const [priority, queue] of state.priorityQueues) {
      for (const execution of queue) {
        const waitTime = now - execution.scheduledTime;
        
        if (waitTime > boostThreshold && execution.priority < maxPriority) {
          // Remove from current queue
          removeFromPriorityQueue(execution.id);
          
          // Boost priority
          execution.priority = Math.min(maxPriority, execution.priority + 1);
          
          // Add back to appropriate queue
          addToPriorityQueue(execution);
          break; // Process one boost per cycle to avoid disruption
        }
      }
    }
  };

  // Main scheduler loop
  const schedulerTick = async (): Promise<void> => {
    try {
      const startTime = Date.now();

      // Boost priorities for long-waiting executions
      boostPriorities();

      // Execute pending items while we have capacity
      while (state.runningExecutions.size < schedulerConfig.maxConcurrentExecutions) {
        const nextExecution = getNextExecution();
        
        if (!nextExecution) {
          break; // No more executions ready to run
        }

        // Execute asynchronously (don't await)
        executeScheduledItem(nextExecution).catch(error => {
          console.error('Scheduler execution error:', error);
        });
      }

      state.metrics.lastSchedulingTime = Date.now() - startTime;

    } catch (error) {
      console.error('Scheduler tick error:', error);
    }
  };

  // Start the scheduler
  const startScheduler = (): void => {
    if (state.isRunning) return;

    state.isRunning = true;
    state.schedulerTimer = setInterval(schedulerTick, schedulerConfig.schedulingInterval);
  };

  // Stop the scheduler
  const stopScheduler = (): void => {
    if (state.schedulerTimer) {
      clearInterval(state.schedulerTimer);
      state.schedulerTimer = null;
    }
    state.isRunning = false;
  };

  // Cancel scheduled execution
  const cancel = async (executionId: string): Promise<boolean> => {
    const execution = state.scheduledExecutions.get(executionId);
    if (!execution) {
      return false;
    }

    if (execution.status === 'running') {
      // Can't cancel running executions (would need more complex implementation)
      return false;
    }

    execution.status = 'cancelled';
    removeFromPriorityQueue(executionId);
    state.scheduledExecutions.delete(executionId);
    state.completedExecutions.set(executionId, execution);
    state.metrics.totalCancelled++;

    return true;
  };

  // Get execution status
  const getStatus = (executionId: string): ScheduledExecution | null => {
    return state.scheduledExecutions.get(executionId) || 
           state.runningExecutions.get(executionId) ||
           state.completedExecutions.get(executionId) ||
           null;
  };

  // Get scheduler statistics
  const getStats = (): SchedulerStats => {
    const totalPending = Array.from(state.priorityQueues.values()).reduce((sum, queue) => sum + queue.length, 0);
    const totalRunning = state.runningExecutions.size;
    const {totalCompleted} = state.metrics;
    const {totalFailed} = state.metrics;
    const {totalCancelled} = state.metrics;

    return {
      totalScheduled: state.metrics.totalScheduled,
      pending: totalPending,
      running: totalRunning,
      completed: totalCompleted,
      failed: totalFailed,
      cancelled: totalCancelled,
      avgWaitTime: state.metrics.avgWaitTime,
      avgExecutionTime: state.metrics.avgExecutionTime,
      queueUtilization: schedulerConfig.maxQueueSize > 0 ? (totalPending / schedulerConfig.maxQueueSize) * 100 : 0,
      workerUtilization: (totalRunning / schedulerConfig.maxConcurrentExecutions) * 100
    };
  };

  // List pending executions
  const listPending = (): ScheduledExecution[] => {
    const pending: ScheduledExecution[] = [];
    
    for (const queue of state.priorityQueues.values()) {
      pending.push(...queue);
    }

    return pending.sort((a, b) => {
      // Sort by priority (desc) then by scheduled time (asc)
      if (a.priority !== b.priority) {
        return b.priority - a.priority;
      }
      return a.scheduledTime - b.scheduledTime;
    });
  };

  // List running executions
  const listRunning = (): ScheduledExecution[] => {
    return Array.from(state.runningExecutions.values());
  };

  // Clear completed executions
  const clearCompleted = (): number => {
    const count = state.completedExecutions.size;
    state.completedExecutions.clear();
    return count;
  };

  // Cleanup resources
  const cleanup = async (): Promise<void> => {
    stopScheduler();
    
    // Cancel all pending executions
    for (const executionId of state.scheduledExecutions.keys()) {
      await cancel(executionId);
    }

    // Clear all state
    state.scheduledExecutions.clear();
    state.priorityQueues.clear();
    state.runningExecutions.clear();
    state.completedExecutions.clear();

    // Reset metrics
    state.metrics = {
      totalScheduled: 0,
      totalCompleted: 0,
      totalFailed: 0,
      totalCancelled: 0,
      avgWaitTime: 0,
      avgExecutionTime: 0,
      lastSchedulingTime: 0
    };
  };

  return {
    schedule,
    cancel,
    getStatus,
    getStats,
    listPending,
    listRunning,
    clearCompleted,
    startScheduler,
    stopScheduler,
    cleanup
  };
};
