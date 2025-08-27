/**
 * Synopticon HTTP API Client
 * HTTP client for communicating with Synopticon API server
 */

import { createLogger } from '../utils/logger.ts';
import { MCPError, MCPErrorCode, withErrorHandling, createHealthChecker } from '../utils/error-handler.ts';

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

class SynopticonHTTPClient {
  private config: Required<HTTPClientConfig>;
  private healthChecker: () => Promise<boolean>;

  constructor(config: HTTPClientConfig) {
    this.config = {
      timeout: 5000,
      retryAttempts: 3,
      retryDelay: 1000,
      headers: {},
      ...config
    };

    this.healthChecker = createHealthChecker(
      `${this.config.baseUrl}/api/health`,
      this.config.timeout
    );

    logger.info('HTTP client initialized', { baseUrl: this.config.baseUrl });
  }

  /**
   * Check if Synopticon API is available
   */
  async isHealthy(): Promise<boolean> {
    return this.healthChecker();
  }

  /**
   * Get system health and capabilities
   */
  async getHealth(): Promise<SynopticonCapabilities> {
    return withErrorHandling(async () => {
      const response = await this.request<SynopticonCapabilities>('/api/health');
      return response.data!;
    }, { operation: 'getHealth' });
  }

  /**
   * Get system status
   */
  async getStatus(): Promise<{ pipelines: AnalysisStatus[] }> {
    return withErrorHandling(async () => {
      const response = await this.request<{ pipelines: AnalysisStatus[] }>('/api/status');
      return response.data!;
    }, { operation: 'getStatus' });
  }

  /**
   * Start face analysis
   */
  async startFaceAnalysis(params: {
    device?: string;
    quality?: string;
  } = {}): Promise<{ sessionId: string }> {
    return withErrorHandling(async () => {
      const response = await this.request<{ sessionId: string }>(
        '/api/analysis/face/start',
        'POST',
        params
      );
      return response.data!;
    }, { operation: 'startFaceAnalysis', params });
  }

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
      const response = await this.request('/api/analysis/face/results');
      return response.data!;
    }, { operation: 'getFaceResults' });
  }

  /**
   * Stop face analysis
   */
  async stopFaceAnalysis(): Promise<{ success: boolean }> {
    return withErrorHandling(async () => {
      const response = await this.request<{ success: boolean }>('/api/analysis/face/stop', 'POST');
      return response.data!;
    }, { operation: 'stopFaceAnalysis' });
  }

  /**
   * Start emotion analysis
   */
  async startEmotionAnalysis(params: {
    device?: string;
    threshold?: number;
  } = {}): Promise<{ sessionId: string }> {
    return withErrorHandling(async () => {
      const response = await this.request<{ sessionId: string }>(
        '/api/analysis/emotion/start',
        'POST',
        params
      );
      return response.data!;
    }, { operation: 'startEmotionAnalysis', params });
  }

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
      const response = await this.request('/api/analysis/emotion/results');
      return response.data!;
    }, { operation: 'getEmotionResults' });
  }

  /**
   * Stop emotion analysis
   */
  async stopEmotionAnalysis(): Promise<{ success: boolean }> {
    return withErrorHandling(async () => {
      const response = await this.request<{ success: boolean }>('/api/analysis/emotion/stop', 'POST');
      return response.data!;
    }, { operation: 'stopEmotionAnalysis' });
  }

  /**
   * Start media streaming
   */
  async startMediaStream(params: {
    devices?: string[];
    quality?: string;
  } = {}): Promise<{ streamId: string; endpoints: string[] }> {
    return withErrorHandling(async () => {
      const response = await this.request<{ streamId: string; endpoints: string[] }>(
        '/api/streaming/start',
        'POST',
        params
      );
      return response.data!;
    }, { operation: 'startMediaStream', params });
  }

  /**
   * Get media stream status
   */
  async getStreamStatus(): Promise<{
    active: boolean;
    streams: Array<{
      id: string;
      type: 'video' | 'audio';
      status: string;
      device: string;
    }>;
  }> {
    return withErrorHandling(async () => {
      const response = await this.request('/api/streaming/status');
      return response.data!;
    }, { operation: 'getStreamStatus' });
  }

  /**
   * Stop media streaming
   */
  async stopMediaStream(): Promise<{ success: boolean }> {
    return withErrorHandling(async () => {
      const response = await this.request<{ success: boolean }>('/api/streaming/stop', 'POST');
      return response.data!;
    }, { operation: 'stopMediaStream' });
  }

  /**
   * List available devices
   */
  async listDevices(): Promise<{
    cameras: Array<{ id: string; label: string; type: string }>;
    microphones: Array<{ id: string; label: string; type: string }>;
  }> {
    return withErrorHandling(async () => {
      const response = await this.request('/api/devices');
      return response.data!;
    }, { operation: 'listDevices' });
  }

  /**
   * Generic HTTP request method with retry logic
   */
  private async request<T = unknown>(
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
    data?: unknown
  ): Promise<APIResponse<T>> {
    const url = `${this.config.baseUrl}${endpoint}`;
    let lastError: Error;

    for (let attempt = 1; attempt <= this.config.retryAttempts; attempt++) {
      try {
        logger.debug(`HTTP ${method} ${endpoint}`, { attempt, data });

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

        const response = await fetch(url, {
          method,
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            ...this.config.headers
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
        
        if (attempt === this.config.retryAttempts) {
          break;
        }

        logger.warn(`HTTP request failed, retrying`, {
          attempt,
          error: lastError.message,
          nextRetryIn: this.config.retryDelay
        });

        await new Promise(resolve => setTimeout(resolve, this.config.retryDelay));
      }
    }

    if (lastError!.name === 'AbortError') {
      throw new MCPError(
        MCPErrorCode.TIMEOUT_ERROR,
        `Request to ${endpoint} timed out after ${this.config.timeout}ms`,
        { endpoint, method }
      );
    }

    throw new MCPError(
      MCPErrorCode.NETWORK_ERROR,
      `Failed to connect to Synopticon API: ${lastError!.message}`,
      { endpoint, method },
      lastError!
    );
  }
}

/**
 * Create HTTP client instance
 */
export const createSynopticonHTTPClient = (config: HTTPClientConfig): SynopticonHTTPClient => {
  return new SynopticonHTTPClient(config);
};