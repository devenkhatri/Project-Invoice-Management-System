import { SheetsService } from '../../services/googleSheets';
import { v4 as uuidv4 } from 'uuid';

// Initialize the sheets service
const sheetsService = new SheetsService();

// Helper function to measure execution time
const measureExecutionTime = async (fn: () => Promise<any>): Promise<number> => {
  const start = process.hrtime.bigint();
  await fn();
  const end = process.hrtime.bigint();
  return Number(end - start) / 1000000; // Convert to milliseconds
};

describe('Google Sheets Performance Tests', () => {
  // Test data
  const testSheetName = 'Performance_Test';
  const batchSize = 100;
  let testIds: string[] = [];
  
  // Setup - create test data
  beforeAll(async () => {
    // Create test sheet if it doesn't exist
    try {
      await sheetsService.createSheet(testSheetName);
    } catch (error) {
      console.log('Test sheet already exists or could not be created');
    }
  });
  
  // Cleanup after tests
  afterAll(async () => {
    // Clean up test data
    for (const id of testIds) {
      try {
        await sheetsService.delete(testSheetName, id);
      } catch (error) {
        console.log(`Could not delete test record ${id}`);
      }
    }
  });
  
  // Test single record creation performance
  test('Single record creation performance', async () => {
    const testData = {
      id: uuidv4(),
      name: 'Performance Test',
      value: 'Test Value',
      timestamp: new Date().toISOString()
    };
    
    const executionTime = await measureExecutionTime(async () => {
      const id = await sheetsService.create(testSheetName, testData);
      testIds.push(id);
    });
    
    console.log(`Single record creation took ${executionTime}ms`);
    expect(executionTime).toBeLessThan(2000); // Should take less than 2 seconds
  });
  
  // Test batch record creation performance
  test('Batch record creation performance', async () => {
    const batchData = Array.from({ length: batchSize }, () => ({
      id: uuidv4(),
      name: 'Batch Performance Test',
      value: 'Test Value',
      timestamp: new Date().toISOString()
    }));
    
    const executionTime = await measureExecutionTime(async () => {
      const ids = await sheetsService.batchCreate(testSheetName, batchData);
      testIds.push(...ids);
    });
    
    const avgTimePerRecord = executionTime / batchSize;
    console.log(`Batch creation of ${batchSize} records took ${executionTime}ms (${avgTimePerRecord}ms per record)`);
    expect(avgTimePerRecord).toBeLessThan(20); // Should take less than 20ms per record on average
  });
  
  // Test query performance
  test('Query performance', async () => {
    const executionTime = await measureExecutionTime(async () => {
      await sheetsService.query(testSheetName, { name: 'Batch Performance Test' });
    });
    
    console.log(`Query execution took ${executionTime}ms`);
    expect(executionTime).toBeLessThan(3000); // Should take less than 3 seconds
  });
  
  // Test read performance with different result sizes
  test.each([1, 10, 50, 100])('Read performance with %i results', async (resultSize) => {
    // First ensure we have enough test data
    const existingData = await sheetsService.read(testSheetName);
    if (existingData.length < resultSize) {
      const additionalData = Array.from({ length: resultSize - existingData.length }, () => ({
        id: uuidv4(),
        name: 'Read Performance Test',
        value: 'Test Value',
        timestamp: new Date().toISOString()
      }));
      
      const ids = await sheetsService.batchCreate(testSheetName, additionalData);
      testIds.push(...ids);
    }
    
    // Measure read performance
    const executionTime = await measureExecutionTime(async () => {
      await sheetsService.read(testSheetName, undefined, resultSize);
    });
    
    console.log(`Reading ${resultSize} records took ${executionTime}ms (${executionTime / resultSize}ms per record)`);
    expect(executionTime / resultSize).toBeLessThan(30); // Should take less than 30ms per record
  });
  
  // Test update performance
  test('Update performance', async () => {
    // Create a test record to update
    const testData = {
      id: uuidv4(),
      name: 'Update Performance Test',
      value: 'Original Value',
      timestamp: new Date().toISOString()
    };
    
    const id = await sheetsService.create(testSheetName, testData);
    testIds.push(id);
    
    // Measure update performance
    const executionTime = await measureExecutionTime(async () => {
      await sheetsService.update(testSheetName, id, {
        ...testData,
        value: 'Updated Value',
        timestamp: new Date().toISOString()
      });
    });
    
    console.log(`Update operation took ${executionTime}ms`);
    expect(executionTime).toBeLessThan(2000); // Should take less than 2 seconds
  });
  
  // Test delete performance
  test('Delete performance', async () => {
    // Create a test record to delete
    const testData = {
      id: uuidv4(),
      name: 'Delete Performance Test',
      value: 'Test Value',
      timestamp: new Date().toISOString()
    };
    
    const id = await sheetsService.create(testSheetName, testData);
    
    // Measure delete performance
    const executionTime = await measureExecutionTime(async () => {
      await sheetsService.delete(testSheetName, id);
    });
    
    console.log(`Delete operation took ${executionTime}ms`);
    expect(executionTime).toBeLessThan(2000); // Should take less than 2 seconds
    
    // Remove from testIds since it's already deleted
    testIds = testIds.filter(testId => testId !== id);
  });
});