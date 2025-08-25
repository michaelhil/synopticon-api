#!/usr/bin/env bun

/**
 * COMPREHENSIVE TEST SUITE RUNNER
 * Runs all tests systematically and identifies issues
 */

import { spawnSync } from 'child_process';
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join, resolve } from 'path';

const projectRoot = resolve(process.cwd());
const testResults = {
  testFiles: [],
  totalTests: 0,
  passedTests: 0,
  failedTests: 0,
  errors: [],
  skippedFiles: [],
  runtimeErrors: []
};

console.log('🧪 COMPREHENSIVE TEST SUITE RUNNER');
console.log('📁 Project root:', projectRoot);
console.log('');

// Test categories to run
const TEST_CATEGORIES = [
  {
    name: 'Unit Tests',
    path: 'tests/unit',
    pattern: /\.test\.(js|ts)$/,
    runner: 'bun test'
  },
  {
    name: 'Integration Tests', 
    path: 'tests/integration',
    pattern: /\.test\.(js|ts)$/,
    runner: 'bun test'
  },
  {
    name: 'End-to-End Tests',
    path: 'tests/e2e',
    pattern: /\.test\.(js|ts)$/,
    runner: 'bun test'
  },
  {
    name: 'Performance Tests',
    path: 'tests/performance',
    pattern: /\.test\.(js|ts)$/,
    runner: 'bun test'
  },
  {
    name: 'Standalone Test Scripts',
    path: 'tests',
    pattern: /\.js$/, 
    runner: 'bun',
    exclude: /\.test\.(js|ts)$/
  }
];

// Package.json script validation
function validatePackageJsonScripts() {
  console.log('📦 Validating package.json scripts...\n');
  
  try {
    const packageJson = JSON.parse(readFileSync(join(projectRoot, 'package.json'), 'utf8'));
    const scripts = packageJson.scripts || {};
    const scriptResults = {
      total: Object.keys(scripts).length,
      working: 0,
      broken: 0,
      issues: []
    };
    
    for (const [scriptName, scriptCommand] of Object.entries(scripts)) {
      // Check if script references files that exist
      const fileReferences = scriptCommand.match(/\b[\w\-\.\/]+\.js\b/g) || [];
      
      for (const fileRef of fileReferences) {
        const fullPath = resolve(projectRoot, fileRef);
        if (!existsSync(fullPath)) {
          scriptResults.broken++;
          scriptResults.issues.push({
            script: scriptName,
            command: scriptCommand,
            issue: `Referenced file not found: ${fileRef}`,
            severity: 'high'
          });
        } else {
          scriptResults.working++;
        }
      }
    }
    
    console.log(`✅ Package.json scripts validation:`);
    console.log(`   Total scripts: ${scriptResults.total}`);
    console.log(`   File references working: ${scriptResults.working}`);
    console.log(`   File references broken: ${scriptResults.broken}`);
    
    if (scriptResults.issues.length > 0) {
      console.log(`\n❌ Script issues found:`);
      for (const issue of scriptResults.issues) {
        console.log(`   ${issue.script}: ${issue.issue}`);
      }
    }
    
    testResults.packageJsonScripts = scriptResults;
    console.log('');
    
  } catch (error) {
    console.error('❌ Error validating package.json:', error.message);
    testResults.errors.push({ type: 'packageJson', error: error.message });
  }
}

