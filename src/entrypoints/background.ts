import { TavilySearchEngine } from '@/ai_engine/search/search.tavily';
import { planSearchQueryWithGroq } from '@/ai_engine/search/search.groq';
import { completeWithGroq } from '@/ai_engine/shared/groq';
import { GroqSummaryEngine } from '@/ai_engine/summary/summary.groq';
import { GroqTranslateEngine } from '@/ai_engine/translate/translate.groq';
import { getErrorMessage } from '@/ai_engine/shared/errors';
import type { ActionId, StreamMessage, StreamRequest } from '@/types';

const VIETNAMESE_RE = /[ăâđêôơưáàảãạấầẩẫậắằẳẵặéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ]/i;
const SUMMARY_LENGTH_THRESHOLD = 1000;
const CONTEXT_MENU_ID = 'selection-assist-open';
const translateEngine = new GroqTranslateEngine();
const summaryEngine = new GroqSummaryEngine();
const searchEngine = new TavilySearchEngine();

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
  const selectedText = request.selectedText.trim();

  if (request.mode === 'translate') {
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
    const response = await summaryEngine.summarize({
      content: selectedText,
    });

    return {
      displayText: response.summaryText,
    };
  }

  const query = request.query?.trim() || selectedText;
  const plannedSearchQuery = await planSearchQueryWithGroq({
    query,
    selectedText,
    context: request.context,
  });
  const response = await searchEngine.search({
    query: plannedSearchQuery,
  });
  const answer = await completeWithGroq(
    [
      'You answer search questions for Vietnamese users.',
      'Return only the direct answer, with no preface, no labels, and no markdown heading.',
      'Be as concise as possible while still answering the question.',
      'Prioritize the highlighted context over web results.',
      'Use web results only as supporting context.',
      'Do not print a source/link list unless the user explicitly asks for links or sources.',
      'If the available information is insufficient, say that briefly.',
    ].join(' '),
    buildSearchAnswerPrompt(query, plannedSearchQuery, selectedText, request.context, response.results),
    350,
  );

  return {
    displayText: answer,
  };
}

function buildSearchAnswerPrompt(
  query: string,
  plannedSearchQuery: string,
  selectedText: string,
  context: string | undefined,
  results: Array<{ title: string; link: string; snippet?: string }>,
): string {
  const resultLines = results.length
    ? results.map((result, index) => {
        const snippet = result.snippet ? `\nSnippet: ${result.snippet}` : '';
        return `${index + 1}. ${result.title}\nURL: ${result.link}${snippet}`;
      })
    : ['No web results found.'];

  return [
    `User question: ${query}`,
    `Web search query used: ${plannedSearchQuery}`,
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
