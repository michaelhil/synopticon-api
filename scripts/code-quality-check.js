#!/usr/bin/env bun
/**
 * Comprehensive Code Quality Check Script
 * Runs all quality checks and provides detailed reporting
 */

import { spawn } from 'bun';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const QUALITY_REPORT_PATH = './quality-report.json';
const MAX_WARNINGS = 10;
const MAX_ERRORS = 0;

// Quality check configuration
const checks = [
  {
    name: 'ESLint Strict',
    command: 'bunx eslint src/**/*.js examples/**/*.js --format json --max-warnings 0',
    critical: true,
    weight: 0.4
  },
  {
    name: 'TypeScript Check',
    command: 'bun x tsc --noEmit',
    critical: true,
    weight: 0.3
  },
  {
    name: 'Knip Dead Code',
    command: 'bunx knip --reporter json',
    critical: false,
    weight: 0.2
  },
  {
    name: 'Test Suite',
    command: 'bun test --reporter json',
    critical: true,
    weight: 0.1
  }
];

// Results tracking
const results = {
  timestamp: new Date().toISOString(),
  version: getPackageVersion(),
  overall: { passed: false, score: 0 },
  checks: [],
  metrics: {
    totalFiles: 0,
    lintErrors: 0,
    lintWarnings: 0,
    typeErrors: 0,
    unusedFiles: 0,
    testsPassed: 0,
    testsFailed: 0
  },
  recommendations: []
};

async function runQualityCheck() {
  console.log('🔍 Starting comprehensive code quality check...\n');
  
  // Run each check
  for (const check of checks) {
    console.log(`🔄 Running ${check.name}...`);
    
    const checkResult = await runCheck(check);
    results.checks.push(checkResult);
    
    if (checkResult.passed) {
      console.log(`✅ ${check.name}: PASSED`);
    } else {
      console.log(`❌ ${check.name}: FAILED`);
      if (check.critical) {
        console.log(`   Critical check failed: ${checkResult.summary}`);
      }
    }
    console.log();
  }
  
  // Calculate overall score
  calculateOverallScore();
  
  // Generate recommendations
  generateRecommendations();
  
  // Save report
  writeFileSync(QUALITY_REPORT_PATH, JSON.stringify(results, null, 2));
  
  // Display summary
  displaySummary();
  
  // Exit with appropriate code
  process.exit(results.overall.passed ? 0 : 1);
}

