/**
 * Synopticon MCP Server
 * Main MCP server implementing Model Context Protocol for Synopticon API
 */

import { MCPServerConfig, validateMCPConfig } from './config/mcp-config.ts';
import { getEnabledTools, TOOL_CATEGORIES } from './config/tool-registry.ts';
import { createSynopticonHTTPClient } from './client/http-client.ts';
import { createLogger, getLogLevelFromEnv } from './utils/logger.ts';
import { MCPError, MCPErrorCode, createErrorResponse } from './utils/error-handler.ts';

// Tool imports with lazy loading
const loadSystemTools = () => import('./tools/system-tools.ts');
const loadFaceTools = () => import('./tools/face-tools.ts');  
const loadEmotionTools = () => import('./tools/emotion-tools.ts');
const loadMediaTools = () => import('./tools/media-tools.ts');
const loadCognitiveTools = () => import('./tools/cognitive-tools.ts');

const logger = createLogger('MCPServer', getLogLevelFromEnv());

interface MCPRequest {
  jsonrpc: '2.0';
  id?: string | number;
  method: string;
  params?: unknown;
}

interface MCPResponse {
  jsonrpc: '2.0';
  id?: string | number;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

class SynopticonMCPServer {
  private config: MCPServerConfig;
  private httpClient: ReturnType<typeof createSynopticonHTTPClient>;
  private toolsCache: Map<string, any> = new Map();
  private initialized = false;

  constructor(config: Partial<MCPServerConfig> = {}) {
    this.config = validateMCPConfig(config);
    this.httpClient = createSynopticonHTTPClient({
      baseUrl: this.config.synopticonApiUrl,
      timeout: this.config.timeout,
      retryAttempts: this.config.retry.attempts,
      retryDelay: this.config.retry.delay
    });

    logger.info('MCP Server initialized', {
      apiUrl: this.config.synopticonApiUrl,
      transport: this.config.transport
    });
  }

  /**
   * Initialize server and verify Synopticon connectivity
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    logger.info('Initializing MCP server...');

    try {
      // Verify Synopticon API connectivity
      const isHealthy = await this.httpClient.isHealthy();
      if (!isHealthy) {
        throw new MCPError(
          MCPErrorCode.SYNOPTICON_UNAVAILABLE,
          'Cannot connect to Synopticon API'
        );
      }

      // Get capabilities to enable/disable tool categories
      const capabilities = await this.httpClient.getHealth();
      this.updateToolCategories(capabilities);

      this.initialized = true;
      logger.info('MCP server initialized successfully', {
        enabledCategories: Object.keys(TOOL_CATEGORIES).filter(k => TOOL_CATEGORIES[k].enabled)
      });

    } catch (error) {
      logger.error('Failed to initialize MCP server', error as Error);
      throw error;
    }
  }

  /**
   * Start the MCP server with specified transport
   */
  async start(): Promise<void> {
    await this.initialize();

    if (this.config.transport === 'stdio') {
      await this.startStdioTransport();
    } else if (this.config.transport === 'sse') {
      await this.startSSETransport();
    }
  }

  /**
   * Handle MCP request
   */
  private async handleRequest(request: MCPRequest): Promise<MCPResponse> {
    const requestId = request.id || 'unknown';
    
    logger.debug('Processing MCP request', { 
      method: request.method, 
      id: requestId,
      params: request.params 
    });

    try {
      let result: unknown;

      switch (request.method) {
        case 'initialize':
          result = await this.handleInitialize(request.params);
          break;
        
        case 'tools/list':
          result = await this.handleToolsList();
          break;
        
        case 'tools/call':
          result = await this.handleToolCall(request.params);
          break;
        
        default:
          throw new MCPError(
            MCPErrorCode.INVALID_TOOL_CALL,
            `Unknown method: ${request.method}`
          );
      }

      return {
        jsonrpc: '2.0',
        id: requestId,
        result
      };

    } catch (error) {
      logger.error('MCP request failed', error as Error, { 
        method: request.method,
        id: requestId
      });

      if (error instanceof MCPError) {
        return {
          jsonrpc: '2.0',
          id: requestId,
          error: {
            code: -1,
            message: error.message,
            data: error.context
          }
        };
      }

      return {
        jsonrpc: '2.0',
        id: requestId,
        error: {
          code: -1,
          message: 'Internal server error',
          data: { error: String(error) }
        }
      };
    }
  }

  /**
   * Handle MCP initialize request
   */
  private async handleInitialize(params: unknown): Promise<object> {
    logger.info('MCP client connected');
    
    return {
      protocolVersion: '2024-11-05',
      capabilities: {
        tools: {}
      },
      serverInfo: {
        name: 'synopticon-mcp-server',
        version: '0.5.6'
      }
    };
  }

  /**
   * Handle tools list request
   */
  private async handleToolsList(): Promise<{ tools: MCPTool[] }> {
    const tools = await this.loadAllTools();
    
    logger.debug('Listing available tools', { count: tools.length });
    
    return {
      tools: tools.map(tool => tool.definition)
    };
  }

  /**
   * Handle tool call request
   */
  private async handleToolCall(params: unknown): Promise<unknown> {
    const { name, arguments: args } = params as { name: string; arguments: Record<string, unknown> };
    
    if (!name) {
      throw new MCPError(MCPErrorCode.INVALID_TOOL_CALL, 'Tool name is required');
    }

    logger.debug('Executing tool', { name, args });

    const tools = await this.loadAllTools();
    const tool = tools.find(t => t.definition.name === name);
    
    if (!tool) {
      throw new MCPError(
        MCPErrorCode.INVALID_TOOL_CALL,
        `Unknown tool: ${name}`,
        { availableTools: tools.map(t => t.definition.name) }
      );
    }

    return await tool.handler(args || {}, this.httpClient);
  }

