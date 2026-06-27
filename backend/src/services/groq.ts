import Groq from 'groq-sdk';
import { config, requireConfigValue } from '../config.js';
import type {
  SummaryQuery,
  SummaryResponse,
  TranslateQuery,
  TranslateResponse,
} from '../contracts.js';
import { getErrorMessage, UpstreamError } from '../errors.js';

let groqClient: Groq | undefined;

function getGroqClient(): Groq {
  if (!groqClient) {
    groqClient = new Groq({
      apiKey: requireConfigValue(config.groqApiKey, 'GROQ_API_KEY'),
    });
  }

  return groqClient;
}

async function completeWithGroq(
  systemPrompt: string,
  userPrompt: string,
  maxCompletionTokens: number,
): Promise<string> {
  const client = getGroqClient();

  try {
    const completion = await client.chat.completions.create({
      model: config.groqModel,
      temperature: 0.2,
      reasoning_effort: 'none',
      max_completion_tokens: maxCompletionTokens,
      messages: [
        { role: 'system' as const, content: systemPrompt },
        { role: 'user' as const, content: userPrompt },
      ],
    });

    const content = completion.choices[0]?.message?.content?.trim();
    if (!content) {
      throw new Error('Groq returned an empty completion');
    }

    return content;
  } catch (error) {
    throw new UpstreamError('Groq', getErrorMessage(error));
  }
}

export async function summarizeWithGroq(query: SummaryQuery): Promise<SummaryResponse> {
  const summaryText = await completeWithGroq(
    'You summarize text for Vietnamese users. Return only the summary, without prefacing or explaining your answer.',
    `Summarize the following content in Vietnamese, preserving the key ideas and important details:\n\n${query.content}`,
    500,
  );

  return { summaryText };
}

export async function translateWithGroq(query: TranslateQuery): Promise<TranslateResponse> {
  const sourceLanguage = query.sourceLanguage || 'auto-detect';
  const translatedText = await completeWithGroq(
    'You are a precise translation engine. Return only the translated text.',
    [
      `Source language: ${sourceLanguage}`,
      `Target language: ${query.targetLanguage}`,
      '',
      'Translate this text while preserving meaning, tone, formatting, and proper nouns:',
      query.text,
    ].join('\n'),
    500,
  );

  return { translatedText };
}
