import { globby } from 'globby';
import express, { Express } from 'express';
import chokidar from 'chokidar';
import cors from 'cors';
import bodyParser from 'body-parser';

import type {
  Plugin,
  AliasOptions,
} from 'vite'
import moduleAlias from 'module-alias';

export interface Options {
  middlewareFiles: string | string[]
  alias?: Record<string, string>
  expressOptions
}

const startApp = async (app: Express, middlewareFiles: string | string[]) => {
  app.use(cors());
  app.use(bodyParser.json());
  app.use((req, res, next) => {
    res.header('Cache-Control', 'private, no-cache, no-store, must-revalidate');
    res.header('Expires', '-1');
    res.header('Pragma', 'no-cache');
    next();
  });

  const paths = await globby(middlewareFiles);
  paths.forEach((path) => {
    app.use(require(path).default);
  });

  return app;
};

const addAlias = (alias: Record<string, string> | AliasOptions) => {
  Object.keys(alias).forEach((key) => {
    moduleAlias.addAlias(key, alias[key]);
  });
}

export default ({ middlewareFiles, alias }: Options): Plugin => {
  const app = express();
  if (alias) {
    addAlias(alias);
  }
  return {
    name: 'vite:middleware',
    config: async (config) => {
      const { resolve: { alias: viteAlias } } = config;
      if (viteAlias && !alias) {
        addAlias(viteAlias);
      }
      await startApp(app, middlewareFiles);
      chokidar.watch(middlewareFiles).on('change', (path) => {
        app.use(require(path).default);
      });
    },
    configureServer: (server) => {
      server.middlewares.use(app);
    },
  };
}
