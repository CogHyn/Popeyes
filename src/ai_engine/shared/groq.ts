import { config, requireConfigValue } from './config';
import { getErrorMessage, UpstreamError } from './errors';

interface GroqMessage {
  role: 'system' | 'user';
  content: string;
}

interface GroqChoice {
  message?: {
    content?: unknown;
  };
}

interface GroqCompletionResponse {
  choices?: GroqChoice[];
}

export interface GroqCompletionOptions {
  apiKey?: string;
  model?: string;
}

export async function completeWithGroq(
  systemPrompt: string,
  userPrompt: string,
  maxCompletionTokens: number,
  options: GroqCompletionOptions = {},
): Promise<string> {
  const apiKey = requireConfigValue(options.apiKey || config.groqApiKey, 'VITE_GROQ_API_KEY');
  const model = options.model?.trim() || config.groqModel;
  const messages: GroqMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        reasoning_effort: 'none',
        max_completion_tokens: maxCompletionTokens,
        messages,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await readErrorBody(response)}`);
    }

    const payload = (await response.json()) as GroqCompletionResponse;
    const content = payload.choices?.[0]?.message?.content;

    if (typeof content !== 'string' || !content.trim()) {
      throw new Error('Groq returned an empty completion');
    }

    return content.trim();
  } catch (error) {
    if (error instanceof UpstreamError) throw error;
    throw new UpstreamError('Groq', getErrorMessage(error));
  }
}

async function readErrorBody(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return 'Unable to read upstream error body';
  }
}