async function runCheck(check) {
  const startTime = Date.now();
  
  try {
    const proc = spawn(check.command.split(' '), {
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    await proc.exited;
    
    const stdout = await new Response(proc.stdout).text();
    const stderr = await new Response(proc.stderr).text();
    
    return {
      name: check.name,
      passed: proc.exitCode === 0,
      exitCode: proc.exitCode,
      duration: Date.now() - startTime,
      output: stdout,
      errors: stderr,
      summary: parseCheckOutput(check, stdout, stderr, proc.exitCode),
      weight: check.weight,
      critical: check.critical
    };
    
  } catch (error) {
    return {
      name: check.name,
      passed: false,
      exitCode: -1,
      duration: Date.now() - startTime,
      output: '',
      errors: error.message,
      summary: `Failed to run: ${error.message}`,
      weight: check.weight,
      critical: check.critical
    };
  }
}

function parseCheckOutput(check, stdout, stderr, exitCode) {
  switch (check.name) {
    case 'ESLint Strict':
      return parseESLintOutput(stdout);
    case 'TypeScript Check':
      return parseTypeScriptOutput(stderr);
    case 'Knip Dead Code':
      return parseKnipOutput(stdout);
    case 'Test Suite':
      return parseTestOutput(stdout);
    default:
      return exitCode === 0 ? 'Passed' : 'Failed';
  }
}

function parseESLintOutput(output) {
  try {
    const data = JSON.parse(output);
    const errors = data.reduce((sum, file) => sum + file.errorCount, 0);
    const warnings = data.reduce((sum, file) => sum + file.warningCount, 0);
    
    results.metrics.lintErrors = errors;
    results.metrics.lintWarnings = warnings;
    
    return `${errors} errors, ${warnings} warnings`;
  } catch {
    return 'Output parsing failed';
  }
}

function parseTypeScriptOutput(output) {
  const errorMatches = output.match(/error TS\d+/g);
  const errorCount = errorMatches ? errorMatches.length : 0;
  
  results.metrics.typeErrors = errorCount;
  
  return errorCount === 0 ? 'No type errors' : `${errorCount} type errors`;
}

function parseKnipOutput(output) {
  try {
    const data = JSON.parse(output);
    const unusedFiles = data.files ? data.files.length : 0;
    
    results.metrics.unusedFiles = unusedFiles;
    
    return `${unusedFiles} unused files detected`;
  } catch {
    // Parse text output
    const lines = output.split('\\n');
    const unusedLine = lines.find(line => line.includes('Unused files'));
    const match = unusedLine?.match(/\\((\\d+)\\)/);
    const unusedFiles = match ? parseInt(match[1]) : 0;
    
    results.metrics.unusedFiles = unusedFiles;
    
    return `${unusedFiles} unused files detected`;
  }
}

function parseTestOutput(output) {
  try {
    const data = JSON.parse(output);
    const passed = data.pass || 0;
    const failed = data.fail || 0;
    
    results.metrics.testsPassed = passed;
    results.metrics.testsFailed = failed;
    
    return `${passed} passed, ${failed} failed`;
  } catch {
    return 'Test output parsing failed';
  }
}

function calculateOverallScore() {
  let totalScore = 0;
  let totalWeight = 0;
  
  for (const check of results.checks) {
    const checkScore = check.passed ? 100 : 0;
    totalScore += checkScore * check.weight;
    totalWeight += check.weight;
    
    // Critical checks must pass
    if (check.critical && !check.passed) {
      results.overall.passed = false;
      results.overall.score = 0;
      return;
    }
  }
  
  results.overall.score = Math.round(totalScore / totalWeight);
  results.overall.passed = results.overall.score >= 85; // Minimum 85% score
}

function generateRecommendations() {
  if (results.metrics.lintErrors > 0) {
    results.recommendations.push({
      type: 'error',
      message: `Fix ${results.metrics.lintErrors} ESLint errors`,
      command: 'bun run lint:fix'
    });
  }
  
  if (results.metrics.lintWarnings > MAX_WARNINGS) {
    results.recommendations.push({
      type: 'warning',
      message: `Address ${results.metrics.lintWarnings} ESLint warnings`,
      command: 'bun run lint:fix'
    });
  }
  
  if (results.metrics.typeErrors > 0) {
    results.recommendations.push({
      type: 'error',
      message: `Fix ${results.metrics.typeErrors} TypeScript errors`,
      command: 'bun run typecheck'
    });
  }
  
  if (results.metrics.unusedFiles > 50) {
    results.recommendations.push({
      type: 'info',
      message: `Consider removing ${results.metrics.unusedFiles} unused files`,
      command: 'bun run knip:check'
    });
  }
  
  if (results.metrics.testsFailed > 0) {
    results.recommendations.push({
      type: 'error',
      message: `Fix ${results.metrics.testsFailed} failing tests`,
      command: 'bun test'
    });
  }
}

function displaySummary() {
  console.log('\\n' + '='.repeat(60));
  console.log('📊 CODE QUALITY REPORT');
  console.log('='.repeat(60));
  
  console.log(`\\n🎯 Overall Score: ${results.overall.score}%`);
  console.log(`✅ Status: ${results.overall.passed ? 'PASSED' : 'FAILED'}`);
  
  console.log('\\n📈 Metrics:');
  console.log(`   ESLint Errors: ${results.metrics.lintErrors}`);
  console.log(`   ESLint Warnings: ${results.metrics.lintWarnings}`);
  console.log(`   TypeScript Errors: ${results.metrics.typeErrors}`);
  console.log(`   Unused Files: ${results.metrics.unusedFiles}`);
  console.log(`   Tests Passed: ${results.metrics.testsPassed}`);
  console.log(`   Tests Failed: ${results.metrics.testsFailed}`);
  
  if (results.recommendations.length > 0) {
    console.log('\\n💡 Recommendations:');
    for (const rec of results.recommendations) {
      const icon = rec.type === 'error' ? '❌' : rec.type === 'warning' ? '⚠️' : '💡';
      console.log(`   ${icon} ${rec.message}`);
      console.log(`      Command: ${rec.command}`);
    }
  }
  
  console.log(`\\n📄 Full report saved to: ${QUALITY_REPORT_PATH}`);
  console.log('='.repeat(60));
}

function getPackageVersion() {
  try {
    const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
    return packageJson.version;
  } catch {
    return 'unknown';
  }
}

// Run the quality check
runQualityCheck().catch(error => {
  console.error('💥 Quality check failed:', error);
  process.exit(1);
});