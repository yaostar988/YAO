import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  define: {
    // 1. 注入 API Key，如果没有则给空字符串防止报错
    'process.env.API_KEY': JSON.stringify(process.env.API_KEY || ''),
    // 2. 关键修复：伪造一个空的 process 对象，防止第三方库报错 "process is not defined"
    'process': {
      env: {
        NODE_ENV: 'production'
      }
    }
  },
});