/**
 * Test orchestrator for Synopticon comprehensive testing system
 * Manages parallel test execution, data generation, and result aggregation
 */

import { spawn } from 'child_process';
import { createWriteStream, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

interface TestSuite {
  name: string;
  pattern: string;
  timeout: number;
  parallel: boolean;
  dependencies?: string[];
}

interface TestResult {
  suite: string;
  passed: boolean;
  duration: number;
  testCount: number;
  failures: string[];
  coverage?: number;
}

interface TestRunSummary {
  totalSuites: number;
  passed: number;
  failed: number;
  duration: number;
  coverage: number;
  results: TestResult[];
}

// Factory function for test orchestrator
export const createTestOrchestrator = (config: {
  maxParallel?: number;
  outputDir?: string;
  enableCoverage?: boolean;
}) => {
  const maxParallel = config.maxParallel || 4;
  const outputDir = config.outputDir || 'test-results';
  const enableCoverage = config.enableCoverage || true;

  // Ensure output directory exists
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  const testSuites: TestSuite[] = [
    {
      name: 'Unit Tests',
      pattern: 'tests/unit/**/*.test.{ts,js}',
      timeout: 30000,
      parallel: true
    },
    {
      name: 'Integration Tests', 
      pattern: 'tests/integration/**/*.test.{ts,js}',
      timeout: 60000,
      parallel: true,
      dependencies: ['Unit Tests']
    },
    {
      name: 'System Tests',
      pattern: 'tests/system/**/*.test.{ts,js}',
      timeout: 120000,
      parallel: false,
      dependencies: ['Integration Tests']
    },
    {
      name: 'Performance Tests',
      pattern: 'tests/performance/**/*.test.{ts,js}',
      timeout: 300000,
      parallel: false,
      dependencies: ['System Tests']
    }
  ];

  const runTestSuite = async (suite: TestSuite): Promise<TestResult> => {
    const startTime = Date.now();
    console.log(`🧪 Running ${suite.name}...`);

    return new Promise((resolve) => {
      const args = [
        'test',
        suite.pattern,
        '--timeout', suite.timeout.toString()
      ];

      if (enableCoverage && suite.name === 'Unit Tests') {
        args.push('--coverage');
      }

      const testProcess = spawn('bun', args, {
        stdio: 'pipe',
        shell: true
      });

      let output = '';
      let errorOutput = '';

      testProcess.stdout.on('data', (data) => {
        output += data.toString();
      });

      testProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      testProcess.on('close', (code) => {
        const duration = Date.now() - startTime;
        
        // Parse test results from output
        const testCount = (output.match(/\d+ tests?/g) || ['0 tests']).length;
        const failures = errorOutput
          .split('\n')
          .filter(line => line.includes('FAIL') || line.includes('Error'))
          .slice(0, 5); // Limit to 5 failures

        // Extract coverage if available
        let coverage = 0;
        const coverageMatch = output.match(/All files[^|]*\|\s*(\d+\.?\d*)/);
        if (coverageMatch) {
          coverage = parseFloat(coverageMatch[1]);
        }

        const result: TestResult = {
          suite: suite.name,
          passed: code === 0,
          duration,
          testCount,
          failures,
          coverage: coverage > 0 ? coverage : undefined
        };

        // Write detailed results to file
        const resultFile = join(outputDir, `${suite.name.replace(/\s/g, '-')}.json`);
        const logFile = join(outputDir, `${suite.name.replace(/\s/g, '-')}.log`);
        
        const writeStream = createWriteStream(resultFile);
        writeStream.write(JSON.stringify(result, null, 2));
        writeStream.end();

        const logStream = createWriteStream(logFile);
        logStream.write(`STDOUT:\n${output}\n\nSTDERR:\n${errorOutput}`);
        logStream.end();

        const icon = result.passed ? '✅' : '❌';
        console.log(`${icon} ${suite.name} (${duration}ms)`);
        
        if (!result.passed) {
          console.log(`   Failures: ${failures.length}`);
          failures.forEach(failure => {
            console.log(`   - ${failure}`);
          });
        }

        resolve(result);
      });
    });
  };

  const runAllTests = async (): Promise<TestRunSummary> => {
    const startTime = Date.now();
    console.log('🎯 Starting comprehensive test execution');
    console.log('=====================================');

    const results: TestResult[] = [];
    const completedSuites = new Set<string>();
    
    // Process suites respecting dependencies
    while (completedSuites.size < testSuites.length) {
      const readySuites = testSuites.filter(suite => 
        !completedSuites.has(suite.name) &&
        (!suite.dependencies || 
         suite.dependencies.every(dep => completedSuites.has(dep)))
      );

      if (readySuites.length === 0) {
        console.error('❌ Dependency cycle detected in test suites');
        break;
      }

      // Run parallel or sequential based on suite configuration
      const parallelSuites = readySuites.filter(s => s.parallel);
      const sequentialSuites = readySuites.filter(s => !s.parallel);

      // Run parallel suites
      if (parallelSuites.length > 0) {
        const parallelBatch = parallelSuites.slice(0, maxParallel);
        const parallelResults = await Promise.all(
          parallelBatch.map(suite => runTestSuite(suite))
        );
        
        results.push(...parallelResults);
        parallelBatch.forEach(suite => completedSuites.add(suite.name));
      }

      // Run sequential suites
      for (const suite of sequentialSuites) {
        const result = await runTestSuite(suite);
        results.push(result);
        completedSuites.add(suite.name);
      }
    }

    const duration = Date.now() - startTime;
    const passed = results.filter(r => r.passed).length;
    const failed = results.length - passed;
    
    // Calculate overall coverage
    const coverageResults = results.filter(r => r.coverage !== undefined);
    const averageCoverage = coverageResults.length > 0 
      ? coverageResults.reduce((sum, r) => sum + (r.coverage || 0), 0) / coverageResults.length
      : 0;

    const summary: TestRunSummary = {
      totalSuites: results.length,
      passed,
      failed,
      duration,
      coverage: averageCoverage,
      results
    };

    // Write summary
    const summaryFile = join(outputDir, 'summary.json');
    const summaryStream = createWriteStream(summaryFile);
    summaryStream.write(JSON.stringify(summary, null, 2));
    summaryStream.end();

    // Display summary
    console.log('\n📊 Test Execution Summary');
    console.log('========================');
    console.log(`Total Suites: ${summary.totalSuites}`);
    console.log(`Passed: ${summary.passed}`);
    console.log(`Failed: ${summary.failed}`);
    console.log(`Duration: ${Math.round(summary.duration / 1000)}s`);
    if (summary.coverage > 0) {
      console.log(`Coverage: ${summary.coverage.toFixed(1)}%`);
    }

    if (summary.failed === 0) {
      console.log('\n🎉 All test suites passed!');
    } else {
      console.log('\n⚠️ Some test suites failed');
    }

    return summary;
  };

  const addTestSuite = (suite: TestSuite) => {
    testSuites.push(suite);
  };

  return {
    runAllTests,
    runTestSuite,
    addTestSuite,
    getSuites: () => [...testSuites]
  };
};

// CLI execution
const runTests = async () => {
  const orchestrator = createTestOrchestrator({
    maxParallel: 4,
    enableCoverage: true
  });

  const summary = await orchestrator.runAllTests();
  process.exit(summary.failed === 0 ? 0 : 1);
};

// Run if called directly
if (import.meta.main) {
  runTests().catch(console.error);
}