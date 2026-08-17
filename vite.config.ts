/// <reference types="vitest/config" />
import path from 'node:path';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { aidaBffPlugin } from './server/viteBffPlugin.js';

const AIDA_PUBLIC_SERVER_DEFAULTS = {
  AIDA_SUPABASE_URL: 'https://eswovqxqzfevcdwwcmuh.supabase.co',
  AIDA_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_7WXAYCzC5ed6AdHTmskD6w_lapuztIT',
};

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
  // The URL and publishable key are public Supabase client configuration. Keep
  // safe AIDA defaults so a missing/blank local .env cannot make the same-origin
  // BFF unavailable. Non-empty explicit environment values still override the
  // defaults. Secret/service-role keys remain prohibited.
  const loadedEnv = loadEnv(mode, process.cwd(), '');
  const serverEnv = {
    ...loadedEnv,
    AIDA_SUPABASE_URL:
      loadedEnv.AIDA_SUPABASE_URL?.trim() || AIDA_PUBLIC_SERVER_DEFAULTS.AIDA_SUPABASE_URL,
    AIDA_SUPABASE_PUBLISHABLE_KEY:
      loadedEnv.AIDA_SUPABASE_PUBLISHABLE_KEY?.trim()
      || AIDA_PUBLIC_SERVER_DEFAULTS.AIDA_SUPABASE_PUBLISHABLE_KEY,
  };
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
