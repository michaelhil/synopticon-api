#!/usr/bin/env bun
/**
 * Add MCP Tools Helper
 * Helper script for developers to add new MCP tools when extending Synopticon
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

const log = {
  info: (msg) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}✅${colors.reset} ${msg}`),
  warn: (msg) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}❌${colors.reset} ${msg}`),
  title: (msg) => console.log(`\n${colors.bright}${colors.cyan}🛠  ${msg}${colors.reset}\n`),
  step: (num, msg) => console.log(`\n${colors.bright}${num}.${colors.reset} ${msg}`)
};

/**
 * Available tool categories
 */
const TOOL_CATEGORIES = {
  system: { name: 'System', file: 'system-tools.ts' },
  face: { name: 'Face Analysis', file: 'face-tools.ts' },
  emotion: { name: 'Emotion Analysis', file: 'emotion-tools.ts' },
  media: { name: 'Media Streaming', file: 'media-tools.ts' },
  eye_tracking: { name: 'Eye Tracking', file: 'eye-tools.ts' },
  speech: { name: 'Speech Analysis', file: 'speech-tools.ts' }
};

/**
 * Prompt user for input
 */
async function prompt(question, options = {}) {
  const { choices, validate, default: defaultValue } = options;
  
  if (choices) {
    console.log(`\n${question}`);
    choices.forEach((choice, i) => {
      console.log(`   [${i + 1}] ${choice.label}`);
    });
    console.log();
  }
  
  process.stdout.write(choices ? 'Choice: ' : `${question}${defaultValue ? ` (${defaultValue})` : ''}: `);
  
  return new Promise((resolve) => {
    process.stdin.once('data', (data) => {
      let input = data.toString().trim();
      
      if (!input && defaultValue) {
        input = defaultValue;
      }
      
      if (choices) {
        const choiceIndex = parseInt(input) - 1;
        if (choiceIndex >= 0 && choiceIndex < choices.length) {
          resolve(choices[choiceIndex].value);
        } else {
          console.log(`${colors.red}Invalid choice. Please try again.${colors.reset}`);
          resolve(prompt(question, options));
        }
      } else if (validate) {
        const validationResult = validate(input);
        if (validationResult === true) {
          resolve(input);
        } else {
          console.log(`${colors.red}${validationResult}${colors.reset}`);
          resolve(prompt(question, options));
        }
      } else {
        resolve(input);
      }
    });
  });
}

/**
 * Generate tool template
 */
function generateToolTemplate(toolInfo) {
  const { name, description, category, endpoint, method, parameters } = toolInfo;
  
  // Convert parameters to validation schema
  const validationSchema = {};
  const inputProperties = {};
  
  parameters.forEach(param => {
    validationSchema[param.name] = {
      type: param.type,
      required: param.required
    };
    
    if (param.min !== undefined) validationSchema[param.name].min = param.min;
    if (param.max !== undefined) validationSchema[param.name].max = param.max;
    if (param.enum) validationSchema[param.name].enum = param.enum;
    
    inputProperties[param.name] = {
      type: param.type,
      description: param.description
    };
    
    if (param.enum) inputProperties[param.name].enum = param.enum;
    if (param.min !== undefined) inputProperties[param.name].minimum = param.min;
    if (param.max !== undefined) inputProperties[param.name].maximum = param.max;
    if (param.default !== undefined) inputProperties[param.name].default = param.default;
  });
  
  const toolTemplate = `
/**
 * ${name} tool - ${description}
 */
export const ${name}Tool: MCPTool = toolFactory.createActionTool(
  '${name}',
  '${description}',
  ${JSON.stringify(validationSchema, null, 2)},
  ${JSON.stringify(inputProperties, null, 2)},
  async (client, params) => {
    const result = await client.request('${endpoint}', '${method}', params);
    
    return {
      action: '${name}_completed',
      result,
      message: '${description} completed successfully',
      timestamp: new Date().toISOString()
    };
  }
);`;

  return toolTemplate;
}

/**
 * Add tool to category file
 */
function addToolToFile(categoryKey, toolTemplate, toolName) {
  const filePath = join('src/services/mcp/tools', TOOL_CATEGORIES[categoryKey].file);
  
  if (!existsSync(filePath)) {
    log.error(`Tool file does not exist: ${filePath}`);
    return false;
  }
  
  let content = readFileSync(filePath, 'utf-8');
  
  // Find the export section
  const exportMatch = content.match(/export const \w+Tools: MCPTool\[\] = \[([\s\S]*?)\];/);
  if (!exportMatch) {
    log.error('Could not find tool export array in file');
    return false;
  }
  
  // Add the new tool template before the export
  const insertPosition = exportMatch.index;
  const newContent = 
    content.slice(0, insertPosition) + 
    toolTemplate + 
    '\n\n' + 
    content.slice(insertPosition).replace(
      exportMatch[0],
      exportMatch[0].replace('];', `,\n  ${toolName}Tool\n];`)
    );
  
  writeFileSync(filePath, newContent);
  return true;
}

/**
 * Update tool registry
 */
