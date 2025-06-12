import type { Plugin, ViteDevServer } from 'vite'
import type { Express } from 'express'

interface ApiPluginOptions {
  prefix?: string;
  app: Express;
}

export function apiPlugin(options: ApiPluginOptions): Plugin {
  const apiPrefix = options.prefix || '/api';

  return {
    name: 'api-server',
    configureServer(server: ViteDevServer) {
      server.middlewares.use((req, res, next) => {
        console.log('req.url', req.url);
        if (req.url?.startsWith(apiPrefix)) {
          return options.app(req, res, next);
        }
        return next();
      });
    }
  }
}