#!/usr/bin/env bun

/**
 * FINAL COMPREHENSIVE TEST AND ERROR DETECTION SYSTEM
 * Ultra-systematic testing to verify all fixes worked
 */

import { spawnSync } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const projectRoot = resolve(process.cwd());
const results = {
  critical: { passed: 0, failed: 0, tests: [] },
  high: { passed: 0, failed: 0, tests: [] },
  medium: { passed: 0, failed: 0, tests: [] },
  summary: { totalTests: 0, passRate: 0 }
};

console.log('🎯 FINAL COMPREHENSIVE TEST & ERROR DETECTION SYSTEM');
console.log('=' .repeat(60));
console.log('');

// Test categories with priority
const CRITICAL_TESTS = [
  {
    name: 'Enhanced Server Integration',
    command: 'bun tests/integration/test-enhanced-server.js',
    description: 'Core API server functionality'
  },
  {
    name: 'TypeScript Compilation',
    command: 'npx tsc --noEmit --skipLibCheck',
    description: 'TypeScript type checking'
  },
  {
    name: 'Distribution System',
    command: 'bun tests/performance/test-distribution-performance-simple.js',
    description: 'Distribution system core functionality'
  }
];

const HIGH_PRIORITY_TESTS = [
  {
    name: 'Lazy Loading Simple',
    command: 'bun test tests/unit/lazy-loading-simple.test.js',
    description: 'Core lazy loading system'
  },
  {
    name: 'Multi Distribution System',
    command: 'bun tests/integration/test-multi-distribution-system.js',
    description: 'Complex distribution scenarios'
  },
  {
    name: 'Package Scripts Validation',
    command: 'bun npm run typecheck',
    description: 'Package.json script functionality'
  }
];

const MEDIUM_PRIORITY_TESTS = [
  {
    name: 'Basic Demo Server',
    command: 'timeout 3 bun npm run demo',
    description: 'Demo server startup',
    expectTimeout: true
  },
  {
    name: 'Performance Benchmark',
    command: 'bun tests/performance/benchmark.js',
    description: 'New performance benchmarks'
  },
  {
    name: 'Shader Compilation',
    command: 'bun scripts/compile-shaders.js',
    description: 'Shader compilation script'
  }
];

// Test runner
async function runTest(test, priority) {
  console.log(`▶️ Testing: ${test.name}`);
  console.log(`   Command: ${test.command}`);
  
  try {
    const [command, ...args] = test.command.split(' ');
    const result = spawnSync(command, args, {
      cwd: projectRoot,
      encoding: 'utf8',
      timeout: 15000
    });
    
    const testResult = {
      name: test.name,
      command: test.command,
      description: test.description,
      success: false,
      output: result.stdout || '',
      error: result.stderr || '',
      exitCode: result.status
    };
    
    // Determine success
    if (test.expectTimeout && result.status === null) {
      testResult.success = true;
      console.log(`✅ ${test.name} - PASSED (expected timeout)`);
    } else if (result.status === 0) {
      testResult.success = true;
      console.log(`✅ ${test.name} - PASSED`);
    } else {
      testResult.success = false;
      console.log(`❌ ${test.name} - FAILED (exit code: ${result.status})`);
      if (result.stderr) {
        const errorLines = result.stderr.split('\n').slice(0, 2);
        console.log(`   Error: ${errorLines.join(' ')}`);
      }
    }
    
    results[priority].tests.push(testResult);
    if (testResult.success) {
      results[priority].passed++;
    } else {
      results[priority].failed++;
    }
    
  } catch (error) {
    console.log(`💥 ${test.name} - RUNTIME ERROR: ${error.message}`);
    results[priority].tests.push({
      name: test.name,
      success: false,
      error: error.message,
      description: test.description
    });
    results[priority].failed++;
  }
  
  console.log('');
}

// Run all test categories
async function runAllTests() {
  console.log('🔥 CRITICAL TESTS (Must Pass)\n');
  for (const test of CRITICAL_TESTS) {
    await runTest(test, 'critical');
  }
  
  console.log('🔸 HIGH PRIORITY TESTS\n');
  for (const test of HIGH_PRIORITY_TESTS) {
    await runTest(test, 'high');
  }
  
  console.log('🔹 MEDIUM PRIORITY TESTS\n');
  for (const test of MEDIUM_PRIORITY_TESTS) {
    await runTest(test, 'medium');
  }
}

