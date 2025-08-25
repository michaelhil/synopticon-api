/**
 * Distribution API Extension - Bun Native TypeScript
 * Provides HTTP API endpoints for controlling the distribution system
 * Uses Bun native WebSocket and Web API types for maximum performance
 */

import { createDistributionSessionManager } from '../../core/distribution/distribution-session-manager';
import { createDistributionConfigManager } from '../../core/distribution/distribution-config-manager';
import { parseRequestURL } from '../../shared/utils/url-utils';

// API Request/Response Types using Web API standards
export interface ApiResponse<T = unknown> {
  readonly success: boolean;
  readonly data?: T;
  readonly error?: string;
  readonly timestamp: number;
  readonly requestId?: string;
}

export interface StreamConfig {
  readonly type: 'udp' | 'mqtt' | 'websocket' | 'http' | 'sse';
  readonly destination: {
    readonly host: string;
    readonly port: number;
    readonly path?: string;
  };
  readonly source: 'eye_tracking' | 'face_analysis' | 'speech_analysis' | 'emotion_analysis' | 'age_estimation';
  readonly distributors: ReadonlyArray<string>;
  readonly filter?: {
    readonly sampleRate?: number;
    readonly includeMetadata?: boolean;
  };
  readonly clientId?: string;
  readonly metadata?: Record<string, unknown>;
}

export interface StreamInfo {
  readonly id: string;
  readonly type: string;
  readonly source: string;
  readonly destination: StreamConfig['destination'];
  readonly status: 'active' | 'stopped' | 'error';
  readonly createdAt: number;
  readonly clientId?: string;
  readonly statistics: {
    readonly packetsSent: number;
    readonly bytesSent: number;
    readonly lastActivity: number;
  };
  readonly metadata?: Record<string, unknown>;
}

export interface DiscoveryInfo {
  readonly service: string;
  readonly version: string;
  readonly capabilities: ReadonlyArray<string>;
  readonly availableStreams: ReadonlyArray<Pick<StreamInfo, 'id' | 'type' | 'source' | 'status'>>;
  readonly availableDistributors: ReadonlyArray<string>;
  readonly connectedClients: ReadonlyArray<{
    readonly id: string;
    readonly name?: string;
    readonly type: string;
    readonly streamCount: number;
  }>;
  readonly templates: ReadonlyArray<string>;
  readonly apiEndpoints: Record<string, string>;
  readonly websocketEndpoints: Record<string, string>;
}

// Secure ID generation using Bun's crypto
const generateSecureId = (prefix = ''): string => {
  const timestamp = Date.now();
  const random = crypto.getRandomValues(new Uint8Array(16));
  const randomHex = Array.from(random, byte => byte.toString(16).padStart(2, '0')).join('');
  return prefix ? `${prefix}_${timestamp}_${randomHex}` : `${timestamp}_${randomHex}`;
};

// Response helper for Web API Response format
const createApiResponse = <T>(data: T, success = true, status = 200): Response => {
  const response: ApiResponse<T> = {
    success,
    data: success ? data : undefined,
    error: !success ? (data as any) : undefined,
    timestamp: Date.now()
  };

  return new Response(JSON.stringify(response), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-API-Key'
    }
  });
};

/**
 * Create Distribution API with Bun native implementations
 */
