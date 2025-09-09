/**
 * Conversation Quality Assessment Module
 * Evaluates conversation flow, coherence, and overall quality
 */

export const createQualityAssessor = (state) => {
  // Calculate conversation flow
  const calculateConversationFlow = () => {
    const turns = state.metrics.interactions.turnTaking;
    const {responseTimes} = state.metrics.interactions;
    
    if (turns.length < 2) return 0;

    let flowScore = 0;
    let factors = 0;

    // Factor 1: Turn distribution consistency
    const turnDurations = turns.map(turn => turn.duration);
    const avgTurnDuration = turnDurations.reduce((sum, dur) => sum + dur, 0) / turnDurations.length;
    
    // Calculate coefficient of variation for turn durations
    const variance = turnDurations.reduce((sum, dur) => sum + Math.pow(dur - avgTurnDuration, 2), 0) / turnDurations.length;
    const stdDev = Math.sqrt(variance);
    const cv = avgTurnDuration > 0 ? stdDev / avgTurnDuration : 1;
    
    // Lower variation = better flow (normalize to 0-1)
    const turnConsistency = Math.max(0, 1 - (cv / 2)); // Assuming CV of 2 is maximum
    flowScore += turnConsistency;
    factors++;

    // Factor 2: Response time consistency
    if (responseTimes.length > 0) {
      const avgResponseTime = responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
      const responseVariance = responseTimes.reduce((sum, time) => sum + Math.pow(time - avgResponseTime, 2), 0) / responseTimes.length;
      const responseStdDev = Math.sqrt(responseVariance);
      const responseCv = avgResponseTime > 0 ? responseStdDev / avgResponseTime : 1;
      
      const responseConsistency = Math.max(0, 1 - (responseCv / 2));
      flowScore += responseConsistency;
      factors++;
    }

    // Factor 3: Interruption impact
    const interruptionRate = turns.length > 0 ? state.metrics.interactions.interruptions / turns.length : 0;
    const interruptionPenalty = Math.max(0, 1 - (interruptionRate * 3)); // 33% interruptions = 0 score
    flowScore += interruptionPenalty;
    factors++;

    return factors > 0 ? flowScore / factors : 0;
  };

  // Calculate conversation coherence
  const calculateConversationCoherence = () => {
    const {topics} = state.metrics;
    const {participants} = state.rawData;
    
    if (topics.discovered.length === 0) return 0;

    let coherenceScore = 0;
    let factors = 0;

    // Factor 1: Topic focus (fewer dominant topics = more coherent)
    const dominantTopicRatio = topics.dominantTopics.length > 0 
      ? topics.dominantTopics[0].frequency / topics.discovered.reduce((sum, t) => sum + t.frequency, 0)
      : 0;
    
    coherenceScore += Math.min(1, dominantTopicRatio * 2); // 50% concentration = full score
    factors++;

    // Factor 2: Topic transition smoothness
    const {transitions} = topics;
    if (transitions.length > 0) {
      // Count abrupt transitions (many new topics at once)
      const abruptTransitions = transitions.filter(t => t.newTopics.length > 2).length;
      const smoothnessScore = Math.max(0, 1 - (abruptTransitions / transitions.length));
      coherenceScore += smoothnessScore;
      factors++;
    }

    // Factor 3: Participant topic consistency
    let participantConsistency = 0;
    let consistencyCount = 0;

    for (const [participantId, chunks] of participants.entries()) {
      const participantTopics = new Map();
      
      chunks.forEach(chunk => {
        if (chunk.text) {
          // Simple keyword extraction for participant topics
          const words = chunk.text.toLowerCase().split(/\s+/);
          words.forEach(word => {
            if (word.length > 4) {
              participantTopics.set(word, (participantTopics.get(word) || 0) + 1);
            }
          });
        }
      });

      // Calculate topic concentration for this participant
      if (participantTopics.size > 0) {
        const topicFreqs = Array.from(participantTopics.values());
        const total = topicFreqs.reduce((sum, freq) => sum + freq, 0);
        const maxFreq = Math.max(...topicFreqs);
        const concentration = total > 0 ? maxFreq / total : 0;
        
        participantConsistency += concentration;
        consistencyCount++;
      }
    }

    if (consistencyCount > 0) {
      coherenceScore += participantConsistency / consistencyCount;
      factors++;
    }

    return factors > 0 ? coherenceScore / factors : 0;
  };

  // Calculate participation quality
  const calculateParticipationQuality = () => {
    const speakingTimes = Array.from(state.metrics.speakingTime.byParticipant.values());
    const wordCounts = Array.from(state.metrics.wordCount.byParticipant.values());
    const participantCount = state.rawData.participants.size;
    
    if (participantCount <= 1) return 1;

    let participationScore = 0;
    let factors = 0;

    // Factor 1: Speaking time balance
    const totalSpeakingTime = speakingTimes.reduce((sum, time) => sum + time, 0);
    if (totalSpeakingTime > 0) {
      const expectedTimePerParticipant = totalSpeakingTime / participantCount;
      const timeDeviations = speakingTimes.map(time => 
        Math.abs(time - expectedTimePerParticipant) / expectedTimePerParticipant
      );
      const avgDeviation = timeDeviations.reduce((sum, dev) => sum + dev, 0) / timeDeviations.length;
      const timeBalance = Math.max(0, 1 - avgDeviation); // Lower deviation = better balance
      
      participationScore += timeBalance;
      factors++;
    }

    // Factor 2: Word count balance
    const totalWords = wordCounts.reduce((sum, words) => sum + words, 0);
    if (totalWords > 0) {
      const expectedWordsPerParticipant = totalWords / participantCount;
      const wordDeviations = wordCounts.map(words => 
        Math.abs(words - expectedWordsPerParticipant) / expectedWordsPerParticipant
      );
      const avgWordDeviation = wordDeviations.reduce((sum, dev) => sum + dev, 0) / wordDeviations.length;
      const wordBalance = Math.max(0, 1 - avgWordDeviation);
      
      participationScore += wordBalance;
      factors++;
    }

    // Factor 3: Minimum participation threshold
    const minSpeakingTime = Math.min(...speakingTimes);
    const avgSpeakingTime = totalSpeakingTime / participantCount;
    const minParticipationRatio = avgSpeakingTime > 0 ? minSpeakingTime / avgSpeakingTime : 0;
    
    // Penalize if any participant speaks less than 20% of average
    const minParticipationScore = minParticipationRatio >= 0.2 ? 1 : minParticipationRatio / 0.2;
    participationScore += minParticipationScore;
    factors++;

    return factors > 0 ? participationScore / factors : 0;
  };

  // Calculate overall conversation quality
  const calculateOverallQuality = () => {
    const flow = calculateConversationFlow();
    const coherence = calculateConversationCoherence();
    const participation = calculateParticipationQuality();
    
    // Weighted average of quality factors
    const overallScore = (flow * 0.3) + (coherence * 0.4) + (participation * 0.3);
    
    // Convert to qualitative rating
    if (overallScore >= 0.8) return 'excellent';
    if (overallScore >= 0.6) return 'good';
    if (overallScore >= 0.4) return 'fair';
    if (overallScore >= 0.2) return 'poor';
    return 'very poor';
  };

  // Get detailed quality assessment
  const getQualityAssessment = () => {
    const flow = calculateConversationFlow();
    const coherence = calculateConversationCoherence();
    const participation = calculateParticipationQuality();
    const overall = calculateOverallQuality();
    
    return {
      flow: {
        score: Math.round(flow * 100),
        rating: flow >= 0.7 ? 'good' : flow >= 0.4 ? 'fair' : 'poor'
      },
      coherence: {
        score: Math.round(coherence * 100),
        rating: coherence >= 0.7 ? 'good' : coherence >= 0.4 ? 'fair' : 'poor'
      },
      participation: {
        score: Math.round(participation * 100),
        rating: participation >= 0.7 ? 'good' : participation >= 0.4 ? 'fair' : 'poor'
      },
      overall: {
        rating: overall,
        score: Math.round(((flow * 0.3) + (coherence * 0.4) + (participation * 0.3)) * 100)
      }
    };
  };

  return {
    calculateConversationFlow,
    calculateConversationCoherence,
    calculateParticipationQuality,
    calculateOverallQuality,
    getQualityAssessment
  };
};
