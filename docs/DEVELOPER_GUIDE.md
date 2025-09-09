# Synopticon API Developer Guide

## Quick Start

### Prerequisites

- **Bun**: Version 1.0.0 or higher
- **Operating System**: macOS, Linux, or Windows (with WSL recommended)
- **Hardware**: Webcam for face detection, microphone for speech analysis
- **Optional**: Tobii Eye Tracker 5 for eye tracking features

### Installation

```bash
# Clone the repository
git clone https://github.com/synopticon/synopticon-api.git
cd synopticon-api

# Install dependencies (zero external dependencies!)
bun install

# Start development server
bun dev

# Open browser to view API documentation
open http://localhost:3000
```

## Development Environment Setup

### IDE Configuration

#### Visual Studio Code
Recommended extensions:
```json
{
  "recommendations": [
    "oven.bun-vscode",
    "ms-vscode.vscode-typescript-next",
    "bradlc.vscode-tailwindcss",
    "esbenp.prettier-vscode",
    "ms-vscode.vscode-eslint"
  ]
}
```

#### TypeScript Configuration
The project uses TypeScript with strict settings:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "allowImportingTsExtensions": true
  }
}
```

### Environment Variables

Create `.env` file:
```env
# Server Configuration
PORT=3000
HOST=localhost
NODE_ENV=development

# Feature Toggles
ENABLE_FACE_DETECTION=true
ENABLE_EMOTION_ANALYSIS=true
ENABLE_EYE_TRACKING=true
ENABLE_SPEECH_ANALYSIS=true
ENABLE_COGNITIVE_ADVISORY=true

# Performance Settings
MAX_CONCURRENT_SESSIONS=10
MEMORY_PRESSURE_THRESHOLD=0.75
CACHE_SIZE_MB=100

# Logging
LOG_LEVEL=debug
ENABLE_REQUEST_LOGGING=true

# Security
CORS_ORIGINS=http://localhost:3000,http://localhost:5173
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100
```

## Core Development Patterns

### Factory Functions (No Classes!)

```typescript
// ✅ Preferred: Factory function pattern
export const createFaceDetector = (config: FaceDetectorConfig) => {
  const state = {
    isInitialized: false,
    detectionCount: 0
  };

  const initialize = async () => {
    // Initialization logic
    state.isInitialized = true;
  };

  const detect = async (imageData: ImageData) => {
    if (!state.isInitialized) {
      await initialize();
    }
    
    // Detection logic
    state.detectionCount++;
    return results;
  };

  const getStats = () => ({
    isInitialized: state.isInitialized,
    detectionCount: state.detectionCount
  });

  return { detect, getStats, initialize };
};

// ❌ Avoid: Class-based approach
class FaceDetector {
  // Don't use classes in this project
}
```

### Configuration Objects

```typescript
// ✅ Preferred: Configuration objects
export interface PipelineConfig {
  confidenceThreshold: number;
  maxFaces: number;
  enableLandmarks: boolean;
  processingMode: 'fast' | 'accurate';
}

export const createPipeline = (config: PipelineConfig) => {
  // Implementation using config
};

// Usage
const pipeline = createPipeline({
  confidenceThreshold: 0.7,
  maxFaces: 5,
  enableLandmarks: true,
  processingMode: 'accurate'
});
```

### Error Handling

```typescript
// Result type pattern for error handling
export type Result<T, E = Error> = 
  | { success: true; data: T }
  | { success: false; error: E };

export const safeFaceDetection = async (image: ImageData): Promise<Result<Face[]>> => {
  try {
    const faces = await detectFaces(image);
    return { success: true, data: faces };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error : new Error(String(error))
    };
  }
};

// Usage
const result = await safeFaceDetection(imageData);
if (result.success) {
  console.log('Detected faces:', result.data);
} else {
  console.error('Detection failed:', result.error.message);
}
```

## Feature Development

### Adding a New Analysis Pipeline

1. **Create the pipeline module:**

```typescript
// src/features/my-analysis/my-analysis-pipeline.ts
export interface MyAnalysisConfig {
  sensitivity: number;
  enableAdvanced: boolean;
}

