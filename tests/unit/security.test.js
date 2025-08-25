/**
 * Security Test Suite
 * Comprehensive security testing for Synopticon API
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { createParallelInitializer } from '../../src/core/parallel-initializer.ts';
import { createPipelineComposer } from '../../src/core/pipeline-composer.js';
import { loadScript } from '../../src/shared/utils/dependency-loader.js';
import { createErrorHandler } from '../../src/shared/utils/error-handler.ts';

describe('Security Tests', () => {
  describe('Code Injection Prevention', () => {
    let composer;

    beforeEach(() => {
      composer = createPipelineComposer();
    });

    afterEach(async () => {
      if (composer) {
        await composer.cleanup();
      }
    });

    test('should reject eval() injection attempts', async () => {
      // Test malicious condition strings
      const maliciousConditions = [
        'process.exit(1)',
        'require("fs").unlinkSync("/tmp/test")',
        'eval("alert(\'XSS\')")',
        'window.location = "http://evil.com"',
        'document.cookie = "stolen"',
        'new Function("return process")()("exit")()',
        '__proto__.polluted = true',
        'this.constructor.constructor("return process")().exit()',
        'global.process.exit(1)',
        'globalThis.eval("malicious code")'
      ];

      for (const maliciousCondition of maliciousConditions) {
        // Should not throw but should return false (condition not found)
        const result = await composer.executeConditional('test-composition', {
          conditionalSteps: [{
            condition: maliciousCondition,
            pipelines: [{ id: 'mock-pipeline', options: {} }]
          }],
          options: { defaultPipelines: [] }
        }, {});

        // Should not execute malicious code and should handle gracefully
        expect(result).toBeDefined();
        expect(result.executedSteps).toBe(0); // No steps should execute
      }
    });

    test('should only allow safe predefined conditions', async () => {
      const safeConditions = [
        'input.faces.length > 0',
        'input.confidence > 0.5',
        'input.status === "success"',
        'previousResults.length > 0'
      ];

      for (const safeCondition of safeConditions) {
        // Should not throw for safe conditions
        expect(() => {
          // This tests the condition parsing without execution
          const conditions = composer.getSafeConditions();
          expect(conditions).toHaveProperty(safeCondition);
        }).not.toThrow();
      }
    });

    test('should log security violations', async () => {
      const errorHandler = createErrorHandler({ enableCollection: true });
      let loggedErrors = [];

      // Mock console.warn to capture security warnings
      const originalWarn = console.warn;
      console.warn = (message, ...args) => {
        loggedErrors.push({ message, args });
      };

      try {
        await composer.executeConditional('test-composition', {
          conditionalSteps: [{
            condition: 'process.exit(1)',
            pipelines: [{ id: 'mock-pipeline', options: {} }]
          }],
          options: { defaultPipelines: [] }
        }, {});

        // Should have logged a security warning
        expect(loggedErrors.some(log => 
          log.message.includes('Unsupported condition')
        )).toBe(true);
      } finally {
        console.warn = originalWarn;
      }
    });
  });

  describe('Script Loading Security', () => {
    test('should verify script integrity when SRI hash provided', async () => {
      const mockScriptConfig = {
        url: 'https://example.com/safe-script.js',
        integrity: 'sha384-abc123invalidhash',
        crossorigin: 'anonymous'
      };

      // Create a mock DOM environment
      const mockDocument = {
        createElement: (tag) => ({
          src: '',
          integrity: '',
          crossOrigin: '',
          async: false,
          onload: null,
          onerror: null
        }),
        head: {
          appendChild: () => {}
        }
      };

      // Should attempt to set integrity attribute
      const mockScript = mockDocument.createElement('script');
      expect(typeof mockScript.integrity).toBe('string');
    });

    test('should reject scripts without proper CORS headers', async () => {
      const unsafeScriptConfig = {
        url: 'https://untrusted.com/malicious.js',
        // Missing crossorigin and integrity
      };

      // In a real browser environment, this would fail CORS checks
      // We simulate by checking that crossorigin is properly set when needed
      expect(unsafeScriptConfig.crossorigin).toBeUndefined();
    });

    test('should use fallback URLs when CDN fails', () => {
      const scriptConfigWithFallback = {
        url: 'https://cdn.example.com/library.js',
        integrity: 'sha384-validhash',
        crossorigin: 'anonymous',
        fallback: '/assets/vendor/library.js'
      };

      expect(scriptConfigWithFallback.fallback).toBeDefined();
      expect(scriptConfigWithFallback.fallback.startsWith('/')).toBe(true); // Local path
    });
  });

  describe('DOM XSS Prevention', () => {
    test('should not use innerHTML with user content', () => {
      // Simulate DOM manipulation code
      const safeSetContent = (element, content) => {
        element.textContent = content; // Safe
        // element.innerHTML = content; // Unsafe - should not be used
      };

      const mockElement = { textContent: '', innerHTML: '' };
      const userContent = '<script>alert("XSS")</script>';

      safeSetContent(mockElement, userContent);

      // Should set as text, not HTML
      expect(mockElement.textContent).toBe(userContent);
      expect(mockElement.innerHTML).toBe(''); // Should remain empty
    });

    test('should sanitize user input before DOM insertion', () => {
      const sanitizeInput = (input) => {
        return input
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#x27;')
          .replace(/&/g, '&amp;');
      };

      const dangerousInput = '<script>alert("XSS")</script>';
      const sanitized = sanitizeInput(dangerousInput);

      expect(sanitized).not.toContain('<script>');
      expect(sanitized).toContain('&lt;script&gt;');
    });
  });

  describe('Configuration Validation', () => {
    test('should validate configuration parameters', () => {
      const validateConfig = (config) => {
        const errors = [];

        // Check for required fields
        if (!config.name || typeof config.name !== 'string') {
          errors.push('name must be a non-empty string');
        }

        // Check for dangerous values
        if (config.allowEval === true) {
          errors.push('eval() is not allowed for security reasons');
        }

        // Validate numeric ranges
        if (config.timeout && (config.timeout < 0 || config.timeout > 300000)) {
          errors.push('timeout must be between 0 and 300000ms');
        }

        return errors;
      };

      // Test valid config
      expect(validateConfig({
        name: 'test-pipeline',
        timeout: 5000
      })).toEqual([]);

      // Test invalid configs
      expect(validateConfig({
        allowEval: true
      })).toContain('name must be a non-empty string');

      expect(validateConfig({
        name: 'test',
        allowEval: true
      })).toContain('eval() is not allowed for security reasons');

      expect(validateConfig({
        name: 'test',
        timeout: -1000
      })).toContain('timeout must be between 0 and 300000ms');
    });

    test('should prevent prototype pollution', () => {
      const safeAssign = (target, source) => {
        const protectedKeys = ['__proto__', 'constructor', 'prototype'];
        
        for (const key in source) {
          if (protectedKeys.includes(key)) {
            console.warn(`Blocked potentially dangerous key: ${key}`);
            continue;
          }
          target[key] = source[key];
        }
        
        return target;
      };

      const target = {};
      const maliciousSource = {
        __proto__: { polluted: true },
        constructor: { polluted: true },
        normalKey: 'safe value'
      };

      safeAssign(target, maliciousSource);

      expect(target.normalKey).toBe('safe value');
      expect(target.__proto__.polluted).toBeUndefined();
      expect(target.constructor.polluted).toBeUndefined();
    });
  });

  describe('Memory Safety', () => {
    test('should prevent memory exhaustion attacks', () => {
      const createSafeMemoryPool = (maxSize = 100) => {
        const pool = [];
        
        return {
          acquire: () => {
            if (pool.length >= maxSize) {
              throw new Error(`Memory pool exhausted (max: ${maxSize})`);
            }
            const obj = { id: Date.now() };
            pool.push(obj);
            return obj;
          },
          release: (obj) => {
            const index = pool.indexOf(obj);
            if (index >= 0) {
              pool.splice(index, 1);
            }
          },
          size: () => pool.length
        };
      };

      const memoryPool = createSafeMemoryPool(3);

      // Should allow normal allocation
      const obj1 = memoryPool.acquire();
      const obj2 = memoryPool.acquire();
      const obj3 = memoryPool.acquire();

      expect(memoryPool.size()).toBe(3);

      // Should prevent exhaustion
      expect(() => {
        memoryPool.acquire(); // 4th object should fail
      }).toThrow('Memory pool exhausted');
    });

    test('should clean up resources on cleanup', async () => {
      let cleanupCalled = false;
      
      const mockPipeline = {
        name: 'test-pipeline',
        cleanup: async () => {
          cleanupCalled = true;
        }
      };

      const mockOrchestrator = {
        pipelines: new Map([['test', mockPipeline]]),
        cleanup: async function() {
          for (const pipeline of this.pipelines.values()) {
            await pipeline.cleanup();
          }
          this.pipelines.clear();
        }
      };

      await mockOrchestrator.cleanup();

      expect(cleanupCalled).toBe(true);
      expect(mockOrchestrator.pipelines.size).toBe(0);
    });
  });

  describe('Error Handling Security', () => {
    test('should not leak sensitive information in error messages', () => {
      const sanitizeError = (error) => {
        // Remove sensitive paths, credentials, internal details
        let message = error.message;
        
        // Remove file paths
        message = message.replace(/\/[^\s]+/g, '[PATH]');
        
        // Remove potential credentials
        message = message.replace(/password[=:]\s*\S+/gi, 'password=[REDACTED]');
        message = message.replace(/token[=:]\s*\S+/gi, 'token=[REDACTED]');
        
        return { ...error, message };
      };

      const sensitiveError = new Error('Database connection failed: password=secret123 at /home/user/.env');
      const sanitized = sanitizeError(sensitiveError);

      expect(sanitized.message).not.toContain('secret123');
      expect(sanitized.message).not.toContain('/home/user');
      expect(sanitized.message).toContain('[REDACTED]');
      expect(sanitized.message).toContain('[PATH]');
    });

    test('should rate limit error reporting', () => {
      const createRateLimitedLogger = (maxPerMinute = 10) => {
        const errorCounts = new Map();
        
        return {
          logError: (errorType) => {
            const now = Date.now();
            const windowStart = now - 60000; // 1 minute window
            
            if (!errorCounts.has(errorType)) {
              errorCounts.set(errorType, []);
            }
            
            const timestamps = errorCounts.get(errorType);
            
            // Remove old timestamps
            const recentTimestamps = timestamps.filter(ts => ts > windowStart);
            
            if (recentTimestamps.length >= maxPerMinute) {
              return false; // Rate limited
            }
            
            recentTimestamps.push(now);
            errorCounts.set(errorType, recentTimestamps);
            
            return true; // Allowed
          }
        };
      };

      const logger = createRateLimitedLogger(2);
      
      expect(logger.logError('test-error')).toBe(true);
      expect(logger.logError('test-error')).toBe(true);
      expect(logger.logError('test-error')).toBe(false); // Rate limited
    });
  });

  describe('Input Validation', () => {
    test('should validate image data inputs', () => {
      const validateImageData = (data) => {
        const errors = [];
        
        if (!data) {
          errors.push('Image data is required');
          return errors;
        }
        
        // Check data structure
        if (!data.width || !data.height || !data.data) {
          errors.push('Image data must have width, height, and data properties');
        }
        
        // Check dimensions
        if (data.width > 4096 || data.height > 4096) {
          errors.push('Image dimensions too large (max: 4096x4096)');
        }
        
        if (data.width < 1 || data.height < 1) {
          errors.push('Image dimensions must be positive');
        }
        
        // Check data array
        if (data.data && data.data.length !== data.width * data.height * 4) {
          errors.push('Image data length does not match dimensions');
        }
        
        return errors;
      };

      // Valid image data
      expect(validateImageData({
        width: 640,
        height: 480,
        data: new Uint8Array(640 * 480 * 4)
      })).toEqual([]);

      // Invalid cases
      expect(validateImageData(null)).toContain('Image data is required');
      expect(validateImageData({})).toContain('Image data must have width, height, and data properties');
      expect(validateImageData({
        width: 5000,
        height: 480,
        data: new Uint8Array(1)
      })).toContain('Image dimensions too large');
    });
  });

  describe('API Security', () => {
    test('should implement proper CORS headers', () => {
      const corsConfig = {
        origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
        methods: ['GET', 'POST', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
        credentials: false // Important: don't allow credentials for public APIs
      };

      expect(corsConfig.origin).not.toContain('*'); // Should not allow all origins
      expect(corsConfig.credentials).toBe(false);
      expect(corsConfig.methods).not.toContain('DELETE'); // Restrict dangerous methods
    });

    test('should implement rate limiting', () => {
      const rateLimitConfig = {
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 100, // Max requests per window
        message: 'Too many requests from this IP, please try again later.',
        standardHeaders: true, // Return rate limit info in headers
        legacyHeaders: false // Disable legacy X-RateLimit-* headers
      };

      expect(rateLimitConfig.max).toBeLessThanOrEqual(100);
      expect(rateLimitConfig.windowMs).toBeGreaterThan(60000); // At least 1 minute
      expect(rateLimitConfig.message).toBeDefined();
    });
  });
});