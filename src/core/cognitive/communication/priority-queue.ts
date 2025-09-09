/**
 * Priority Queue Implementation
 * Manages message queuing with priority levels
 */

import type { Priority, PriorityQueue } from './types.js';

interface QueueState {
  critical: any[];
  high: any[];
  normal: any[];
  low: any[];
}

/**
 * Create a priority queue for message handling
 */
export const createPriorityQueue = (): PriorityQueue => {
  const queues: QueueState = {
    critical: [],
    high: [],
    normal: [],
    low: []
  };
  
  const enqueue = (item: any, priority: Priority = 'normal'): void => {
    if (!queues[priority]) {
      priority = 'normal';
    }
    queues[priority].push(item);
  };
  
  const dequeue = (): any | null => {
    const priorities: Priority[] = ['critical', 'high', 'normal', 'low'];
    
    for (const priority of priorities) {
      if (queues[priority].length > 0) {
        return queues[priority].shift();
      }
    }
    return null;
  };
  
  const peek = (): any | null => {
    const priorities: Priority[] = ['critical', 'high', 'normal', 'low'];
    
    for (const priority of priorities) {
      if (queues[priority].length > 0) {
        return queues[priority][0];
      }
    }
    return null;
  };
  
  const size = (): number => {
    return Object.values(queues).reduce((sum, q) => sum + q.length, 0);
  };
  
  const clear = (priority?: Priority): void => {
    if (priority) {
      queues[priority] = [];
    } else {
      queues.critical = [];
      queues.high = [];
      queues.normal = [];
      queues.low = [];
    }
  };
  
  const getQueueSizes = (): Record<Priority, number> => {
    return {
      critical: queues.critical.length,
      high: queues.high.length,
      normal: queues.normal.length,
      low: queues.low.length
    };
  };
  
  const isEmpty = (): boolean => {
    return size() === 0;
  };
  
  return { 
    enqueue, 
    dequeue, 
    peek, 
    size,
    clear,
    getQueueSizes,
    isEmpty
  };
};