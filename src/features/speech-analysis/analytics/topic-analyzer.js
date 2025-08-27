/**
 * Topic Analysis Module
 * Handles topic discovery, transitions, and timeline analysis
 */

export const createTopicAnalyzer = (state) => {
  // Extract keywords from text
  const extractKeywords = (text) => {
    // Simple keyword extraction (in production, use more sophisticated NLP)
    const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 
                              'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were']);
    
    return text.toLowerCase()
      .split(/\s+/)
      .filter(word => word.length > 3 && !stopWords.has(word))
      .map(word => word.replace(/[^a-zA-Z]/g, ''))
      .filter(word => word.length > 2);
  };

  // Analyze topics from conversation chunks
  const analyzeTopics = () => {
    const {topics} = state.metrics;
    const keywordFreq = new Map();
    const topicClusters = new Map();
    
    // Extract keywords from all chunks
    for (const chunks of state.rawData.participants.values()) {
      for (const chunk of chunks) {
        if (chunk.text) {
          const keywords = extractKeywords(chunk.text);
          
          keywords.forEach(keyword => {
            keywordFreq.set(keyword, (keywordFreq.get(keyword) || 0) + 1);
            
            // Add to timeline
            if (!topicClusters.has(keyword)) {
              topicClusters.set(keyword, []);
            }
            topicClusters.get(keyword).push({
              timestamp: chunk.timestamp,
              participant: chunk.participantId || 'unknown',
              context: chunk.text.substring(0, 100)
            });
          });
        }
      }
    }

    // Find significant topics (above threshold)
    const totalChunks = Array.from(state.rawData.participants.values())
      .reduce((total, chunks) => total + chunks.length, 0);
    
    const minFrequency = Math.max(2, Math.floor(totalChunks * state.config.topicThreshold));
    
    topics.discovered = Array.from(keywordFreq.entries())
      .filter(([keyword, freq]) => freq >= minFrequency)
      .map(([keyword, freq]) => ({
        keyword,
        frequency: freq,
        relevance: freq / totalChunks,
        timeline: topicClusters.get(keyword) || []
      }))
      .sort((a, b) => b.frequency - a.frequency);

    // Update dominant topics (top 5)
    topics.dominantTopics = topics.discovered.slice(0, 5);

    // Calculate topic transitions
    topics.transitions = calculateTopicTransitions();
    
    // Build topic timeline
    topics.timeline = buildTopicTimeline();

    return topics;
  };

  // Calculate topic transitions
  const calculateTopicTransitions = () => {
    const transitions = [];
    const windowSize = 3; // Number of chunks to consider for context

    // Sort all chunks by timestamp
    const allChunks = [];
    for (const [participantId, chunks] of state.rawData.participants.entries()) {
      chunks.forEach(chunk => {
        allChunks.push({ ...chunk, participantId });
      });
    }
    allChunks.sort((a, b) => a.timestamp - b.timestamp);

    // Analyze transitions using sliding window
    for (let i = windowSize; i < allChunks.length - windowSize; i++) {
      const before = allChunks.slice(i - windowSize, i);
      const after = allChunks.slice(i, i + windowSize);

      const beforeTopics = getChunkTopics(before);
      const afterTopics = getChunkTopics(after);

      // Find topic changes
      const newTopics = afterTopics.filter(topic => !beforeTopics.includes(topic));
      const lostTopics = beforeTopics.filter(topic => !afterTopics.includes(topic));

      if (newTopics.length > 0 || lostTopics.length > 0) {
        transitions.push({
          timestamp: allChunks[i].timestamp,
          participant: allChunks[i].participantId,
          newTopics,
          lostTopics,
          context: allChunks[i].text?.substring(0, 150)
        });
      }
    }

    return transitions.slice(-20); // Keep recent transitions
  };

  // Get topics from a group of chunks
  const getChunkTopics = (chunks) => {
    const keywordCount = new Map();
    
    chunks.forEach(chunk => {
      if (chunk.text) {
        const keywords = extractKeywords(chunk.text);
        keywords.forEach(keyword => {
          keywordCount.set(keyword, (keywordCount.get(keyword) || 0) + 1);
        });
      }
    });

    // Return keywords that appear more than once
    return Array.from(keywordCount.entries())
      .filter(([keyword, count]) => count > 1)
      .map(([keyword]) => keyword);
  };

  // Build topic timeline
  const buildTopicTimeline = () => {
    const timeline = [];
    const timeWindow = 30000; // 30 seconds

    // Group chunks by time windows
    const allChunks = [];
    for (const [participantId, chunks] of state.rawData.participants.entries()) {
      chunks.forEach(chunk => {
        allChunks.push({ ...chunk, participantId });
      });
    }
    allChunks.sort((a, b) => a.timestamp - b.timestamp);

    if (allChunks.length === 0) return timeline;

    const startTime = allChunks[0].timestamp;
    const endTime = allChunks[allChunks.length - 1].timestamp;

    // Create time buckets
    for (let time = startTime; time <= endTime; time += timeWindow) {
      const windowChunks = allChunks.filter(chunk => 
        chunk.timestamp >= time && chunk.timestamp < time + timeWindow
      );

      if (windowChunks.length > 0) {
        const windowTopics = getChunkTopics(windowChunks);
        
        timeline.push({
          startTime: time,
          endTime: time + timeWindow,
          topics: windowTopics,
          participants: [...new Set(windowChunks.map(c => c.participantId))],
          activityLevel: windowChunks.length
        });
      }
    }

    return timeline;
  };

  // Get topic summary
  const getTopicSummary = () => {
    const {topics} = state.metrics;
    
    return {
      totalTopics: topics.discovered.length,
      dominantTopics: topics.dominantTopics.map(t => t.keyword),
      topicDiversity: calculateTopicDiversity(),
      recentTransitions: topics.transitions.slice(-5),
      topicCoverage: calculateTopicCoverage()
    };
  };

  // Calculate topic diversity (how varied the conversation topics are)
  const calculateTopicDiversity = () => {
    const topics = state.metrics.topics.discovered;
    if (topics.length === 0) return 0;

    // Calculate entropy-like measure
    const totalFreq = topics.reduce((sum, topic) => sum + topic.frequency, 0);
    let diversity = 0;

    topics.forEach(topic => {
      const p = topic.frequency / totalFreq;
      if (p > 0) {
        diversity -= p * Math.log2(p);
      }
    });

    // Normalize to 0-1 scale
    const maxDiversity = Math.log2(topics.length);
    return maxDiversity > 0 ? diversity / maxDiversity : 0;
  };

  // Calculate topic coverage (how well topics are distributed across participants)
  const calculateTopicCoverage = () => {
    const participantCount = state.rawData.participants.size;
    if (participantCount <= 1) return 1;

    const topicParticipation = new Map();

    // Track which participants contribute to each topic
    for (const [participantId, chunks] of state.rawData.participants.entries()) {
      const participantKeywords = new Set();
      
      chunks.forEach(chunk => {
        if (chunk.text) {
          const keywords = extractKeywords(chunk.text);
          keywords.forEach(keyword => participantKeywords.add(keyword));
        }
      });

      participantKeywords.forEach(keyword => {
        if (!topicParticipation.has(keyword)) {
          topicParticipation.set(keyword, new Set());
        }
        topicParticipation.get(keyword).add(participantId);
      });
    }

    // Calculate average participation per topic
    const participationRates = Array.from(topicParticipation.values())
      .map(participants => participants.size / participantCount);

    return participationRates.length > 0 
      ? participationRates.reduce((sum, rate) => sum + rate, 0) / participationRates.length
      : 0;
  };

  return {
    analyzeTopics,
    getTopicSummary,
    extractKeywords
  };
};