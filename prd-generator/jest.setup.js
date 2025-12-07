import '@testing-library/jest-dom'
import 'fake-indexeddb/auto'
import { TextEncoder, TextDecoder } from 'util'
import { ReadableStream } from 'stream/web'

// Polyfill TextEncoder/TextDecoder for Node.js
global.TextEncoder = TextEncoder
global.TextDecoder = TextDecoder

// Polyfill ReadableStream for Node.js
if (typeof global.ReadableStream === 'undefined') {
  global.ReadableStream = ReadableStream
}

// Polyfill structuredClone for Node.js < 17
if (typeof global.structuredClone === 'undefined') {
  global.structuredClone = (val) => JSON.parse(JSON.stringify(val))
}

// Mock window.matchMedia (only in jsdom environment)
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  })
}

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  takeRecords() {
    return []
  }
  unobserve() {}
}

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
}

// Mock URL.createObjectURL and URL.revokeObjectURL for file-saver
if (typeof window !== 'undefined' && typeof URL !== 'undefined') {
  URL.createObjectURL = jest.fn(() => 'blob:mock-url');
  URL.revokeObjectURL = jest.fn();
}

// Polyfill Blob.prototype.text for jsdom
if (typeof Blob !== 'undefined' && !Blob.prototype.text) {
  Blob.prototype.text = function() {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsText(this);
    });
  };
}

// Suppress console errors in tests (optional)
const originalError = console.error
beforeAll(() => {
  console.error = (...args) => {
    if (
      typeof args[0] === 'string' &&
      (args[0].includes('Warning: ReactDOM.render') ||
        args[0].includes('Not implemented: HTMLFormElement'))
    ) {
      return
    }
    originalError.call(console, ...args)
  }
})

afterAll(() => {
  console.error = originalError
})
