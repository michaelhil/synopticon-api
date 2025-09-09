/**
 * MCP Server Configuration Types and Defaults
 * Defines configuration schema for the Synopticon MCP server
 */

export interface MCPServerConfig {
  /** Synopticon API base URL */
  synopticonApiUrl: string;
  /** MCP transport method */
  transport: 'stdio' | 'sse';
  /** Server host (for SSE transport) */
  host?: string;
  /** Server port (for SSE transport) */
  port?: number;
  /** Enable debug logging */
  debug?: boolean;
  /** Connection timeout in milliseconds */
  timeout?: number;
  /** Retry configuration */
  retry?: {
    attempts: number;
    delay: number;
  };
}

export interface MCPClientConfig {
  /** Target LLM client type */
  client: 'claude-desktop' | 'cursor' | 'continue' | 'other';
  /** Deployment scenario */
  deployment: 'local' | 'remote' | 'docker';
  /** Remote host (for remote deployment) */
  remoteHost?: string;
  /** Custom configuration overrides */
  overrides?: Record<string, unknown>;
}

export const DEFAULT_MCP_CONFIG: MCPServerConfig = {
  synopticonApiUrl: 'http://localhost:3000',
  transport: 'stdio',
  debug: false,
  timeout: 5000,
  retry: {
    attempts: 3,
    delay: 1000
  }
};

export const MCP_PORTS = {
  /** Default MCP server port for SSE transport */
  DEFAULT: 3001,
  /** Alternative ports for multi-instance scenarios */
  ALTERNATIVES: [3002, 3003, 3004]
} as const;

export const SUPPORTED_CLIENTS = {
  'claude-desktop': {
    name: 'Claude Desktop',
    configPath: '~/.config/claude/claude_desktop_config.json',
    transport: 'stdio'
  },
  'cursor': {
    name: 'Cursor',
    configPath: '~/.cursor/mcp_config.json',
    transport: 'stdio'
  },
  'continue': {
    name: 'Continue',
    configPath: '~/.continue/config.json',
    transport: 'sse'
  }
} as const;

export const validateMCPConfig = (config: Partial<MCPServerConfig>): MCPServerConfig => {
  const validated = { ...DEFAULT_MCP_CONFIG, ...config };
  
  if (!validated.synopticonApiUrl) {
    throw new Error('synopticonApiUrl is required');
  }
  
  if (!['stdio', 'sse'].includes(validated.transport)) {
    throw new Error('transport must be "stdio" or "sse"');
  }
  
  if (validated.transport === 'sse' && !validated.port) {
    validated.port = MCP_PORTS.DEFAULT;
  }
  
  return validated;
};