export const createDistributionAPI = (config: any = {}) => {
  // Core managers
  const sessionManager = createDistributionSessionManager();
  const configManager = createDistributionConfigManager();
  
  // Stream registry for tracking active streams
  const streams = new Map<string, StreamInfo>();
  const clients = new Map<string, any>();
  const templates = new Map<string, any>();
  const recordings = new Map<string, any>();
  
  // WebSocket connections for status updates (using Bun native WebSocket)
  const statusConnections = new Set<any>(); // Bun WebSocket type
  
  // Initialize default templates
  const initializeTemplates = (): void => {
    templates.set('research_study', {
      name: 'Research Study',
      description: 'Standard research study configuration',
      config: {
        distributors: {
          mqtt: {
            broker: 'mqtt://localhost:1883',
            topics: {
              prefix: 'studies',
              gaze: 'studies/{study_id}/{participant_id}/gaze',
              events: 'studies/{study_id}/{participant_id}/events'
            }
          }
        },
        eventRouting: {
          'eye_tracking': ['mqtt'],
          'events': ['mqtt']
        }
      }
    });
    
    templates.set('real_time_viz', {
      name: 'Real-Time Visualization',
      description: 'Low-latency streaming for visualization',
      config: {
        distributors: {
          udp: { port: 9999 },
          websocket: { port: 8080 }
        },
        eventRouting: {
          'eye_tracking': ['udp', 'websocket'],
          'face_analysis': ['websocket']
        }
      }
    });
    
    templates.set('data_logging', {
      name: 'Data Logging',
      description: 'Comprehensive data logging configuration',
      config: {
        distributors: {
          http: {
            baseUrl: 'http://localhost:3001',
            endpoints: { batch: '/api/data/batch' }
          },
          mqtt: { broker: 'mqtt://localhost:1883' }
        },
        eventRouting: {
          'all_data': ['http', 'mqtt']
        }
      }
    });
  };
  
  initializeTemplates();
  
  // Broadcast status update to all WebSocket connections
  const broadcastStatusUpdate = (update: any): void => {
    const message = JSON.stringify({
      type: 'status_update',
      timestamp: Date.now(),
      ...update
    });
    
    statusConnections.forEach(ws => {
      if (ws.readyState === 1) { // WebSocket.OPEN
        ws.send(message);
      }
    });
  };
  
  // Stream management functions
  const createStream = async (config: StreamConfig): Promise<StreamInfo> => {
    const streamId = generateSecureId('stream');
    
    // Validate destination
    if (config.type === 'udp') {
      if (!config.destination.host || !config.destination.port) {
        throw new Error('UDP streams require host and port in destination');
      }
    }
    
    // Create distribution configuration
    const distributionConfig = {
      distributors: {} as any,
      eventRouting: {} as any
    };
    
    // Configure distributor based on type
    switch (config.type) {
      case 'udp':
        distributionConfig.distributors.udp = {
          port: config.destination.port,
          targets: [{
            host: config.destination.host,
            port: config.destination.port
          }]
        };
        break;
        
      case 'mqtt':
        distributionConfig.distributors.mqtt = {
          broker: 'mqtt://localhost:1883',
          clientId: `synopticon_${streamId}`,
          topics: {
            prefix: 'synopticon',
            data: `synopticon/${config.source}`
          }
        };
        break;
        
      case 'websocket':
        distributionConfig.distributors.websocket = {
          port: config.destination.port || 8080,
          compression: true
        };
        break;
        
      case 'http':
        distributionConfig.distributors.http = {
          baseUrl: `http://${config.destination.host}:${config.destination.port}`,
          endpoints: { data: '/api/data' }
        };
        break;
        
      default:
        throw new Error(`Unknown stream type: ${config.type}`);
    }
    
    // Set up event routing
    const routingKey = config.source || 'all_data';
    distributionConfig.eventRouting[routingKey] = [config.type];
    
    // Create session using the session manager
    try {
      const sessionConfig = configManager.createSessionConfig(distributionConfig);
      await sessionManager.createSession(streamId, sessionConfig);
    } catch (error: any) {
      throw new Error(`Failed to create distribution session: ${error.message}`);
    }
    
    // Store stream info
    const streamInfo: StreamInfo = {
      id: streamId,
      type: config.type,
      source: config.source,
      destination: config.destination,
      status: 'active',
      createdAt: Date.now(),
      clientId: config.clientId,
      statistics: {
        packetsSent: 0,
        bytesSent: 0,
        lastActivity: Date.now()
      },
      metadata: config.metadata || {}
    };
    
    streams.set(streamId, streamInfo);
    
    // Link to client if client_id provided
    if (config.clientId && clients.has(config.clientId)) {
      const client = clients.get(config.clientId);
      if (client) {
        client.streams.push(streamId);
      }
    }
    
    // Broadcast status update
    broadcastStatusUpdate({
      event: 'stream_created',
      stream: streamInfo
    });
    
    return streamInfo;
  };
  
  // Status aggregation
  const getOverallStatus = () => {
    const activeStreams = Array.from(streams.values()).filter(s => s.status === 'active');
    
    return {
      timestamp: Date.now(),
      streams: {
        total: streams.size,
        active: activeStreams.length,
        stopped: streams.size - activeStreams.length
      },
      clients: {
        total: clients.size,
        active: Array.from(clients.values()).filter(c => 
          Date.now() - c.last_seen < 60000
        ).length
      },
      recordings: {
        total: recordings.size,
        active: Array.from(recordings.values()).filter(r => 
          r.status === 'recording'
        ).length
      },
      data_sources: {
        eye_tracking: {
          connected: true,
          device_id: 'neon-001',
          sample_rate: 200
        },
        face_analysis: {
          available: true,
          pipeline: 'accurate'
        },
        speech_analysis: {
          available: true,
          active: false
        }
      },
      stream_details: activeStreams
    };
  };
  
  // Discovery service
  const getDiscoveryInfo = (): DiscoveryInfo => {
    return {
      service: 'synopticon',
      version: '1.0.0',
      capabilities: [
        'eye_tracking',
        'face_analysis',
        'speech_analysis',
        'emotion_analysis'
      ],
      availableStreams: Array.from(streams.values()).map(s => ({
        id: s.id,
        type: s.type,
        source: s.source,
        status: s.status
      })),
      availableDistributors: [
        'mqtt',
        'udp',
        'websocket',
        'http',
        'sse'
      ],
      connectedClients: Array.from(clients.values()).map(c => ({
        id: c.id,
        name: c.name,
        type: c.type,
        streamCount: c.streams?.length || 0
      })),
      templates: Array.from(templates.keys()),
      apiEndpoints: {
        streams: '/api/distribution/streams',
        status: '/api/distribution/status',
        discovery: '/api/distribution/discovery',
        clients: '/api/distribution/clients',
        templates: '/api/distribution/templates'
      },
      websocketEndpoints: {
        status: 'ws://[host]/api/distribution/events'
      }
    };
  };
  
  // API route handlers using Web API Request/Response
  const routes: Record<string, (request: Request) => Promise<Response>> = {
    // Get overall status
    'GET /api/distribution/status': async (request: Request): Promise<Response> => {
      try {
        const status = getOverallStatus();
        return createApiResponse(status);
      } catch (error: any) {
        return createApiResponse(error.message, false, 500);
      }
    },
    
    // Service discovery
    'GET /api/distribution/discovery': async (request: Request): Promise<Response> => {
      try {
        const discovery = getDiscoveryInfo();
        return createApiResponse(discovery);
      } catch (error: any) {
        return createApiResponse(error.message, false, 500);
      }
    },
    
    // Create new stream
    'POST /api/distribution/streams': async (request: Request): Promise<Response> => {
      try {
        const body = await request.json();
        const stream = await createStream(body);
        return createApiResponse({
          stream_id: stream.id,
          data: stream,
          websocket_status_url: `ws://${request.headers.get('host')}/api/distribution/events?stream=${stream.id}`
        });
      } catch (error: any) {
        return createApiResponse(error.message, false, 400);
      }
    },
    
    // Get stream status
    'GET /api/distribution/streams/:id': async (request: Request): Promise<Response> => {
      try {
        const url = new URL(request.url);
        const streamId = url.pathname.split('/').pop();
        
        if (!streamId || !streams.has(streamId)) {
          return createApiResponse('Stream not found', false, 404);
        }
        
        const stream = streams.get(streamId);
        const sessionStatus = sessionManager.getSessionStatus ? 
          sessionManager.getSessionStatus(streamId) : null;
        
        return createApiResponse({
          ...stream,
          session_status: sessionStatus
        });
      } catch (error: any) {
        return createApiResponse(error.message, false, 500);
      }
    },
    
    // List all streams
    'GET /api/distribution/streams': async (request: Request): Promise<Response> => {
      try {
        const streamList = Array.from(streams.values());
        return createApiResponse({
          streams: streamList,
          count: streamList.length
        });
      } catch (error: any) {
        return createApiResponse(error.message, false, 500);
      }
    },
    
    // Get available templates
    'GET /api/distribution/templates': async (request: Request): Promise<Response> => {
      try {
        const templateList = Array.from(templates.entries()).map(([id, template]) => ({
          id,
          ...template
        }));
        return createApiResponse(templateList);
      } catch (error: any) {
        return createApiResponse(error.message, false, 500);
      }
    }
  };
  
  // WebSocket handler for real-time status updates (Bun native)
  const handleWebSocketConnection = (ws: any): void => {
    // Add to status connections
    statusConnections.add(ws);
    
    // Send initial status
    ws.send(JSON.stringify({
      type: 'connected',
      timestamp: Date.now(),
      overall_status: getOverallStatus()
    }));
    
    // Cleanup on disconnect handled by caller
  };
  
  const addStatusConnection = (ws: any): void => {
    statusConnections.add(ws);
  };
  
  const removeStatusConnection = (ws: any): void => {
    statusConnections.delete(ws);
  };
  
  return {
    routes,
    handleWebSocketConnection,
    addStatusConnection,
    removeStatusConnection,
    getOverallStatus,
    getDiscoveryInfo,
    
    // Cleanup function
    cleanup: () => {
      streams.clear();
      clients.clear();
      templates.clear();
      recordings.clear();
      statusConnections.clear();
    },
    
    // Direct access for testing
    streams,
    clients,
    templates,
    recordings
  };
};