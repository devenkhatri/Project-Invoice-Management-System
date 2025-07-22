const Sequencer = require('@jest/test-sequencer').default;

/**
 * Custom test sequencer to run tests in a specific order:
 * 1. Unit tests
 * 2. Integration tests
 * 3. E2E tests
 * 4. Performance tests
 * 5. Load tests
 */
class CustomSequencer extends Sequencer {
  sort(tests) {
    // Return a new array of tests sorted by path
    return Array.from(tests).sort((testA, testB) => {
      const pathA = testA.path;
      const pathB = testB.path;
      
      // Helper function to determine test type priority
      const getTestTypePriority = (path) => {
        if (path.includes('/__tests__/e2e/')) return 3;
        if (path.includes('/__tests__/performance/')) return 4;
        if (path.includes('/__tests__/load/')) return 5;
        if (path.includes('/__tests__/')) return 1; // Regular unit tests
        return 2; // Integration tests
      };
      
      const priorityA = getTestTypePriority(pathA);
      const priorityB = getTestTypePriority(pathB);
      
      // Sort by priority first
      if (priorityA !== priorityB) {
        return priorityA - priorityB;
      }
      
      // If same priority, sort alphabetically
      return pathA.localeCompare(pathB);
    });
  }
}

module.exports = CustomSequencer;