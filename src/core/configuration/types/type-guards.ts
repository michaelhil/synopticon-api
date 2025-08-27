/**
 * Type Guard Functions
 * Runtime type checking utilities for analysis results
 */

import { ErrorResult, FaceResult, AnalysisResult } from './analysis-types.js';

// Type guards
export const isErrorResult = (result: unknown): result is ErrorResult => {
  return typeof result === 'object' && result !== null && 'error' in result && result.error === true;
};

export const isFaceResult = (result: unknown): result is FaceResult => {
  return typeof result === 'object' && result !== null && 'detection' in result;
};

export const isAnalysisResult = (result: unknown): result is AnalysisResult => {
  return typeof result === 'object' && result !== null && 'faces' in result && 'metadata' in result;
};