#!/usr/bin/env bun
/**
 * Synopticon MCP Setup Wizard
 * Interactive setup tool for configuring MCP connections with LLM clients
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

const log = {
  info: (msg) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}✅${colors.reset} ${msg}`),
  warn: (msg) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}❌${colors.reset} ${msg}`),
  title: (msg) => console.log(`\n${colors.bright}${colors.cyan}🔗 ${msg}${colors.reset}\n`),
  step: (num, msg) => console.log(`\n${colors.bright}${num}.${colors.reset} ${msg}`)
};

// Configuration templates
const CLIENT_CONFIGS = {
  'claude-desktop': {
    name: 'Claude Desktop',
    configPath: join(homedir(), '.config', 'claude', 'claude_desktop_config.json'),
    templates: {
      local: 'configs/mcp-clients/claude-desktop-local.json',
      remote: 'configs/mcp-clients/claude-desktop-remote.json',
      docker: 'configs/mcp-clients/claude-desktop-docker.json'
    }
  },
  'cursor': {
    name: 'Cursor',
    configPath: join(homedir(), '.cursor', 'mcp_config.json'),
    templates: {
      local: 'configs/mcp-clients/cursor-local.json'
    }
  },
  'continue': {
    name: 'Continue',
    configPath: join(homedir(), '.continue', 'config.json'),
    templates: {
      local: 'configs/mcp-clients/continue-local.json'
    }
  }
};

/**
 * Prompt user for input with validation
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
 * Test connection to Synopticon API
 */
async function testSynopticonConnection(apiUrl) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(`${apiUrl}/api/health`, {
      signal: controller.signal,
      headers: { 'Accept': 'application/json' }
    });
    
    clearTimeout(timeoutId);
    
    if (response.ok) {
      const data = await response.json();
      return { success: true, data };
    } else {
      return { success: false, error: `HTTP ${response.status}: ${response.statusText}` };
    }
  } catch (error) {
    if (error.name === 'AbortError') {
      return { success: false, error: 'Connection timeout (5 seconds)' };
    }
    return { success: false, error: error.message };
  }
}

/**
 * Detect deployment scenario
 */
async function detectDeployment() {
  log.step(1, 'Detecting Synopticon deployment...');
  
  // Try common localhost addresses
  const localAddresses = [
    'http://localhost:3000',
    'http://127.0.0.1:3000'
  ];
  
  for (const url of localAddresses) {
    log.info(`Testing ${url}...`);
    const result = await testSynopticonConnection(url);
    
    if (result.success) {
      log.success(`Found Synopticon API at ${url}`);
      return { type: 'local', apiUrl: url, capabilities: result.data };
    }
  }
  
  log.warn('Synopticon API not found on localhost');
  return { type: 'manual', apiUrl: null, capabilities: null };
}

/**
 * Get API URL from user
 */
async function getApiUrl(deployment) {
  if (deployment.type === 'local') {
    return deployment.apiUrl;
  }
  
  log.step(2, 'Synopticon API Configuration');
  
  const deploymentType = await prompt('Where is Synopticon running?', {
    choices: [
      { label: 'Another computer on network', value: 'remote' },
      { label: 'Docker container', value: 'docker' },
      { label: 'Custom URL', value: 'custom' }
    ]
  });
  
  let apiUrl;
  
  switch (deploymentType) {
    case 'remote':
      const remoteHost = await prompt('Enter the IP address or hostname of the remote computer', {
        validate: (input) => {
          if (!input) return 'IP address or hostname is required';
          return true;
        }
      });
      apiUrl = `http://${remoteHost}:3000`;
      break;
      
    case 'docker':
      apiUrl = 'http://localhost:3000';
      log.info('Using localhost:3000 for Docker container');
      break;
      
    case 'custom':
      apiUrl = await prompt('Enter the full Synopticon API URL', {
        validate: (input) => {
          try {
            new URL(input);
            return true;
          } catch {
            return 'Please enter a valid URL (e.g., http://example.com:3000)';
          }
        }
      });
      break;
  }
  
  log.info(`Testing connection to ${apiUrl}...`);
  const result = await testSynopticonConnection(apiUrl);
  
  if (result.success) {
    log.success('Connection successful!');
    return apiUrl;
  } else {
    log.error(`Connection failed: ${result.error}`);
    
    const retry = await prompt('Would you like to try a different URL? (y/n)', { default: 'y' });
    if (retry.toLowerCase() === 'y') {
      return getApiUrl({ type: 'manual' });
    } else {
      throw new Error('Cannot proceed without valid Synopticon API connection');
    }
  }
}

/**
 * Select LLM client
 */
async function selectClient() {
  log.step(3, 'LLM Client Selection');
  
  const clientChoices = Object.entries(CLIENT_CONFIGS).map(([key, config]) => ({
    label: config.name,
    value: key
  }));
  
  return await prompt('Which LLM client are you using?', { choices: clientChoices });
}

/**
 * Generate configuration
 */
