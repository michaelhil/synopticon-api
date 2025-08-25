/**
 * Speech Analysis Integration Tests
 * Tests the complete client-server speech analysis system with actual server
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { spawn } from 'child_process';
import { createBrowserSpeechClient } from '../../src/browser-speech-client.js';
import { createServerAnalysisHandler } from '../../src/server-analysis-endpoint.js';
import { createSpeechAnalysisPipeline } from '../../src/features/*/speech-analysis-pipeline-client-server.js';

// Test configuration
const TEST_SERVER_PORT = 3333;
const TEST_SERVER_URL = `http://localhost:${TEST_SERVER_PORT}/api/analyze`;
const SERVER_STARTUP_DELAY = 2000; // 2 seconds

describe('Speech Analysis Integration Tests', () => {
  let serverProcess = null;
  let serverHandler = null;
  
  // Start test server
  beforeAll(async () => {
    console.log('🚀 Starting test speech analysis server...');
    
    // Create server handler for testing
    serverHandler = createServerAnalysisHandler({
      llmBackend: 'mock',
      maxSessions: 10,
      sessionTimeout: 60000, // 1 minute for tests
      enableAnalytics: true
    });
    
    // Create a simple Express server for testing
    const express = (await import('express')).default;
    const cors = (await import('cors')).default;
    
    const app = express();
    app.use(cors());
    app.use(express.json());
    
    // Health check
    app.get('/health', (req, res) => {
      res.json({ status: 'ok', service: 'speech-test-server' });
    });
    
    // Analysis endpoint
    app.post('/api/analyze', serverHandler.createExpressMiddleware());
    
    // Session endpoints
    app.get('/api/session/:sessionId', async (req, res) => {
      try {
        const session = serverHandler.getSession(req.params.sessionId);
        if (!session) {
          return res.status(404).json({ error: 'Session not found' });
        }
        res.json(session);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
    
    app.delete('/api/session/:sessionId', async (req, res) => {
      try {
        const ended = serverHandler.endSession(req.params.sessionId);
        res.json({ sessionId: req.params.sessionId, ended });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
    
    // Start server
    const server = app.listen(TEST_SERVER_PORT, () => {
      console.log(`✅ Test server running on port ${TEST_SERVER_PORT}`);
    });
    
    serverProcess = server;
    
    // Wait for server to be ready
    await new Promise(resolve => setTimeout(resolve, SERVER_STARTUP_DELAY));
    
    // Verify server is responding
    try {
      const response = await fetch(`http://localhost:${TEST_SERVER_PORT}/health`);
      const data = await response.json();
      expect(data.status).toBe('ok');
      console.log('✅ Test server health check passed');
    } catch (error) {
      throw new Error(`Test server failed to start: ${error.message}`);
    }
  }, 10000);
  
  // Stop test server
  afterAll(async () => {
    console.log('🛑 Stopping test server...');
    
    if (serverHandler) {
      await serverHandler.cleanup();
    }
    
    if (serverProcess) {
      serverProcess.close();
    }
    
    console.log('✅ Test server stopped');
  });

  describe('Server-Client Communication', () => {
    it('should connect to test server successfully', async () => {
      const response = await fetch(`http://localhost:${TEST_SERVER_PORT}/health`);
      expect(response.ok).toBe(true);
      
      const data = await response.json();
      expect(data.status).toBe('ok');
      expect(data.service).toBe('speech-test-server');
    });

    it('should handle transcript analysis requests', async () => {
      const sessionId = 'test-session-' + Date.now();
      const transcripts = [
        {
          text: 'Hello, this is a test transcript.',
          timestamp: Date.now(),
          confidence: 0.95,
          isFinal: true
        },
        {
          text: 'The weather is nice today.',
          timestamp: Date.now() + 1000,
          confidence: 0.88,
          isFinal: true
        }
      ];

      const response = await fetch(TEST_SERVER_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          sessionId,
          transcripts
        })
      });

      expect(response.ok).toBe(true);
      
      const result = await response.json();
      expect(result.sessionId).toBe(sessionId);
      expect(result.results).toBeDefined();
      expect(Array.isArray(result.results)).toBe(true);
      expect(result.timestamp).toBeDefined();
    });

    it('should maintain session state across requests', async () => {
      const sessionId = 'persistent-session-' + Date.now();
      
      // Send first transcript
      const firstResponse = await fetch(TEST_SERVER_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          sessionId,
          transcripts: [{
            text: 'First message in session.',
            timestamp: Date.now(),
            confidence: 0.9,
            isFinal: true
          }]
        })
      });

      expect(firstResponse.ok).toBe(true);
      const firstResult = await firstResponse.json();
      
      // Get session data
      const sessionResponse = await fetch(`http://localhost:${TEST_SERVER_PORT}/api/session/${sessionId}`);
      expect(sessionResponse.ok).toBe(true);
      
      const sessionData = await sessionResponse.json();
      expect(sessionData.id).toBe(sessionId);
      expect(sessionData.transcripts).toBeDefined();
      expect(sessionData.transcripts.length).toBeGreaterThan(0);
      
      // Send second transcript to same session
      const secondResponse = await fetch(TEST_SERVER_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          sessionId,
          transcripts: [{
            text: 'Second message in same session.',
            timestamp: Date.now(),
            confidence: 0.85,
            isFinal: true
          }]
        })
      });

      expect(secondResponse.ok).toBe(true);
      
      // Verify session has accumulated transcripts
      const updatedSessionResponse = await fetch(`http://localhost:${TEST_SERVER_PORT}/api/session/${sessionId}`);
      const updatedSessionData = await updatedSessionResponse.json();
      
      expect(updatedSessionData.transcripts.length).toBeGreaterThan(sessionData.transcripts.length);
    });

    it('should handle session cleanup', async () => {
      const sessionId = 'cleanup-session-' + Date.now();
      
      // Create session
      await fetch(TEST_SERVER_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          sessionId,
          transcripts: [{
            text: 'Session to be cleaned up.',
            timestamp: Date.now(),
            confidence: 0.9,
            isFinal: true
          }]
        })
      });
      
      // Verify session exists
      let sessionResponse = await fetch(`http://localhost:${TEST_SERVER_PORT}/api/session/${sessionId}`);
      expect(sessionResponse.ok).toBe(true);
      
      // Delete session
      const deleteResponse = await fetch(`http://localhost:${TEST_SERVER_PORT}/api/session/${sessionId}`, {
        method: 'DELETE'
      });
      
      expect(deleteResponse.ok).toBe(true);
      const deleteResult = await deleteResponse.json();
      expect(deleteResult.ended).toBe(true);
      
      // Verify session is gone
      sessionResponse = await fetch(`http://localhost:${TEST_SERVER_PORT}/api/session/${sessionId}`);
      expect(sessionResponse.status).toBe(404);
    });
  });

  describe('Browser Speech Client Integration', () => {
    let client;

    afterEach(() => {
      if (client) {
        client.cleanup();
        client = null;
      }
    });

    it('should create client configured for test server', () => {
      client = createBrowserSpeechClient({
        serverUrl: TEST_SERVER_URL,
        batchSize: 2,
        batchTimeout: 1000
      });

      expect(client).toBeDefined();
      expect(client.getConfig().serverUrl).toBe(TEST_SERVER_URL);
    });

    it('should validate server URL during initialization', () => {
      client = createBrowserSpeechClient({
        serverUrl: TEST_SERVER_URL
      });

      // Mock Web Speech API for testing
      global.window = {
        SpeechRecognition: function MockSpeechRecognition() {
          this.start = () => {};
          this.stop = () => {};
          this.onresult = null;
          this.onerror = null;
          this.onend = null;
        }
      };

      expect(() => {
        client.initialize();
      }).not.toThrow();

      expect(client.isInitialized()).toBe(true);
    });

    it('should send manual text to server', async () => {
      client = createBrowserSpeechClient({
        serverUrl: TEST_SERVER_URL,
        batchSize: 1 // Send immediately
      });

      // Mock fetch to capture the request
      const originalFetch = global.fetch;
      let capturedRequest = null;
      
      global.fetch = async (url, options) => {
        if (url === TEST_SERVER_URL) {
          capturedRequest = {
            url,
            method: options.method,
            body: JSON.parse(options.body)
          };
          // Return mock response
          return {
            ok: true,
            json: async () => ({
              sessionId: capturedRequest.body.sessionId,
              results: [],
              timestamp: Date.now()
            })
          };
        }
        return originalFetch(url, options);
      };

      try {
        const result = await client.sendText('Test manual text input');
        
        expect(capturedRequest).toBeDefined();
        expect(capturedRequest.method).toBe('POST');
        expect(capturedRequest.body.transcripts).toBeDefined();
        expect(capturedRequest.body.transcripts[0].text).toBe('Test manual text input');
        expect(capturedRequest.body.transcripts[0].isManual).toBe(true);
        
        expect(result).toBeDefined();
        expect(result.sessionId).toBeDefined();
        
      } finally {
        global.fetch = originalFetch;
      }
    });
  });

  describe('End-to-End Pipeline Integration', () => {
    let pipeline;

    afterEach(async () => {
      if (pipeline) {
        await pipeline.cleanup();
        pipeline = null;
      }
    });

    it('should create pipeline configured for test server', () => {
      pipeline = createSpeechAnalysisPipeline({
        serverUrl: TEST_SERVER_URL,
        batchSize: 2,
        batchTimeout: 500
      });

      expect(pipeline).toBeDefined();
      expect(pipeline.getConfig().serverUrl).toBe(TEST_SERVER_URL);
    });

    it('should initialize pipeline without errors', async () => {
      pipeline = createSpeechAnalysisPipeline({
        serverUrl: TEST_SERVER_URL
      });

      // Mock Web Speech API
      global.window = {
        SpeechRecognition: function MockSpeechRecognition() {
          this.start = () => {};
          this.stop = () => {};
          this.lang = 'en-US';
          this.continuous = true;
          this.interimResults = true;
          this.maxAlternatives = 1;
        }
      };

      await expect(pipeline.initialize()).resolves.toBe(true);
      expect(pipeline.isInitialized()).toBe(true);
    });

    it('should handle pipeline events', async () => {
      pipeline = createSpeechAnalysisPipeline({
        serverUrl: TEST_SERVER_URL
      });

      const events = [];
      
      pipeline.onTranscript((data) => {
        events.push({ type: 'transcript', data });
      });
      
      pipeline.onAnalysis((data) => {
        events.push({ type: 'analysis', data });
      });
      
      pipeline.onError((data) => {
        events.push({ type: 'error', data });
      });

      // Send manual text through pipeline
      const result = await pipeline.sendText('Test pipeline integration');
      
      expect(result).toBeDefined();
      expect(events.length).toBeGreaterThan(0);
      
      const transcriptEvent = events.find(e => e.type === 'transcript');
      expect(transcriptEvent).toBeDefined();
      expect(transcriptEvent.data.text).toBe('Test pipeline integration');
    });

    it('should provide accurate statistics', async () => {
      pipeline = createSpeechAnalysisPipeline({
        serverUrl: TEST_SERVER_URL
      });

      const initialStats = pipeline.getStatistics();
      expect(initialStats.transcriptCount).toBe(0);
      expect(initialStats.analysisCount).toBe(0);

      // Send some text
      await pipeline.sendText('First test message');
      await pipeline.sendText('Second test message');

      const updatedStats = pipeline.getStatistics();
      expect(updatedStats.transcriptCount).toBeGreaterThan(0);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle server unavailable gracefully', async () => {
      const client = createBrowserSpeechClient({
        serverUrl: 'http://localhost:99999/api/analyze' // Non-existent server
      });

      await expect(
        client.sendText('Test message to unavailable server')
      ).rejects.toThrow();

      client.cleanup();
    });

    it('should handle malformed server responses', async () => {
      const client = createBrowserSpeechClient({
        serverUrl: TEST_SERVER_URL
      });

      // Mock fetch to return malformed response
      const originalFetch = global.fetch;
      global.fetch = async () => ({
        ok: true,
        json: async () => {
          throw new Error('Malformed JSON');
        }
      });

      try {
        await expect(
          client.sendText('Test message')
        ).rejects.toThrow();
      } finally {
        global.fetch = originalFetch;
        client.cleanup();
      }
    });

    it('should handle network timeouts', async () => {
      const client = createBrowserSpeechClient({
        serverUrl: TEST_SERVER_URL
      });

      // Mock fetch to simulate timeout
      const originalFetch = global.fetch;
      global.fetch = async () => {
        return new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Network timeout')), 100);
        });
      };

      try {
        await expect(
          client.sendText('Test timeout')
        ).rejects.toThrow('Network timeout');
      } finally {
        global.fetch = originalFetch;
        client.cleanup();
      }
    });
  });

  describe('Performance and Load Testing', () => {
    it('should handle multiple concurrent sessions', async () => {
      const sessionCount = 5;
      const sessions = [];

      // Create multiple sessions concurrently
      const promises = Array.from({ length: sessionCount }, async (_, index) => {
        const sessionId = `load-test-${index}-${Date.now()}`;
        
        const response = await fetch(TEST_SERVER_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            sessionId,
            transcripts: [{
              text: `Load test message ${index}`,
              timestamp: Date.now(),
              confidence: 0.9,
              isFinal: true
            }]
          })
        });

        expect(response.ok).toBe(true);
        const result = await response.json();
        sessions.push(result.sessionId);
        return result;
      });

      const results = await Promise.all(promises);
      expect(results).toHaveLength(sessionCount);
      expect(new Set(sessions)).toHaveProperty('size', sessionCount); // All unique sessions

      // Cleanup sessions
      await Promise.all(sessions.map(sessionId => 
        fetch(`http://localhost:${TEST_SERVER_PORT}/api/session/${sessionId}`, {
          method: 'DELETE'
        })
      ));
    });

    it('should maintain performance under load', async () => {
      const messageCount = 20;
      const sessionId = `perf-test-${Date.now()}`;
      
      const startTime = Date.now();
      
      // Send messages rapidly
      const promises = Array.from({ length: messageCount }, async (_, index) => {
        const response = await fetch(TEST_SERVER_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            sessionId,
            transcripts: [{
              text: `Performance test message ${index}`,
              timestamp: Date.now(),
              confidence: 0.9,
              isFinal: true
            }]
          })
        });

        expect(response.ok).toBe(true);
        return response.json();
      });

      const results = await Promise.all(promises);
      const totalTime = Date.now() - startTime;
      const averageTime = totalTime / messageCount;

      expect(results).toHaveLength(messageCount);
      expect(averageTime).toBeLessThan(1000); // Less than 1 second per message on average
      
      console.log(`📊 Performance test: ${messageCount} messages in ${totalTime}ms (avg: ${averageTime.toFixed(2)}ms/message)`);

      // Cleanup
      await fetch(`http://localhost:${TEST_SERVER_PORT}/api/session/${sessionId}`, {
        method: 'DELETE'
      });
    });
  });
});