/**
 * Emotion Analysis Routes Module
 * Handles emotion detection and analysis endpoints
 */

export const createEmotionRoutes = ({
  orchestrator,
  initializeEmotionPipeline,
  decodeFrame,
  middlewareSystem,
  createJSONResponse,
  createErrorResponse
}) => {
  const routes = [];

  // Emotion analysis endpoint
  routes.push(['POST', '^/api/emotion/analyze$', async (request) => {
    try {
      const body = await request.json();
      
      
      if (!body.frame && !body.image) {
        return createErrorResponse('Frame or image data required', 400);
      }

      // Lazy load emotion pipeline if needed
      await initializeEmotionPipeline();
      
      const emotionPipeline = orchestrator.getPipeline('emotion-analysis');
      if (!emotionPipeline) {
        return createErrorResponse('Emotion analysis pipeline failed to load', 500);
      }

      const frameData = decodeFrame(body.frame || body.image);
      console.log('🖼️ Decoded frame data:', { width: frameData?.width, height: frameData?.height, hasData: !!frameData?.data });
      
      const result = await emotionPipeline.process(frameData);
      
      console.log('🔍 RAW pipeline result:', JSON.stringify(result, null, 2));
      
      // Handle different result formats
      const faces = result.data?.faces || result.faces || [];
      console.log('🔍 faces array:', faces);
      console.log('🔍 First face:', faces[0]);
      
      if (faces.length === 0) {
        return createJSONResponse({
          success: true,
          faces: [],
          message: 'No faces detected',
          debug: {
            hasResult: !!result,
            hasData: !!result.data,
            hasEmotion: false,
            emotionKeys: []
          }
        }, 200);
      }
      
      // Extract emotion data from pipeline result
      const faceResult = faces[0];
      console.log('🔍 faceResult:', faceResult);
      console.log('🔍 faceResult.emotion:', faceResult?.emotion);
      
      if (!faceResult || !faceResult.emotion) {
        console.log('❌ No valid faceResult or emotion, returning fallback');
        return createJSONResponse({
          emotions: {
            happy: 0.1, sad: 0.1, angry: 0.1, fearful: 0.1, 
            disgusted: 0.1, surprised: 0.1, neutral: 0.5
          },
          dominant_emotion: { emotion: 'neutral', confidence: 0.5 },
          confidence: 0.5,
          faces_detected: faces.length,
          message: 'Emotion data not available, returning neutral fallback'
        }, 200);
      } else {
        // Build response with emotion probabilities
        const emotions = faceResult.emotion.probabilities || faceResult.emotion.emotions;
        console.log('🔍 Building response - emotions:', emotions);
        console.log('🔍 Building response - faceResult.emotion:', faceResult.emotion);
        
        return createJSONResponse({
          emotions: emotions,
          dominant_emotion: {
            emotion: faceResult.emotion.emotion,
            confidence: faceResult.emotion.confidence
          },
          confidence: faceResult.emotion.confidence,
          valence: faceResult.emotion.valence,
          arousal: faceResult.emotion.arousal,
          faces_detected: faces.length,
          timestamp: Date.now(),
          debug: {
            hasEmotion: true,
            emotionKeys: Object.keys(emotions || {}),
            rawEmotion: faceResult.emotion
          }
        }, 200);
      }
      
    } catch (error) {
      console.error('❌ Server emotion analysis error:', error.message);
      console.error('❌ Error stack:', error.stack);
      
      return createErrorResponse(`Emotion analysis failed: ${error.message}`, 500);
    }
  }]);

  // Get emotion labels
  routes.push(['GET', '^/api/emotion/labels$', async (request) => {
    try {
      
      return createJSONResponse({
        emotions: ['happy', 'sad', 'angry', 'fearful', 'disgusted', 'surprised', 'neutral'],
        model: 'CNN-7-emotion',
        version: '1.0',
        description: '7-emotion classification with valence-arousal mapping'
      }, 200);
    } catch (error) {
      
      return createErrorResponse(`Failed to get emotion labels: ${error.message}`, 500);
    }
  }]);

  return routes;
};