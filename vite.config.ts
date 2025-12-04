import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  define: {
    // Only inject the API Key. 
    // The 'process' object itself is now polyfilled in index.html for better stability.
    'process.env.API_KEY': JSON.stringify(process.env.API_KEY || ''),
    'global': 'window',
  },
});