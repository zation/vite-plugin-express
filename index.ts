import { globby } from 'globby';
import express, {
  Handler,
} from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import type {
  Plugin,
  ViteDevServer,
  Connect,
} from 'vite';
import { resolve } from 'path';

export interface Options {
  middlewareFiles: string | string[]
  prefixUrl?: string
  defaultMiddlewares?: Handler[]
}

const startApp = async (server: ViteDevServer, options: Options) => {
  const newApp = express();
  const {
    middlewareFiles,
    prefixUrl = '/api',
    defaultMiddlewares,
  } = options;
  if (defaultMiddlewares) {
    defaultMiddlewares.forEach((middleware) => {
      newApp.use(prefixUrl, middleware);
    });
  } else {
    newApp.get(prefixUrl, cors() as Handler);
    newApp.use(prefixUrl, bodyParser.json());
    newApp.use(prefixUrl, (req, res, next) => {
      res.header('Cache-Control', 'private, no-cache, no-store, must-revalidate');
      res.header('Expires', '-1');
      res.header('Pragma', 'no-cache');
      next();
    });
  }

  const paths = await globby(middlewareFiles);
  await Promise.all(paths.map(async (path) => {
    newApp.use(prefixUrl, (await server.ssrLoadModule(resolve(process.cwd(), path))).default)
  }));

  return { newApp, newPaths: paths.map((path) => resolve(process.cwd(), path)) };
};

export default (options: Options): Plugin => {
  let app: Connect.NextHandleFunction = (req, res, next) => next();
  let paths: string[] = [];
  return {
    name: 'vite:middleware',
    apply: 'serve',
    configureServer: (server) => {
      server.middlewares.use((req, res, next) => app(req, res, next));
      return async () => {
        const { newApp, newPaths } = await startApp(server, options);
        app = newApp;
        paths = newPaths;
        server.watcher.on('change', async (path) => {
          if (paths.indexOf(path) >= 0) {
            const { newApp, newPaths } = await startApp(server, options);
            app = newApp;
            paths = newPaths;
          }
        });
      }
    },
  };
}
