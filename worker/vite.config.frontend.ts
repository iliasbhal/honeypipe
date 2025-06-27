import { defineConfig, PluginOption } from 'vite'
import react from '@vitejs/plugin-react-swc'
import packageJSON from './package.json'
import backendConfig from './vite.config.backend';

const backendPort = backendConfig.server?.port || 8080;
const reactPlugin = react() as PluginOption

export default defineConfig({
  root: './src/frontend',
  plugins: [
    reactPlugin,
  ],
  server: {
    port: 5173,
    cors: true,
    proxy: {
      '/api': {
        target: `http://localhost:${backendPort}`,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
  build: {
    emptyOutDir: true,

    outDir: '../../dist/static',
    rollupOptions: {
      external: Object.keys(packageJSON.dependencies)
        .concat(Object.keys(packageJSON.devDependencies))
    }
  },
})