function updateToolRegistry(categoryKey, toolName) {
  const registryPath = 'src/services/mcp/config/tool-registry.ts';
  
  if (!existsSync(registryPath)) {
    log.error('Tool registry file does not exist');
    return false;
  }
  
  let content = readFileSync(registryPath, 'utf-8');
  
  // Find the category in TOOL_CATEGORIES
  const categoryPattern = new RegExp(`(${categoryKey}:\\s*\\{[^}]*tools:\\s*\\[)([^\\]]*)\\]`, 's');
  const match = content.match(categoryPattern);
  
  if (!match) {
    log.error(`Could not find ${categoryKey} category in tool registry`);
    return false;
  }
  
  // Add the new tool to the tools array
  const toolsArray = match[2];
  const newToolsArray = toolsArray.trim() 
    ? `${toolsArray.trim()},\n      'synopticon_${toolName}'`
    : `\n      'synopticon_${toolName}'\n    `;
  
  const newContent = content.replace(categoryPattern, `$1${newToolsArray}]`);
  
  writeFileSync(registryPath, newContent);
  return true;
}

/**
 * Main function
 */
async function main() {
  try {
    log.title('Add New MCP Tool');
    
    log.step(1, 'Tool Information');
    
    // Get tool details
    const name = await prompt('Tool name (snake_case)', {
      validate: (input) => {
        if (!input) return 'Tool name is required';
        if (!/^[a-z][a-z0-9_]*$/.test(input)) return 'Tool name must be snake_case (lowercase letters, numbers, underscores)';
        return true;
      }
    });
    
    const description = await prompt('Tool description', {
      validate: (input) => input ? true : 'Description is required'
    });
    
    const endpoint = await prompt('API endpoint (e.g., /api/analysis/new-feature/start)', {
      validate: (input) => {
        if (!input) return 'API endpoint is required';
        if (!input.startsWith('/')) return 'Endpoint must start with /';
        return true;
      }
    });
    
    const method = await prompt('HTTP method', {
      choices: [
        { label: 'GET', value: 'GET' },
        { label: 'POST', value: 'POST' },
        { label: 'PUT', value: 'PUT' },
        { label: 'DELETE', value: 'DELETE' }
      ]
    });
    
    log.step(2, 'Tool Category');
    
    const categoryChoices = Object.entries(TOOL_CATEGORIES).map(([key, info]) => ({
      label: info.name,
      value: key
    }));
    
    const category = await prompt('Select tool category', { choices: categoryChoices });
    
    log.step(3, 'Parameters');
    
    const parameters = [];
    let addingParams = true;
    
    while (addingParams) {
      const hasParams = await prompt('Add a parameter? (y/n)', { default: 'n' });
      
      if (hasParams.toLowerCase() !== 'y') {
        addingParams = false;
        continue;
      }
      
      const paramName = await prompt('Parameter name', {
        validate: (input) => input ? true : 'Parameter name is required'
      });
      
      const paramType = await prompt('Parameter type', {
        choices: [
          { label: 'String', value: 'string' },
          { label: 'Number', value: 'number' },
          { label: 'Boolean', value: 'boolean' },
          { label: 'Array', value: 'array' },
          { label: 'Object', value: 'object' }
        ]
      });
      
      const paramDesc = await prompt('Parameter description', {
        validate: (input) => input ? true : 'Parameter description is required'
      });
      
      const paramRequired = await prompt('Is parameter required? (y/n)', { default: 'n' });
      
      const param = {
        name: paramName,
        type: paramType,
        description: paramDesc,
        required: paramRequired.toLowerCase() === 'y'
      };
      
      // Additional validation based on type
      if (paramType === 'string') {
        const hasEnum = await prompt('Does parameter have predefined values? (y/n)', { default: 'n' });
        if (hasEnum.toLowerCase() === 'y') {
          const enumValues = await prompt('Enter values (comma-separated)');
          param.enum = enumValues.split(',').map(v => v.trim());
        }
      }
      
      if (paramType === 'number') {
        const minValue = await prompt('Minimum value (optional)');
        const maxValue = await prompt('Maximum value (optional)');
        if (minValue) param.min = parseFloat(minValue);
        if (maxValue) param.max = parseFloat(maxValue);
      }
      
      const defaultValue = await prompt('Default value (optional)');
      if (defaultValue) {
        if (paramType === 'number') param.default = parseFloat(defaultValue);
        else if (paramType === 'boolean') param.default = defaultValue.toLowerCase() === 'true';
        else param.default = defaultValue;
      }
      
      parameters.push(param);
      log.success(`Added parameter: ${paramName}`);
    }
    
    log.step(4, 'Generating tool code...');
    
    const toolInfo = { name, description, category, endpoint, method, parameters };
    const toolTemplate = generateToolTemplate(toolInfo);
    
    log.step(5, 'Adding tool to files...');
    
    // Add to category file
    const success1 = addToolToFile(category, toolTemplate, name);
    if (!success1) {
      throw new Error('Failed to add tool to category file');
    }
    log.success(`Added tool to ${TOOL_CATEGORIES[category].file}`);
    
    // Update tool registry
    const success2 = updateToolRegistry(category, name);
    if (!success2) {
      throw new Error('Failed to update tool registry');
    }
    log.success('Updated tool registry');
    
    log.step(6, 'Next steps');
    
    console.log(`\n${colors.bright}${colors.green}✅ Tool added successfully!${colors.reset}\n`);
    console.log(`${colors.bright}Next steps:${colors.reset}`);
    console.log(`1. Implement the API endpoint: ${endpoint}`);
    console.log(`2. Test the tool: bun test src/services/mcp/tools/${TOOL_CATEGORIES[category].file}`);
    console.log(`3. Update documentation if needed`);
    console.log(`4. The tool will be available as: synopticon_${name}`);
    console.log();
    
  } catch (error) {
    log.error(`Failed to add tool: ${error.message}`);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\nOperation cancelled by user');
  process.exit(0);
});

main();