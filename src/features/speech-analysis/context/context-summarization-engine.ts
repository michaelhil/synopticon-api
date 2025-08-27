/**
 * Context Summarization Engine
 * Handles intelligent summarization using different strategies
 */

import type { ConversationContext, ContextChunk, ContextStrategy } from './base-context-manager.ts';

export interface SummarizationOptions {
  readonly strategy?: ContextStrategy;
  readonly maxLength?: number;
  readonly preserveRecent?: number;
  readonly includeMetrics?: boolean;
  readonly customPrompt?: string;
}

export interface SummaryResult {
  readonly summary: string;
  readonly originalLength: number;
  readonly summaryLength: number;
  readonly compressionRatio: number;
  readonly chunksProcessed: number;
  readonly processingTime: number;
  readonly strategy: ContextStrategy;
}

export interface SummaryMetrics {
  readonly totalSummaries: number;
  readonly averageCompressionRatio: number;
  readonly averageProcessingTime: number;
  readonly successRate: number;
}

/**
 * Creates a context summarization engine
 */
export const createContextSummarizationEngine = () => {
  let summaryMetrics: SummaryMetrics = {
    totalSummaries: 0,
    averageCompressionRatio: 0,
    averageProcessingTime: 0,
    successRate: 1.0
  };

  /**
   * Generate summary using rolling window strategy
   */
  const summarizeWithRollingWindow = async (
    context: ConversationContext,
    llmClient: any,
    options: SummarizationOptions
  ): Promise<string> => {
    const maxChunks = Math.min(options.preserveRecent || 10, context.chunks.length);
    const recentChunks = context.chunks.slice(-maxChunks);
    
    if (recentChunks.length === 0) {
      return '';
    }

    const recentText = recentChunks.map(chunk => chunk.text).join(' ');
    
    if (!llmClient) {
      // Fallback: simple truncation with key points
      return extractKeyPointsSummary(recentText, options.maxLength || 500);
    }

    const prompt = options.customPrompt || 
      `Summarize this recent conversation in ${options.maxLength || 200} words or less. Focus on main topics and key points:\n\n${recentText}`;

    try {
      const summary = await llmClient.generate(prompt, {
        systemPrompt: 'You are a conversation summarizer. Create concise, informative summaries that capture the essence of discussions.',
        maxTokens: Math.ceil((options.maxLength || 200) * 1.3), // Allow some buffer
        temperature: 0.3
      });

      return summary.trim() || extractKeyPointsSummary(recentText, options.maxLength || 500);
    } catch (error) {
      console.warn('LLM summarization failed, using fallback:', error);
      return extractKeyPointsSummary(recentText, options.maxLength || 500);
    }
  };

  /**
   * Generate summary using summary-based strategy
   */
  const summarizeWithSummaryBased = async (
    context: ConversationContext,
    llmClient: any,
    options: SummarizationOptions
  ): Promise<string> => {
    const existingSummary = context.summary;
    const recentChunks = context.chunks.slice(-5); // Last 5 chunks for updates
    
    if (recentChunks.length === 0) {
      return existingSummary;
    }

    const recentText = recentChunks.map(chunk => chunk.text).join(' ');

    if (!llmClient) {
      // Fallback: combine existing summary with key points from recent text
      const recentKeyPoints = extractKeyPointsSummary(recentText, 200);
      return combineWithExistingSummary(existingSummary, recentKeyPoints, options.maxLength || 500);
    }

    const prompt = existingSummary
      ? `Update this summary with new information. Existing summary: "${existingSummary}"\n\nNew information: "${recentText}"\n\nProvide an updated summary in ${options.maxLength || 300} words or less.`
      : `Summarize this conversation in ${options.maxLength || 300} words or less:\n\n${recentText}`;

    try {
      const summary = await llmClient.generate(prompt, {
        systemPrompt: 'You are a conversation summarizer. Update summaries to include new information while maintaining key context.',
        maxTokens: Math.ceil((options.maxLength || 300) * 1.3),
        temperature: 0.3
      });

      return summary.trim() || combineWithExistingSummary(existingSummary, extractKeyPointsSummary(recentText, 200), options.maxLength || 500);
    } catch (error) {
      console.warn('LLM summary update failed, using fallback:', error);
      return combineWithExistingSummary(existingSummary, extractKeyPointsSummary(recentText, 200), options.maxLength || 500);
    }
  };

  /**
   * Generate summary using hybrid strategy
   */
  const summarizeWithHybrid = async (
    context: ConversationContext,
    llmClient: any,
    options: SummarizationOptions
  ): Promise<string> => {
    // Combine rolling window for recent context with existing summary
    const existingSummary = context.summary;
    const recentChunks = context.chunks.slice(-8); // Last 8 chunks
    
    if (recentChunks.length === 0) {
      return existingSummary;
    }

    const recentText = recentChunks.map(chunk => chunk.text).join(' ');

    if (!llmClient) {
      const recentKeyPoints = extractKeyPointsSummary(recentText, 250);
      return combineWithExistingSummary(existingSummary, recentKeyPoints, options.maxLength || 500);
    }

    const prompt = existingSummary
      ? `Create a comprehensive summary combining previous context and recent discussion.\n\nPrevious context: "${existingSummary}"\n\nRecent discussion: "${recentText}"\n\nProvide a unified summary in ${options.maxLength || 400} words or less that captures both historical context and recent developments.`
      : `Summarize this conversation comprehensively in ${options.maxLength || 400} words or less:\n\n${recentText}`;

    try {
      const summary = await llmClient.generate(prompt, {
        systemPrompt: 'You are a conversation summarizer. Create comprehensive summaries that balance historical context with recent developments.',
        maxTokens: Math.ceil((options.maxLength || 400) * 1.3),
        temperature: 0.3
      });

      return summary.trim() || combineWithExistingSummary(existingSummary, extractKeyPointsSummary(recentText, 250), options.maxLength || 500);
    } catch (error) {
      console.warn('LLM hybrid summarization failed, using fallback:', error);
      return combineWithExistingSummary(existingSummary, extractKeyPointsSummary(recentText, 250), options.maxLength || 500);
    }
  };

  /**
   * Extract key points summary without LLM (fallback method)
   */
  const extractKeyPointsSummary = (text: string, maxLength: number): string => {
    if (!text || text.length === 0) {
      return '';
    }

    // Simple extractive summarization
    const sentences = text.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 20);
    
    if (sentences.length === 0) {
      return text.substring(0, Math.min(maxLength, text.length));
    }

    // Score sentences based on length, position, and keyword frequency
    const scoredSentences = sentences.map((sentence, index) => {
      const words = sentence.toLowerCase().split(/\s+/);
      const lengthScore = Math.min(words.length / 15, 1); // Optimal around 15 words
      const positionScore = index < sentences.length / 2 ? 1 : 0.8; // Prefer earlier sentences
      const keywordScore = countKeywords(words) / words.length;
      
      return {
        sentence,
        score: (lengthScore * 0.4) + (positionScore * 0.3) + (keywordScore * 0.3)
      };
    });

    // Select top-scoring sentences
    scoredSentences.sort((a, b) => b.score - a.score);
    
    let summary = '';
    for (const { sentence } of scoredSentences) {
      if (summary.length + sentence.length + 2 <= maxLength) {
        summary += (summary ? '. ' : '') + sentence;
      } else {
        break;
      }
    }

    return summary || text.substring(0, Math.min(maxLength, text.length));
  };

  /**
   * Count important keywords in text
   */
  const countKeywords = (words: string[]): number => {
    const importantWords = new Set([
      'important', 'key', 'main', 'primary', 'significant', 'critical', 'essential',
      'decided', 'agreed', 'concluded', 'resolved', 'determined',
      'problem', 'issue', 'challenge', 'solution', 'answer',
      'will', 'shall', 'must', 'should', 'need', 'require',
      'new', 'change', 'update', 'modify', 'improve', 'develop'
    ]);

    return words.filter(word => importantWords.has(word)).length;
  };

  /**
   * Combine existing summary with new information
   */
  const combineWithExistingSummary = (existingSummary: string, newInfo: string, maxLength: number): string => {
    if (!existingSummary) {
      return newInfo.substring(0, maxLength);
    }

    if (!newInfo) {
      return existingSummary.substring(0, maxLength);
    }

    // Try to fit both, prioritizing existing summary
    const combined = `${existingSummary}. Recent update: ${newInfo}`;
    
    if (combined.length <= maxLength) {
      return combined;
    }

    // Truncate new info to fit
    const availableLength = maxLength - existingSummary.length - 20; // Buffer for " Recent update: "
    if (availableLength > 50) {
      return `${existingSummary}. Recent update: ${newInfo.substring(0, availableLength)}`;
    }

    // If not enough space, just return truncated existing summary
    return existingSummary.substring(0, maxLength);
  };

  /**
   * Generate summary based on strategy
   */
  const generateSummary = async (
    context: ConversationContext,
    llmClient: any,
    options: SummarizationOptions = {}
  ): Promise<SummaryResult> => {
    const startTime = performance.now();
    const originalText = context.chunks.map(chunk => chunk.text).join(' ');
    const originalLength = originalText.length;
    
    let summary: string;
    const strategy = options.strategy || ContextStrategy.HYBRID;

    try {
      switch (strategy) {
        case ContextStrategy.ROLLING_WINDOW:
          summary = await summarizeWithRollingWindow(context, llmClient, options);
          break;
        case ContextStrategy.SUMMARY_BASED:
          summary = await summarizeWithSummaryBased(context, llmClient, options);
          break;
        case ContextStrategy.HYBRID:
        default:
          summary = await summarizeWithHybrid(context, llmClient, options);
          break;
      }

      const processingTime = performance.now() - startTime;
      const summaryLength = summary.length;
      const compressionRatio = originalLength > 0 ? summaryLength / originalLength : 0;

      // Update metrics
      updateSummaryMetrics(compressionRatio, processingTime, true);

      return {
        summary,
        originalLength,
        summaryLength,
        compressionRatio,
        chunksProcessed: context.chunks.length,
        processingTime,
        strategy
      };

    } catch (error) {
      const processingTime = performance.now() - startTime;
      
      // Update metrics with failure
      updateSummaryMetrics(0, processingTime, false);
      
      // Return fallback summary
      const fallbackSummary = extractKeyPointsSummary(originalText, options.maxLength || 500);
      
      return {
        summary: fallbackSummary,
        originalLength,
        summaryLength: fallbackSummary.length,
        compressionRatio: originalLength > 0 ? fallbackSummary.length / originalLength : 0,
        chunksProcessed: context.chunks.length,
        processingTime,
        strategy
      };
    }
  };

  /**
   * Update summary metrics
   */
  const updateSummaryMetrics = (compressionRatio: number, processingTime: number, success: boolean): void => {
    const alpha = 0.1; // Exponential moving average factor
    
    summaryMetrics = {
      totalSummaries: summaryMetrics.totalSummaries + 1,
      averageCompressionRatio: summaryMetrics.averageCompressionRatio * (1 - alpha) + compressionRatio * alpha,
      averageProcessingTime: summaryMetrics.averageProcessingTime * (1 - alpha) + processingTime * alpha,
      successRate: summaryMetrics.successRate * (1 - alpha) + (success ? 1 : 0) * alpha
    };
  };

  /**
   * Get current summarization metrics
   */
  const getMetrics = (): SummaryMetrics => ({
    ...summaryMetrics
  });

  /**
   * Reset metrics
   */
  const resetMetrics = (): void => {
    summaryMetrics = {
      totalSummaries: 0,
      averageCompressionRatio: 0,
      averageProcessingTime: 0,
      successRate: 1.0
    };
  };

  /**
   * Estimate summary length for given text and strategy
   */
  const estimateSummaryLength = (textLength: number, strategy: ContextStrategy, options: SummarizationOptions = {}): number => {
    const maxLength = options.maxLength || 500;
    
    switch (strategy) {
      case ContextStrategy.ROLLING_WINDOW:
        return Math.min(Math.ceil(textLength * 0.3), maxLength);
      case ContextStrategy.SUMMARY_BASED:
        return Math.min(Math.ceil(textLength * 0.25), maxLength);
      case ContextStrategy.HYBRID:
      default:
        return Math.min(Math.ceil(textLength * 0.4), maxLength);
    }
  };

  return {
    generateSummary,
    getMetrics,
    resetMetrics,
    estimateSummaryLength,
    extractKeyPointsSummary
  };
};

export type ContextSummarizationEngine = ReturnType<typeof createContextSummarizationEngine>;