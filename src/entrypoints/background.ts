import type { ActionId, StreamMessage, StreamRequest } from '@/types';

const VIETNAMESE_RE = /[ăâđêôơưáàảãạấầẩẫậắằẳẵặéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ]/i;
const SUMMARY_LENGTH_THRESHOLD = 1000;

export default defineBackground(() => {
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
});

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
  const response = buildDraftResponse(request);

  try {
    for (const chunk of chunkText(response, 18)) {
      if (isCancelled()) return;
      postStreamMessage(port, { type: 'chunk', chunk });
      await delay(28);
    }

    if (!isCancelled()) {
      postStreamMessage(port, { type: 'done' });
    }
  } catch {
    if (!isCancelled()) {
      postStreamMessage(port, {
        type: 'error',
        message: 'Không thể tạo phản hồi lúc này. Thử lại sau nhé.',
      });
    }
  }
}

function buildDraftResponse(request: StreamRequest): string {
  const selectedText = request.selectedText.trim();

  if (request.mode === 'translate') {
    return `Bản dịch nháp: ${selectedText}`;
  }

  if (request.mode === 'summary') {
    return summarizeLocally(selectedText);
  }

  return `Câu hỏi: ${request.query ?? ''}\n\nDựa trên đoạn đã chọn, đây là câu trả lời nháp để kiểm tra UX popup. Bước tiếp theo sẽ nối Groq/Tavily để phản hồi có ngữ cảnh web thật.`;
}

function summarizeLocally(text: string): string {
  const compact = text.replace(/\s+/g, ' ').trim();
  if (compact.length <= 180) {
    return `Tóm tắt: ${compact}`;
  }

  return `Tóm tắt: ${compact.slice(0, 180)}...`;
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
