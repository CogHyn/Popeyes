import { BackendAiEngine, BackendApiError } from '@/ai_engine/backend/backend.client';
import type { ActionId, StreamMessage, StreamRequest } from '@/types';

const VIETNAMESE_RE = /[ăâđêôơưáàảãạấầẩẫậắằẳẵặéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ]/i;
const SUMMARY_LENGTH_THRESHOLD = 1000;
const CONTEXT_MENU_ID = 'selection-assist-open';
const backendEngine = new BackendAiEngine();

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
    const response = await buildBackendResponse(request);

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
        message: getStreamErrorMessage(error),
      });
    }
  }
}

async function buildBackendResponse(request: StreamRequest): Promise<{ displayText: string; replacementText?: string }> {
  const selectedText = request.selectedText.trim();

  if (request.mode === 'translate') {
    const response = await backendEngine.translate({
      text: selectedText,
      targetLanguage: 'vi',
    });

    return {
      displayText: response.translatedText,
      replacementText: response.translatedText,
    };
  }

  if (request.mode === 'summary') {
    const response = await backendEngine.summarize({
      content: selectedText,
    });

    return {
      displayText: response.summaryText,
    };
  }

  const query = request.query?.trim() || selectedText;
  const response = await backendEngine.search({
    query,
  });
  const resultLines = response.results.map((result, index) => {
    return `${index + 1}. ${result.title}\n   ${result.link}`;
  });

  return {
    displayText: [
      `Câu hỏi: ${query}`,
      '',
      'Kết quả tìm kiếm:',
      '',
      ...resultLines,
    ].join('\n'),
  };
}

function getStreamErrorMessage(error: unknown): string {
  if (error instanceof BackendApiError) {
    return error.message;
  }

  return 'Không thể tạo phản hồi lúc này. Thử lại sau nhé.';
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
