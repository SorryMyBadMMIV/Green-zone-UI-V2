import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  // Relative URLs in the build, so dist/ works at a site's root or in any folder (GitHub Pages, a
  // school or office server, the backend's static folder) without rebuilding.
  base: './',
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'jsdom',
    globals: true,
  },
});
