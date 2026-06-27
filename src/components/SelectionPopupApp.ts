import { ActionList } from '@/components/ActionList';
import { ChatView } from '@/components/ChatView';
import { createButton, createElement } from '@/components/dom';
import { SearchQueryView } from '@/components/SearchQueryView';
import { StreamView } from '@/components/StreamView';
import type { Action, ActionId, ChatMessage, PopupState, StreamMessage, StreamRequest, VisibleSelection } from '@/types';
import { ACTIONS } from '@/types';
import { copyText, replaceSelectedText } from '@/utils/selectionUtils';

const VIETNAMESE_RE = /[ăâđêôơưáàảãạấầẩẫậắằẳẵặéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ]/i;
const SUMMARY_LENGTH_THRESHOLD = 1000;

interface SelectionPopupAppOptions {
  selection: VisibleSelection;
  onClose: () => void;
  initialMode?: 'actions' | 'search';
}

export class SelectionPopupApp {
  private readonly selection: VisibleSelection;
  private readonly onClose: () => void;
  private readonly root = createElement('section', {
    className: 'assist-popup',
    attributes: { role: 'dialog', 'aria-label': 'AI inline assistant' },
  });

  private actions: Action[] = rankActions(ACTIONS, 'translate');
  private activeActionId: ActionId = this.actions[0].id;
  private query = '';
  private isQueryOpen = false;
  private state: PopupState = 'list';
  private output = '';
  private replacementText = '';
  private errorMessage = '';
  private chatMessages: ChatMessage[] = [];
  private port?: Browser.runtime.Port;

  constructor({ selection, onClose, initialMode = 'actions' }: SelectionPopupAppOptions) {
    this.selection = selection;
    this.onClose = onClose;
    this.isQueryOpen = initialMode === 'search';
    this.classifyIntent();
    this.render();
  }

  get element(): HTMLElement {
    return this.root;
  }

  dispose(): void {
    this.disconnectPort();
  }

  handleKey(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.onClose();
      return;
    }