// Find and run tests in a directory
function findAndRunTests(category) {
  console.log(`🔍 Running ${category.name}...\n`);
  
  const testDir = join(projectRoot, category.path);
  if (!existsSync(testDir)) {
    console.log(`⚠️ Test directory not found: ${category.path}\n`);
    return;
  }
  
  const testFiles = [];
  
  function scanDirectory(dir) {
    const items = readdirSync(dir);
    
    for (const item of items) {
      const fullPath = join(dir, item);
      const stat = statSync(fullPath);
      
      if (stat.isDirectory()) {
        scanDirectory(fullPath);
      } else if (stat.isFile()) {
        const relativePath = fullPath.replace(projectRoot + '/', '');
        
        if (category.pattern.test(item)) {
          if (!category.exclude || !category.exclude.test(item)) {
            testFiles.push({ name: relativePath, path: fullPath });
          }
        }
      }
    }
  }
  
  scanDirectory(testDir);
  
  if (testFiles.length === 0) {
    console.log(`ℹ️ No ${category.name.toLowerCase()} found\n`);
    return;
  }
  
  console.log(`📋 Found ${testFiles.length} ${category.name.toLowerCase()}:`);
  testFiles.forEach(f => console.log(`   ${f.name}`));
  console.log('');
  
  // Run each test file
  for (const testFile of testFiles) {
    try {
      console.log(`▶️ Running ${testFile.name}...`);
      
      const [command, ...args] = category.runner.split(' ');
      const result = spawnSync(command, [...args, testFile.path], {
        cwd: projectRoot,
        encoding: 'utf8',
        timeout: 30000
      });
      
      const testResult = {
        file: testFile.name,
        category: category.name,
        command: `${category.runner} ${testFile.path}`,
        success: result.status === 0,
        stdout: result.stdout,
        stderr: result.stderr,
        duration: 'unknown'
      };
      
      if (result.status === 0) {
        console.log(`✅ ${testFile.name} - PASSED`);
        testResults.passedTests++;
      } else {
        console.log(`❌ ${testFile.name} - FAILED`);
        console.log(`   Exit code: ${result.status}`);
        if (result.stderr) {
          const errorLines = result.stderr.split('\n').slice(0, 3);
          console.log(`   Error: ${errorLines.join(' ')}`);
        }
        testResults.failedTests++;
        testResult.error = result.stderr;
      }
      
      testResults.testFiles.push(testResult);
      testResults.totalTests++;
      
    } catch (error) {
      console.log(`💥 ${testFile.name} - RUNTIME ERROR: ${error.message}`);
      testResults.runtimeErrors.push({
        file: testFile.name,
        error: error.message
      });
      testResults.failedTests++;
    }
  }
  
  console.log('');
}

// HTML file validation
function validateHTMLFiles() {
  console.log('🌐 Validating HTML files...\n');
  
  const htmlFiles = [];
  
  function findHTMLFiles(dir) {
    const items = readdirSync(dir);
    
    for (const item of items) {
      const fullPath = join(dir, item);
      const stat = statSync(fullPath);
      
      if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
        findHTMLFiles(fullPath);
      } else if (item.endsWith('.html')) {
        htmlFiles.push(fullPath);
      }
    }
  }
  
  findHTMLFiles(projectRoot);
  
  const htmlResults = {
    total: htmlFiles.length,
    valid: 0,
    issues: []
  };
  
  for (const htmlFile of htmlFiles) {
    try {
      const content = readFileSync(htmlFile, 'utf8');
      const relativePath = htmlFile.replace(projectRoot + '/', '');
      
      // Check script src attributes
      const scriptMatches = [...content.matchAll(/<script[^>]+src="([^"]+)"[^>]*>/g)];
      
      for (const match of scriptMatches) {
        const srcPath = match[1];
        
        // Skip external URLs
        if (srcPath.startsWith('http://') || srcPath.startsWith('https://') || srcPath.startsWith('//')) {
          continue;
        }
        
        // Check local file references
        const fullSrcPath = resolve(htmlFile.replace(/[^\/]+$/, ''), srcPath);
        if (!existsSync(fullSrcPath)) {
          htmlResults.issues.push({
            file: relativePath,
            issue: `Script not found: ${srcPath}`,
            severity: 'high'
          });
        }
      }
      
      if (htmlResults.issues.filter(i => i.file === relativePath).length === 0) {
        htmlResults.valid++;
      }
      
    } catch (error) {
      htmlResults.issues.push({
        file: htmlFile.replace(projectRoot + '/', ''),
        issue: `Read error: ${error.message}`,
        severity: 'medium'
      });
    }
  }
  
  console.log(`✅ HTML file validation:`);
  console.log(`   Total HTML files: ${htmlResults.total}`);
  console.log(`   Valid files: ${htmlResults.valid}`);
  console.log(`   Files with issues: ${htmlResults.total - htmlResults.valid}`);
  
  if (htmlResults.issues.length > 0) {
    console.log(`\n❌ HTML issues found:`);
    for (const issue of htmlResults.issues) {
      console.log(`   ${issue.file}: ${issue.issue}`);
    }
  }
  
  testResults.htmlValidation = htmlResults;
  console.log('');
}

