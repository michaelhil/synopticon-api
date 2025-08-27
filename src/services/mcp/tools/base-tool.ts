/**
 * Base MCP Tool Interface
 * Common interface and utilities for all Synopticon MCP tools
 */

import type { SynopticonHTTPClient } from '../client/http-client.ts';
import { createLogger } from '../utils/logger.ts';
import { validateParameters, ValidationSchema } from '../utils/validation.ts';

const logger = createLogger('BaseTool');

export interface MCPToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export interface MCPToolResult {
  content: Array<{
    type: 'text';
    text: string;
  }>;
  isError?: boolean;
}

export type MCPToolHandler = (
  params: Record<string, unknown>,
  client: SynopticonHTTPClient
) => Promise<MCPToolResult>;

export interface MCPTool {
  definition: MCPToolDefinition;
  handler: MCPToolHandler;
}

/**
 * Create standardized success result
 */
export const createSuccessResult = (message: string, data?: unknown): MCPToolResult => {
  let text = message;
  
  if (data) {
    text += '\n\nData:\n```json\n' + JSON.stringify(data, null, 2) + '\n```';
  }
  
  return {
    content: [{ type: 'text', text }]
  };
};

/**
 * Create standardized error result
 */
export const createErrorResult = (message: string, error?: unknown): MCPToolResult => {
  let text = `Error: ${message}`;
  
  if (error && typeof error === 'object') {
    text += '\n\nDetails:\n```json\n' + JSON.stringify(error, null, 2) + '\n```';
  }
  
  return {
    content: [{ type: 'text', text }],
    isError: true
  };
};

/**
 * Create MCP tool with validation
 */
export const createMCPTool = (
  definition: MCPToolDefinition,
  validationSchema: ValidationSchema,
  handler: (params: Record<string, unknown>, client: SynopticonHTTPClient) => Promise<unknown>
): MCPTool => {
  const validatedHandler: MCPToolHandler = async (params, client) => {
    try {
      logger.debug(`Executing tool: ${definition.name}`, { params });
      
      // Validate parameters
      const validation = validateParameters(params, validationSchema);
      if (!validation.valid) {
        return createErrorResult(
          'Parameter validation failed',
          { errors: validation.errors, params }
        );
      }

      // Execute handler with validated parameters
      const result = await handler(validation.sanitized!, client);
      
      logger.debug(`Tool ${definition.name} completed successfully`);
      return createSuccessResult(`${definition.name} completed successfully`, result);
      
    } catch (error) {
      logger.error(`Tool ${definition.name} failed`, error as Error);
      
      if (error instanceof Error) {
        return createErrorResult(error.message, { name: error.name, stack: error.stack });
      }
      
      return createErrorResult('Unknown error occurred', error);
    }
  };

  return {
    definition,
    handler: validatedHandler
  };
};

/**
 * Base tool factory for common patterns
 */
export const createBaseToolFactory = (category: string) => {
  const categoryLogger = createLogger(`${category}Tools`);
  
  return {
    /**
     * Create a simple status/getter tool
     */
    createStatusTool: (
      name: string,
      description: string,
      apiCall: (client: SynopticonHTTPClient) => Promise<unknown>
    ): MCPTool => {
      return createMCPTool(
        {
          name: `synopticon_${name}`,
          description: `Synopticon: ${description}`,
          inputSchema: {
            type: 'object',
            properties: {}
          }
        },
        {}, // No parameters needed for status tools
        async (_, client) => {
          categoryLogger.debug(`Executing status tool: ${name}`);
          return await apiCall(client);
        }
      );
    },

    /**
     * Create a start/action tool with optional parameters
     */
    createActionTool: (
      name: string,
      description: string,
      parameterSchema: ValidationSchema,
      inputProperties: Record<string, unknown>,
      apiCall: (client: SynopticonHTTPClient, params: Record<string, unknown>) => Promise<unknown>
    ): MCPTool => {
      return createMCPTool(
        {
          name: `synopticon_${name}`,
          description: `Synopticon: ${description}`,
          inputSchema: {
            type: 'object',
            properties: inputProperties,
            required: Object.keys(parameterSchema).filter(key => parameterSchema[key].required)
          }
        },
        parameterSchema,
        async (params, client) => {
          categoryLogger.debug(`Executing action tool: ${name}`, { params });
          return await apiCall(client, params);
        }
      );
    }
  };
};