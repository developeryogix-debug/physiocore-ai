import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
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
          'vendor-charts':   ['recharts'],
          'vendor-clinical': [
            '../clinical/src/index',
            '../agents/clinical/src/index',
          ],
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
});
