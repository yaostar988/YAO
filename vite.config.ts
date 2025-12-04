import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  define: {
    // 1. 确保 API Key 被正确注入
    'process.env.API_KEY': JSON.stringify(process.env.API_KEY || ''),
    
    // 2. 终极修复：完整模拟 process 对象
    // 很多 SDK 会检查 process.version 来判断环境，如果缺少这个属性就会报错
    'process': {
      env: {
        NODE_ENV: 'production',
        API_KEY: JSON.stringify(process.env.API_KEY || '')
      },
      version: '', // <--- 解决 "version" 报错的关键
      browser: true
    },

    // 3. 兼容某些使用了 global 变量的旧库
    'global': 'window',
  },
});