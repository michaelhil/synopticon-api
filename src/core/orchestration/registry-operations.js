/**
 * Registry operations for pipeline management
 */

import { validatePipelineConfig } from './pipeline.js';

export const createRegistryOperations = (state) => {
  // Direct pipeline registration
  const register = (name, pipelineOrFactory, metadata = {}) => {
    try {
      // Validate if it's a pipeline config
      if (typeof pipelineOrFactory === 'object' && pipelineOrFactory.process) {
        validatePipelineConfig(pipelineOrFactory);
      }
      
      const entry = {
        name,
        factory: typeof pipelineOrFactory === 'function' ? pipelineOrFactory : () => pipelineOrFactory,
        metadata: {
          category: metadata.category || 'general',
          version: metadata.version || '1.0.0',
          description: metadata.description || '',
          author: metadata.author || 'unknown',
          capabilities: metadata.capabilities || [],
          dependencies: metadata.dependencies || [],
          tags: metadata.tags || [],
          registeredAt: Date.now(),
          ...metadata
        }
      };
      
      state.pipelineFactories.set(name, entry);
      
      // Add to category index
      const {category} = entry.metadata;
      if (!state.categories.has(category)) {
        state.categories.set(category, new Set());
      }
      state.categories.get(category).add(name);
      
      return true;
      
    } catch (error) {
      throw new Error(`Pipeline registration failed for '${name}': ${error.message}`);
    }
  };
  
  // Unregister a pipeline
  const unregister = (name) => {
    const entry = state.pipelineFactories.get(name);
    if (!entry) return false;
    
    // Remove from category index
    const {category} = entry.metadata;
    if (state.categories.has(category)) {
      state.categories.get(category).delete(name);
      if (state.categories.get(category).size === 0) {
        state.categories.delete(category);
      }
    }
    
    // Remove active instances
    if (state.pipelines.has(name)) {
      state.pipelines.delete(name);
    }
    
    state.pipelineFactories.delete(name);
    return true;
  };
  
  // Create pipeline instance
  const create = async (name, config = {}) => {
    const entry = state.pipelineFactories.get(name);
    if (!entry) {
      throw new Error(`Pipeline '${name}' not registered`);
    }
    
    try {
      const pipeline = await entry.factory(config);
      
      if (!pipeline || typeof pipeline.process !== 'function') {
        throw new Error(`Pipeline factory for '${name}' must return an object with a 'process' method`);
      }
      
      const instance = {
        ...pipeline,
        name,
        metadata: entry.metadata,
        config,
        createdAt: Date.now()
      };
      
      state.pipelines.set(name, instance);
      return instance;
      
    } catch (error) {
      throw new Error(`Failed to create pipeline '${name}': ${error.message}`);
    }
  };
  
  return {
    register,
    unregister,
    create
  };
};

export const createRegistryQueries = (state) => {
  // Check if pipeline is registered
  const isRegistered = (name) => state.pipelineFactories.has(name);
  
  // Get all registered pipeline names
  const getRegistered = () => Array.from(state.pipelineFactories.keys());
  
  // Get pipeline metadata
  const getMetadata = (name) => {
    const entry = state.pipelineFactories.get(name);
    return entry ? entry.metadata : null;
  };
  
  // Get pipelines by category
  const getByCategory = (category) => {
    const categorySet = state.categories.get(category);
    return categorySet ? Array.from(categorySet) : [];
  };
  
  // Get all categories
  const getCategories = () => Array.from(state.categories.keys());
  
  // Get active pipeline instances
  const getActive = () => Array.from(state.pipelines.keys());
  
  // Get pipeline instance
  const getInstance = (name) => state.pipelines.get(name) || null;
  
  // Search pipelines
  const search = (query) => {
    const results = [];
    const searchTerm = query.toLowerCase();
    
    for (const [name, entry] of state.pipelineFactories) {
      const {metadata} = entry;
      const searchable = [
        name,
        metadata.description,
        metadata.author,
        ...metadata.capabilities,
        ...metadata.tags
      ].join(' ').toLowerCase();
      
      if (searchable.includes(searchTerm)) {
        results.push({
          name,
          metadata,
          relevance: calculateRelevance(searchable, searchTerm)
        });
      }
    }
    
    return results.sort((a, b) => b.relevance - a.relevance);
  };
  
  return {
    isRegistered,
    getRegistered,
    getMetadata,
    getByCategory,
    getCategories,
    getActive,
    getInstance,
    search
  };
};

// Helper function to calculate search relevance
const calculateRelevance = (text, searchTerm) => {
  const exactMatch = text.includes(searchTerm) ? 10 : 0;
  const wordMatches = searchTerm.split(' ').reduce((score, word) => {
    return score + (text.includes(word) ? 5 : 0);
  }, 0);
  const fuzzyMatch = searchTerm.length > 2 && text.includes(searchTerm.substring(0, 3)) ? 2 : 0;
  
  return exactMatch + wordMatches + fuzzyMatch;
};