/**
 * Semantic Search Engine for Context Management
 * Handles keyword extraction, similarity calculations, and semantic matching
 */

export interface Keyword {
  readonly word: string;
  readonly frequency: number;
  readonly tfidf?: number;
}

export interface SemanticSimilarity {
  readonly score: number;
  readonly matches: readonly string[];
}

export interface SearchResult {
  readonly chunkId: string;
  readonly text: string;
  readonly timestamp: number;
  readonly similarity: number;
  readonly matchedKeywords: readonly string[];
  readonly contextSnippet: string;
  readonly relevanceRanking: number;
}

export interface SemanticSearchOptions {
  readonly threshold?: number;
  readonly maxResults?: number;
  readonly includeSnippets?: boolean;
}

export interface SemanticSearchResult {
  readonly query: string;
  readonly contextId: string;
  readonly results: readonly SearchResult[];
  readonly totalMatches: number;
  readonly timestamp: number;
}

/**
 * Creates a semantic search engine
 */
export const createSemanticSearchEngine = () => {
  // Common stop words to filter out
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
    'from', 'about', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'up',
    'down', 'out', 'off', 'over', 'under', 'again', 'further', 'then', 'once', 'here', 'there',
    'when', 'where', 'why', 'how', 'all', 'any', 'both', 'each', 'few', 'more', 'most', 'other',
    'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very',
    'can', 'will', 'just', 'should', 'now', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'would', 'could', 'should', 'may', 'might', 'must',
    'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them', 'my', 'your',
    'his', 'her', 'its', 'our', 'their', 'this', 'that', 'these', 'those'
  ]);

  /**
   * Extract keywords from text using frequency analysis
   */
  const extractKeywords = (text: string): Keyword[] => {
    if (!text || typeof text !== 'string') {
      return [];
    }

    // Clean and tokenize text
    const words = text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.has(word));

    // Count word frequencies
    const wordCount = new Map<string, number>();
    words.forEach(word => {
      wordCount.set(word, (wordCount.get(word) || 0) + 1);
    });

    // Convert to keyword objects and sort by frequency
    return Array.from(wordCount.entries())
      .map(([word, frequency]) => ({ word, frequency }))
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 50); // Top 50 keywords
  };

  /**
   * Calculate semantic similarity between two sets of keywords
   */
  const calculateSemanticSimilarity = (
    keywords1: Keyword[], 
    keywords2: Keyword[], 
    text1: string, 
    text2: string
  ): SemanticSimilarity => {
    if (keywords1.length === 0 || keywords2.length === 0) {
      return { score: 0, matches: [] };
    }

    const words1 = new Set(keywords1.map(k => k.word));
    const words2 = new Set(keywords2.map(k => k.word));
    
    // Find direct matches
    const directMatches = keywords1
      .filter(k1 => words2.has(k1.word))
      .map(k1 => k1.word);

    // Find partial matches (substring containment)
    const partialMatches = keywords1
      .filter(k1 => !words2.has(k1.word))
      .filter(k1 => {
        return keywords2.some(k2 => 
          k1.word.includes(k2.word) || k2.word.includes(k1.word)
        );
      })
      .map(k1 => k1.word);

    // Find semantic similarity through shared context
    const contextMatches = findContextualMatches(keywords1, keywords2, text1, text2);

    const allMatches = [...directMatches, ...partialMatches, ...contextMatches];
    
    // Calculate similarity score
    const directScore = directMatches.length / Math.max(keywords1.length, keywords2.length);
    const partialScore = (partialMatches.length * 0.5) / Math.max(keywords1.length, keywords2.length);
    const contextScore = (contextMatches.length * 0.3) / Math.max(keywords1.length, keywords2.length);
    
    const totalScore = Math.min(directScore + partialScore + contextScore, 1.0);

    return {
      score: Math.round(totalScore * 1000) / 1000, // Round to 3 decimal places
      matches: [...new Set(allMatches)] // Remove duplicates
    };
  };

  /**
   * Find contextual matches using simple heuristics
   */
  const findContextualMatches = (
    keywords1: Keyword[], 
    keywords2: Keyword[], 
    text1: string, 
    text2: string
  ): string[] => {
    const contextMatches: string[] = [];

    // Simple heuristic: words that appear in similar sentence contexts
    const sentences1 = text1.split(/[.!?]+/).map(s => s.trim().toLowerCase());
    const sentences2 = text2.split(/[.!?]+/).map(s => s.trim().toLowerCase());

    for (const k1 of keywords1) {
      for (const k2 of keywords2) {
        if (k1.word !== k2.word && areWordsContextuallyRelated(k1.word, k2.word, sentences1, sentences2)) {
          contextMatches.push(k1.word);
          break; // Avoid adding the same word multiple times
        }
      }
    }

    return contextMatches;
  };

  /**
   * Check if two words appear in similar contexts
   */
  const areWordsContextuallyRelated = (
    word1: string, 
    word2: string, 
    sentences1: string[], 
    sentences2: string[]
  ): boolean => {
    // Find sentences containing each word
    const contexts1 = sentences1.filter(s => s.includes(word1));
    const contexts2 = sentences2.filter(s => s.includes(word2));

    // Check if the contexts share common words
    for (const c1 of contexts1) {
      for (const c2 of contexts2) {
        const words1 = new Set(c1.split(/\s+/));
        const words2 = new Set(c2.split(/\s+/));
        
        // If contexts share at least 2 non-stop words, consider them related
        const commonWords = [...words1].filter(w => words2.has(w) && !stopWords.has(w));
        if (commonWords.length >= 2) {
          return true;
        }
      }
    }

    return false;
  };

  /**
   * Generate a context snippet highlighting matched keywords
   */
  const generateContextSnippet = (text: string, queryKeywords: Keyword[]): string => {
    const queryWords = queryKeywords.map(k => k.word);
    const maxSnippetLength = 150;

    // Find the best sentence or phrase that contains query keywords
    const sentences = text.split(/[.!?]+/).map(s => s.trim());
    
    let bestSentence = '';
    let maxMatches = 0;

    for (const sentence of sentences) {
      if (sentence.length === 0) continue;
      
      const sentenceWords = sentence.toLowerCase().split(/\s+/);
      const matches = queryWords.filter(word => sentenceWords.includes(word));
      
      if (matches.length > maxMatches || (matches.length === maxMatches && sentence.length < bestSentence.length)) {
        maxMatches = matches.length;
        bestSentence = sentence;
      }
    }

    // If no good sentence found, take the beginning of the text
    if (!bestSentence) {
      bestSentence = text.substring(0, maxSnippetLength);
    }

    // Truncate if too long
    if (bestSentence.length > maxSnippetLength) {
      bestSentence = `${bestSentence.substring(0, maxSnippetLength - 3)  }...`;
    }

    return bestSentence;
  };

  /**
   * Calculate relevance ranking for a chunk in context
   */
  const calculateRelevanceRanking = (chunk: any, query: string, context: any): number => {
    // Factors that affect relevance:
    // 1. Recency (newer chunks are more relevant)
    // 2. Chunk length (optimal length chunks are preferred)
    // 3. Position in conversation (middle chunks often more relevant)
    
    const now = Date.now();
    const chunkAge = now - chunk.timestamp;
    const maxAge = context.chunks.length > 0 
      ? Math.max(...context.chunks.map((c: any) => now - c.timestamp))
      : 1;

    // Recency score (0-1, higher for recent chunks)
    const recencyScore = 1 - (chunkAge / maxAge);

    // Length score (penalize very short or very long chunks)
    const optimalLength = 100; // words
    const chunkLength = chunk.text.split(' ').length;
    const lengthScore = Math.exp(-Math.abs(chunkLength - optimalLength) / optimalLength);

    // Position score (middle chunks often more informative)
    const chunkIndex = context.chunks.findIndex((c: any) => c.chunkId === chunk.chunkId);
    const totalChunks = context.chunks.length;
    const normalizedPosition = chunkIndex / Math.max(totalChunks - 1, 1);
    const positionScore = 1 - Math.abs(normalizedPosition - 0.5) * 2;

    // Combined relevance score
    return (recencyScore * 0.4) + (lengthScore * 0.4) + (positionScore * 0.2);
  };

  /**
   * Perform semantic search on context chunks
   */
  const performSemanticSearch = (
    query: string,
    context: any,
    options: SemanticSearchOptions = {}
  ): SearchResult[] => {
    const queryKeywords = extractKeywords(query.toLowerCase());
    const results: SearchResult[] = [];
    
    // Score each chunk based on keyword overlap and context
    for (const chunk of context.chunks) {
      const chunkKeywords = extractKeywords(chunk.text.toLowerCase());
      const similarity = calculateSemanticSimilarity(queryKeywords, chunkKeywords, chunk.text, query);
      
      if (similarity.score > (options.threshold || 0.1)) {
        results.push({
          chunkId: chunk.chunkId,
          text: chunk.text,
          timestamp: chunk.timestamp,
          similarity: similarity.score,
          matchedKeywords: similarity.matches,
          contextSnippet: options.includeSnippets !== false 
            ? generateContextSnippet(chunk.text, queryKeywords)
            : '',
          relevanceRanking: calculateRelevanceRanking(chunk, query, context)
        });
      }
    }

    // Sort by combined similarity and relevance score
    results.sort((a, b) => {
      const scoreA = (a.similarity * 0.7) + (a.relevanceRanking * 0.3);
      const scoreB = (b.similarity * 0.7) + (b.relevanceRanking * 0.3);
      return scoreB - scoreA;
    });

    return results.slice(0, options.maxResults || 10);
  };

  /**
   * Find chunks similar to a reference text
   */
  const findSimilarChunks = (
    referenceText: string,
    context: any,
    options: SemanticSearchOptions = {}
  ): any[] => {
    const referenceKeywords = extractKeywords(referenceText.toLowerCase());
    const similarChunks = [];
    
    for (const chunk of context.chunks) {
      const chunkKeywords = extractKeywords(chunk.text.toLowerCase());
      const similarity = calculateSemanticSimilarity(referenceKeywords, chunkKeywords, chunk.text, referenceText);
      
      if (similarity.score > (options.threshold || 0.3)) {
        similarChunks.push({
          ...chunk,
          similarity: similarity.score,
          matchedKeywords: similarity.matches
        });
      }
    }

    similarChunks.sort((a, b) => b.similarity - a.similarity);
    return similarChunks.slice(0, options.maxResults || 5);
  };

  return {
    extractKeywords,
    calculateSemanticSimilarity,
    generateContextSnippet,
    calculateRelevanceRanking,
    performSemanticSearch,
    findSimilarChunks
  };
};

export type SemanticSearchEngine = ReturnType<typeof createSemanticSearchEngine>;
