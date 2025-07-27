import { ApiService } from './api';

// Mock axios
jest.mock('axios', () => ({
  create: jest.fn(() => ({
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
    interceptors: {
      request: { use: jest.fn() },
      response: { use: jest.fn() }
    }
  })),
  get: jest.fn()
}));

describe('ApiService', () => {
  test('should be defined', () => {
    expect(ApiService).toBeDefined();
  });

  test('should have required methods', () => {
    expect(typeof ApiService.get).toBe('function');
    expect(typeof ApiService.post).toBe('function');
    expect(typeof ApiService.put).toBe('function');
    expect(typeof ApiService.delete).toBe('function');
    expect(typeof ApiService.healthCheck).toBe('function');
  });
});