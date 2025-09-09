/**
 * Emotion Analysis Routes Module - TypeScript Implementation
 * Handles emotion detection and analysis endpoints
 */

export interface EmotionRouteDependencies {
  orchestrator: any;
  initializeEmotionPipeline: () => Promise<void>;
  decodeFrame: (frameData: any) => any;
  middlewareSystem: any;
  createJSONResponse: (data: any, status?: number, headers?: Record<string, string>) => Response;
  createErrorResponse: (message: string, status?: number, headers?: Record<string, string>) => Response;
}

export type RouteDefinition = [string, string, (request: Request) => Promise<Response>];

export const createEmotionRoutes = ({
  orchestrator,
  initializeEmotionPipeline,
  decodeFrame,
  middlewareSystem,
  createJSONResponse,
  createErrorResponse
}: EmotionRouteDependencies): RouteDefinition[] => {
  const routes: RouteDefinition[] = [];

  // Emotion analysis endpoint
  routes.push(['POST', '^/api/emotion/analyze$', async (request: Request): Promise<Response> => {
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
      console.log('🖼️ Decoded frame data:', { width: frameData?.width, height: frameData?.height, hasData: Boolean(frameData?.data) });
      
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
            hasResult: Boolean(result),
            hasData: Boolean(result.data),
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
        return createErrorResponse('Emotion analysis failed: no emotion data available', 422);
      } else {
        // Build response with emotion probabilities
        const emotions = faceResult.emotion.probabilities || faceResult.emotion.emotions;
        console.log('🔍 Building response - emotions:', emotions);
        console.log('🔍 Building response - faceResult.emotion:', faceResult.emotion);
        
        return createJSONResponse({
          emotions,
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
      
    } catch (error: any) {
      console.error('❌ Server emotion analysis error:', error.message);
      console.error('❌ Error stack:', error.stack);
      
      return createErrorResponse(`Emotion analysis failed: ${error.message}`, 500);
    }
  }]);

  // Get emotion labels
  routes.push(['GET', '^/api/emotion/labels$', async (request: Request): Promise<Response> => {
    try {
      
      return createJSONResponse({
        emotions: ['happy', 'sad', 'angry', 'fearful', 'disgusted', 'surprised', 'neutral'],
        model: 'CNN-7-emotion',
        version: '1.0',
        description: '7-emotion classification with valence-arousal mapping'
      }, 200);
    } catch (error: any) {
      
      return createErrorResponse(`Failed to get emotion labels: ${error.message}`, 500);
    }
  }]);

  return routes;
};