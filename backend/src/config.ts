import dotenv from 'dotenv';
import { HttpError } from './errors.js';

dotenv.config();

function parsePort(value: string | undefined): number {
  if (!value) {
    return 3001;
  }

  const port = Number(value);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new HttpError(500, 'PORT must be an integer from 1 to 65535', 'CONFIG_INVALID');
  }

  return port;
}

export const config = {
  port: parsePort(process.env.PORT),
  corsOrigin: process.env.CORS_ORIGIN || '*',
  groqApiKey: process.env.GROQ_API_KEY,
  groqModel: process.env.GROQ_MODEL || 'qwen/qwen3-32b',
  tavilyApiKey: process.env.TAVILY_API_KEY,
};

export function requireConfigValue(value: string | undefined, key: string): string {
  if (!value?.trim()) {
    throw new HttpError(500, `${key} is not configured`, 'CONFIG_MISSING');
  }

  return value;
}
