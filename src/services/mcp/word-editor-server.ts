#!/usr/bin/env bun
/**
 * MCP Server for Word Document Editing
 * Provides tools for reading and editing Microsoft Word (.docx) files
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { join, extname, basename } from "path";
import { existsSync, readFileSync, writeFileSync, readdirSync, statSync } from "fs";

// We'll use a TypeScript-compatible approach for document manipulation
// Since we're using Bun, we can use native APIs and external tools

const server = new Server(
  {
    name: "word-editor-server",
    version: "0.1.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Helper function to check if file is a Word document
const isWordDocument = (filepath: string): boolean => {
  const ext = extname(filepath).toLowerCase();
  return ext === '.docx' || ext === '.doc';
};

// Helper function to convert .docx to text using pandoc (if available)
const convertDocxToText = async (filepath: string): Promise<string> => {
  try {
    const process = Bun.spawn(['pandoc', filepath, '-t', 'markdown'], {
      stdout: 'pipe',
      stderr: 'pipe'
    });
    
    const output = await new Response(process.stdout).text();
    const exitCode = await process.exited;
    
    if (exitCode === 0) {
      return output;
    } else {
      throw new Error('Pandoc conversion failed');
    }
  } catch (error) {
    // Fallback: try to extract text using a simple approach
    console.warn('Pandoc not available, using fallback text extraction');
    return 'Word document content extraction requires pandoc or python-docx library';
  }
};

// Helper function to convert markdown back to .docx
const convertTextToDocx = async (text: string, outputPath: string): Promise<boolean> => {
  try {
    // Create a temporary markdown file
    const tempMd = `/tmp/temp-${Date.now()}.md`;
    writeFileSync(tempMd, text, 'utf-8');
    
    const process = Bun.spawn(['pandoc', tempMd, '-o', outputPath], {
      stdout: 'pipe',
      stderr: 'pipe'
    });
    
    const exitCode = await process.exited;
    
    // Clean up temp file
    try {
      await Bun.file(tempMd).delete();
    } catch (e) {
      // Ignore cleanup errors
    }
    
    return exitCode === 0;
  } catch (error) {
    console.error('Failed to convert text to Word document:', error);
    return false;
  }
};

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "list_word_documents",
        description: "List Word documents in a specified directory",
        inputSchema: {
          type: "object",
          properties: {
            directory: {
              type: "string",
              description: "Directory path to search for Word documents",
            },
            recursive: {
              type: "boolean",
              description: "Whether to search recursively in subdirectories",
              default: false,
            },
          },
          required: ["directory"],
        },
      },
      {
        name: "read_word_document",
        description: "Read the contents of a Word document and convert to editable text",
        inputSchema: {
          type: "object",
          properties: {
            filepath: {
              type: "string",
              description: "Full path to the Word document",
            },
          },
          required: ["filepath"],
        },
      },
      {
        name: "write_word_document",
        description: "Create or update a Word document with new content",
        inputSchema: {
          type: "object",
          properties: {
            filepath: {
              type: "string",
              description: "Full path where the Word document should be saved",
            },
            content: {
              type: "string",
              description: "Content to write to the document (supports Markdown formatting)",
            },
            backup: {
              type: "boolean",
              description: "Whether to create a backup of existing file",
              default: true,
            },
          },
          required: ["filepath", "content"],
        },
      },
      {
        name: "update_word_section",
        description: "Update a specific section of a Word document",
        inputSchema: {
          type: "object",
          properties: {
            filepath: {
              type: "string",
              description: "Full path to the Word document",
            },
            search_text: {
              type: "string",
              description: "Text to search for in the document",
            },
            replacement_text: {
              type: "string",
              description: "Text to replace the found section with",
            },
            backup: {
              type: "boolean",
              description: "Whether to create a backup of existing file",
              default: true,
            },
          },
          required: ["filepath", "search_text", "replacement_text"],
        },
      },
      {
        name: "get_word_document_info",
        description: "Get metadata and structure information about a Word document",
        inputSchema: {
          type: "object",
          properties: {
            filepath: {
              type: "string",
              description: "Full path to the Word document",
            },
          },
          required: ["filepath"],
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "list_word_documents": {
        const { directory, recursive = false } = args as { directory: string; recursive?: boolean };
        
        if (!existsSync(directory)) {
          throw new Error(`Directory does not exist: ${directory}`);
        }
        
        const findWordDocs = (dir: string, recurse: boolean = false): string[] => {
          const results: string[] = [];
          const items = readdirSync(dir);
          
          for (const item of items) {
            const fullPath = join(dir, item);
            const stat = statSync(fullPath);
            
            if (stat.isDirectory() && recurse) {
              results.push(...findWordDocs(fullPath, true));
            } else if (stat.isFile() && isWordDocument(fullPath)) {
              results.push(fullPath);
            }
          }
          
          return results;
        };
        
        const wordDocs = findWordDocs(directory, recursive);
        
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                directory,
                recursive,
                documents: wordDocs.map(doc => ({
                  path: doc,
                  name: basename(doc),
                  size: statSync(doc).size,
                  modified: statSync(doc).mtime.toISOString()
                }))
              }, null, 2)
            }
          ]
        };
      }

      case "read_word_document": {
        const { filepath } = args as { filepath: string };
        
        if (!existsSync(filepath)) {
          throw new Error(`File does not exist: ${filepath}`);
        }
        
        if (!isWordDocument(filepath)) {
          throw new Error(`File is not a Word document: ${filepath}`);
        }
        
        const content = await convertDocxToText(filepath);
        
        return {
          content: [
            {
              type: "text",
              text: `Document: ${basename(filepath)}\nPath: ${filepath}\n\nContent:\n${content}`
            }
          ]
        };
      }

      case "write_word_document": {
        const { filepath, content, backup = true } = args as { 
          filepath: string; 
          content: string; 
          backup?: boolean; 
        };
        
        // Create backup if file exists and backup is requested
        if (backup && existsSync(filepath)) {
          const backupPath = filepath.replace(/\.docx?$/, `.backup-${Date.now()}$&`);
          try {
            const originalContent = readFileSync(filepath);
            writeFileSync(backupPath, originalContent);
          } catch (error) {
            console.warn(`Failed to create backup: ${error}`);
          }
        }
        
        const success = await convertTextToDocx(content, filepath);
        
        if (!success) {
          throw new Error('Failed to create Word document. Ensure pandoc is installed.');
        }
        
        return {
          content: [
            {
              type: "text",
              text: `Successfully ${existsSync(filepath) ? 'updated' : 'created'} Word document: ${filepath}`
            }
          ]
        };
      }

      case "update_word_section": {
        const { filepath, search_text, replacement_text, backup = true } = args as {
          filepath: string;
          search_text: string;
          replacement_text: string;
          backup?: boolean;
        };
        
        if (!existsSync(filepath)) {
          throw new Error(`File does not exist: ${filepath}`);
        }
        
        // Read current content
        const currentContent = await convertDocxToText(filepath);
        
        // Check if search text exists
        if (!currentContent.includes(search_text)) {
          throw new Error(`Search text not found in document: "${search_text}"`);
        }
        
        // Replace content
        const updatedContent = currentContent.replace(new RegExp(search_text, 'g'), replacement_text);
        
        // Create backup if requested
        if (backup) {
          const backupPath = filepath.replace(/\.docx?$/, `.backup-${Date.now()}$&`);
          try {
            const originalFile = readFileSync(filepath);
            writeFileSync(backupPath, originalFile);
          } catch (error) {
            console.warn(`Failed to create backup: ${error}`);
          }
        }
        
        // Write updated content
        const success = await convertTextToDocx(updatedContent, filepath);
        
        if (!success) {
          throw new Error('Failed to update Word document');
        }
        
        return {
          content: [
            {
              type: "text",
              text: `Successfully updated Word document: ${filepath}\nReplaced: "${search_text}"\nWith: "${replacement_text}"`
            }
          ]
        };
      }

      case "get_word_document_info": {
        const { filepath } = args as { filepath: string };
        
        if (!existsSync(filepath)) {
          throw new Error(`File does not exist: ${filepath}`);
        }
        
        if (!isWordDocument(filepath)) {
          throw new Error(`File is not a Word document: ${filepath}`);
        }
        
        const stat = statSync(filepath);
        const content = await convertDocxToText(filepath);
        const wordCount = content.split(/\s+/).length;
        const charCount = content.length;
        
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                filename: basename(filepath),
                path: filepath,
                size: `${(stat.size / 1024).toFixed(2)} KB`,
                created: stat.birthtime.toISOString(),
                modified: stat.mtime.toISOString(),
                wordCount,
                characterCount: charCount,
                hasContent: wordCount > 0
              }, null, 2)
            }
          ]
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [
        {
          type: "text",
          text: `Error: ${errorMessage}`,
        },
      ],
      isError: true,
    };
  }
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Word Editor MCP server running on stdio");
}

main().catch((error) => {
  console.error("Server failed to start:", error);
  process.exit(1);
});