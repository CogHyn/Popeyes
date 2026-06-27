import { completeWithGroq, type GroqCompletionOptions } from '@/ai_engine/shared/groq';
import type { SearchQuery } from './search.interface';

const MAX_PLANNED_QUERY_LENGTH = 380;
const PLANNER_CONTEXT_LIMIT = 1800;

export async function planSearchQueryWithGroq(
  query: SearchQuery,
  options: GroqCompletionOptions = {},
): Promise<string> {
  const fallbackQuery = buildFallbackSearchQuery(query);

  try {
    const plannedQuery = await completeWithGroq(
      [
        'You create concise web search queries.',
        'Read the user question and highlighted context, then return only one search query.',
        `The query must be ${MAX_PLANNED_QUERY_LENGTH} characters or fewer.`,
        'Do not explain, do not use markdown, do not add labels.',
        'Prefer searchable keywords, entities, product names, error messages, dates, and intent.',
      ].join(' '),
      buildPlannerPrompt(query),
      100,
      options,
    );

    return sanitizeSearchQuery(plannedQuery) || fallbackQuery;
  } catch {
    return fallbackQuery;
  }
}

function buildPlannerPrompt(query: SearchQuery): string {
  return [
    `User question: ${query.query}`,
    '',
    'Highlighted context:',
    trimPlannerContext(query.selectedText),
    '',
    'Surrounding page/input context:',
    trimPlannerContext(query.context),
    '',
    'Return the best web search query only.',
  ].join('\n');
}

function buildFallbackSearchQuery(query: SearchQuery): string {
  const parts = [
    query.query,
    query.selectedText,
  ].flatMap((part) => {
    const normalized = normalizeSearchQuery(part ?? '');
    return normalized ? [normalized] : [];
  });

  return truncateSearchQuery(parts.join(' '));
}

function sanitizeSearchQuery(value: string): string {
  const firstMeaningfulLine = value
    .split('\n')
    .map((line) => line.replace(/^[-*"`'\s]+|[-*"`'\s]+$/g, '').trim())
    .find(Boolean);

  if (!firstMeaningfulLine) return '';

  return truncateSearchQuery(firstMeaningfulLine.replace(/^search query:\s*/i, ''));
}

function trimPlannerContext(value: string | undefined): string {
  const normalized = normalizeSearchQuery(value ?? '');
  if (!normalized) return '(none)';

  return normalized.length > PLANNER_CONTEXT_LIMIT
    ? normalized.slice(0, PLANNER_CONTEXT_LIMIT).trim()
    : normalized;
}

function truncateSearchQuery(value: string): string {
  const normalized = normalizeSearchQuery(value);

  return normalized.length > MAX_PLANNED_QUERY_LENGTH
    ? normalized.slice(0, MAX_PLANNED_QUERY_LENGTH).trim()
    : normalized;
}

function normalizeSearchQuery(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}