export interface MyAnalysisResult {
  confidence: number;
  data: any;
  processingTimeMs: number;
}

export const createMyAnalysisPipeline = (config: MyAnalysisConfig) => {
  const analyze = async (input: any): Promise<MyAnalysisResult> => {
    const startTime = performance.now();
    
    // Your analysis logic here
    const data = performAnalysis(input, config);
    
    return {
      confidence: 0.95,
      data,
      processingTimeMs: performance.now() - startTime
    };
  };

  const initialize = async () => {
    // Initialize models, load resources, etc.
  };

  const cleanup = async () => {
    // Cleanup resources
  };

  return { analyze, initialize, cleanup };
};
```

2. **Register with the orchestrator:**

```typescript
// src/core/orchestration/unified-orchestrator.ts
export const createUnifiedOrchestrator = (config) => {
  const pipelines = new Map();

  const registerPipeline = (name: string, pipeline: any) => {
    pipelines.set(name, pipeline);
  };

  // In your feature initialization
  const myPipeline = createMyAnalysisPipeline(config.myAnalysis);
  registerPipeline('myAnalysis', myPipeline);
};
```

3. **Add API routes:**

```typescript
// src/core/api/routes/my-analysis-routes.ts
export const createMyAnalysisRoutes = (dependencies: RouteDependencies) => {
  const routes: RouteDefinition[] = [
    [
      'POST',
      '^/api/analysis/my-analysis$',
      async (request: Request): Promise<Response> => {
        const body = await request.json();
        
        // Validation
        if (!body.input) {
          return createErrorResponse('Input required', 400);
        }

        try {
          const result = await dependencies.orchestrator.analyze('myAnalysis', body.input);
          return createJSONResponse(result);
        } catch (error) {
          return createErrorResponse('Analysis failed', 500);
        }
      }
    ]
  ];

  return routes;
};
```

### WebSocket Integration

```typescript
// Real-time data streaming
export const createRealtimeMyAnalysis = (wsManager: WebSocketManager) => {
  const processRealtime = (sessionId: string, data: any) => {
    const result = analyzeData(data);
    
    // Send to specific session
    wsManager.sendToSession(sessionId, {
      type: 'my_analysis_result',
      data: result,
      timestamp: Date.now()
    });
  };

  const subscribe = (sessionId: string, options: any) => {
    // Setup subscription logic
    wsManager.addSubscription(sessionId, 'my_analysis', options);
  };

  return { processRealtime, subscribe };
};
```

## Testing

### Unit Testing with Bun

```typescript
// tests/unit/my-analysis.test.ts
import { describe, expect, test } from 'bun:test';
import { createMyAnalysisPipeline } from '../src/features/my-analysis/my-analysis-pipeline.ts';

describe('MyAnalysis Pipeline', () => {
  test('should analyze input correctly', async () => {
    const pipeline = createMyAnalysisPipeline({
      sensitivity: 0.8,
      enableAdvanced: true
    });

    await pipeline.initialize();

    const result = await pipeline.analyze({ data: 'test' });
    
    expect(result.confidence).toBeGreaterThan(0.5);
    expect(result.data).toBeDefined();
    expect(result.processingTimeMs).toBeGreaterThan(0);
  });

  test('should handle invalid input', async () => {
    const pipeline = createMyAnalysisPipeline({
      sensitivity: 0.8,
      enableAdvanced: false
    });

    await pipeline.initialize();

    await expect(pipeline.analyze(null)).rejects.toThrow();
  });
});
```

### Integration Testing

```typescript
// tests/integration/api.test.ts
import { describe, expect, test, beforeAll, afterAll } from 'bun:test';

describe('API Integration', () => {
  let server: any;

  beforeAll(async () => {
    server = createFaceAnalysisServer({ port: 0 }); // Random port
    await server.start();
  });

  afterAll(async () => {
    await server.stop();
  });

  test('should respond to health check', async () => {
    const response = await fetch(`http://localhost:${server.port}/api/health`);
    const data = await response.json();
    
    expect(response.status).toBe(200);
    expect(data.status).toBe('healthy');
  });
});
```

### Performance Testing

```typescript
// tests/performance/my-analysis-benchmark.ts
import { bench, run } from 'bun:test';

