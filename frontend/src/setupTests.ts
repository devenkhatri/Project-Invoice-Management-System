// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';

// Mock axios to avoid ES module issues
jest.mock('axios', () => ({
  create: jest.fn(() => ({
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
    interceptors: {
      request: { use: jest.fn() },
      response: { use: jest.fn() },
    },
  })),
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  delete: jest.fn(),
  isAxiosError: jest.fn(),
}));

// Mock react-beautiful-dnd
jest.mock('react-beautiful-dnd', () => ({
  DragDropContext: ({ children }: any) => children,
  Droppable: ({ children }: any) => children({ innerRef: jest.fn(), droppableProps: {}, placeholder: null }, {}),
  Draggable: ({ children }: any) => children({ innerRef: jest.fn(), draggableProps: {}, dragHandleProps: {} }, {}),
}));

// Mock recharts
jest.mock('recharts', () => ({
  LineChart: jest.fn(({ children }) => children),
  Line: jest.fn(() => null),
  AreaChart: jest.fn(({ children }) => children),
  Area: jest.fn(() => null),
  BarChart: jest.fn(({ children }) => children),
  Bar: jest.fn(() => null),
  PieChart: jest.fn(({ children }) => children),
  Pie: jest.fn(() => null),
  Cell: jest.fn(() => null),
  XAxis: jest.fn(() => null),
  YAxis: jest.fn(() => null),
  CartesianGrid: jest.fn(() => null),
  Tooltip: jest.fn(() => null),
  Legend: jest.fn(() => null),
  ResponsiveContainer: jest.fn(({ children }) => children),
}));

// Mock window.URL methods
Object.defineProperty(window, 'URL', {
  value: {
    createObjectURL: jest.fn(() => 'mock-url'),
    revokeObjectURL: jest.fn(),
  },
});

// Mock window.alert
Object.defineProperty(window, 'alert', {
  value: jest.fn(),
});

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // deprecated
    removeListener: jest.fn(), // deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});