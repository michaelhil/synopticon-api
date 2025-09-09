/**
 * @fileoverview Decision Router Implementation
 * 
 * Advanced decision routing system that evaluates context and determines
 * the appropriate processing route based on configurable rules.
 * 
 * @version 1.0.0
 * @author Synopticon Development Team
 */

import { createLogger } from '../../../shared/utils/logger.js';
import type {
  DecisionRouter,
  RoutingRule,
  RoutingResult,
  CognitiveContext
} from './types.js';

const logger = createLogger({ level: 2 });

/**
 * Create decision router with configurable rules
 */
export const createDecisionRouter = (initialRules: RoutingRule[] = []): DecisionRouter => {
  const routingRules: Map<string, RoutingRule> = new Map();
  let ruleIdCounter = 0;

  // Initialize with provided rules
  initialRules.forEach(rule => addRule(rule));

  const addRule = (rule: RoutingRule): void => {
    if (!rule.id) {
      rule.id = `rule_${++ruleIdCounter}_${Date.now()}`;
    }

    if (!validateRule(rule)) {
      throw new Error(`Invalid routing rule: ${JSON.stringify(rule)}`);
    }

    routingRules.set(rule.id, rule);
    logger.debug(`Added routing rule: ${rule.id} -> ${rule.route}`);
  };

  const removeRule = (ruleId: string): void => {
    if (routingRules.delete(ruleId)) {
      logger.debug(`Removed routing rule: ${ruleId}`);
    } else {
      logger.warn(`Attempted to remove non-existent rule: ${ruleId}`);
    }
  };

  const updateRule = (ruleId: string, updates: Partial<RoutingRule>): void => {
    const existingRule = routingRules.get(ruleId);
    if (!existingRule) {
      throw new Error(`Rule not found: ${ruleId}`);
    }

    const updatedRule = { ...existingRule, ...updates, id: ruleId };
    
    if (!validateRule(updatedRule)) {
      throw new Error(`Invalid rule update: ${JSON.stringify(updates)}`);
    }

    routingRules.set(ruleId, updatedRule);
    logger.debug(`Updated routing rule: ${ruleId}`);
  };

  const route = (context: CognitiveContext): RoutingResult => {
    const startTime = Date.now();
    const matchedRules: string[] = [];
    const reasoning: string[] = [];
    const alternatives: string[] = [];

    // Sort rules by priority (critical -> high -> medium -> low)
    const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
    const sortedRules = Array.from(routingRules.values()).sort((a, b) => 
      priorityOrder[b.priority] - priorityOrder[a.priority]
    );

    let selectedRule: RoutingRule | null = null;
    let confidence = 0;

    // Evaluate rules in priority order
    for (const rule of sortedRules) {
      try {
        const matches = rule.condition(context);
        
        if (matches) {
          matchedRules.push(rule.id!);
          reasoning.push(`Rule '${rule.id}' matched: ${rule.description || rule.route}`);
          
          if (!selectedRule || priorityOrder[rule.priority] > priorityOrder[selectedRule.priority]) {
            if (selectedRule) {
              alternatives.push(selectedRule.route);
            }
            selectedRule = rule;
          } else {
            alternatives.push(rule.route);
          }
        }
      } catch (error) {
        logger.error(`Error evaluating rule ${rule.id}:`, error as Error);
        reasoning.push(`Rule '${rule.id}' failed evaluation: ${(error as Error).message}`);
      }
    }

    // Calculate confidence based on rule specificity and context completeness
    if (selectedRule) {
      confidence = calculateRouteConfidence(selectedRule, context, matchedRules.length);
    }

    // Default routing if no rules match
    if (!selectedRule) {
      selectedRule = {
        route: 'default-advisory',
        priority: 'low',
        timeout: 30000,
        condition: () => true,
        description: 'Default route for unmatched contexts'
      };
      reasoning.push('No specific rules matched - using default route');
      confidence = 0.3;
    }

    const processingTime = Date.now() - startTime;

    return {
      route: selectedRule.route,
      priority: selectedRule.priority,
      timeout: selectedRule.timeout,
      confidence,
      reasoning,
      matchedRules,
      alternatives,
      metadata: {
        timestamp: Date.now(),
        processingTime,
        ruleCount: routingRules.size
      }
    };
  };

  const getRules = (): RoutingRule[] => {
    return Array.from(routingRules.values());
  };

  const validateRule = (rule: RoutingRule): boolean => {
    // Check required fields
    if (!rule.route || typeof rule.route !== 'string') {
      return false;
    }

    if (!rule.priority || !['low', 'medium', 'high', 'critical'].includes(rule.priority)) {
      return false;
    }

    if (!rule.condition || typeof rule.condition !== 'function') {
      return false;
    }

    if (!rule.timeout || typeof rule.timeout !== 'number' || rule.timeout <= 0) {
      return false;
    }

    // Test condition function (basic validation)
    try {
      const testContext: CognitiveContext = {};
      const result = rule.condition(testContext);
      if (typeof result !== 'boolean') {
        return false;
      }
    } catch (error) {
      logger.warn(`Rule condition validation failed: ${(error as Error).message}`);
      return false;
    }

    return true;
  };

  return {
    addRule,
    removeRule,
    updateRule,
    route,
    getRules,
    validateRule
  };
};