const pipeline = createMyAnalysisPipeline({ sensitivity: 0.8 });
await pipeline.initialize();

bench('my analysis performance', () => {
  return pipeline.analyze(testData);
});

run();
```

## Debugging and Profiling

### Debug Configuration

```typescript
// Enable debug logging
process.env.LOG_LEVEL = 'debug';

// Use Bun's built-in debugger
// bun --inspect src/services/api/server.ts

// Performance profiling
const startTime = performance.now();
await someOperation();
console.log(`Operation took: ${performance.now() - startTime}ms`);
```

### Memory Debugging

```typescript
// Monitor memory usage
const getMemoryUsage = () => {
  const usage = process.memoryUsage();
  return {
    rss: Math.round(usage.rss / 1024 / 1024) + 'MB',
    heapTotal: Math.round(usage.heapTotal / 1024 / 1024) + 'MB',
    heapUsed: Math.round(usage.heapUsed / 1024 / 1024) + 'MB',
    external: Math.round(usage.external / 1024 / 1024) + 'MB'
  };
};

// Log memory usage periodically
setInterval(() => {
  console.log('Memory usage:', getMemoryUsage());
}, 5000);
```

### WebSocket Debugging

```typescript
// Enable WebSocket message logging
const wsManager = createWebSocketManager({
  enableMessageLogging: true,
  logLevel: 'debug'
});

// Monitor WebSocket connections
wsManager.on('connection', (ws, sessionId) => {
  console.log(`WebSocket connected: ${sessionId}`);
});

wsManager.on('disconnection', (sessionId) => {
  console.log(`WebSocket disconnected: ${sessionId}`);
});
```

## Performance Optimization

### Memory Management

```typescript
// Use object pools for frequently created objects
const createObjectPool = <T>(factory: () => T, reset: (obj: T) => void) => {
  const pool: T[] = [];

  const acquire = (): T => {
    return pool.pop() || factory();
  };

  const release = (obj: T): void => {
    reset(obj);
    pool.push(obj);
  };

  return { acquire, release };
};

// Example usage for image processing
const canvasPool = createObjectPool(
  () => document.createElement('canvas'),
  (canvas) => {
    canvas.width = 0;
    canvas.height = 0;
  }
);
```

### Lazy Loading

```typescript
// Lazy load heavy dependencies
let heavyDependency: any = null;

const getHeavyDependency = async () => {
  if (!heavyDependency) {
    heavyDependency = await import('./heavy-dependency.js');
  }
  return heavyDependency;
};

// Use in pipeline
const processWithHeavyOperation = async (data: any) => {
  const dep = await getHeavyDependency();
  return dep.process(data);
};
```

### Batch Processing

```typescript
// Batch multiple requests for efficiency
export const createBatchProcessor = <T, R>(
  processor: (items: T[]) => Promise<R[]>,
  batchSize: number = 10,
  batchTimeoutMs: number = 100
) => {
  const pending: { item: T; resolve: (result: R) => void }[] = [];

  const processBatch = async () => {
    if (pending.length === 0) return;
    
    const batch = pending.splice(0, batchSize);
    const items = batch.map(p => p.item);
    
    try {
      const results = await processor(items);
      batch.forEach((p, index) => p.resolve(results[index]));
    } catch (error) {
      batch.forEach(p => p.resolve(error));
    }
  };

  const process = (item: T): Promise<R> => {
    return new Promise((resolve) => {
      pending.push({ item, resolve });
      
      if (pending.length >= batchSize) {
        processBatch();
      } else if (pending.length === 1) {
        setTimeout(processBatch, batchTimeoutMs);
      }
    });
  };

  return { process };
};
```

## Security Best Practices

### Input Validation

```typescript
import { z } from 'zod';

// Define schemas for API inputs
const FaceDetectionRequestSchema = z.object({
  image: z.string().min(1, 'Image data required'),
  options: z.object({
    confidenceThreshold: z.number().min(0).max(1).default(0.5),
    maxFaces: z.number().int().min(1).max(50).default(10)
  }).optional()
});

