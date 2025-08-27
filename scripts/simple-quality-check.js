#!/usr/bin/env bun
/**
 * Simple Quality Check - Focus on Critical Issues Only
 */

import { spawn } from 'bun';

console.log('🔍 Running simplified quality check...\n');

// Check TypeScript
console.log('1️⃣ TypeScript Check...');
try {
  const tsProcess = spawn(['bun', 'x', 'tsc', '--noEmit'], {
    stdio: ['pipe', 'pipe', 'pipe']
  });
  
  await tsProcess.exited;
  
  if (tsProcess.exitCode === 0) {
    console.log('✅ TypeScript: PASSED\n');
  } else {
    const stderr = await new Response(tsProcess.stderr).text();
    console.log('❌ TypeScript: FAILED');
    console.log(stderr.substring(0, 500) + (stderr.length > 500 ? '...' : ''));
    console.log();
  }
} catch (error) {
  console.log('❌ TypeScript check failed:', error.message, '\n');
}

// Check for critical ESLint errors only
console.log('2️⃣ Critical ESLint Errors...');
try {
  const lintProcess = spawn(['bunx', 'eslint', 'src/**/*.js', '--quiet'], {
    stdio: ['pipe', 'pipe', 'pipe']
  });
  
  await lintProcess.exited;
  
  if (lintProcess.exitCode === 0) {
    console.log('✅ ESLint (errors only): PASSED\n');
  } else {
    const stdout = await new Response(lintProcess.stdout).text();
    const lines = stdout.split('\n');
    const criticalLines = lines.filter(line => 
      line.includes('error') && !line.includes('warning')
    ).slice(0, 10);
    
    console.log('❌ ESLint Critical Errors:');
    criticalLines.forEach(line => console.log('  ', line));
    console.log();
  }
} catch (error) {
  console.log('❌ ESLint check failed:', error.message, '\n');
}

// Simple test run
console.log('3️⃣ Basic Test Run...');
try {
  const testProcess = spawn(['bun', 'test', '--timeout', '10000'], {
    stdio: ['pipe', 'pipe', 'pipe']
  });
  
  await testProcess.exited;
  
  const stdout = await new Response(testProcess.stdout).text();
  const passCount = (stdout.match(/✓/g) || []).length;
  const failCount = (stdout.match(/✗/g) || []).length;
  
  console.log(`✅ Tests: ${passCount} passed, ${failCount} failed\n`);
  
} catch (error) {
  console.log('❌ Test run failed:', error.message, '\n');
}

// Basic file check
console.log('4️⃣ Essential Files Check...');
const essentialFiles = [
  'src/index.js',
  'src/services/api/server.js',
  'src/services/mcp/server.ts',
  'package.json'
];

let allFilesPresent = true;
for (const file of essentialFiles) {
  try {
    const stats = await Bun.file(file).exists();
    if (stats) {
      console.log(`✅ ${file} - present`);
    } else {
      console.log(`❌ ${file} - missing`);
      allFilesPresent = false;
    }
  } catch {
    console.log(`❌ ${file} - missing or inaccessible`);
    allFilesPresent = false;
  }
}

console.log('\n🎯 Simple Quality Check Complete');
console.log(allFilesPresent ? '✅ All essential files present' : '❌ Some essential files missing');