/**
 * Calculate confidence score for routing decision
 */
const calculateRouteConfidence = (
  rule: RoutingRule,
  context: CognitiveContext,
  matchedRuleCount: number
): number => {
  let confidence = 0.5; // Base confidence

  // Increase confidence for higher priority rules
  const priorityBonus = {
    critical: 0.3,
    high: 0.2,
    medium: 0.1,
    low: 0.0
  };
  confidence += priorityBonus[rule.priority];

  // Increase confidence based on context completeness
  const contextFields = Object.keys(context).length;
  const contextBonus = Math.min(0.2, contextFields * 0.02);
  confidence += contextBonus;

  // Decrease confidence if many rules matched (ambiguity)
  if (matchedRuleCount > 1) {
    const ambiguityPenalty = Math.min(0.2, (matchedRuleCount - 1) * 0.05);
    confidence -= ambiguityPenalty;
  }

  // Ensure confidence is within valid range
  return Math.max(0, Math.min(1, confidence));
};

/**
 * Default routing rules for common scenarios
 */
export const createDefaultRoutingRules = (): RoutingRule[] => [
  {
    id: 'emergency-response',
    condition: (context) => 
      context.alerts?.level === 'critical' || 
      Boolean(context.emergency) ||
      (context.human?.stress || 0) > 0.9,
    route: 'emergency-response',
    priority: 'critical',
    timeout: 5000,
    description: 'Emergency situations requiring immediate response'
  },
  
  {
    id: 'performance-intervention',
    condition: (context) => 
      Boolean(context.performance?.degraded) || 
      Boolean(context.human?.overload) ||
      (context.human?.fatigue || 0) > 0.8,
    route: 'performance-intervention',
    priority: 'high',
    timeout: 10000,
    description: 'Performance degradation requiring intervention'
  },
  
  {
    id: 'situational-awareness',
    condition: (context) => 
      context.situational?.awarenessLevel === 'low' ||
      (context.situational?.environmentalRisk || 0) > 0.7,
    route: 'situational-awareness',
    priority: 'high',
    timeout: 15000,
    description: 'Low situational awareness requiring attention'
  },
  
  {
    id: 'mission-critical',
    condition: (context) => 
      Boolean(context.mission?.criticalPath) ||
      context.mission?.phase === 'execution' && context.mission?.complexity > 0.8,
    route: 'mission-support',
    priority: 'high',
    timeout: 12000,
    description: 'Mission-critical operations requiring support'
  },
  
  {
    id: 'routine-advisory',
    condition: (context) => 
      context.alerts?.level === 'low' &&
      !context.emergency &&
      (context.human?.stress || 0) < 0.5,
    route: 'routine-advisory',
    priority: 'medium',
    timeout: 20000,
    description: 'Routine advisory for normal operations'
  },
  
  {
    id: 'system-optimization',
    condition: (context) => 
      (context.system?.health || 1) < 0.8 ||
      context.system?.automation?.reliability < 0.9,
    route: 'system-optimization',
    priority: 'medium',
    timeout: 25000,
    description: 'System optimization and maintenance'
  },
  
  {
    id: 'user-query',
    condition: (context) => Boolean(context.user?.currentQuery),
    route: 'user-interaction',
    priority: 'medium',
    timeout: 15000,
    description: 'User query requiring specific response'
  },
  
  {
    id: 'temporal-adaptation',
    condition: (context) => 
      context.temporal?.sessionDuration > 240 || // 4 hours
      context.temporal?.workload === 'high',
    route: 'temporal-adaptation',
    priority: 'low',
    timeout: 30000,
    description: 'Temporal context adaptation'
  }
];

