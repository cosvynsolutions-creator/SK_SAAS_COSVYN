import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: [
      'test/persistence-and-integrity.test.ts', 
      'test/delivery-app.test.ts', 
      'test/manager-app.test.ts',
      'test/admin-app.test.ts'
    ],
    testTimeout: 20000,
    hookTimeout: 20000
  }
});