// Additional file-based validations
function performFileValidations() {
  console.log('📋 ADDITIONAL VALIDATIONS\n');
  
  const validations = [
    {
      name: 'Core Files Exist',
      check: () => {
        const coreFiles = [
          'src/core/orchestrator.ts',
          'src/core/pipeline.ts',
          'src/core/lazy-pipeline-registry.js',
          'src/services/api/enhanced-server.js'
        ];
        
        const missing = coreFiles.filter(f => !existsSync(resolve(projectRoot, f)));
        return { success: missing.length === 0, details: missing.length ? `Missing: ${missing.join(', ')}` : 'All core files present' };
      }
    },
    {
      name: 'Feature Structure',
      check: () => {
        const features = [
          'src/features/face-detection',
          'src/features/eye-tracking',
          'src/features/emotion-analysis',
          'src/features/speech-analysis'
        ];
        
        const missing = features.filter(f => !existsSync(resolve(projectRoot, f)));
        return { success: missing.length === 0, details: missing.length ? `Missing: ${missing.join(', ')}` : 'All feature directories present' };
      }
    },
    {
      name: 'Test Organization',
      check: () => {
        const testDirs = [
          'tests/unit',
          'tests/integration',
          'tests/e2e',
          'tests/performance'
        ];
        
        const missing = testDirs.filter(d => !existsSync(resolve(projectRoot, d)));
        return { success: missing.length === 0, details: missing.length ? `Missing: ${missing.join(', ')}` : 'All test directories present' };
      }
    },
    {
      name: 'Package.json Scripts',
      check: () => {
        try {
          const pkg = JSON.parse(readFileSync(resolve(projectRoot, 'package.json'), 'utf8'));
          const criticalScripts = ['demo', 'speech:server', 'test:performance'];
          const missing = criticalScripts.filter(s => !pkg.scripts[s]);
          return { success: missing.length === 0, details: missing.length ? `Missing scripts: ${missing.join(', ')}` : 'All critical scripts present' };
        } catch (error) {
          return { success: false, details: error.message };
        }
      }
    }
  ];
  
  for (const validation of validations) {
    const result = validation.check();
    if (result.success) {
      console.log(`✅ ${validation.name} - ${result.details}`);
    } else {
      console.log(`❌ ${validation.name} - ${result.details}`);
    }
  }
  
  console.log('');
}

// Generate final report
function generateFinalReport() {
  const totalTests = results.critical.tests.length + results.high.tests.length + results.medium.tests.length;
  const totalPassed = results.critical.passed + results.high.passed + results.medium.passed;
  const passRate = Math.round((totalPassed / totalTests) * 100);
  
  results.summary.totalTests = totalTests;
  results.summary.passRate = passRate;
  
  console.log('📊 FINAL COMPREHENSIVE TEST RESULTS');
  console.log('=' .repeat(60));
  console.log(`Total Tests: ${totalTests}`);
  console.log(`Passed: ${totalPassed} (${passRate}%)`);
  console.log(`Failed: ${totalTests - totalPassed} (${100 - passRate}%)`);
  console.log('');
  
  // Category breakdown
  console.log('📈 Results by Priority:');
  console.log(`Critical: ${results.critical.passed}/${results.critical.tests.length} (${Math.round(results.critical.passed/results.critical.tests.length*100)}%)`);
  console.log(`High:     ${results.high.passed}/${results.high.tests.length} (${Math.round(results.high.passed/results.high.tests.length*100)}%)`);
  console.log(`Medium:   ${results.medium.passed}/${results.medium.tests.length} (${Math.round(results.medium.passed/results.medium.tests.length*100)}%)`);
  console.log('');
  
  // Critical failures (blocking issues)
  if (results.critical.failed > 0) {
    console.log('🚨 CRITICAL FAILURES (Must Fix):');
    for (const test of results.critical.tests) {
      if (!test.success) {
        console.log(`   ❌ ${test.name}: ${test.error || 'Failed'}  `);
      }
    }
    console.log('');
  }
  
  // Success assessment
  if (results.critical.passed === results.critical.tests.length) {
    console.log('🎉 ALL CRITICAL TESTS PASSED - Core system is functional!');
  } else {
    console.log('⚠️ CRITICAL TESTS FAILED - Core system has issues');
  }
  
  if (passRate >= 80) {
    console.log('✅ Overall system health: GOOD');
  } else if (passRate >= 60) {
    console.log('🔶 Overall system health: FAIR - needs improvements');
  } else {
    console.log('🔴 Overall system health: POOR - significant issues remain');
  }
  
  console.log('');
  console.log('🎯 RECOMMENDATIONS:');
  
  if (results.critical.failed === 0) {
    console.log('   • Core system is stable and functional');
    console.log('   • Focus on improving high-priority test coverage');
    console.log('   • Continue development with confidence');
  } else {
    console.log('   • Fix critical failures before proceeding');
    console.log('   • Focus on import path corrections');
    console.log('   • Verify TypeScript compilation');
  }
}

// Main execution
async function main() {
  console.log('Starting final comprehensive testing...\n');
  
  await runAllTests();
  performFileValidations();
  generateFinalReport();
  
  console.log('🏁 Final comprehensive testing complete!');
}

main().catch(console.error);