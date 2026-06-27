import { TavilySearchEngine } from '@/ai_engine/search/search.tavily';
import { planSearchQueryWithGroq } from '@/ai_engine/search/search.groq';
import { MockSearchEngine } from '@/ai_engine/search/search.mock';
import { completeWithGroq, type GroqCompletionOptions } from '@/ai_engine/shared/groq';
import { GroqSummaryEngine } from '@/ai_engine/summary/summary.groq';
import { MockSummaryEngine } from '@/ai_engine/summary/summary.mock';
import { GroqTranslateEngine } from '@/ai_engine/translate/translate.groq';
import { MockTranslateEngine } from '@/ai_engine/translate/translate.mock';
import { getErrorMessage } from '@/ai_engine/shared/errors';
import { getDashboardSettings, type AnswerStyle, type DashboardSettings } from '@/dashboard/settings';
import type { SearchResult } from '@/ai_engine/search/search.interface';
import type { ActionId, StreamMessage, StreamRequest } from '@/types';

const VIETNAMESE_RE = /[ăâđêôơưáàảãạấầẩẫậắằẳẵặéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ]/i;
const SUMMARY_LENGTH_THRESHOLD = 1000;
const CONTEXT_MENU_ID = 'selection-assist-open';

const DEFAULT_SEARCH_ANSWER_PROMPT = [
  'You answer search questions for Vietnamese users.',
  'Return only the direct answer, with no preface, no labels, and no markdown heading.',
  'Prioritize the highlighted context over web results.',
  'Use web results only as supporting context.',
  'If the available information is insufficient, say that briefly.',
].join(' ');

export default defineBackground(() => {
  void ensureContextMenu();

  browser.runtime.onMessage.addListener((message) => {
    if (message?.type !== 'CLASSIFY_INTENT') return;

    const text = String(message.text ?? '');
    return Promise.resolve({
      recommendedAction: classifyIntent(text),
    });
  });

  browser.runtime.onConnect.addListener((port) => {
    if (port.name !== 'ai-stream') return;

    let cancelled = false;
    port.onDisconnect.addListener(() => {
      cancelled = true;
    });

    port.onMessage.addListener((request: StreamRequest) => {
      void streamDraftResponse(port, request, () => cancelled);
    });
  });

  browser.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId !== CONTEXT_MENU_ID || tab?.id === undefined) return;

    void browser.tabs.sendMessage(tab.id, {
      type: 'OPEN_SELECTION_ASSIST',
    });
  });
});

async function ensureContextMenu(): Promise<void> {
  try {
    await browser.contextMenus.update(CONTEXT_MENU_ID, {
      title: 'Open AI Assistant',
      contexts: ['selection'],
    });
  } catch {
    await browser.contextMenus.create({
      id: CONTEXT_MENU_ID,
      title: 'Open AI Assistant',
      contexts: ['selection'],
    });
  }
}

function classifyIntent(text: string): ActionId {
  if (VIETNAMESE_RE.test(text) || text.length >= SUMMARY_LENGTH_THRESHOLD) {
    return 'summary';
  }

  return 'translate';
}

async function streamDraftResponse(
  port: Browser.runtime.Port,
  request: StreamRequest,
  isCancelled: () => boolean,
): Promise<void> {
  try {
    const response = await buildAiResponse(request);

    if (response.replacementText) {
      postStreamMessage(port, { type: 'replacement', text: response.replacementText });
    }

    for (const chunk of chunkText(response.displayText, 18)) {
      if (isCancelled()) return;
      postStreamMessage(port, { type: 'chunk', chunk });
      await delay(28);
    }

    if (!isCancelled()) {
      postStreamMessage(port, { type: 'done' });
    }
  } catch (error) {
    if (!isCancelled()) {
      postStreamMessage(port, {
        type: 'error',
        message: `Không thể tạo phản hồi lúc này: ${getErrorMessage(error)}`,
      });
    }
  }
}

