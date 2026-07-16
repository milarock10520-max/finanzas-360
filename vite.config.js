import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig({
  base: './',
  plugins: [react(), cloudflare()],
  css: {
    postcss: './postcss.config.cjs',
  },
})