module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/index.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/'
  ],
  // Group tests by type for easier running
  // testSequencer: './src/__tests__/testSequencer.js',
  // Setup and teardown for all tests
  // setupFilesAfterEnv: ['./src/__tests__/setupTests.js'],
  // Timeout for performance and load tests
  testTimeout: 30000
};