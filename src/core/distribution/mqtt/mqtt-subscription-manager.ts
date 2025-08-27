/**
 * MQTT Subscription Manager
 * Manages topic subscriptions and message delivery
 */

import type { MqttMessage, MqttSubscription, MqttQoS } from './mqtt-types.js';

/**
 * Topic pattern matching utilities
 */
const createTopicMatcher = () => {
  /**
   * Check if topic matches pattern with wildcards
   */
  const matches = (pattern: string, topic: string): boolean => {
    // Handle single-level wildcard (+)
    const regexPattern = pattern
      .replace(/\+/g, '[^/]+')
      .replace(/\$/g, '\\$')
      .replace(/\#$/, '.*');
    
    // Handle multi-level wildcard (#)
    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(topic);
  };

  return { matches };
};

/**
 * Creates MQTT subscription manager
 */
export const createMqttSubscriptionManager = () => {
  const subscriptions = new Map<string, MqttSubscription>();
  const topicMatcher = createTopicMatcher();
  let subscriptionCounter = 0;

  /**
   * Add a new subscription
   */
  const add = (
    topics: string[],
    handler: (message: MqttMessage) => void,
    qos: MqttQoS
  ): MqttSubscription => {
    const id = `sub_${++subscriptionCounter}_${Date.now()}`;
    
    const subscription: MqttSubscription = {
      id,
      topics,
      handler,
      qos,
      unsubscribe: async () => {
        subscriptions.delete(id);
      }
    };

    subscriptions.set(id, subscription);
    return subscription;
  };

  /**
   * Remove subscriptions by topics
   */
  const remove = (topics: string[]): void => {
    const toRemove: string[] = [];
    
    for (const [id, subscription] of subscriptions) {
      // Check if any of the subscription topics match any of the removal topics
      const hasMatchingTopic = subscription.topics.some(subTopic =>
        topics.some(removeTopic => 
          subTopic === removeTopic || 
          topicMatcher.matches(subTopic, removeTopic) ||
          topicMatcher.matches(removeTopic, subTopic)
        )
      );
      
      if (hasMatchingTopic) {
        toRemove.push(id);
      }
    }
    
    toRemove.forEach(id => subscriptions.delete(id));
  };

  /**
   * Remove subscription by ID
   */
  const removeById = (id: string): boolean => {
    return subscriptions.delete(id);
  };

  /**
   * Deliver message to matching subscriptions
   */
  const deliver = (message: MqttMessage): void => {
    const matchingSubscriptions: MqttSubscription[] = [];
    
    // Find all subscriptions with matching topics
    for (const subscription of subscriptions.values()) {
      const matches = subscription.topics.some(pattern => 
        topicMatcher.matches(pattern, message.topic)
      );
      
      if (matches) {
        matchingSubscriptions.push(subscription);
      }
    }
    
    // Sort by QoS (higher QoS gets priority)
    matchingSubscriptions.sort((a, b) => b.qos - a.qos);
    
    // Deliver to handlers
    matchingSubscriptions.forEach(subscription => {
      try {
        subscription.handler(message);
      } catch (error) {
        console.error(`Error in subscription handler for ${subscription.id}:`, error);
      }
    });
  };

  /**
   * Get all subscriptions
   */
  const getAll = (): MqttSubscription[] => {
    return Array.from(subscriptions.values());
  };

  /**
   * Get subscription by ID
   */
  const getById = (id: string): MqttSubscription | undefined => {
    return subscriptions.get(id);
  };

  /**
   * Get subscriptions for a specific topic
   */
  const getByTopic = (topic: string): MqttSubscription[] => {
    const matching: MqttSubscription[] = [];
    
    for (const subscription of subscriptions.values()) {
      const matches = subscription.topics.some(pattern => 
        topicMatcher.matches(pattern, topic)
      );
      
      if (matches) {
        matching.push(subscription);
      }
    }
    
    return matching;
  };

  /**
   * Get subscription count
   */
  const count = (): number => {
    return subscriptions.size;
  };

  /**
   * Get all unique topics
   */
  const getTopics = (): string[] => {
    const topics = new Set<string>();
    
    for (const subscription of subscriptions.values()) {
      subscription.topics.forEach(topic => topics.add(topic));
    }
    
    return Array.from(topics);
  };

  /**
   * Check if topic has subscribers
   */
  const hasSubscribers = (topic: string): boolean => {
    for (const subscription of subscriptions.values()) {
      const matches = subscription.topics.some(pattern => 
        topicMatcher.matches(pattern, topic)
      );
      
      if (matches) {
        return true;
      }
    }
    
    return false;
  };

  /**
   * Clear all subscriptions
   */
  const clear = (): void => {
    subscriptions.clear();
    subscriptionCounter = 0;
  };

  /**
   * Get subscription statistics
   */
  const getStats = () => ({
    total: subscriptions.size,
    topics: getTopics().length,
    byQos: {
      qos0: Array.from(subscriptions.values()).filter(s => s.qos === 0).length,
      qos1: Array.from(subscriptions.values()).filter(s => s.qos === 1).length,
      qos2: Array.from(subscriptions.values()).filter(s => s.qos === 2).length
    }
  });

  return {
    add,
    remove,
    removeById,
    deliver,
    getAll,
    getById,
    getByTopic,
    count,
    getTopics,
    hasSubscribers,
    clear,
    getStats
  };
};