/**
 * Topic Modeling Engine for Context Analysis
 * Handles topic extraction, clustering, and evolution analysis
 */

import type { Keyword } from './semantic-search-engine.ts';

export interface TopicCluster {
  readonly name: string;
  readonly keywords: readonly Keyword[];
  readonly summary: string;
  readonly frequency: number;
  readonly relevanceScore: number;
  readonly chunks: readonly TopicChunk[];
}

export interface TopicChunk {
  readonly chunkId: string;
  readonly timestamp: number;
  readonly excerpt: string;
}

export interface TopicExtractionResult {
  readonly contextId: string;
  readonly topics: readonly TopicCluster[];
  readonly totalChunks: number;
  readonly extractionTime: number;
}

export interface TopicEvolutionWindow {
  readonly startTime: number;
  readonly endTime: number;
  readonly chunkCount: number;
  readonly topics: readonly string[];
  readonly keywordDistribution: readonly Keyword[];
}

export interface TopicEvolutionResult {
  readonly contextId: string;
  readonly evolution: readonly TopicEvolutionWindow[];
  readonly totalWindows: number;
  readonly analysisTime: number;
}

export interface TopicModelingOptions {
  readonly maxTopics?: number;
  readonly minKeywordsPerTopic?: number;
  readonly windowSize?: number;
  readonly enableLLMSummaries?: boolean;
}

/**
 * Creates a topic modeling engine
 */