  /**
   * Load all enabled tools with lazy loading
   */
  private async loadAllTools(): Promise<Array<{ definition: MCPTool; handler: Function }>> {
    const allTools: Array<{ definition: MCPTool; handler: Function }> = [];

    // Load system tools (always enabled)
    if (!this.toolsCache.has('system')) {
      const { systemTools } = await loadSystemTools();
      this.toolsCache.set('system', systemTools);
    }
    allTools.push(...this.toolsCache.get('system'));

    // Load face analysis tools
    if (TOOL_CATEGORIES.face.enabled) {
      if (!this.toolsCache.has('face')) {
        const { faceTools } = await loadFaceTools();
        this.toolsCache.set('face', faceTools);
      }
      allTools.push(...this.toolsCache.get('face'));
    }

    // Load emotion analysis tools
    if (TOOL_CATEGORIES.emotion.enabled) {
      if (!this.toolsCache.has('emotion')) {
        const { emotionTools } = await loadEmotionTools();
        this.toolsCache.set('emotion', emotionTools);
      }
      allTools.push(...this.toolsCache.get('emotion'));
    }

    // Load media streaming tools
    if (TOOL_CATEGORIES.media.enabled) {
      if (!this.toolsCache.has('media')) {
        const { mediaTools } = await loadMediaTools();
        this.toolsCache.set('media', mediaTools);
      }
      allTools.push(...this.toolsCache.get('media'));
    }

    // Load cognitive advisory tools
    if (TOOL_CATEGORIES.cognitive.enabled) {
      if (!this.toolsCache.has('cognitive')) {
        const { cognitiveTools } = await loadCognitiveTools();
        this.toolsCache.set('cognitive', cognitiveTools);
      }
      allTools.push(...this.toolsCache.get('cognitive'));
    }

    return allTools;
  }

  /**
   * Update tool categories based on Synopticon capabilities
   */
  private updateToolCategories(capabilities: any): void {
    TOOL_CATEGORIES.face.enabled = capabilities.face_detection || false;
    TOOL_CATEGORIES.emotion.enabled = capabilities.emotion_analysis || false;
    TOOL_CATEGORIES.media.enabled = capabilities.media_streaming || false;
    TOOL_CATEGORIES.cognitive.enabled = true; // Always enabled - cognitive system is always available
    
    // Future capabilities
    TOOL_CATEGORIES.eye_tracking.enabled = capabilities.eye_tracking || false;
    TOOL_CATEGORIES.speech.enabled = capabilities.speech_analysis || false;

    logger.debug('Tool categories updated', {
      face: TOOL_CATEGORIES.face.enabled,
      emotion: TOOL_CATEGORIES.emotion.enabled,
      media: TOOL_CATEGORIES.media.enabled,
      eye_tracking: TOOL_CATEGORIES.eye_tracking.enabled,
      speech: TOOL_CATEGORIES.speech.enabled
    });
  }

  /**
   * Start stdio transport for Claude Desktop
   */
  private async startStdioTransport(): Promise<void> {
    logger.info('Starting stdio transport for MCP communication');

    process.stdin.setEncoding('utf-8');
    process.stdin.on('data', async (data) => {
      try {
        const request = JSON.parse(data.toString().trim()) as MCPRequest;
        const response = await this.handleRequest(request);
        
        process.stdout.write(JSON.stringify(response) + '\n');
      } catch (error) {
        logger.error('Failed to process stdio input', error as Error);
        
        const errorResponse: MCPResponse = {
          jsonrpc: '2.0',
          error: {
            code: -1,
            message: 'Failed to parse request'
          }
        };
        
        process.stdout.write(JSON.stringify(errorResponse) + '\n');
      }
    });

    process.stdin.resume();
    logger.info('MCP server listening on stdio');
  }

  /**
   * Start SSE transport for web-based clients
   */
  private async startSSETransport(): Promise<void> {
    const port = this.config.port || 3001;
    logger.info(`Starting SSE transport on port ${port}`);
    
    // Note: SSE implementation would require a web server
    // For now, we'll log that it's not implemented
    logger.warn('SSE transport not yet implemented - use stdio transport');
    throw new MCPError(
      MCPErrorCode.CONFIGURATION_ERROR,
      'SSE transport not yet implemented'
    );
  }
}

/**
 * Create and start MCP server
 */
export const createSynopticonMCPServer = (config?: Partial<MCPServerConfig>) => {
  return new SynopticonMCPServer(config);
};

/**
 * Main entry point for CLI usage
 */
export const main = async () => {
  try {
    const config: Partial<MCPServerConfig> = {
      synopticonApiUrl: process.env.SYNOPTICON_API_URL || 'http://localhost:3000',
      transport: (process.env.MCP_TRANSPORT as 'stdio' | 'sse') || 'stdio',
      debug: process.env.MCP_DEBUG === 'true',
      timeout: parseInt(process.env.MCP_TIMEOUT || '5000'),
      port: parseInt(process.env.MCP_PORT || '3001')
    };

    const server = createSynopticonMCPServer(config);
    await server.start();

  } catch (error) {
    logger.error('Failed to start MCP server', error as Error);
    process.exit(1);
  }
};

// Start server if run directly
if (import.meta.main) {
  main();
}