import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Bridge ANTHROPIC_API_KEY → VITE_ANTHROPIC_KEY so either name in Vercel works.
  // Vite replaces these at build time; value embedded in client bundle (same as VITE_ passthrough).
  define: {
    'import.meta.env.VITE_ANTHROPIC_KEY': JSON.stringify(
      process.env['VITE_ANTHROPIC_KEY'] || process.env['ANTHROPIC_API_KEY'] || ''
    ),
  },
  resolve: {
    alias: {
      '@physiocore/types': new URL('../types/src/index.ts', import.meta.url).pathname,
      '@physiocore/supabase': new URL('../supabase/src/index.ts', import.meta.url).pathname,
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react':    ['react', 'react-dom', 'react-router-dom'],
          'vendor-supabase': ['@supabase/supabase-js'],
          'vendor-pdf':      ['@react-pdf/renderer'],
          'vendor-stripe':   ['@stripe/stripe-js'],
        },
      },
    },
    chunkSizeWarningLimit: 1600, // @react-pdf/renderer is inherently ~1.5MB; all other chunks <400KB
  },
});
