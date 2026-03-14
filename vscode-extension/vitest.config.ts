import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    // Exclude any test file that imports 'vscode' (requires VS Code extension host)
    exclude: ['**/node_modules/**'],
    environment: 'node',
  },
});
