import { globby } from 'globby';
import express, {
  Express,
  Handler,
} from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import type {
  Plugin,
  ViteDevServer,
} from 'vite';
import { resolve } from 'path';

export interface Options {
  middlewareFiles: string | string[]
  defaultMiddlewares?: Handler[]
}

interface Middlewares {
  [path: string]: Handler
}

const startApp = async (app: Express, middlewareFiles: string | string[], server: ViteDevServer, defaultMiddlewares?: Handler[]) => {
  let middlewares: Middlewares = {};
  if (defaultMiddlewares) {
    defaultMiddlewares.forEach((middleware) => {
      app.use(middleware);
    });
  } else {
    app.use(cors());
    app.use(bodyParser.json());
    app.use((req, res, next) => {
      res.header('Cache-Control', 'private, no-cache, no-store, must-revalidate');
      res.header('Expires', '-1');
      res.header('Pragma', 'no-cache');
      next();
    });
  }

  const paths = await globby(middlewareFiles);
  await Promise.all(paths.map(async (path) => {
    const fullPath = resolve(process.cwd(), path);
    middlewares[fullPath] = (await server.ssrLoadModule(fullPath)).default;
    server.watcher.add(resolve(process.cwd(), path));
  }));
  app.use((req, res, next) => {
    Object.values(middlewares).forEach((middleware) => middleware(req, res, next));
  });
  server.watcher.on('change', async (path) => {
    if (middlewares[path]) {
      middlewares[path] = (await server.ssrLoadModule(resolve(process.cwd(), path))).default;
    }
  });

  return app;
};

export default ({ middlewareFiles, defaultMiddlewares }: Options): Plugin => {
  const app = express();
  return {
    name: 'vite:middleware',
    apply: 'serve',
    configureServer: (server) => {
      server.middlewares.use(app);
      return async () => {
        await startApp(app, middlewareFiles, server, defaultMiddlewares);
      }
    },
  };
}
