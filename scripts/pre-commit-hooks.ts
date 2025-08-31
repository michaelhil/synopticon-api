/**
 * Pre-commit hooks for Synopticon development quality assurance
 * Runs automated validation before each commit
 */

import { execSync } from 'child_process';
import { createGuardrailValidator } from './guardrail-validator';

interface PreCommitResult {
  step: string;
  passed: boolean;
  message: string;
  duration: number;
}

// Factory function for pre-commit validation
export const createPreCommitValidator = () => {
  const results: PreCommitResult[] = [];

  const runStep = async (
    stepName: string,
    fn: () => Promise<boolean> | boolean
  ): Promise<boolean> => {
    const startTime = Date.now();
    console.log(`Running ${stepName}...`);
    
    try {
      const passed = await fn();
      const duration = Date.now() - startTime;
      
      results.push({
        step: stepName,
        passed,
        message: passed ? 'Passed' : 'Failed',
        duration
      });
      
      if (passed) {
        console.log(`✅ ${stepName} (${duration}ms)`);
      } else {
        console.log(`❌ ${stepName} (${duration}ms)`);
      }
      
      return passed;
    } catch (error) {
      const duration = Date.now() - startTime;
      results.push({
        step: stepName,
        passed: false,
        message: `Error: ${error}`,
        duration
      });
      console.log(`❌ ${stepName} failed: ${error}`);
      return false;
    }
  };

  const validateGuardrails = async (): Promise<boolean> => {
    const validator = createGuardrailValidator();
    const summary = await validator.validateProject();
    return summary.passed;
  };

  const validateTypes = (): boolean => {
    try {
      execSync('bun x tsc --noEmit', { stdio: 'pipe' });
      return true;
    } catch {
      return false;
    }
  };

  const runLinting = (): boolean => {
    try {
      execSync('bunx eslint "src/**/*.{ts,js}" --max-warnings 0', { 
        stdio: 'pipe' 
      });
      return true;
    } catch {
      return false;
    }
  };

  const runUnitTests = (): boolean => {
    try {
      execSync('bun test --timeout 30000', { stdio: 'pipe' });
      return true;
    } catch {
      return false;
    }
  };

  const validateCommit = async (): Promise<boolean> => {
    console.log('🔒 Pre-commit validation started');
    console.log('================================');
    
    const steps = [
      ['Guardrail compliance', validateGuardrails],
      ['TypeScript compilation', validateTypes],
      ['ESLint validation', runLinting],
      ['Unit tests', runUnitTests]
    ] as const;

    let allPassed = true;
    
    for (const [stepName, stepFn] of steps) {
      const passed = await runStep(stepName, stepFn);
      if (!passed) {
        allPassed = false;
      }
    }
    
    console.log('\nSummary:');
    results.forEach(result => {
      const icon = result.passed ? '✅' : '❌';
      console.log(`${icon} ${result.step}: ${result.message} (${result.duration}ms)`);
    });
    
    if (allPassed) {
      console.log('\n🎉 All pre-commit checks passed! Commit proceeding...');
    } else {
      console.log('\n🚫 Pre-commit validation failed. Commit blocked.');
      console.log('Please fix the issues above and try again.');
    }
    
    return allPassed;
  };

  return {
    validateCommit,
    getResults: () => [...results]
  };
};

// CLI execution
const runPreCommitHooks = async () => {
  const validator = createPreCommitValidator();
  const passed = await validator.validateCommit();
  process.exit(passed ? 0 : 1);
};

// Run if called directly
if (import.meta.main) {
  runPreCommitHooks().catch(console.error);
}