    if (this.state !== 'list') return;

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      this.moveActiveAction(event.key === 'ArrowDown' ? 1 : -1);
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      if (this.query.trim()) {
        this.executeChat(this.query.trim());
      } else {
        this.executeAction(this.activeActionId);
      }
      return;
    }

    if (/^[1-9]$/.test(event.key) && !this.query) {
      event.preventDefault();
      const action = this.actions[Number(event.key) - 1];
      if (action) this.selectAction(action.id);
      return;
    }

    if (event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey) {
      this.query += event.key;
      this.isQueryOpen = true;
      this.render();
      event.preventDefault();
      return;
    }

    if (event.key === 'Backspace' && this.query) {
      this.query = this.query.slice(0, -1);
      this.render();
      event.preventDefault();
    }
  }

  private async classifyIntent(): Promise<void> {
    const fallback = inferAction(this.selection.text);

    try {
      const response = await browser.runtime.sendMessage({
        type: 'CLASSIFY_INTENT',
        text: this.selection.text,
      });

      const recommendedAction = response?.recommendedAction === 'summary' ? 'summary' : fallback;
      this.actions = rankActions(ACTIONS, recommendedAction);
      this.activeActionId = this.actions[0].id;
      this.render();
    } catch {
      this.actions = rankActions(ACTIONS, fallback);
      this.activeActionId = this.actions[0].id;
      this.render();
    }
  }

  private render(): void {
    this.root.replaceChildren(
      createHeader(this.selection.text, this.onClose),
      createElement('div', { className: 'assist-body' }, [this.renderBody()]),
    );
  }

  private renderBody(): HTMLElement {
    if (this.state === 'chat-streaming' || this.state === 'chat-completed') {
      return ChatView({
        state: this.state,
        messages: this.chatMessages,
        onBack: () => this.resetToList(),
        onCopy: () => void copyText(this.getAssistantChatText()),
        onStop: () => this.stopChatStream(),
      });
    }

    if (this.state === 'streaming' || this.state === 'completed' || this.state === 'error') {
      return StreamView({
        state: this.state,
        output: this.output,
        errorMessage: this.errorMessage,
        onBack: () => this.resetToList(),
        onCopy: () => void copyText(this.output),
        onInsert: () => {
          const textToInsert = this.replacementText || this.output;
          if (textToInsert) replaceSelectedText(this.selection, textToInsert);
        },
        onStop: () => this.stopStream(),
      });
    }

    if (this.isQueryOpen || this.query) {
      return SearchQueryView({
        query: this.query,
        onQueryChange: (query) => {
          this.query = query;
          this.isQueryOpen = true;
        },
        onSubmit: () => this.executeChat(this.query.trim()),
      });
    }

    return ActionList({
      actions: this.actions,
      activeActionId: this.activeActionId,
      onSelect: (actionId) => this.selectAction(actionId),
    });
  }

  private executeAction(mode: ActionId): void {
    this.disconnectPort();
    this.output = '';
    this.replacementText = '';
    this.errorMessage = '';
    this.chatMessages = [];
    this.state = 'streaming';
    this.render();

    const request: StreamRequest = {
      mode,
      selectedText: this.selection.text,
      query: this.query.trim() || undefined,
      context: this.selection.context,
    };

    try {
      const port = browser.runtime.connect({ name: 'ai-stream' });
      this.port = port;

      port.onMessage.addListener((message: StreamMessage) => {
        if (message.type === 'chunk') {
          this.output += message.chunk;
          this.render();
          return;
        }

        if (message.type === 'replacement') {
          this.replacementText = message.text;
          return;
        }

        if (message.type === 'done') {
          this.state = 'completed';
          this.render();
          return;
        }

        this.state = 'error';
        this.errorMessage = message.message;
        this.render();
      });

      port.onDisconnect.addListener(() => {
        if (this.state === 'streaming') {
          this.state = this.output ? 'completed' : 'error';
          this.errorMessage = this.output ? '' : 'Luồng trả lời đã dừng trước khi có kết quả.';
          this.render();
        }
      });

      port.postMessage(request);
    } catch {
      this.state = 'error';
      this.errorMessage = 'Extension vừa được cập nhật. Refresh trang này rồi thử lại nhé.';
      this.render();
    }
  }

  private executeChat(query: string): void {
    if (!query) return;

    this.disconnectPort();
    this.output = '';
    this.replacementText = '';
    this.errorMessage = '';
    this.chatMessages = [
      { role: 'assistant', content: '', status: 'streaming' },
    ];
    this.state = 'chat-streaming';
    this.render();

    const request: StreamRequest = {
      mode: 'search',
      selectedText: this.selection.text,
      query,
      context: this.selection.context,
    };

    try {
      const port = browser.runtime.connect({ name: 'ai-stream' });
      this.port = port;

      port.onMessage.addListener((message: StreamMessage) => {
        if (message.type === 'chunk') {
          this.appendAssistantChatText(message.chunk);
          this.render();
          return;
        }

        if (message.type === 'replacement') {
          return;
        }

        if (message.type === 'done') {
          this.markAssistantChatDone();
          this.state = 'chat-completed';
          this.render();
          return;
        }

        this.setAssistantChatError(message.message);
        this.state = 'chat-completed';
        this.render();
      });

      port.onDisconnect.addListener(() => {
        if (this.state === 'chat-streaming') {
          if (this.getAssistantChatText()) {
            this.markAssistantChatDone();
          } else {
            this.setAssistantChatError('Luồng trả lời đã dừng trước khi có kết quả.');
          }

          this.state = 'chat-completed';
          this.render();
        }
      });

      port.postMessage(request);
    } catch {
      this.setAssistantChatError('Extension vừa được cập nhật. Refresh trang này rồi thử lại nhé.');
      this.state = 'chat-completed';
      this.render();
    }
  }

  private moveActiveAction(delta: number): void {
    const currentIndex = this.actions.findIndex((action) => action.id === this.activeActionId);
    const nextIndex = (currentIndex + delta + this.actions.length) % this.actions.length;
    this.activeActionId = this.actions[nextIndex].id;
    this.render();
  }

  private selectAction(actionId: ActionId): void {
    this.activeActionId = actionId;
    this.render();
  }

  private resetToList(): void {
    this.disconnectPort();
    this.query = '';
    this.isQueryOpen = false;
    this.output = '';
    this.replacementText = '';
    this.errorMessage = '';
    this.chatMessages = [];
    this.state = 'list';
    this.render();
  }

  private stopStream(): void {
    this.disconnectPort();
    this.state = this.output ? 'completed' : 'list';
    this.render();
  }

  private stopChatStream(): void {
    if (this.getAssistantChatText()) {
      this.markAssistantChatDone();
    } else {
      this.setAssistantChatDone('Đã dừng trả lời.');
    }

    this.state = 'chat-completed';
    this.disconnectPort();
    this.render();
  }

  private appendAssistantChatText(text: string): void {
    const assistant = this.getAssistantMessage();
    if (!assistant) return;

    assistant.content += text;
    assistant.status = 'streaming';
  }

  private markAssistantChatDone(): void {
    const assistant = this.getAssistantMessage();
    if (!assistant) return;

    assistant.status = 'done';
  }

  private setAssistantChatDone(text: string): void {
    const assistant = this.getAssistantMessage();
    if (!assistant) return;

    assistant.content = text;
    assistant.status = 'done';
  }

  private setAssistantChatError(message: string): void {
    const assistant = this.getAssistantMessage();
    if (!assistant) return;

    assistant.content = message;
    assistant.status = 'error';
  }

  private getAssistantChatText(): string {
    return this.getAssistantMessage()?.content ?? '';
  }

  private getAssistantMessage(): ChatMessage | undefined {
    return this.chatMessages.findLast((message) => message.role === 'assistant');
  }

  private disconnectPort(): void {
    if (!this.port) return;

    try {
      this.port.disconnect();
    } catch {
      // Port may already be disconnected by the browser.
    }

    this.port = undefined;
  }
}

function createHeader(selectionText: string, onClose: () => void): HTMLElement {
  return createElement('header', { className: 'assist-header' }, [
    createElement('div', { className: 'assist-title' }, [
      createElement('div', { className: 'assist-kicker', text: 'AI command' }),
      createElement('div', { className: 'assist-selection', text: selectionText || 'Quick search' }),
    ]),
    createButton('assist-close', 'x', onClose, { title: 'Close', ariaLabel: 'Close popup' }),
  ]);
}

function inferAction(text: string): ActionId {
  if (VIETNAMESE_RE.test(text) || text.length >= SUMMARY_LENGTH_THRESHOLD) return 'summary';
  return 'translate';
}

function rankActions(actions: Action[], recommendedActionId: ActionId): Action[] {
  return actions
    .map((action) => ({
      ...action,
      confidence: action.id === recommendedActionId ? 0.92 : 0.72,
    }))
    .sort((a, b) => b.confidence - a.confidence);
}
