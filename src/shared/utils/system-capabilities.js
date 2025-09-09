/**
 * System Capabilities Module
 * Handles system capability detection and dependency availability checking
 */

// Check if dependency is available
export const isDependencyAvailable = (dependencies, dependencyKey) => {
  const dependency = dependencies[dependencyKey];
  if (!dependency) {
    return false;
  }
  
  return dependency.check();
};

// Get dependency info
export const getDependencyInfo = (dependencies, dependencyKey) => {
  const dependency = dependencies[dependencyKey];
  if (!dependency) {
    return null;
  }

  return {
    name: dependency.name,
    available: dependency.check(),
    dependencies: dependency.dependencies || [],
    scripts: dependency.scripts
  };
};

// Check system capabilities
export const checkSystemCapabilities = (dependencies) => {
  const capabilities = {};
  
  for (const [key, dependency] of Object.entries(dependencies)) {
    capabilities[key] = {
      available: dependency.check(),
      name: dependency.name
    };
  }
  
  return capabilities;
};