async function buildAiResponse(request: StreamRequest): Promise<{ displayText: string; replacementText?: string }> {
  const settings = await getDashboardSettings();
  const groqOptions = getGroqOptions(settings);
  const selectedText = request.selectedText.trim();
  const context = settings.behavior.includeSelectionContext ? request.context : undefined;

  if (request.mode === 'translate') {
    const translateEngine = settings.provider.llmProvider === 'mock'
      ? new MockTranslateEngine()
      : new GroqTranslateEngine({
        ...groqOptions,
        translatePrompt: settings.prompts.translatePrompt,
      });
    const response = await translateEngine.translate({
      text: selectedText,
      targetLanguage: 'vi',
    });

    return {
      displayText: response.translatedText,
      replacementText: response.translatedText,
    };
  }

  if (request.mode === 'summary') {
    const summaryEngine = settings.provider.llmProvider === 'mock'
      ? new MockSummaryEngine()
      : new GroqSummaryEngine({
        ...groqOptions,
        summaryPrompt: settings.prompts.summaryPrompt,
        summaryLength: settings.behavior.summaryLength,
        answerStyle: settings.behavior.answerStyle,
      });
    const response = await summaryEngine.summarize({
      content: selectedText,
    });

    return {
      displayText: response.summaryText,
    };
  }

  const query = request.query?.trim() || selectedText;
  if (settings.provider.llmProvider === 'mock') {
    return {
      displayText: buildMockSearchAnswer(query, selectedText, context, settings),
    };
  }

  const shouldUseWebSearch = settings.behavior.enableWebSearch && settings.provider.searchProvider !== 'disabled';
  const plannedSearchQuery = shouldUseWebSearch
    ? await planSearchQueryWithGroq({
      query,
      selectedText,
      context,
    }, groqOptions)
    : query;
  const results = shouldUseWebSearch
    ? await searchWithConfiguredProvider(plannedSearchQuery, settings)
    : [];
  const answer = await completeWithGroq(
    buildSearchSystemPrompt(settings),
    buildSearchAnswerPrompt(query, plannedSearchQuery, selectedText, context, results, shouldUseWebSearch, settings),
    getSearchTokenBudget(settings.behavior.answerStyle),
    groqOptions,
  );

  return {
    displayText: answer,
  };
}

async function searchWithConfiguredProvider(query: string, settings: DashboardSettings): Promise<SearchResult[]> {
  const searchEngine = settings.provider.searchProvider === 'mock'
    ? new MockSearchEngine()
    : new TavilySearchEngine({ apiKey: settings.provider.tavilyApiKey });
  const response = await searchEngine.search({ query });

  return response.results;
}

function getGroqOptions(settings: DashboardSettings): GroqCompletionOptions {
  return {
    apiKey: settings.provider.groqApiKey,
    model: settings.provider.groqModel,
  };
}

function buildSearchSystemPrompt(settings: DashboardSettings): string {
  return [
    settings.prompts.searchAnswerPrompt.trim() || DEFAULT_SEARCH_ANSWER_PROMPT,
    'Return only the direct answer, with no preface, no labels, and no markdown heading.',
    'Do not print a source/link list unless the user explicitly asks for links or sources.',
    `Answer style: ${describeAnswerStyle(settings.behavior.answerStyle)}.`,
    settings.behavior.enableWebSearch
      ? 'When web results are provided, use them only as supporting context.'
      : 'Web search is disabled, so do not imply that you checked live web results.',
  ].join(' ');
}

function buildSearchAnswerPrompt(
  query: string,
  plannedSearchQuery: string,
  selectedText: string,
  context: string | undefined,
  results: SearchResult[],
  usedWebSearch: boolean,
  settings: DashboardSettings,
): string {
  const resultLines = !usedWebSearch
    ? ['Web search disabled.']
    : results.length
    ? results.map((result, index) => {
        const snippet = result.snippet ? `\nSnippet: ${result.snippet}` : '';
        return `${index + 1}. ${result.title}\nURL: ${result.link}${snippet}`;
      })
    : ['No web results found.'];

  return [
    `User question: ${query}`,
    `Web search query used: ${plannedSearchQuery}`,
    `Answer style: ${describeAnswerStyle(settings.behavior.answerStyle)}`,
    '',
    'Highlighted context:',
    selectedText || '(none)',
    '',
    'Surrounding page/input context:',
    context?.trim() || '(none)',
    '',
    'Retrieved links/results:',
    ...resultLines,
    '',
    'Answer the user question directly and briefly.',
  ].join('\n');
}

function buildMockSearchAnswer(
  query: string,
  selectedText: string,
  context: string | undefined,
  settings: DashboardSettings,
): string {
  return [
    '[Mock Answer]',
    `Question: ${query}`,
    `Style: ${describeAnswerStyle(settings.behavior.answerStyle)}`,
    '',
    'Highlighted context:',
    selectedText || '(none)',
    '',
    'Surrounding context:',
    context?.trim() || '(disabled or none)',
  ].join('\n');
}

function describeAnswerStyle(style: AnswerStyle): string {
  if (style === 'bullet_points') return 'bullet points';
  if (style === 'detailed') return 'detailed but organized';
  return 'concise and direct';
}

function getSearchTokenBudget(style: AnswerStyle): number {
  if (style === 'detailed') return 650;
  if (style === 'bullet_points') return 450;
  return 350;
}

function chunkText(text: string, size: number): string[] {
  const chunks: string[] = [];

  for (let index = 0; index < text.length; index += size) {
    chunks.push(text.slice(index, index + size));
  }

  return chunks;
}

function postStreamMessage(port: Browser.runtime.Port, message: StreamMessage): void {
  port.postMessage(message);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
