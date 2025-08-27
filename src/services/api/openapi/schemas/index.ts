/**
 * OpenAPI Schemas Index
 * Aggregates all schema definitions into a unified structure
 */

import { commonSchemas } from './common.js';
import { faceAnalysisSchemas } from './face-analysis.js';
import { distributionSchemas } from './distribution.js';
import { mediaStreamingSchemas } from './media-streaming.js';

export const allSchemas = {
  ...commonSchemas,
  ...faceAnalysisSchemas,
  ...distributionSchemas,
  ...mediaStreamingSchemas
};

export {
  commonSchemas,
  faceAnalysisSchemas,
  distributionSchemas,
  mediaStreamingSchemas
};