import cors from 'cors';
import express from 'express';
import { config } from './config.js';
import { apiRouter, errorHandler, notFoundHandler } from './routes.js';

export function createApp() {
  const app = express();

  app.use(cors({ origin: config.corsOrigin === '*' ? true : config.corsOrigin }));
  app.use(express.json({ limit: '1mb' }));
  app.use(apiRouter);
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

const app = createApp();

app.listen(config.port, () => {
  console.log(`Popeyes backend listening on port ${config.port}`);
});
