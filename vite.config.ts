import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

import packageJSON from './package.json'

// // @ts-expect-error aaaa
// console.log('process.env.NODE_ENV', process.env.NODE_ENV);

// // @ts-expect-error aaaa
// const isDev = process.env.NODE_ENV === 'development';


// https://vitejs.dev/config/
export default defineConfig({
  root: './playground',
  plugins: [
    react(),
    // externalize({
    //   externals: [
    //     "react", // Externalize "react", and all of its subexports (react/*), such as react/jsx-runtime
    //     /^external-.*/, // Externalize all modules starting with "external-"
    //     (moduleName) => moduleName.includes("external"), // Externalize all modules containing "external",
    //   ],
    // }),
  ],
  build: {
    emptyOutDir: true,

    outDir: '../build',
    rollupOptions: {
      external: Object.keys(packageJSON.dependencies)
        .concat(Object.keys(packageJSON.devDependencies))
    }
  },
})
