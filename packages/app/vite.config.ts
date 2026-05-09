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
});
