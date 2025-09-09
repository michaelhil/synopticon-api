/**
 * Pipeline Discovery Manager
 * Handles pipeline discovery, search, and querying operations
 */

import type { 
  PipelineMetadata, 
  SearchResult,
  RegistryState
} from './types.js';

export interface DiscoveryManager {
  list: () => string[];
  getInfo: (name: string) => (PipelineMetadata & { name: string }) | null;
  findByCapability: (capability: string) => string[];
  findByCategory: (category: string) => string[];
  findByTags: (tags: string | string[]) => string[];
  search: (query: string) => SearchResult[];
  getCategories: () => string[];
  getCapabilities: () => string[];
  getTags: () => string[];
}

/**
 * Create pipeline discovery manager
 */
export const createDiscoveryManager = (state: RegistryState): DiscoveryManager => {
  
  /**
   * List all registered pipeline names
   */
  const list = (): string[] => {
    return Array.from(state.pipelineFactories.keys());
  };
  
  /**
   * Get detailed information about a specific pipeline
   */
  const getInfo = (name: string): (PipelineMetadata & { name: string }) | null => {
    const entry = state.pipelineFactories.get(name);
    return entry ? { ...entry.metadata, name } : null;
  };
  
  /**
   * Find pipelines by capability
   */
  const findByCapability = (capability: string): string[] => {
    const results: string[] = [];
    
    for (const [name, entry] of state.pipelineFactories) {
      if (entry.metadata.capabilities.includes(capability)) {
        results.push(name);
      }
    }
    
    return results;
  };
  
  /**
   * Find pipelines by category
   */
  const findByCategory = (category: string): string[] => {
    return Array.from(state.categories.get(category) || []);
  };
  
  /**
   * Find pipelines by tags
   */
  const findByTags = (tags: string | string[]): string[] => {
    const targetTags = Array.isArray(tags) ? tags : [tags];
    const results: string[] = [];
    
    for (const [name, entry] of state.pipelineFactories) {
      const hasAnyTag = targetTags.some(tag => entry.metadata.tags.includes(tag));
      if (hasAnyTag) {
        results.push(name);
      }
    }
    
    return results;
  };
  
  /**
   * Advanced search across pipeline metadata
   */
  const search = (query: string): SearchResult[] => {
    const results: SearchResult[] = [];
    const searchTerm = query.toLowerCase();
    
    if (!searchTerm) return results;
    
    for (const [name, entry] of state.pipelineFactories) {
      const searchableFields = [
        name,
        entry.metadata.description,
        entry.metadata.category,
        entry.metadata.author,
        ...entry.metadata.tags,
        ...entry.metadata.capabilities
      ];
      
      const searchableText = searchableFields.join('\n') ').toLowerCase();
      
      if (searchableText.includes(searchTerm)) {
        // Calculate relevance score
        let relevance = 0;
        
        // Exact name match gets highest score
        if (name.toLowerCase().includes(searchTerm)) {
          relevance += 10;
        }
        
        // Description match gets medium score
        if (entry.metadata.description.toLowerCase().includes(searchTerm)) {
          relevance += 5;
        }
        
        // Tag and capability matches get lower score
        const tagMatches = entry.metadata.tags.filter(tag => 
          tag.toLowerCase().includes(searchTerm)).length;
        const capabilityMatches = entry.metadata.capabilities.filter(cap => 
          cap.toLowerCase().includes(searchTerm)).length;
        
        relevance += tagMatches * 2 + capabilityMatches * 3;
        
        // Count total occurrences for additional relevance
        const occurrences = searchableText.split(searchTerm).length - 1;
        relevance += occurrences;
        
        results.push({
          name,
          relevance,
          metadata: entry.metadata
        });
      }
    }
    
    // Sort by relevance (highest first) and then by name
    return results.sort((a, b) => {
      if (b.relevance !== a.relevance) {
        return b.relevance - a.relevance;
      }
      return a.name.localeCompare(b.name);
    });
  };
  
  /**
   * Get all available categories
   */
  const getCategories = (): string[] => {
    return Array.from(state.categories.keys()).sort();
  };
  
  /**
   * Get all available capabilities
   */
  const getCapabilities = (): string[] => {
    const capabilities = new Set<string>();
    
    for (const [, entry] of state.pipelineFactories) {
      entry.metadata.capabilities.forEach(cap => capabilities.add(cap));
    }
    
    return Array.from(capabilities).sort();
  };
  
  /**
   * Get all available tags
   */
  const getTags = (): string[] => {
    const tags = new Set<string>();
    
    for (const [, entry] of state.pipelineFactories) {
      entry.metadata.tags.forEach(tag => tags.add(tag));
    }
    
    return Array.from(tags).sort();
  };
  
  return {
    list,
    getInfo,
    findByCapability,
    findByCategory,
    findByTags,
    search,
    getCategories,
    getCapabilities,
    getTags
  };
};