// Use in route handler
const validateAndProcess = async (request: Request) => {
  const body = await request.json();
  
  // Validate input
  const validationResult = FaceDetectionRequestSchema.safeParse(body);
  if (!validationResult.success) {
    return createErrorResponse('Invalid input', 400, {
      errors: validationResult.error.errors
    });
  }

  // Process validated data
  const { image, options } = validationResult.data;
  return await processFaceDetection(image, options);
};
```

### Rate Limiting

```typescript
// Custom rate limiter implementation
export const createRateLimiter = (windowMs: number, maxRequests: number) => {
  const requests = new Map<string, number[]>();

  const checkLimit = (key: string): boolean => {
    const now = Date.now();
    const windowStart = now - windowMs;
    
    // Get or create request history for this key
    const keyRequests = requests.get(key) || [];
    
    // Remove expired requests
    const validRequests = keyRequests.filter(time => time > windowStart);
    
    // Check if under limit
    if (validRequests.length >= maxRequests) {
      return false;
    }

    // Add current request and update
    validRequests.push(now);
    requests.set(key, validRequests);
    
    return true;
  };

  return { checkLimit };
};
```

## Deployment

### Production Build

```bash
# Build TypeScript
bun run build:ts

# Optimize bundle
bun run build:analyze

# Start production server
NODE_ENV=production bun serve
```

### Docker Deployment

```dockerfile
FROM oven/bun:latest

WORKDIR /app

# Copy package files
COPY package.json bun.lockb ./

# Install dependencies
RUN bun install --frozen-lockfile --production

# Copy source code
COPY . .

# Build application
RUN bun run build

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

# Start application
CMD ["bun", "serve"]
```

### Environment-specific Configuration

```typescript
// config/production.ts
export const productionConfig = {
  server: {
    port: process.env.PORT || 3000,
    host: '0.0.0.0',
    cors: {
      origins: process.env.CORS_ORIGINS?.split(',') || ['https://app.example.com']
    }
  },
  logging: {
    level: 'info',
    enableConsole: false,
    enableFile: true
  },
  performance: {
    memoryPressureThreshold: 0.8,
    maxConcurrentSessions: 50
  }
};
```

## Monitoring and Observability

### Metrics Collection

```typescript
// Custom metrics system
export const createMetrics = () => {
  const counters = new Map<string, number>();
  const gauges = new Map<string, number>();
  const histograms = new Map<string, number[]>();

  const incrementCounter = (name: string, value: number = 1) => {
    counters.set(name, (counters.get(name) || 0) + value);
  };

  const setGauge = (name: string, value: number) => {
    gauges.set(name, value);
  };

  const recordHistogram = (name: string, value: number) => {
    const values = histograms.get(name) || [];
    values.push(value);
    histograms.set(name, values);
  };

  const getMetrics = () => ({
    counters: Object.fromEntries(counters),
    gauges: Object.fromEntries(gauges),
    histograms: Object.fromEntries(
      Array.from(histograms.entries()).map(([name, values]) => [
        name,
        {
          count: values.length,
          sum: values.reduce((a, b) => a + b, 0),
          avg: values.reduce((a, b) => a + b, 0) / values.length
        }
      ])
    )
  });

  return { incrementCounter, setGauge, recordHistogram, getMetrics };
};
```

### Health Checks

```typescript
// Comprehensive health checking
export const createHealthChecker = (dependencies: any) => {
  const checkHealth = async () => {
    const checks = await Promise.allSettled([
      checkDatabase(),
      checkMemory(),
      checkDisk(),
      checkExternalServices()
    ]);

    const results = checks.map((check, index) => ({
      name: ['database', 'memory', 'disk', 'external'][index],
      status: check.status === 'fulfilled' ? 'healthy' : 'unhealthy',
      details: check.status === 'fulfilled' ? check.value : check.reason
    }));

    const overallStatus = results.every(r => r.status === 'healthy') 
      ? 'healthy' 
      : 'unhealthy';

    return {
      status: overallStatus,
      timestamp: Date.now(),
      checks: results
    };
  };

  return { checkHealth };
};
```

This guide provides a comprehensive foundation for developing with the Synopticon API. Follow these patterns and practices to build robust, performant features that integrate seamlessly with the existing architecture.