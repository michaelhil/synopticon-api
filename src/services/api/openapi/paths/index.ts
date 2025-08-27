/**
 * OpenAPI Paths Index
 * Aggregates all path definitions into a unified structure
 */

import { systemPaths } from './system.js';
import { analysisPaths } from './analysis.js';
import { distributionPaths } from './distribution.js';

export const allPaths = {
  ...systemPaths,
  ...analysisPaths,
  ...distributionPaths
};

export {
  systemPaths,
  analysisPaths,
  distributionPaths
};