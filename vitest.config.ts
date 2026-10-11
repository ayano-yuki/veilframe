import { fileURLToPath } from 'node:url';
import { defineVitestConfig } from '@nuxt/test-utils/config';

export default defineVitestConfig({
  resolve: {
    alias: { '@fsd': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'nuxt',
    include: ['src/**/*.test.ts', 'server/**/*.test.ts', 'app/**/*.test.ts'],
    setupFiles: ['./tests/support/setup.ts'],
    environmentOptions: { nuxt: { domEnvironment: 'happy-dom' } },
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,vue}', 'server/**/*.ts', 'app/**/*.vue'],
      exclude: ['**/*.test.ts', '**/*.d.ts'],
      reporter: ['text', 'html', 'json-summary', 'json'],
      thresholds: {
        statements: 100,
        branches: 100,
        functions: 100,
        lines: 100,
      },
    },
  },
});
