/**
 * Composition Registry
 * Central registry for storing and managing reusable composition templates
 */

import type { BaseComposition } from '../composition-engine.js';

export interface CompositionTemplate {
  id: string;
  name: string;
  description?: string;
  composition: BaseComposition;
  metadata: {
    version: string;
    author?: string;
    tags?: string[];
    createdAt: number;
    updatedAt: number;
    usageCount: number;
    averageExecutionTime?: number;
    successRate?: number;
  };
}

export interface RegistryStats {
  totalTemplates: number;
  templatesByPattern: Record<string, number>;
  mostUsedTemplates: Array<{ id: string; name: string; usageCount: number; }>;
  recentTemplates: Array<{ id: string; name: string; createdAt: number; }>;
  averageSuccessRate: number;
}

export interface RegistrySearchOptions {
  pattern?: string;
  tags?: string[];
  author?: string;
  minSuccessRate?: number;
  maxExecutionTime?: number;
  sortBy?: 'name' | 'usage' | 'created' | 'updated' | 'success_rate';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
}

/**
 * Creates composition registry
 */
export const createCompositionRegistry = () => {
  const state = {
    templates: new Map<string, CompositionTemplate>(),
    templatesByPattern: new Map<string, Set<string>>(),
    templatesByTag: new Map<string, Set<string>>(),
    templatesByAuthor: new Map<string, Set<string>>()
  };

  // Register a new composition template
  const register = (
    composition: BaseComposition,
    metadata: {
      version?: string;
      author?: string;
      tags?: string[];
      description?: string;
    } = {}
  ): void => {
    const template: CompositionTemplate = {
      id: composition.id,
      name: composition.name,
      description: metadata.description,
      composition: { ...composition }, // Deep copy to avoid mutations
      metadata: {
        version: metadata.version || '1.0.0',
        author: metadata.author,
        tags: metadata.tags || [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        usageCount: 0,
        averageExecutionTime: undefined,
        successRate: undefined
      }
    };

    // Store template
    state.templates.set(composition.id, template);

    // Update pattern index
    let patternSet = state.templatesByPattern.get(composition.pattern);
    if (!patternSet) {
      patternSet = new Set();
      state.templatesByPattern.set(composition.pattern, patternSet);
    }
    patternSet.add(composition.id);

    // Update tag index
    for (const tag of template.metadata.tags || []) {
      let tagSet = state.templatesByTag.get(tag);
      if (!tagSet) {
        tagSet = new Set();
        state.templatesByTag.set(tag, tagSet);
      }
      tagSet.add(composition.id);
    }

    // Update author index
    if (template.metadata.author) {
      let authorSet = state.templatesByAuthor.get(template.metadata.author);
      if (!authorSet) {
        authorSet = new Set();
        state.templatesByAuthor.set(template.metadata.author, authorSet);
      }
      authorSet.add(composition.id);
    }
  };

  // Get template by ID
  const get = (templateId: string): BaseComposition | null => {
    const template = state.templates.get(templateId);
    return template ? { ...template.composition } : null; // Return copy to prevent mutations
  };

  // Get template with metadata
  const getTemplate = (templateId: string): CompositionTemplate | null => {
    const template = state.templates.get(templateId);
    return template ? { ...template } : null;
  };

  // Update existing template
  const update = (
    templateId: string,
    updates: {
      composition?: Partial<BaseComposition>;
      metadata?: Partial<CompositionTemplate['metadata']>;
      description?: string;
    }
  ): boolean => {
    const template = state.templates.get(templateId);
    if (!template) {
      return false;
    }

    // Update composition if provided
    if (updates.composition) {
      Object.assign(template.composition, updates.composition);
    }

    // Update metadata
    if (updates.metadata) {
      Object.assign(template.metadata, updates.metadata);
    }

    if (updates.description !== undefined) {
      template.description = updates.description;
    }

    template.metadata.updatedAt = Date.now();

    // Re-index if pattern changed
    if (updates.composition?.pattern && updates.composition.pattern !== template.composition.pattern) {
      // Remove from old pattern index
      const oldPatternSet = state.templatesByPattern.get(template.composition.pattern);
      if (oldPatternSet) {
        oldPatternSet.delete(templateId);
      }

      // Add to new pattern index
      let newPatternSet = state.templatesByPattern.get(updates.composition.pattern);
      if (!newPatternSet) {
        newPatternSet = new Set();
        state.templatesByPattern.set(updates.composition.pattern, newPatternSet);
      }
      newPatternSet.add(templateId);
    }

    return true;
  };

  // Remove template
  const remove = (templateId: string): boolean => {
    const template = state.templates.get(templateId);
    if (!template) {
      return false;
    }

    // Remove from main storage
    state.templates.delete(templateId);

    // Remove from pattern index
    const patternSet = state.templatesByPattern.get(template.composition.pattern);
    if (patternSet) {
      patternSet.delete(templateId);
      if (patternSet.size === 0) {
        state.templatesByPattern.delete(template.composition.pattern);
      }
    }

    // Remove from tag indices
    for (const tag of template.metadata.tags || []) {
      const tagSet = state.templatesByTag.get(tag);
      if (tagSet) {
        tagSet.delete(templateId);
        if (tagSet.size === 0) {
          state.templatesByTag.delete(tag);
        }
      }
    }

    // Remove from author index
    if (template.metadata.author) {
      const authorSet = state.templatesByAuthor.get(template.metadata.author);
      if (authorSet) {
        authorSet.delete(templateId);
        if (authorSet.size === 0) {
          state.templatesByAuthor.delete(template.metadata.author);
        }
      }
    }

    return true;
  };

  // Record template usage
  const recordUsage = (
    templateId: string,
    executionTime: number,
    success: boolean
  ): void => {
    const template = state.templates.get(templateId);
    if (!template) {
      return;
    }

    template.metadata.usageCount++;

    // Update average execution time
    if (template.metadata.averageExecutionTime === undefined) {
      template.metadata.averageExecutionTime = executionTime;
    } else {
      template.metadata.averageExecutionTime = 
        (template.metadata.averageExecutionTime * (template.metadata.usageCount - 1) + executionTime) / template.metadata.usageCount;
    }

    // Update success rate
    if (template.metadata.successRate === undefined) {
      template.metadata.successRate = success ? 1 : 0;
    } else {
      const successCount = template.metadata.successRate * (template.metadata.usageCount - 1) + (success ? 1 : 0);
      template.metadata.successRate = successCount / template.metadata.usageCount;
    }

    template.metadata.updatedAt = Date.now();
  };

  // Search templates
  const search = (options: RegistrySearchOptions = {}): CompositionTemplate[] => {
    let results = Array.from(state.templates.values());

    // Filter by pattern
    if (options.pattern) {
      results = results.filter(template => template.composition.pattern === options.pattern);
    }

    // Filter by tags
    if (options.tags && options.tags.length > 0) {
      results = results.filter(template => 
        options.tags!.some(tag => template.metadata.tags?.includes(tag))
      );
    }

    // Filter by author
    if (options.author) {
      results = results.filter(template => template.metadata.author === options.author);
    }

    // Filter by success rate
    if (options.minSuccessRate !== undefined) {
      results = results.filter(template => 
        template.metadata.successRate !== undefined && 
        template.metadata.successRate >= options.minSuccessRate!
      );
    }

    // Filter by execution time
    if (options.maxExecutionTime !== undefined) {
      results = results.filter(template => 
        template.metadata.averageExecutionTime !== undefined && 
        template.metadata.averageExecutionTime <= options.maxExecutionTime!
      );
    }

    // Sort results
    const sortBy = options.sortBy || 'name';
    const sortOrder = options.sortOrder || 'asc';

    results.sort((a, b) => {
      let aValue: any, bValue: any;

      switch (sortBy) {
      case 'name':
        aValue = a.name.toLowerCase();
        bValue = b.name.toLowerCase();
        break;
      case 'usage':
        aValue = a.metadata.usageCount;
        bValue = b.metadata.usageCount;
        break;
      case 'created':
        aValue = a.metadata.createdAt;
        bValue = b.metadata.createdAt;
        break;
      case 'updated':
        aValue = a.metadata.updatedAt;
        bValue = b.metadata.updatedAt;
        break;
      case 'success_rate':
        aValue = a.metadata.successRate || 0;
        bValue = b.metadata.successRate || 0;
        break;
      default:
        aValue = a.name;
        bValue = b.name;
      }

      if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    // Limit results
    if (options.limit && options.limit > 0) {
      results = results.slice(0, options.limit);
    }

    return results.map(template => ({ ...template })); // Return copies
  };

  // List all template IDs
  const list = (): string[] => Array.from(state.templates.keys());

  // Get templates by pattern
  const getByPattern = (pattern: string): CompositionTemplate[] => {
    const templateIds = state.templatesByPattern.get(pattern);
    if (!templateIds) {
      return [];
    }

    return Array.from(templateIds)
      .map(id => state.templates.get(id))
      .filter(Boolean) as CompositionTemplate[];
  };

  // Get templates by tag
  const getByTag = (tag: string): CompositionTemplate[] => {
    const templateIds = state.templatesByTag.get(tag);
    if (!templateIds) {
      return [];
    }

    return Array.from(templateIds)
      .map(id => state.templates.get(id))
      .filter(Boolean) as CompositionTemplate[];
  };

  // Get templates by author
  const getByAuthor = (author: string): CompositionTemplate[] => {
    const templateIds = state.templatesByAuthor.get(author);
    if (!templateIds) {
      return [];
    }

    return Array.from(templateIds)
      .map(id => state.templates.get(id))
      .filter(Boolean) as CompositionTemplate[];
  };

  // Get registry statistics
  const getStats = (): RegistryStats => {
    const templates = Array.from(state.templates.values());

    // Templates by pattern
    const templatesByPattern: Record<string, number> = {};
    for (const [pattern, templateIds] of state.templatesByPattern) {
      templatesByPattern[pattern] = templateIds.size;
    }

    // Most used templates
    const mostUsedTemplates = templates
      .filter(t => t.metadata.usageCount > 0)
      .sort((a, b) => b.metadata.usageCount - a.metadata.usageCount)
      .slice(0, 10)
      .map(t => ({
        id: t.id,
        name: t.name,
        usageCount: t.metadata.usageCount
      }));

    // Recent templates
    const recentTemplates = templates
      .sort((a, b) => b.metadata.createdAt - a.metadata.createdAt)
      .slice(0, 10)
      .map(t => ({
        id: t.id,
        name: t.name,
        createdAt: t.metadata.createdAt
      }));

    // Average success rate
    const templatesWithSuccessRate = templates.filter(t => t.metadata.successRate !== undefined);
    const averageSuccessRate = templatesWithSuccessRate.length > 0
      ? templatesWithSuccessRate.reduce((sum, t) => sum + (t.metadata.successRate || 0), 0) / templatesWithSuccessRate.length
      : 0;

    return {
      totalTemplates: templates.length,
      templatesByPattern,
      mostUsedTemplates,
      recentTemplates,
      averageSuccessRate
    };
  };

  // Check if template exists
  const exists = (templateId: string): boolean => state.templates.has(templateId);

  // Get all available patterns
  const getPatterns = (): string[] => Array.from(state.templatesByPattern.keys());

  // Get all available tags
  const getTags = (): string[] => Array.from(state.templatesByTag.keys());

  // Get all authors
  const getAuthors = (): string[] => Array.from(state.templatesByAuthor.keys());

  // Export registry data
  const exportData = () => ({
    timestamp: Date.now(),
    templates: Array.from(state.templates.values()),
    stats: getStats()
  });

  // Import registry data
  const importData = (data: { templates: CompositionTemplate[]; }): void => {
    // Clear existing data
    state.templates.clear();
    state.templatesByPattern.clear();
    state.templatesByTag.clear();
    state.templatesByAuthor.clear();

    // Import templates
    for (const template of data.templates) {
      state.templates.set(template.id, template);

      // Rebuild indices
      let patternSet = state.templatesByPattern.get(template.composition.pattern);
      if (!patternSet) {
        patternSet = new Set();
        state.templatesByPattern.set(template.composition.pattern, patternSet);
      }
      patternSet.add(template.id);

      for (const tag of template.metadata.tags || []) {
        let tagSet = state.templatesByTag.get(tag);
        if (!tagSet) {
          tagSet = new Set();
          state.templatesByTag.set(tag, tagSet);
        }
        tagSet.add(template.id);
      }

      if (template.metadata.author) {
        let authorSet = state.templatesByAuthor.get(template.metadata.author);
        if (!authorSet) {
          authorSet = new Set();
          state.templatesByAuthor.set(template.metadata.author, authorSet);
        }
        authorSet.add(template.id);
      }
    }
  };

  // Cleanup resources
  const cleanup = async (): Promise<void> => {
    state.templates.clear();
    state.templatesByPattern.clear();
    state.templatesByTag.clear();
    state.templatesByAuthor.clear();
  };

  return {
    register,
    get,
    getTemplate,
    update,
    remove,
    recordUsage,
    search,
    list,
    exists,
    getByPattern,
    getByTag,
    getByAuthor,
    getPatterns,
    getTags,
    getAuthors,
    getStats,
    exportData,
    importData,
    cleanup
  };
};
