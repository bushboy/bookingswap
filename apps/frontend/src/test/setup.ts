import '@testing-library/jest-dom';
import { expect, vi } from 'vitest';
import { customMatchers } from './testUtils.tsx';

// Extend Vitest matchers
expect.extend(customMatchers);

// Add global CSS animation disable for tests
const style = document.createElement('style');
style.innerHTML = `
  *, *::before, *::after {
    animation-duration: 0s !important;
    animation-delay: 0s !important;
    transition-duration: 0s !important;
    transition-delay: 0s !important;
  }
`;
document.head.appendChild(style);

// Mock global objects
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Mock sessionStorage
const sessionStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
Object.defineProperty(window, 'sessionStorage', {
  value: sessionStorageMock,
});

// Mock URL.createObjectURL
Object.defineProperty(URL, 'createObjectURL', {
  writable: true,
  value: vi.fn(() => 'mocked-url'),
});

Object.defineProperty(URL, 'revokeObjectURL', {
  writable: true,
  value: vi.fn(),
});

// Mock File and FileReader
global.File = class MockFile {
  name: string;
  type: string;
  size: number;

  constructor(parts: any[], filename: string, properties?: any) {
    this.name = filename;
    this.type = properties?.type || '';
    this.size = parts.reduce((acc, part) => acc + (part.length || 0), 0);
  }
} as any;

global.FileReader = class MockFileReader {
  result: string | ArrayBuffer | null = null;
  error: any = null;
  readyState: number = 0;
  onload: ((event: any) => void) | null = null;
  onerror: ((event: any) => void) | null = null;

  readAsDataURL(file: File) {
    this.readyState = 2;
    this.result = `data:${file.type};base64,mock-base64-data`;
    if (this.onload) {
      this.onload({ target: this });
    }
  }

  readAsText(file: File) {
    this.readyState = 2;
    this.result = 'mock file content';
    if (this.onload) {
      this.onload({ target: this });
    }
  }
} as any;

// Mock crypto for UUID generation
Object.defineProperty(global, 'crypto', {
  value: {
    randomUUID: () => 'mock-uuid-' + Math.random().toString(36).substr(2, 9),
    getRandomValues: (arr: any) => {
      for (let i = 0; i < arr.length; i++) {
        arr[i] = Math.floor(Math.random() * 256);
      }
      return arr;
    },
  },
});

// Mock performance.now for consistent timing in tests
Object.defineProperty(global.performance, 'now', {
  writable: true,
  value: vi.fn(() => Date.now()),
});

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  warn: vi.fn(),
  error: vi.fn(),
  log: vi.fn(),
  info: vi.fn(),
  debug: vi.fn(),
};

// Setup cleanup after each test
afterEach(() => {
  vi.clearAllMocks();
  vi.clearAllTimers();

  // Clear localStorage and sessionStorage
  localStorageMock.clear();
  sessionStorageMock.clear();

  // Reset DOM
  document.body.innerHTML = '';
  document.head.innerHTML = '';
  document.head.appendChild(style);
});

// Global test timeout
vi.setConfig({ testTimeout: 10000 });
