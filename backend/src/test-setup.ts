// Jest test setup file
// This file is executed before each test file

import dotenv from 'dotenv';
import path from 'path';

// Load test environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env.test') });

// Extend Jest matchers
// import '@types/jest'; // Not needed as Jest types are available globally

// Global test configuration
beforeAll(() => {
  // Setup global test configuration
});

afterAll(() => {
  // Cleanup after all tests
});

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  // Uncomment to suppress console.log in tests
  // log: jest.fn(),
  // warn: jest.fn(),
  // error: jest.fn(),
};