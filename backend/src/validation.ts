import { z } from 'zod';

export const searchQuerySchema = z.object({
  query: z.string().trim().min(1),
}).strict();

export const summaryQuerySchema = z.object({
  content: z.string().trim().min(1),
}).strict();

export const translateQuerySchema = z.object({
  text: z.string().trim().min(1),
  sourceLanguage: z.string().trim().min(1).optional(),
  targetLanguage: z.string().trim().min(1),
}).strict();
