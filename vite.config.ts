/// <reference types="vitest/config" />
import path from 'node:path';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { aidaBffPlugin } from './server/viteBffPlugin.js';

/**
 * Fail production builds if employee-auth bypass is enabled.
 */
function failClosedAuthPlugin(mode: string): Plugin {
  return {
    name: 'aida-fail-closed-employee-auth',
    configResolved() {
      if (mode !== 'production') return;
      const env = loadEnv(mode, process.cwd(), '');
      if (env.VITE_ALLOW_AUTH_BYPASS === 'true') {
        throw new Error(
          'FATAL: VITE_ALLOW_AUTH_BYPASS=true is not allowed for production builds. '
          + 'Employee authentication must fail closed.',
        );
      }
      if (env.VITE_UI_PREVIEW_MODE === 'true') {
        throw new Error(
          'FATAL: VITE_UI_PREVIEW_MODE=true is not allowed for production builds. '
          + 'UI preview fixtures must fail closed.',
        );
      }
    },
  };
}

export default defineConfig(({ mode }) => {
  const serverEnv = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react(), tailwindcss(), aidaBffPlugin(serverEnv), failClosedAuthPlugin(mode)],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, './src'),
      },
    },
    test: {
      environment: 'jsdom',
      setupFiles: './src/test/setup.ts',
      globals: true,
      exclude: ['**/node_modules/**', '**/e2e/**', '**/dist/**'],
    },
    server: {
      port: 5173,
    },
  };
});
