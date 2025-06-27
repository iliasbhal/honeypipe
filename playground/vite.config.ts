import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import packageJSON from './package.json'

export default defineConfig({
  root: './web',
  plugins: [
    react(),
  ],
  server: {
    port: 5173,
    cors: true,
    proxy: {
      '/api': {
        target: 'https://honeypipe.wasmer.app/',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
  build: {
    emptyOutDir: true,

    outDir: '../build',
    rollupOptions: {
      external: Object.keys(packageJSON.dependencies)
        .concat(Object.keys(packageJSON.devDependencies))
    }
  },
})
