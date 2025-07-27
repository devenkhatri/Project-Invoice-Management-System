const express = require('express');

// Test if we can import the client routes without the full server
try {
  console.log('Testing client routes import...');
  
  // Mock the dependencies first
  // jest.mock('./dist/services/sheets.service');
  // jest.mock('./dist/middleware/auth');
  
  const clientRoutes = require('./dist/routes/clients');
  console.log('✅ Client routes imported successfully');
  
  const clientPortalRoutes = require('./dist/routes/client-portal');
  console.log('✅ Client portal routes imported successfully');
  
  // Test basic route setup
  const app = express();
  app.use('/api/clients', clientRoutes.default);
  app.use('/api/client-portal', clientPortalRoutes.default);
  
  console.log('✅ Routes registered successfully');
  
} catch (error) {
  console.error('❌ Error testing client routes:', error.message);
  console.error(error.stack);
}