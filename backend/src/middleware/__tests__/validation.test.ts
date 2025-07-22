import { Request, Response, NextFunction } from 'express';
import { handleValidationErrors, sanitizeHtml, sanitizeInput, validateSchema, schemas } from '../validation';
import { validationResult } from 'express-validator';

// Mock express-validator
jest.mock('express-validator', () => ({
  validationResult: jest.fn(),
  body: jest.fn(),
  param: jest.fn(),
  query: jest.fn()
}));

const mockedValidationResult = validationResult as jest.MockedFunction<typeof validationResult>;

describe('Validation Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockRequest = {
      body: {},
      params: {},
      query: {}
    };
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
    mockNext = jest.fn();
    jest.clearAllMocks();
  });

  describe('handleValidationErrors', () => {
    it('should call next if no validation errors', () => {
      mockedValidationResult.mockReturnValue({
        isEmpty: () => true,
        array: () => []
      } as any);

      handleValidationErrors(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should return 400 if validation errors exist', () => {
      const errors = [
        { field: 'email', msg: 'Invalid email' },
        { field: 'password', msg: 'Password too short' }
      ];

      mockedValidationResult.mockReturnValue({
        isEmpty: () => false,
        array: () => errors
      } as any);

      handleValidationErrors(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: errors
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('sanitizeHtml', () => {
    it('should remove HTML tags', () => {
      const input = '<script>alert("xss")</script>Hello World';
      const result = sanitizeHtml(input);
      expect(result).toBe('alert(&quot;xss&quot;)Hello World');
    });

    it('should escape dangerous characters', () => {
      const input = 'Hello <>&"\' World';
      const result = sanitizeHtml(input);
      expect(result).toBe('Hello &lt;&gt;&amp;&quot;&#x27; World');
    });

    it('should handle empty string', () => {
      const result = sanitizeHtml('');
      expect(result).toBe('');
    });

    it('should handle normal text', () => {
      const input = 'Hello World';
      const result = sanitizeHtml(input);
      expect(result).toBe('Hello World');
    });
  });

  describe('sanitizeInput', () => {
    it('should sanitize string values in request body', () => {
      mockRequest.body = {
        name: '<script>alert("xss")</script>John',
        email: 'test@example.com',
        description: 'Hello <b>World</b>'
      };

      sanitizeInput(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockRequest.body).toEqual({
        name: 'alert(&quot;xss&quot;)John',
        email: 'test@example.com',
        description: 'Hello World'
      });
      expect(mockNext).toHaveBeenCalled();
    });

    it('should sanitize nested objects', () => {
      mockRequest.body = {
        user: {
          name: '<script>alert("xss")</script>John',
          profile: {
            bio: 'Hello <b>World</b>'
          }
        }
      };

      sanitizeInput(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockRequest.body).toEqual({
        user: {
          name: 'alert(&quot;xss&quot;)John',
          profile: {
            bio: 'Hello World'
          }
        }
      });
      expect(mockNext).toHaveBeenCalled();
    });

    it('should sanitize arrays', () => {
      mockRequest.body = {
        items: [
          '<script>alert("xss")</script>Item 1',
          'Item 2',
          { name: '<b>Item 3</b>' }
        ]
      };

      sanitizeInput(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockRequest.body).toEqual({
        items: [
          'alert(&quot;xss&quot;)Item 1',
          'Item 2',
          { name: 'Item 3' }
        ]
      });
      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle non-string values', () => {
      mockRequest.body = {
        name: 'John',
        age: 25,
        active: true,
        data: null,
        items: []
      };

      sanitizeInput(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockRequest.body).toEqual({
        name: 'John',
        age: 25,
        active: true,
        data: null,
        items: []
      });
      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle empty body', () => {
      mockRequest.body = undefined;

      sanitizeInput(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('validateSchema', () => {
    it('should validate and pass valid data', () => {
      const validData = {
        email: 'test@example.com',
        password: 'TestPassword123!',
        name: 'John Doe'
      };

      mockRequest.body = validData;

      const middleware = validateSchema(schemas.register);
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should return 400 for invalid data', () => {
      const invalidData = {
        email: 'invalid-email',
        password: '123', // Too short
        name: '' // Empty name
      };

      mockRequest.body = invalidData;

      const middleware = validateSchema(schemas.register);
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: expect.arrayContaining([
          expect.objectContaining({
            field: expect.any(String),
            message: expect.any(String),
            code: expect.any(String)
          })
        ])
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('schemas', () => {
    describe('register schema', () => {
      it('should validate correct registration data', () => {
        const validData = {
          email: 'test@example.com',
          password: 'TestPassword123!',
          name: 'John Doe',
          role: 'client'
        };

        const result = schemas.register.safeParse(validData);
        expect(result.success).toBe(true);
      });

      it('should reject invalid email', () => {
        const invalidData = {
          email: 'invalid-email',
          password: 'TestPassword123!',
          name: 'John Doe'
        };

        const result = schemas.register.safeParse(invalidData);
        expect(result.success).toBe(false);
      });

      it('should reject weak password', () => {
        const invalidData = {
          email: 'test@example.com',
          password: 'weak',
          name: 'John Doe'
        };

        const result = schemas.register.safeParse(invalidData);
        expect(result.success).toBe(false);
      });

      it('should reject short name', () => {
        const invalidData = {
          email: 'test@example.com',
          password: 'TestPassword123!',
          name: 'J'
        };

        const result = schemas.register.safeParse(invalidData);
        expect(result.success).toBe(false);
      });
    });

    describe('login schema', () => {
      it('should validate correct login data', () => {
        const validData = {
          email: 'test@example.com',
          password: 'password123'
        };

        const result = schemas.login.safeParse(validData);
        expect(result.success).toBe(true);
      });

      it('should reject invalid email', () => {
        const invalidData = {
          email: 'invalid-email',
          password: 'password123'
        };

        const result = schemas.login.safeParse(invalidData);
        expect(result.success).toBe(false);
      });

      it('should reject empty password', () => {
        const invalidData = {
          email: 'test@example.com',
          password: ''
        };

        const result = schemas.login.safeParse(invalidData);
        expect(result.success).toBe(false);
      });
    });

    describe('project schema', () => {
      it('should validate correct project data', () => {
        const validData = {
          name: 'Test Project',
          clientId: 'client123',
          description: 'A test project',
          budget: 1000,
          status: 'active'
        };

        const result = schemas.project.safeParse(validData);
        expect(result.success).toBe(true);
      });

      it('should reject empty name', () => {
        const invalidData = {
          name: '',
          clientId: 'client123'
        };

        const result = schemas.project.safeParse(invalidData);
        expect(result.success).toBe(false);
      });

      it('should reject negative budget', () => {
        const invalidData = {
          name: 'Test Project',
          clientId: 'client123',
          budget: -100
        };

        const result = schemas.project.safeParse(invalidData);
        expect(result.success).toBe(false);
      });
    });

    describe('client schema', () => {
      it('should validate correct client data', () => {
        const validData = {
          name: 'Test Client',
          email: 'client@example.com',
          phone: '+1234567890',
          gstin: '22AAAAA0000A1Z5'
        };

        const result = schemas.client.safeParse(validData);
        expect(result.success).toBe(true);
      });

      it('should reject invalid GSTIN format', () => {
        const invalidData = {
          name: 'Test Client',
          email: 'client@example.com',
          gstin: 'invalid-gstin'
        };

        const result = schemas.client.safeParse(invalidData);
        expect(result.success).toBe(false);
      });
    });

    describe('invoice schema', () => {
      it('should validate correct invoice data', () => {
        const validData = {
          clientId: 'client123',
          projectId: 'project123',
          amount: 1000,
          taxAmount: 180,
          items: [
            {
              description: 'Service 1',
              quantity: 1,
              rate: 1000,
              amount: 1000
            }
          ]
        };

        const result = schemas.invoice.safeParse(validData);
        expect(result.success).toBe(true);
      });

      it('should reject negative amount', () => {
        const invalidData = {
          clientId: 'client123',
          amount: -100
        };

        const result = schemas.invoice.safeParse(invalidData);
        expect(result.success).toBe(false);
      });
    });
  });
});