import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Process env polyfill for browser
if (typeof (window as any).process === 'undefined') {
  (window as any).process = {
    env: {
      API_KEY: ''
    }
  };
}

// Circular JSON protection for dev wrapper / Firestore listeners
const makeCircularSafe = (val: any, seen = new WeakSet()): any => {
  if (val === null || typeof val !== 'object') return val;
  if (val instanceof Error) return val.message || String(val);
  if (typeof Event !== 'undefined' && val instanceof Event) return `[Event: ${val.type}]`;
  if (seen.has(val)) return '[Circular]';
  seen.add(val);
  if (Array.isArray(val)) {
    return val.map(item => makeCircularSafe(item, seen));
  }
  const result: Record<string, any> = {};
  for (const key of Object.keys(val)) {
    try {
      result[key] = makeCircularSafe(val[key], seen);
    } catch {
      result[key] = '[Unserializable]';
    }
  }
  return result;
};

const sanitizeArgs = (args: any[]) => {
  return args.map(arg => {
    try {
      if (typeof arg === 'object' && arg !== null) {
        return makeCircularSafe(arg);
      }
      return arg;
    } catch {
      return String(arg);
    }
  });
};

const origError = console.error;
console.error = function (...args: any[]) {
  origError.apply(console, sanitizeArgs(args));
};

const origWarn = console.warn;
console.warn = function (...args: any[]) {
  origWarn.apply(console, sanitizeArgs(args));
};

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