/**
 * Route analysis utilities
 */
export const RouteAnalytics = {
  /**
   * Analyze route usage patterns
   */
  analyzeRoutes: (routes: RoutingResult[]): {
    routeFrequency: Record<string, number>;
    averageConfidence: Record<string, number>;
    priorityDistribution: Record<string, number>;
    processingTimeStats: {
      average: number;
      median: number;
      p95: number;
    };
  } => {
    const routeFrequency: Record<string, number> = {};
    const routeConfidences: Record<string, number[]> = {};
    const priorityDistribution: Record<string, number> = {};
    const processingTimes: number[] = [];

    routes.forEach(result => {
      // Count route frequency
      routeFrequency[result.route] = (routeFrequency[result.route] || 0) + 1;

      // Collect confidence scores
      if (!routeConfidences[result.route]) {
        routeConfidences[result.route] = [];
      }
      routeConfidences[result.route].push(result.confidence);

      // Count priority distribution
      priorityDistribution[result.priority] = (priorityDistribution[result.priority] || 0) + 1;

      // Collect processing times
      processingTimes.push(result.metadata.processingTime);
    });

    // Calculate average confidence per route
    const averageConfidence: Record<string, number> = {};
    Object.entries(routeConfidences).forEach(([route, confidences]) => {
      averageConfidence[route] = confidences.reduce((sum, c) => sum + c, 0) / confidences.length;
    });

    // Calculate processing time statistics
    const sortedTimes = processingTimes.sort((a, b) => a - b);
    const average = processingTimes.reduce((sum, t) => sum + t, 0) / processingTimes.length;
    const median = sortedTimes[Math.floor(sortedTimes.length / 2)];
    const p95Index = Math.floor(sortedTimes.length * 0.95);
    const p95 = sortedTimes[p95Index];

    return {
      routeFrequency,
      averageConfidence,
      priorityDistribution,
      processingTimeStats: {
        average: Math.round(average * 100) / 100,
        median,
        p95
      }
    };
  },

  /**
   * Identify routing optimization opportunities
   */
  identifyOptimizations: (
    routes: RoutingResult[],
    thresholds: {
      lowConfidence: number;
      highProcessingTime: number;
      minSampleSize: number;
    } = {
      lowConfidence: 0.6,
      highProcessingTime: 100,
      minSampleSize: 10
    }
  ): {
    lowConfidenceRoutes: string[];
    slowRoutes: string[];
    underutilizedRules: string[];
    recommendations: string[];
  } => {
    const analytics = RouteAnalytics.analyzeRoutes(routes);
    const lowConfidenceRoutes: string[] = [];
    const slowRoutes: string[] = [];
    const underutilizedRules: string[] = [];
    const recommendations: string[] = [];

    // Identify low confidence routes
    Object.entries(analytics.averageConfidence).forEach(([route, confidence]) => {
      if (confidence < thresholds.lowConfidence) {
        lowConfidenceRoutes.push(route);
        recommendations.push(`Consider refining conditions for route '${route}' (avg confidence: ${confidence.toFixed(2)})`);
      }
    });

    // Identify slow processing
    if (analytics.processingTimeStats.p95 > thresholds.highProcessingTime) {
      recommendations.push(`95th percentile processing time is high (${analytics.processingTimeStats.p95}ms) - consider rule optimization`);
    }

    // Identify underutilized rules
    Object.entries(analytics.routeFrequency).forEach(([route, frequency]) => {
      if (frequency < thresholds.minSampleSize) {
        underutilizedRules.push(route);
        recommendations.push(`Route '${route}' is underutilized (${frequency} uses) - review rule conditions`);
      }
    });

    return {
      lowConfidenceRoutes,
      slowRoutes,
      underutilizedRules,
      recommendations
    };
  }
};