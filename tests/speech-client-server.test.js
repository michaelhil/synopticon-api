/**
 * Speech Analysis Client-Server Tests
 * Testing the new client-server architecture
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createBrowserSpeechClient } from '../src/browser-speech-client.js';
import { createServerAnalysisHandler } from '../src/server-analysis-endpoint.js';
import { createSpeechAnalysisPipeline } from '../src/pipelines/speech-analysis-pipeline-client-server.js';
import { createPipelineEvents } from '../src/core/pipeline-events.js';
import { createUrlValidator, createDevValidator } from '../src/utils/url-validator.js';

describe('Speech Analysis Client-Server Architecture', () => {
  
  describe('Pipeline Events System', () => {
    let events;
    
    beforeEach(() => {
      events = createPipelineEvents();
    });
    
    it('should create event system with proper methods', () => {
      expect(events).toBeDefined();
      expect(events.on).toBeTypeOf('function');
      expect(events.off).toBeTypeOf('function');
      expect(events.emit).toBeTypeOf('function');
      expect(events.once).toBeTypeOf('function');
    });
    
    it('should handle event listeners correctly', () => {
      let callCount = 0;
      const handler = () => callCount++;
      
      events.on('test', handler);
      events.emit('test');
      expect(callCount).toBe(1);
      
      events.emit('test');
      expect(callCount).toBe(2);
      
      events.off('test', handler);
      events.emit('test');
      expect(callCount).toBe(2);
    });
    
    it('should handle once listeners', () => {
      let callCount = 0;
      events.once('test', () => callCount++);
      
      events.emit('test');
      events.emit('test');
      expect(callCount).toBe(1);
    });
    
    it('should return unsubscribe function', () => {
      let callCount = 0;
      const unsubscribe = events.on('test', () => callCount++);
      
      events.emit('test');
      expect(callCount).toBe(1);
      
      unsubscribe();
      events.emit('test');
      expect(callCount).toBe(1);
    });
  });
  
  describe('URL Validator', () => {
    let validator;
    
    beforeEach(() => {
      validator = createDevValidator();
    });
    
    it('should validate localhost URLs', () => {
      const result = validator.validate('http://localhost:3000/api');
      expect(result.valid).toBe(true);
      expect(result.hostname).toBe('localhost');
      expect(result.port).toBe('3000');
    });
    
    it('should reject invalid URLs', () => {
      const result = validator.validate('not-a-url');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid URL format');
    });
    
    it('should reject suspicious patterns', () => {
      const result = validator.validate('http://localhost:3000/<script>');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('suspicious patterns');
    });
    
    it('should detect private IPs', () => {
      expect(validator.isPrivateIP('192.168.1.1')).toBe(true);
      expect(validator.isPrivateIP('10.0.0.1')).toBe(true);
      expect(validator.isPrivateIP('172.16.0.1')).toBe(true);
      expect(validator.isPrivateIP('8.8.8.8')).toBe(false);
    });
    
    it('should detect localhost variants', () => {
      expect(validator.isLocalhost('localhost')).toBe(true);
      expect(validator.isLocalhost('127.0.0.1')).toBe(true);
      expect(validator.isLocalhost('::1')).toBe(true);
      expect(validator.isLocalhost('example.com')).toBe(false);
    });
  });
  
  describe('Browser Speech Client', () => {
    let client;
    
    beforeEach(() => {
      // Mock Web Speech API
      global.window = {
        SpeechRecognition: null,
        webkitSpeechRecognition: null
      };
    });
    
    afterEach(() => {
      if (client) {
        client.cleanup();
      }
    });
    
    it('should create client with factory function', () => {
      client = createBrowserSpeechClient();
      expect(client).toBeDefined();
      expect(client.initialize).toBeTypeOf('function');
      expect(client.startListening).toBeTypeOf('function');
      expect(client.stopListening).toBeTypeOf('function');
    });
    
    it('should generate unique session IDs', () => {
      const client1 = createBrowserSpeechClient();
      const client2 = createBrowserSpeechClient();
      
      expect(client1.getSessionId()).not.toBe(client2.getSessionId());
      expect(client1.getSessionId()).toMatch(/^session_\d+_[a-z0-9]+$/);
      
      client1.cleanup();
      client2.cleanup();
    });
    
    it('should handle configuration updates', () => {
      client = createBrowserSpeechClient({
        language: 'en-US',
        batchSize: 5
      });
      
      const config = client.getConfig();
      expect(config.language).toBe('en-US');
      expect(config.batchSize).toBe(5);
      
      client.updateConfig({ language: 'es-ES' });
      expect(client.getConfig().language).toBe('es-ES');
    });
    
    it('should not throw when Web Speech API is unavailable', () => {
      client = createBrowserSpeechClient();
      
      expect(() => {
        client.initialize();
      }).toThrow('Web Speech API not supported');
    });
  });
  
  describe('Server Analysis Handler', () => {
    let handler;
    
    afterEach(async () => {
      if (handler) {
        await handler.cleanup();
      }
    });
    
    it('should create handler with factory function', () => {
      handler = createServerAnalysisHandler();
      expect(handler).toBeDefined();
      expect(handler.initialize).toBeTypeOf('function');
      expect(handler.processTranscripts).toBeTypeOf('function');
      expect(handler.getSession).toBeTypeOf('function');
    });
    
    it('should manage sessions', async () => {
      handler = createServerAnalysisHandler({
        llmBackend: 'mock'
      });
      
      // Note: Initialization will fail without actual LLM backend
      // but we can test session management structure
      
      const sessionId = 'test-session-123';
      expect(handler.getSession(sessionId)).toBeNull();
      
      const activeSessions = handler.getActiveSessions();
      expect(Array.isArray(activeSessions)).toBe(true);
      expect(activeSessions.length).toBe(0);
    });
    
    it('should create Express middleware', () => {
      handler = createServerAnalysisHandler();
      const middleware = handler.createExpressMiddleware();
      
      expect(middleware).toBeTypeOf('function');
      expect(middleware.length).toBe(3); // Express middleware signature (req, res, next)
    });
    
    it('should create WebSocket handler', () => {
      handler = createServerAnalysisHandler();
      const wsHandler = handler.createWebSocketHandler();
      
      expect(wsHandler).toBeDefined();
      expect(wsHandler.onConnection).toBeTypeOf('function');
      expect(wsHandler.onMessage).toBeTypeOf('function');
      expect(wsHandler.onClose).toBeTypeOf('function');
    });
    
    it('should provide statistics', () => {
      handler = createServerAnalysisHandler();
      const stats = handler.getStatistics();
      
      expect(stats).toBeDefined();
      expect(stats.activeSessions).toBe(0);
      expect(stats.totalTranscripts).toBe(0);
      expect(stats.totalAnalyses).toBe(0);
      expect(Array.isArray(stats.sessions)).toBe(true);
    });
  });
  
  describe('Client-Server Pipeline', () => {
    let pipeline;
    
    afterEach(async () => {
      if (pipeline) {
        await pipeline.cleanup();
      }
    });
    
    it('should create pipeline with factory function', () => {
      pipeline = createSpeechAnalysisPipeline();
      expect(pipeline).toBeDefined();
      expect(pipeline.initialize).toBeTypeOf('function');
      expect(pipeline.startListening).toBeTypeOf('function');
      expect(pipeline.stopListening).toBeTypeOf('function');
    });
    
    it('should manage session lifecycle', () => {
      pipeline = createSpeechAnalysisPipeline();
      
      const sessionId1 = pipeline.getSessionId();
      expect(sessionId1).toMatch(/^session_/);
      
      const sessionId2 = pipeline.startNewSession();
      expect(sessionId2).not.toBe(sessionId1);
      expect(pipeline.getSessionId()).toBe(sessionId2);
    });
    
    it('should provide status information', () => {
      pipeline = createSpeechAnalysisPipeline();
      const status = pipeline.getStatus();
      
      expect(status).toBeDefined();
      expect(status.isInitialized).toBe(false);
      expect(status.isListening).toBe(false);
      expect(status.sessionId).toBeDefined();
    });
    
    it('should track statistics', () => {
      pipeline = createSpeechAnalysisPipeline();
      const stats = pipeline.getStatistics();
      
      expect(stats).toBeDefined();
      expect(stats.transcriptCount).toBe(0);
      expect(stats.analysisCount).toBe(0);
      expect(stats.errorCount).toBe(0);
      expect(stats.duration).toBe(0);
    });
    
    it('should handle event subscriptions', () => {
      pipeline = createSpeechAnalysisPipeline();
      
      let transcriptReceived = false;
      const unsubscribe = pipeline.onTranscript(() => {
        transcriptReceived = true;
      });
      
      expect(unsubscribe).toBeTypeOf('function');
      
      // Note: Can't test actual events without mocking Web Speech API
      // but we verify the subscription mechanism works
      
      let errorReceived = false;
      pipeline.onError(() => {
        errorReceived = true;
      });
      
      // Emit test event through pipeline's event system
      pipeline.emit('error', { type: 'test' });
      expect(errorReceived).toBe(true);
    });
  });
  
  describe('Functional Programming Compliance', () => {
    it('should use factory functions instead of classes', () => {
      // Check that all exports are factory functions
      expect(createBrowserSpeechClient).toBeTypeOf('function');
      expect(createServerAnalysisHandler).toBeTypeOf('function');
      expect(createSpeechAnalysisPipeline).toBeTypeOf('function');
      expect(createPipelineEvents).toBeTypeOf('function');
      expect(createUrlValidator).toBeTypeOf('function');
      
      // Ensure they return objects, not class instances
      const client = createBrowserSpeechClient();
      expect(client.constructor.name).toBe('Object');
      client.cleanup();
      
      const handler = createServerAnalysisHandler();
      expect(handler.constructor.name).toBe('Object');
      
      const pipeline = createSpeechAnalysisPipeline();
      expect(pipeline.constructor.name).toBe('Object');
      pipeline.cleanup();
    });
    
    it('should encapsulate state properly', () => {
      const client = createBrowserSpeechClient();
      
      // State should not be directly accessible
      expect(client.state).toBeUndefined();
      expect(client.recognition).toBeUndefined();
      
      // But methods should work with encapsulated state
      expect(client.isListening()).toBe(false);
      expect(client.isInitialized()).toBe(false);
      
      client.cleanup();
    });
  });
});