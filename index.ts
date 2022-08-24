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

const arePathsDifferent = (target: string[], source: string[]) => {
  if (target.length !== source.length) {
    return true;
  }
  if (target.length === 0) {
    return false;
  }
  return !target.every((path) => source.indexOf(path) >= 0);
}

const startApp = async (server: ViteDevServer, options: Options) => {
  const app = express();
  const {
    middlewareFiles,
    prefixUrl = '/api',
    defaultMiddlewares,
  } = options;
  if (defaultMiddlewares) {
    defaultMiddlewares.forEach((middleware) => {
      app.use(prefixUrl, middleware);
    });
  } else {
    app.get(prefixUrl, cors() as Handler);
    app.use(prefixUrl, bodyParser.json());
    app.use(prefixUrl, (req, res, next) => {
      res.header('Cache-Control', 'private, no-cache, no-store, must-revalidate');
      res.header('Expires', '-1');
      res.header('Pragma', 'no-cache');
      next();
    });
  }

  const paths = (await globby(middlewareFiles)).map((path) => resolve(process.cwd(), path));
  await Promise.all(paths.map(async (path) => {
    app.use(prefixUrl, (await server.ssrLoadModule(path)).default)
  }));

  return { newApp: app, newPaths: paths };
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
        server.watcher.on('all', async (eventName, path) => {
          if (eventName === 'add') {
            const { newApp, newPaths } = await startApp(server, options);
            if (arePathsDifferent(paths, newPaths)) {
              app = newApp;
              paths = newPaths;
            }
          }
          if (eventName === 'change' && paths.indexOf(path) >= 0) {
            const { newApp } = await startApp(server, options);
            app = newApp;
          }
        });
      }
    },
  };
}
