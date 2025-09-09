/**
 * Synopticon HTTP API Client
 * HTTP client for communicating with Synopticon API server
 */

import { createLogger } from '../utils/logger.js';
import { MCPError, MCPErrorCode, withErrorHandling, createHealthChecker } from '../utils/error-handler.js';

const logger = createLogger('HTTPClient');

export interface HTTPClientConfig {
  baseUrl: string;
  timeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
  headers?: Record<string, string>;
}

export interface APIResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}

export interface SynopticonCapabilities {
  face_detection: boolean;
  emotion_analysis: boolean;
  eye_tracking: boolean;
  media_streaming: boolean;
  speech_analysis: boolean;
  version: string;
}

export interface AnalysisStatus {
  pipeline: string;
  status: 'idle' | 'starting' | 'running' | 'stopping' | 'error';
  startTime?: string;
  error?: string;
}

export interface SynopticonHTTPClient {
  isHealthy(): Promise<boolean>;
  getHealth(): Promise<SynopticonCapabilities>;
  getStatus(): Promise<{ pipelines: AnalysisStatus[] }>;
  startFaceAnalysis(params?: { device?: string; quality?: string }): Promise<{ sessionId: string }>;
  getFaceResults(): Promise<{ faces: Array<{ id: string; landmarks: number[][]; confidence: number; boundingBox: { x: number; y: number; width: number; height: number } }>; timestamp: string }>;
  stopFaceAnalysis(): Promise<{ success: boolean }>;
  startEmotionAnalysis(params?: { device?: string }): Promise<{ sessionId: string }>;
  getEmotionResults(): Promise<{ emotions: Array<{ emotion: string; confidence: number; valence: number; arousal: number }>; timestamp: string }>;
  stopEmotionAnalysis(): Promise<{ success: boolean }>;
  startMediaStream(params?: { devices?: string[]; quality?: string }): Promise<{ streamId: string; endpoints: string[] }>;
  getStreamStatus(): Promise<{ streams: Array<{ id: string; status: string; devices: string[] }> }>;
  stopMediaStream(streamId: string): Promise<{ success: boolean }>;
}

/**
 * Create HTTP client instance
 */