// Dynamic import audit
function auditDynamicImports() {
  console.log('🔄 Auditing dynamic imports...\n');
  
  const dynamicImports = [];
  
  function scanForDynamicImports(dir) {
    const items = readdirSync(dir);
    
    for (const item of items) {
      const fullPath = join(dir, item);
      const stat = statSync(fullPath);
      
      if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
        scanForDynamicImports(fullPath);
      } else if (/\.(js|ts)$/.test(item)) {
        try {
          const content = readFileSync(fullPath, 'utf8');
          const relativePath = fullPath.replace(projectRoot + '/', '');
          
          // Find dynamic imports
          const dynamicImportMatches = [...content.matchAll(/import\(['"`]([^'"`]+)['"`]\)/g)];
          
          for (const match of dynamicImportMatches) {
            const importPath = match[1];
            dynamicImports.push({
              file: relativePath,
              importPath,
              line: content.substring(0, match.index).split('\n').length
            });
          }
          
        } catch (error) {
          // Skip files we can't read
        }
      }
    }
  }
  
  scanForDynamicImports(join(projectRoot, 'src'));
  
  console.log(`📋 Found ${dynamicImports.length} dynamic imports:`);
  for (const imp of dynamicImports) {
    console.log(`   ${imp.file}:${imp.line} → ${imp.importPath}`);
  }
  
  testResults.dynamicImports = dynamicImports;
  console.log('');
}

// Configuration file validation
function validateConfigFiles() {
  console.log('⚙️ Validating configuration files...\n');
  
  const configFiles = [
    'package.json',
    'tsconfig.json',
    'vite.config.js',
    'bun.lockb'
  ];
  
  const configResults = {
    total: configFiles.length,
    valid: 0,
    issues: []
  };
  
  for (const configFile of configFiles) {
    const fullPath = join(projectRoot, configFile);
    
    if (existsSync(fullPath)) {
      try {
        if (configFile.endsWith('.json')) {
          JSON.parse(readFileSync(fullPath, 'utf8'));
        }
        configResults.valid++;
        console.log(`✅ ${configFile} - Valid`);
      } catch (error) {
        configResults.issues.push({
          file: configFile,
          issue: error.message,
          severity: 'high'
        });
        console.log(`❌ ${configFile} - Invalid: ${error.message}`);
      }
    } else {
      console.log(`⚠️ ${configFile} - Not found`);
    }
  }
  
  testResults.configValidation = configResults;
  console.log('');
}

// Generate final report
function generateReport() {
  console.log('📊 COMPREHENSIVE TEST RESULTS');
  console.log('═'.repeat(50));
  console.log(`Total test files: ${testResults.totalTests}`);
  console.log(`Passed: ${testResults.passedTests} (${Math.round(testResults.passedTests/testResults.totalTests*100)}%)`);
  console.log(`Failed: ${testResults.failedTests} (${Math.round(testResults.failedTests/testResults.totalTests*100)}%)`);
  console.log(`Runtime errors: ${testResults.runtimeErrors.length}`);
  console.log('');
  
  if (testResults.failedTests > 0) {
    console.log('❌ FAILED TESTS:');
    for (const test of testResults.testFiles) {
      if (!test.success) {
        console.log(`   ${test.file} (${test.category})`);
        if (test.error) {
          const errorLine = test.error.split('\n')[0];
          console.log(`     ${errorLine}`);
        }
      }
    }
    console.log('');
  }
  
  if (testResults.runtimeErrors.length > 0) {
    console.log('💥 RUNTIME ERRORS:');
    for (const error of testResults.runtimeErrors) {
      console.log(`   ${error.file}: ${error.error}`);
    }
    console.log('');
  }
  
  // Summary recommendations
  console.log('🔧 RECOMMENDATIONS:');
  if (testResults.failedTests > 0) {
    console.log('   • Fix failing tests to ensure system stability');
  }
  if (testResults.packageJsonScripts && testResults.packageJsonScripts.broken > 0) {
    console.log('   • Update package.json scripts with correct file paths');
  }
  if (testResults.htmlValidation && testResults.htmlValidation.issues.length > 0) {
    console.log('   • Fix HTML file script references');
  }
  if (testResults.configValidation && testResults.configValidation.issues.length > 0) {
    console.log('   • Validate and fix configuration files');
  }
  
  console.log('');
  
  // Write detailed report
  const detailedReport = {
    timestamp: new Date().toISOString(),
    summary: {
      totalTests: testResults.totalTests,
      passedTests: testResults.passedTests,
      failedTests: testResults.failedTests,
      successRate: Math.round(testResults.passedTests/testResults.totalTests*100)
    },
    ...testResults
  };
  
  writeFileSync(
    join(projectRoot, 'test-results.json'),
    JSON.stringify(detailedReport, null, 2)
  );
  
  console.log('📄 Detailed report saved to test-results.json');
}

// Main execution
async function main() {
  console.log('Starting comprehensive test suite...\n');
  
  // Run all validation steps
  validatePackageJsonScripts();
  validateConfigFiles(); 
  validateHTMLFiles();
  auditDynamicImports();
  
  // Run test categories
  for (const category of TEST_CATEGORIES) {
    findAndRunTests(category);
  }
  
  // Generate final report
  generateReport();
}

main().catch(console.error);