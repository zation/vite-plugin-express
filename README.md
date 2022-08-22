# Vite Plugin Express

> A [vite](https://vitejs.dev/) plugin to allow you to integrate your express server into vite dev server.

## Features

- Automatically load all your server codes by glob.
- Isolate hot reload without reload vite dev server.
- Compatible with the `resolve` and other configs in vite.

## Get started

1. Install vite and this plugin with your favorite package manager, here use npm as example:

   ```bash
   npm install vite vite-plugin-express -D
   ```
2. Create a `vite.config.ts` file in your project root to config vite to actually use this plugin:

   ```ts
   import { defineConfig } from 'vite';
   import express from 'vite-plugin-express';

   export default defineConfig({
     plugins: [
       react(),
       express({
         // the server files export a middleware as default
         // this config can be a glob
         middlewareFiles: './server',
       }),
     ],
     resolve: {
       alias: {
         // you can use this alias in your server code as well
         '@': './src',
       },
     },
   });
   ```
3. Export a middleware as default in your every server files.
    ```ts
    // /server/account.ts
    import { faker } from '@faker-js/faker';
    import express, { Request, Router } from 'express';
    import {
      Gender,
    } from '@/constants/gender';
    
    const router = Router();
    
    const { name } = faker;
    
    router.get('/api/account', (request, response) => {
      response.status(200).send({
        name: `${name.firstName()} ${name.lastName()}`,
        gender: Gender.Male,
      });
    });
    
    export default router;
    ```

## API

- middlewareFiles: use [globby](https://github.com/sindresorhus/globby) as the file loader, for example:
  * `src/**/*.js` — matches all files in the `src` directory (any level of nesting) that have the `.js` extension.
  * `src/*.??` — matches all files in the `src` directory (only first level of nesting) that have a two-character extension.
  * `file-[01].js` — matches files: `file-0.js`, `file-1.js`.
- defaultMiddlewares: replace the default middlewares with yours. The default middlewares are:
  ```ts
  import cors from 'cors';
  import bodyParser from 'body-parser';
  
  app.use(cors());
  app.use(bodyParser.json());
  app.use((req, res, next) => {
    res.header('Cache-Control', 'private, no-cache, no-store, must-revalidate');
    res.header('Expires', '-1');
    res.header('Pragma', 'no-cache');
    next();
  });
  ```
