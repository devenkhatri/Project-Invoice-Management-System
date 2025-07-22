import { Express } from 'express';
import { Server } from 'http';
import request from 'supertest';
import { app } from '../../index';

// Global variables for test server
let server: Server;
let testApp: Express;

// Setup function to start the server before tests
export const setupTestServer = async (): Promise<void> => {
  testApp = app;
  server = testApp.listen(0); // Use random available port
  return Promise.resolve();
};

// Teardown function to close the server after tests
export const teardownTestServer = async (): Promise<void> => {
  return new Promise((resolve) => {
    server.close(() => {
      resolve();
    });
  });
};

// Helper function to get a supertest instance
export const getTestAgent = () => {
  return request(testApp);
};

// Helper function to authenticate and get a token
export const getAuthToken = async (email: string, password: string): Promise<string> => {
  const response = await request(testApp)
    .post('/api/auth/login')
    .send({ email, password });
  
  return response.body.token;
};