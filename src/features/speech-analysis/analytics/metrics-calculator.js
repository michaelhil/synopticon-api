/**
 * Conversation Metrics Calculator Module
 * Handles speaking time, word count, and participant statistics
 */

export const createMetricsCalculator = (state) => {
  // Calculate speaking time metrics
  const calculateSpeakingTimeMetrics = () => {
    const metrics = state.metrics.speakingTime;
    let totalTime = 0;

    // Calculate total speaking time
    for (const chunks of state.rawData.participants.values()) {
      for (const chunk of chunks) {
        if (chunk.duration) {
          totalTime += chunk.duration;
        }
      }
    }

    metrics.total = totalTime;

    // Calculate speaking time by participant
    metrics.byParticipant.clear();
    for (const [participantId, chunks] of state.rawData.participants.entries()) {
      let participantTime = 0;
      for (const chunk of chunks) {
        if (chunk.duration) {
          participantTime += chunk.duration;
        }
      }
      metrics.byParticipant.set(participantId, participantTime);
    }

    // Calculate distribution
    if (totalTime > 0) {
      metrics.distribution = {};
      for (const [participantId, time] of metrics.byParticipant.entries()) {
        metrics.distribution[participantId] = time / totalTime;
      }
    }

    return metrics;
  };

  // Calculate word count metrics
  const calculateWordCountMetrics = () => {
    const metrics = state.metrics.wordCount;
    let totalWords = 0;
    const vocabulary = new Set();
    const wordFrequency = new Map();

    // Reset metrics
    metrics.byParticipant.clear();

    // Process all chunks
    for (const [participantId, chunks] of state.rawData.participants.entries()) {
      let participantWords = 0;
      
      for (const chunk of chunks) {
        if (chunk.text) {
          const words = chunk.text.toLowerCase()
            .split(/\s+/)
            .filter(word => word.length > 2); // Filter short words
          
          participantWords += words.length;
          totalWords += words.length;

          // Track vocabulary
          words.forEach(word => {
            vocabulary.add(word);
            wordFrequency.set(word, (wordFrequency.get(word) || 0) + 1);
          });
        }
      }
      
      metrics.byParticipant.set(participantId, participantWords);
    }

    // Update metrics
    metrics.total = totalWords;
    metrics.vocabulary.unique = vocabulary;
    
    // Find repeated words (frequency > 1)
    metrics.vocabulary.repeated.clear();
    for (const [word, freq] of wordFrequency.entries()) {
      if (freq > 1) {
        metrics.vocabulary.repeated.set(word, freq);
      }
    }

    // Calculate words per minute
    const durationMinutes = state.metrics.duration / (1000 * 60);
    metrics.averageWordsPerMinute = durationMinutes > 0 ? totalWords / durationMinutes : 0;

    return metrics;
  };

  // Calculate sentiment trends
  const calculateSentimentTrends = () => {
    const metrics = state.metrics.sentimentTrends;
    const {sentimentWindow} = state.config;
    
    metrics.byParticipant.clear();
    metrics.timeline = [];
    let totalSentiment = 0;
    let sentimentCount = 0;

    // Process by participant
    for (const [participantId, chunks] of state.rawData.participants.entries()) {
      const participantSentiments = [];
      
      for (const chunk of chunks) {
        if (chunk.sentiment !== undefined) {
          participantSentiments.push({
            value: chunk.sentiment,
            timestamp: chunk.timestamp
          });
          
          // Add to timeline
          metrics.timeline.push({
            participant: participantId,
            sentiment: chunk.sentiment,
            timestamp: chunk.timestamp
          });
          
          totalSentiment += chunk.sentiment;
          sentimentCount++;
        }
      }
      
      // Calculate rolling average for participant
      const recentSentiments = participantSentiments
        .slice(-sentimentWindow)
        .map(s => s.value);
      
      const avgSentiment = recentSentiments.length > 0 
        ? recentSentiments.reduce((a, b) => a + b, 0) / recentSentiments.length
        : 0;
      
      metrics.byParticipant.set(participantId, {
        current: avgSentiment,
        history: participantSentiments,
        trend: calculateSentimentTrend(participantSentiments)
      });
    }

    // Calculate overall sentiment
    metrics.averageSentiment = sentimentCount > 0 ? totalSentiment / sentimentCount : 0;
    
    // Sort timeline by timestamp
    metrics.timeline.sort((a, b) => a.timestamp - b.timestamp);

    return metrics;
  };

  // Calculate sentiment trend direction
  const calculateSentimentTrend = (sentiments) => {
    if (sentiments.length < 2) return 'neutral';
    
    const recent = sentiments.slice(-3);
    if (recent.length < 2) return 'neutral';
    
    const firstHalf = recent.slice(0, Math.ceil(recent.length / 2));
    const secondHalf = recent.slice(Math.ceil(recent.length / 2));
    
    const firstAvg = firstHalf.reduce((a, b) => a + b.value, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((a, b) => a + b.value, 0) / secondHalf.length;
    
    const diff = secondAvg - firstAvg;
    
    if (diff > 0.1) return 'improving';
    if (diff < -0.1) return 'declining';
    return 'stable';
  };

  // Update participant data
  const updateParticipantMetrics = (participantId, chunk) => {
    if (!state.rawData.participants.has(participantId)) {
      state.rawData.participants.set(participantId, []);
    }
    
    const participantChunks = state.rawData.participants.get(participantId);
    participantChunks.push(chunk);
    
    // Keep only recent chunks (memory management)
    const maxChunks = 1000;
    if (participantChunks.length > maxChunks) {
      participantChunks.splice(0, participantChunks.length - maxChunks);
    }
  };

  // Get participant statistics
  const getParticipantStats = (participantId) => {
    const chunks = state.rawData.participants.get(participantId) || [];
    const speakingTime = state.metrics.speakingTime.byParticipant.get(participantId) || 0;
    const wordCount = state.metrics.wordCount.byParticipant.get(participantId) || 0;
    const sentiment = state.metrics.sentimentTrends.byParticipant.get(participantId);
    
    return {
      participantId,
      chunkCount: chunks.length,
      speakingTime,
      wordCount,
      sentiment: sentiment || { current: 0, trend: 'neutral' },
      wordsPerMinute: speakingTime > 0 ? (wordCount / (speakingTime / 60000)) : 0,
      averageChunkLength: chunks.length > 0 ? speakingTime / chunks.length : 0
    };
  };

  return {
    calculateSpeakingTimeMetrics,
    calculateWordCountMetrics,
    calculateSentimentTrends,
    updateParticipantMetrics,
    getParticipantStats
  };
};