export const createSynopticonHTTPClient = (config: HTTPClientConfig): SynopticonHTTPClient => {
  const clientConfig: Required<HTTPClientConfig> = {
    timeout: 5000,
    retryAttempts: 3,
    retryDelay: 1000,
    headers: {},
    ...config
  };

  const healthChecker = createHealthChecker(
    `${clientConfig.baseUrl}/api/health`,
    clientConfig.timeout
  );

  logger.info('HTTP client initialized', { baseUrl: clientConfig.baseUrl });

  const request = async <T = unknown>(
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
    data?: unknown
  ): Promise<APIResponse<T>> => {
    const url = `${clientConfig.baseUrl}${endpoint}`;
    let lastError: Error;

    for (let attempt = 1; attempt <= clientConfig.retryAttempts; attempt++) {
      try {
        logger.debug(`HTTP ${method} ${endpoint}`, { attempt, data });

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), clientConfig.timeout);

        const response = await fetch(url, {
          method,
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            ...clientConfig.headers
          },
          body: data ? JSON.stringify(data) : undefined,
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const responseData = await response.json() as APIResponse<T>;
        logger.debug(`HTTP ${method} ${endpoint} success`, { status: response.status });
        
        return responseData;

      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        if (attempt === clientConfig.retryAttempts) {
          break;
        }

        logger.warn('HTTP request failed, retrying', {
          attempt,
          error: lastError.message,
          nextRetryIn: clientConfig.retryDelay
        });

        await new Promise(resolve => setTimeout(resolve, clientConfig.retryDelay));
      }
    }

    if (lastError!.name === 'AbortError') {
      throw new MCPError(
        MCPErrorCode.TIMEOUT_ERROR,
        `Request to ${endpoint} timed out after ${clientConfig.timeout}ms`,
        { endpoint, method }
      );
    }

    throw new MCPError(
      MCPErrorCode.NETWORK_ERROR,
      `Failed to connect to Synopticon API: ${lastError!.message}`,
      { endpoint, method },
      lastError!
    );
  };

  return {
    /**
     * Check if Synopticon API is available
     */
    async isHealthy(): Promise<boolean> {
      return healthChecker();
    },

    /**
     * Get system health and capabilities
     */
    async getHealth(): Promise<SynopticonCapabilities> {
      return withErrorHandling(async () => {
        const response = await request<SynopticonCapabilities>('/api/health');
        return response.data!;
      }, { operation: 'getHealth' });
    },

    /**
     * Get system status
     */
    async getStatus(): Promise<{ pipelines: AnalysisStatus[] }> {
      return withErrorHandling(async () => {
        const response = await request<{ pipelines: AnalysisStatus[] }>('/api/status');
        return response.data!;
      }, { operation: 'getStatus' });
    },

    /**
     * Start face analysis
     */
    async startFaceAnalysis(params: {
      device?: string;
      quality?: string;
    } = {}): Promise<{ sessionId: string }> {
      return withErrorHandling(async () => {
        const response = await request<{ sessionId: string }>(
          '/api/analysis/face/start',
          'POST',
          params
        );
        return response.data!;
      }, { operation: 'startFaceAnalysis', params });
    },

    /**
     * Get face analysis results
     */
    async getFaceResults(): Promise<{
      faces: Array<{
        id: string;
        landmarks: number[][];
        confidence: number;
        boundingBox: { x: number; y: number; width: number; height: number };
      }>;
      timestamp: string;
    }> {
      return withErrorHandling(async () => {
        const response = await request<{
          faces: Array<{
            id: string;
            landmarks: number[][];
            confidence: number;
            boundingBox: { x: number; y: number; width: number; height: number };
          }>;
          timestamp: string;
        }>('/api/analysis/face/results');
        return response.data!;
      }, { operation: 'getFaceResults' });
    },

    /**
     * Stop face analysis
     */
    async stopFaceAnalysis(): Promise<{ success: boolean }> {
      return withErrorHandling(async () => {
        const response = await request<{ success: boolean }>('/api/analysis/face/stop', 'POST');
        return response.data!;
      }, { operation: 'stopFaceAnalysis' });
    },

    /**
     * Start emotion analysis
     */
    async startEmotionAnalysis(params: {
      device?: string;
    } = {}): Promise<{ sessionId: string }> {
      return withErrorHandling(async () => {
        const response = await request<{ sessionId: string }>(
          '/api/analysis/emotion/start',
          'POST',
          params
        );
        return response.data!;
      }, { operation: 'startEmotionAnalysis', params });
    },

    /**
     * Get emotion analysis results
     */
    async getEmotionResults(): Promise<{
      emotions: Array<{
        emotion: string;
        confidence: number;
        valence: number;
        arousal: number;
      }>;
      timestamp: string;
    }> {
      return withErrorHandling(async () => {
        const response = await request<{
          emotions: Array<{
            emotion: string;
            confidence: number;
            valence: number;
            arousal: number;
          }>;
          timestamp: string;
        }>('/api/analysis/emotion/results');
        return response.data!;
      }, { operation: 'getEmotionResults' });
    },

    /**
     * Stop emotion analysis
     */
    async stopEmotionAnalysis(): Promise<{ success: boolean }> {
      return withErrorHandling(async () => {
        const response = await request<{ success: boolean }>('/api/analysis/emotion/stop', 'POST');
        return response.data!;
      }, { operation: 'stopEmotionAnalysis' });
    },

    /**
     * Start media streaming
     */
    async startMediaStream(params: {
      devices?: string[];
      quality?: string;
    } = {}): Promise<{ streamId: string; endpoints: string[] }> {
      return withErrorHandling(async () => {
        const response = await request<{ streamId: string; endpoints: string[] }>(
          '/api/streaming/start',
          'POST',
          params
        );
        return response.data!;
      }, { operation: 'startMediaStream', params });
    },

    /**
     * Get media stream status
     */
    async getStreamStatus(): Promise<{ streams: Array<{ id: string; status: string; devices: string[] }> }> {
      return withErrorHandling(async () => {
        const response = await request<{ streams: Array<{ id: string; status: string; devices: string[] }> }>('/api/streaming/status');
        return response.data!;
      }, { operation: 'getStreamStatus' });
    },

    /**
     * Stop media stream
     */
    async stopMediaStream(streamId: string): Promise<{ success: boolean }> {
      return withErrorHandling(async () => {
        const response = await request<{ success: boolean }>(`/api/streaming/stop/${streamId}`, 'POST');
        return response.data!;
      }, { operation: 'stopMediaStream', streamId });
    }
  };
};
