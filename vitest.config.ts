import path from 'path';
import { defineConfig } from 'vitest/config';

// 獨立於 vite.config.ts，避免動到 dev server 設定。
// 只需 `@` alias（與 vite.config 一致，指向專案根）即可解析 @/python/sleep_config.json。
export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
