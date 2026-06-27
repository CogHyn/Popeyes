import { createButton, createElement } from '@/components/dom';
import type { ChatMessage, PopupState } from '@/types';

interface ChatViewProps {
  state: PopupState;
  messages: ChatMessage[];
  onBack: () => void;
  onCopy: () => void;
  onStop: () => void;
}

export function ChatView({ state, messages, onBack, onCopy, onStop }: ChatViewProps): HTMLElement {
  const isStreaming = state === 'chat-streaming';
  const assistantMessage = messages.findLast((message) => message.role === 'assistant');
  const isError = assistantMessage?.status === 'error';
  const shell = createElement('div', { className: 'chat-shell' });
  const transcript = createElement('div', {
    className: 'chat-transcript',
    attributes: { role: 'log', 'aria-live': isStreaming ? 'polite' : 'off' },
  });
  const answer = createElement('div', {
    className: `chat-answer${isError ? ' is-error' : ''}`,
    text: assistantMessage?.content || (isStreaming ? 'Đang trả lời...' : ''),
  });

  const actions = createElement('div', { className: 'stream-actions' }, [
    createElement('div', { className: 'stream-group' }, [
      createButton('assist-command', 'Back', onBack, { ariaLabel: 'Back to actions' }),
      isStreaming
        ? createButton('assist-command is-danger', 'Stop', onStop, { ariaLabel: 'Stop chat response' })
        : createButton('assist-command', 'Copy', onCopy, { ariaLabel: 'Copy chat response' }),
    ]),
  ]);

  transcript.append(answer);
  shell.append(transcript, actions);
  window.setTimeout(() => {
    transcript.scrollTop = transcript.scrollHeight;
  }, 0);

  return shell;
}
