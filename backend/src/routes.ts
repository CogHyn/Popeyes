import type { NextFunction, Request, Response } from 'express';
import { Router } from 'express';
import { ZodError } from 'zod';
import { HttpError } from './errors.js';
import { summarizeWithGroq, translateWithGroq } from './services/groq.js';
import { searchWithTavily } from './services/tavily.js';
import {
  searchQuerySchema,
  summaryQuerySchema,
  translateQuerySchema,
} from './validation.js';

type AsyncRoute = (req: Request, res: Response, next: NextFunction) => Promise<void>;

function asyncRoute(handler: AsyncRoute) {
  return (req: Request, res: Response, next: NextFunction): void => {
    handler(req, res, next).catch(next);
  };
}

export const apiRouter = Router();

apiRouter.post('/api/search', asyncRoute(async (req, res) => {
  const query = searchQuerySchema.parse(req.body);
  res.json(await searchWithTavily(query));
}));

apiRouter.post('/api/summary', asyncRoute(async (req, res) => {
  const query = summaryQuerySchema.parse(req.body);
  res.json(await summarizeWithGroq(query));
}));

apiRouter.post('/api/translate', asyncRoute(async (req, res) => {
  const query = translateQuerySchema.parse(req.body);
  res.json(await translateWithGroq(query));
}));

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: `No route for ${req.method} ${req.path}`,
    },
  });
}

export function errorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (error instanceof ZodError) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request body does not match the expected schema',
        details: error.issues,
      },
    });
    return;
  }

  if (error instanceof HttpError) {
    res.status(error.statusCode).json({
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
      },
    });
    return;
  }

  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Unexpected server error',
    },
  });
}