function generateConfig(templatePath, apiUrl, deployment) {
  const template = JSON.parse(readFileSync(templatePath, 'utf-8'));
  
  // Replace placeholder API URL
  const configStr = JSON.stringify(template, null, 2)
    .replace('REMOTE_HOST_IP', new URL(apiUrl).hostname)
    .replace('http://localhost:3000', apiUrl);
    
  return JSON.parse(configStr);
}

/**
 * Install configuration
 */
function installConfig(clientKey, config, apiUrl, deployment) {
  const clientInfo = CLIENT_CONFIGS[clientKey];
  const configPath = clientInfo.configPath;
  const configDir = dirname(configPath);
  
  // Create config directory if it doesn't exist
  if (!existsSync(configDir)) {
    mkdirSync(configDir, { recursive: true });
    log.info(`Created directory: ${configDir}`);
  }
  
  // Handle existing configuration
  let finalConfig = config;
  
  if (existsSync(configPath)) {
    try {
      const existingConfig = JSON.parse(readFileSync(configPath, 'utf-8'));
      
      // Merge configurations
      if (clientKey === 'claude-desktop' && existingConfig.mcpServers) {
        finalConfig.mcpServers = { ...existingConfig.mcpServers, ...config.mcpServers };
      } else {
        // For other clients, we might need different merge logic
        finalConfig = { ...existingConfig, ...config };
      }
      
      log.info('Merged with existing configuration');
    } catch (error) {
      log.warn('Could not parse existing config, creating backup');
      writeFileSync(`${configPath}.backup`, readFileSync(configPath));
    }
  }
  
  // Write configuration
  writeFileSync(configPath, JSON.stringify(finalConfig, null, 2));
  log.success(`Configuration saved to: ${configPath}`);
}

/**
 * Display next steps
 */
function displayNextSteps(clientKey, apiUrl) {
  const clientInfo = CLIENT_CONFIGS[clientKey];
  
  console.log(`\n${colors.bright}${colors.green}🎉 Setup Complete!${colors.reset}\n`);
  console.log(`${colors.bright}Next Steps:${colors.reset}`);
  console.log(`1. Restart ${clientInfo.name}`);
  console.log(`2. Look for "Synopticon" in available tools/connectors`);
  console.log(`3. Try these example commands:`);
  console.log(`   • "Check Synopticon system health"`);
  console.log(`   • "Start face analysis on my webcam"`);
  console.log(`   • "Show me available Synopticon capabilities"`);
  console.log(`   • "List available cameras and microphones"`);
  console.log();
  console.log(`${colors.bright}Troubleshooting:${colors.reset}`);
  console.log(`• If tools don't appear, check that Synopticon is running at ${apiUrl}`);
  console.log(`• Enable debug logging by setting MCP_DEBUG=true in the configuration`);
  console.log(`• Check the setup guide: docs/MCP_SETUP_GUIDE.md`);
  console.log();
}

/**
 * Main setup wizard
 */
async function main() {
  try {
    log.title('Synopticon MCP Setup Wizard');
    
    // Enable raw mode for better input handling
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(false);
    }
    
    // Detect deployment
    const deployment = await detectDeployment();
    
    // Get API URL
    const apiUrl = await getApiUrl(deployment);
    
    // Test final connection and get capabilities
    log.step(4, 'Verifying connection and capabilities...');
    const connectionResult = await testSynopticonConnection(apiUrl);
    
    if (!connectionResult.success) {
      throw new Error(`Final connection test failed: ${connectionResult.error}`);
    }
    
    const capabilities = connectionResult.data;
    log.success('Connected to Synopticon API successfully');
    log.info(`Synopticon version: ${capabilities.version || 'unknown'}`);
    log.info('Available capabilities:');
    if (capabilities.face_detection) log.info('  • Face Detection');
    if (capabilities.emotion_analysis) log.info('  • Emotion Analysis');
    if (capabilities.media_streaming) log.info('  • Media Streaming');
    if (capabilities.eye_tracking) log.info('  • Eye Tracking');
    if (capabilities.speech_analysis) log.info('  • Speech Analysis');
    
    // Select client
    const clientKey = await selectClient();
    const clientInfo = CLIENT_CONFIGS[clientKey];
    
    // Determine template
    let templateKey = 'local';
    if (deployment.type === 'remote') templateKey = 'remote';
    else if (deployment.type === 'docker') templateKey = 'docker';
    
    const templatePath = clientInfo.templates[templateKey];
    if (!templatePath) {
      throw new Error(`No template available for ${clientInfo.name} with ${deployment.type} deployment`);
    }
    
    log.step(5, 'Generating configuration...');
    
    // Generate and install config
    const config = generateConfig(templatePath, apiUrl, deployment);
    installConfig(clientKey, config, apiUrl, deployment);
    
    // Show next steps
    displayNextSteps(clientKey, apiUrl);
    
  } catch (error) {
    log.error(`Setup failed: ${error.message}`);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\nSetup cancelled by user');
  process.exit(0);
});

// Run the setup wizard
main();