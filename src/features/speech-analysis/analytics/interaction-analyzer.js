/**
 * Interaction Analysis Module
 * Handles turn-taking, interruptions, and response time analysis
 */

export const createInteractionAnalyzer = (state) => {
  // Analyze turn-taking patterns
  const analyzeTurnTaking = () => {
    const {interactions} = state.metrics;
    const turnSequence = [];
    const responseTimes = [];
    let interruptions = 0;

    // Sort all chunks by timestamp across participants
    const allChunks = [];
    for (const [participantId, chunks] of state.rawData.participants.entries()) {
      chunks.forEach(chunk => {
        allChunks.push({ ...chunk, participantId });
      });
    }
    allChunks.sort((a, b) => a.timestamp - b.timestamp);

    // Analyze turn sequences
    let currentSpeaker = null;
    let turnStartTime = null;
    let previousTurnEndTime = null;

    for (let i = 0; i < allChunks.length; i++) {
      const chunk = allChunks[i];
      
      if (chunk.participantId !== currentSpeaker) {
        // Turn change detected
        
        if (currentSpeaker !== null && turnStartTime !== null) {
          // Complete previous turn
          const turnDuration = chunk.timestamp - turnStartTime;
          turnSequence.push({
            speaker: currentSpeaker,
            startTime: turnStartTime,
            endTime: chunk.timestamp,
            duration: turnDuration
          });

          // Calculate response time if there's a gap
          if (previousTurnEndTime && turnStartTime > previousTurnEndTime) {
            const responseTime = turnStartTime - previousTurnEndTime;
            responseTimes.push(responseTime);
          }

          previousTurnEndTime = chunk.timestamp;
        }

        // Start new turn
        currentSpeaker = chunk.participantId;
        turnStartTime = chunk.timestamp;
      }

      // Check for interruptions (overlapping speech)
      if (i > 0) {
        const prevChunk = allChunks[i - 1];
        const timeDiff = chunk.timestamp - prevChunk.timestamp;
        
        // If chunks are very close in time but from different speakers
        if (timeDiff < 500 && chunk.participantId !== prevChunk.participantId) {
          interruptions++;
        }
      }
    }

    // Complete final turn
    if (currentSpeaker !== null && turnStartTime !== null) {
      const lastChunk = allChunks[allChunks.length - 1];
      turnSequence.push({
        speaker: currentSpeaker,
        startTime: turnStartTime,
        endTime: lastChunk.timestamp,
        duration: lastChunk.timestamp - turnStartTime
      });
    }

    // Update metrics
    interactions.turnTaking = turnSequence.slice(-50); // Keep recent turns
    interactions.responseTimes = responseTimes.slice(-20); // Keep recent response times
    interactions.interruptions = interruptions;

    return interactions;
  };

  // Calculate engagement level
  const calculateEngagement = () => {
    const participantCount = state.rawData.participants.size;
    if (participantCount <= 1) return 'high';

    const speakingTimes = Array.from(state.metrics.speakingTime.byParticipant.values());
    const wordCounts = Array.from(state.metrics.wordCount.byParticipant.values());
    
    // Calculate participation balance
    const participationBalance = calculateParticipationBalance(speakingTimes);
    
    // Calculate interaction frequency
    const interactionFrequency = calculateInteractionFrequency();
    
    // Calculate response promptness
    const responsePromptness = calculateResponsePromptness();

    // Combine metrics to determine engagement level
    let engagementScore = 0;
    
    // High participation balance is good (0.7-1.0 = +2, 0.4-0.7 = +1, <0.4 = 0)
    if (participationBalance >= 0.7) engagementScore += 2;
    else if (participationBalance >= 0.4) engagementScore += 1;
    
    // High interaction frequency is good
    if (interactionFrequency >= 0.8) engagementScore += 2;
    else if (interactionFrequency >= 0.5) engagementScore += 1;
    
    // Good response promptness is good
    if (responsePromptness >= 0.7) engagementScore += 2;
    else if (responsePromptness >= 0.4) engagementScore += 1;

    // Determine engagement level
    if (engagementScore >= 5) return 'high';
    if (engagementScore >= 3) return 'medium';
    return 'low';
  };

  // Calculate participation balance (how evenly distributed speaking time is)
  const calculateParticipationBalance = (speakingTimes) => {
    if (speakingTimes.length <= 1) return 1;

    const totalTime = speakingTimes.reduce((sum, time) => sum + time, 0);
    if (totalTime === 0) return 0;

    // Calculate normalized speaking times
    const normalizedTimes = speakingTimes.map(time => time / totalTime);
    
    // Calculate Gini coefficient (measure of inequality)
    const n = normalizedTimes.length;
    const sortedTimes = [...normalizedTimes].sort((a, b) => a - b);
    
    let gini = 0;
    for (let i = 0; i < n; i++) {
      gini += (2 * (i + 1) - n - 1) * sortedTimes[i];
    }
    gini = gini / (n * sortedTimes.reduce((sum, time) => sum + time, 0));

    // Convert Gini to balance score (0 = perfect inequality, 1 = perfect equality)
    return Math.max(0, 1 - Math.abs(gini));
  };

  // Calculate interaction frequency
  const calculateInteractionFrequency = () => {
    const turns = state.metrics.interactions.turnTaking;
    if (turns.length < 2) return 0;

    const conversationDuration = state.metrics.duration;
    if (conversationDuration === 0) return 0;

    // Calculate turns per minute
    const turnsPerMinute = (turns.length / conversationDuration) * 60000;
    
    // Normalize to 0-1 scale (assuming 10 turns/minute is high interaction)
    return Math.min(1, turnsPerMinute / 10);
  };

  // Calculate response promptness
  const calculateResponsePromptness = () => {
    const {responseTimes} = state.metrics.interactions;
    if (responseTimes.length === 0) return 1;

    // Calculate average response time
    const avgResponseTime = responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
    
    // Good response time is under 2 seconds, excellent is under 1 second
    if (avgResponseTime <= 1000) return 1;
    if (avgResponseTime <= 2000) return 0.8;
    if (avgResponseTime <= 3000) return 0.6;
    if (avgResponseTime <= 5000) return 0.4;
    return 0.2;
  };

  // Get interaction summary
  const getInteractionSummary = () => {
    const {interactions} = state.metrics;
    
    const avgResponseTime = interactions.responseTimes.length > 0
      ? interactions.responseTimes.reduce((sum, time) => sum + time, 0) / interactions.responseTimes.length
      : 0;

    const turnFrequency = state.metrics.duration > 0
      ? (interactions.turnTaking.length / state.metrics.duration) * 60000 // turns per minute
      : 0;

    return {
      totalTurns: interactions.turnTaking.length,
      interruptions: interactions.interruptions,
      averageResponseTime: Math.round(avgResponseTime),
      turnFrequency: Math.round(turnFrequency * 10) / 10, // 1 decimal place
      engagement: interactions.engagement,
      interactionHealth: calculateInteractionHealth()
    };
  };

  // Calculate overall interaction health
  const calculateInteractionHealth = () => {
    const summary = getInteractionSummary();
    
    let healthScore = 0;
    
    // Low interruptions are good
    const interruptionRate = summary.totalTurns > 0 
      ? summary.interruptions / summary.totalTurns 
      : 0;
    
    if (interruptionRate < 0.1) healthScore += 2;
    else if (interruptionRate < 0.2) healthScore += 1;
    
    // Good response times are good
    if (summary.averageResponseTime < 2000) healthScore += 2;
    else if (summary.averageResponseTime < 4000) healthScore += 1;
    
    // Good turn frequency is good
    if (summary.turnFrequency >= 3 && summary.turnFrequency <= 8) healthScore += 2;
    else if (summary.turnFrequency >= 1) healthScore += 1;
    
    if (healthScore >= 5) return 'excellent';
    if (healthScore >= 3) return 'good';
    if (healthScore >= 1) return 'fair';
    return 'poor';
  };

  return {
    analyzeTurnTaking,
    calculateEngagement,
    getInteractionSummary
  };
};