export const createTopicModelingEngine = () => {
  // Semantic groups for keyword clustering
  const semanticGroups = {
    emotion: ['happy', 'sad', 'angry', 'excited', 'worried', 'frustrated', 'joy', 'fear', 'love', 'hate', 'feel', 'feeling', 'emotion', 'mood'],
    work: ['job', 'work', 'office', 'meeting', 'project', 'task', 'deadline', 'boss', 'colleague', 'business', 'career', 'professional'],
    health: ['health', 'doctor', 'hospital', 'medicine', 'sick', 'healthy', 'pain', 'treatment', 'wellness', 'medical', 'therapy'],
    family: ['family', 'mother', 'father', 'parent', 'child', 'son', 'daughter', 'brother', 'sister', 'husband', 'wife', 'home'],
    technology: ['computer', 'internet', 'software', 'app', 'digital', 'online', 'technology', 'tech', 'system', 'device'],
    education: ['school', 'university', 'student', 'teacher', 'learn', 'study', 'education', 'class', 'lesson', 'course'],
    travel: ['travel', 'trip', 'vacation', 'flight', 'hotel', 'destination', 'journey', 'visit', 'explore', 'tourism'],
    food: ['food', 'eat', 'restaurant', 'meal', 'dinner', 'lunch', 'breakfast', 'cook', 'recipe', 'taste'],
    social: ['friend', 'party', 'social', 'relationship', 'people', 'community', 'group', 'team', 'together', 'meet'],
    time: ['time', 'day', 'week', 'month', 'year', 'morning', 'afternoon', 'evening', 'night', 'today', 'tomorrow', 'yesterday'],
    general: ['thing', 'way', 'good', 'bad', 'new', 'old', 'big', 'small', 'important', 'different', 'same', 'right', 'wrong']
  };

  /**
   * Cluster keywords by topic using semantic similarity
   */
  const clusterKeywordsByTopic = (keywords: Keyword[], fullText: string): Record<string, Keyword[]> => {
    const topicClusters: Record<string, Keyword[]> = {};
    
    for (const keyword of keywords) {
      let bestTopic = 'general';
      let bestScore = 0;
      
      // Find the semantic group with the highest score
      for (const [topic, semanticWords] of Object.entries(semanticGroups)) {
        const score = semanticWords.filter(word => 
          keyword.word.includes(word) || word.includes(keyword.word)
        ).length;
        
        if (score > bestScore) {
          bestScore = score;
          bestTopic = topic;
        }
      }
      
      if (!topicClusters[bestTopic]) {
        topicClusters[bestTopic] = [];
      }
      topicClusters[bestTopic].push(keyword);
    }
    
    // Filter out topics with too few keywords
    Object.keys(topicClusters).forEach(topic => {
      if (topicClusters[topic].length < 2) {
        delete topicClusters[topic];
      }
    });
    
    return topicClusters;
  };

  /**
   * Generate topic summary without LLM (fallback method)
   */
  const generateSimpleTopicSummary = (topicName: string, keywordCluster: Keyword[]): string => {
    const topKeywords = keywordCluster.slice(0, 5).map(kw => kw.word).join(', ');
    const totalFrequency = keywordCluster.reduce((sum, kw) => sum + kw.frequency, 0);
    
    return `${topicName.charAt(0).toUpperCase() + topicName.slice(1)} discussion focusing on: ${topKeywords} (${totalFrequency} mentions)`;
  };

  /**
   * Generate topic summary using LLM
   */
  const generateLLMTopicSummary = async (
    topicName: string, 
    keywordCluster: Keyword[], 
    llmClient: any
  ): Promise<string> => {
    if (!llmClient) {
      return generateSimpleTopicSummary(topicName, keywordCluster);
    }

    const topKeywords = keywordCluster.slice(0, 5).map(kw => kw.word).join(', ');
    const prompt = `Summarize the topic "${topicName}" based on these key terms: ${topKeywords}. Keep it to one sentence.`;
    
    try {
      const summary = await llmClient.generate(prompt, {
        systemPrompt: 'You are a topic analysis assistant. Provide concise, informative topic summaries.',
        maxTokens: 50,
        temperature: 0.3
      });
      
      return summary.trim() || generateSimpleTopicSummary(topicName, keywordCluster);
    } catch (error) {
      console.warn(`LLM topic summary generation failed: ${error instanceof Error ? error.message : String(error)}`);
      return generateSimpleTopicSummary(topicName, keywordCluster);
    }
  };

  /**
   * Calculate topic relevance score
   */
  const calculateTopicRelevance = (keywordCluster: Keyword[], context: any): number => {
    // Calculate topic relevance based on keyword frequency and distribution
    const totalFrequency = keywordCluster.reduce((sum, kw) => sum + kw.frequency, 0);
    const totalWords = context.chunks.reduce((sum: number, chunk: any) => sum + chunk.text.split(' ').length, 0);
    
    const frequencyScore = totalFrequency / Math.max(totalWords, 1);
    const diversityScore = keywordCluster.length / Math.max(keywordCluster[0]?.frequency || 1, 1);
    
    return (frequencyScore * 0.7) + (Math.min(diversityScore, 1) * 0.3);
  };

  /**
   * Find chunks related to a topic
   */
  const findTopicChunks = (keywordCluster: Keyword[], chunks: any[]): TopicChunk[] => {
    const topicWords = keywordCluster.map(kw => kw.word);
    
    return chunks.filter(chunk => {
      const chunkWords = chunk.text.toLowerCase().split(/\s+/);
      const matches = topicWords.filter(word => chunkWords.includes(word));
      return matches.length >= Math.min(2, topicWords.length);
    }).map(chunk => ({
      chunkId: chunk.chunkId,
      timestamp: chunk.timestamp,
      excerpt: chunk.text.substring(0, 100) + (chunk.text.length > 100 ? '...' : '')
    }));
  };

  /**
   * Divide chunks into time windows for evolution analysis
   */
  const divideIntoTimeWindows = (chunks: any[], windowSize: number): any[][] => {
    const windows = [];
    for (let i = 0; i < chunks.length; i += windowSize) {
      windows.push(chunks.slice(i, i + windowSize));
    }
    return windows.filter(window => window.length > 0);
  };

  /**
   * Extract topics from conversation context
   */
  const extractTopics = async (
    context: any,
    extractKeywords: (text: string) => Keyword[],
    llmClient?: any,
    options: TopicModelingOptions = {}
  ): Promise<TopicCluster[]> => {
    const allText = context.chunks.map((c: any) => c.text).join(' ');
    const keywords = extractKeywords(allText.toLowerCase());
    
    // Group keywords by semantic similarity
    const topicClusters = clusterKeywordsByTopic(keywords, allText);
    
    // Generate topic summaries
    const topics: TopicCluster[] = [];
    for (const [topicName, keywordCluster] of Object.entries(topicClusters)) {
      if (keywordCluster.length < (options.minKeywordsPerTopic || 2)) continue;
      
      let topicSummary: string;
      
      if (options.enableLLMSummaries !== false && llmClient) {
        topicSummary = await generateLLMTopicSummary(topicName, keywordCluster, llmClient);
      } else {
        topicSummary = generateSimpleTopicSummary(topicName, keywordCluster);
      }
      
      topics.push({
        name: topicName,
        keywords: keywordCluster.slice(0, 10), // Top 10 keywords
        summary: topicSummary,
        frequency: keywordCluster.reduce((sum, kw) => sum + kw.frequency, 0),
        relevanceScore: calculateTopicRelevance(keywordCluster, context),
        chunks: findTopicChunks(keywordCluster, context.chunks)
      });
    }

    // Sort by relevance and frequency
    topics.sort((a, b) => (b.relevanceScore * b.frequency) - (a.relevanceScore * a.frequency));
    
    return topics.slice(0, options.maxTopics || 5);
  };

  /**
   * Analyze topic evolution over time
   */
  const analyzeTopicEvolution = (
    context: any,
    extractKeywords: (text: string) => Keyword[],
    options: TopicModelingOptions = {}
  ): TopicEvolutionWindow[] => {
    const timeWindows = divideIntoTimeWindows(context.chunks, options.windowSize || 5);
    const evolution: TopicEvolutionWindow[] = [];
    
    for (const window of timeWindows) {
      const windowText = window.map((c: any) => c.text).join(' ');
      const keywords = extractKeywords(windowText.toLowerCase());
      const topicClusters = clusterKeywordsByTopic(keywords, windowText);
      
      evolution.push({
        startTime: window[0].timestamp,
        endTime: window[window.length - 1].timestamp,
        chunkCount: window.length,
        topics: Object.keys(topicClusters).slice(0, 3), // Top 3 topics per window
        keywordDistribution: keywords.slice(0, 10) // Top 10 keywords per window
      });
    }
    
    return evolution;
  };

  /**
   * Get topic distribution over time windows
   */
  const getTopicDistribution = (evolution: TopicEvolutionWindow[]): Record<string, number> => {
    const distribution: Record<string, number> = {};
    
    for (const window of evolution) {
      for (const topic of window.topics) {
        distribution[topic] = (distribution[topic] || 0) + 1;
      }
    }
    
    return distribution;
  };

  /**
   * Find topic trends (emerging, declining, stable)
   */
  const analyzeTopicTrends = (evolution: TopicEvolutionWindow[]): Record<string, 'emerging' | 'declining' | 'stable'> => {
    const trends: Record<string, 'emerging' | 'declining' | 'stable'> = {};
    
    if (evolution.length < 3) return trends; // Need at least 3 windows for trend analysis
    
    const allTopics = new Set<string>();
    evolution.forEach(window => window.topics.forEach(topic => allTopics.add(topic)));
    
    for (const topic of allTopics) {
      const appearances = evolution.map(window => window.topics.includes(topic) ? 1 : 0);
      
      // Simple trend analysis: compare first third with last third
      const firstThird = appearances.slice(0, Math.floor(evolution.length / 3));
      const lastThird = appearances.slice(-Math.floor(evolution.length / 3));
      
      const firstAvg = firstThird.reduce((sum, val) => sum + val, 0) / firstThird.length;
      const lastAvg = lastThird.reduce((sum, val) => sum + val, 0) / lastThird.length;
      
      if (lastAvg > firstAvg + 0.2) {
        trends[topic] = 'emerging';
      } else if (lastAvg < firstAvg - 0.2) {
        trends[topic] = 'declining';
      } else {
        trends[topic] = 'stable';
      }
    }
    
    return trends;
  };

  return {
    extractTopics,
    analyzeTopicEvolution,
    getTopicDistribution,
    analyzeTopicTrends,
    clusterKeywordsByTopic,
    calculateTopicRelevance,
    findTopicChunks,
    generateSimpleTopicSummary
  };
};

export type TopicModelingEngine = ReturnType<typeof createTopicModelingEngine>;