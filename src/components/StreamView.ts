import { createButton, createElement } from '@/components/dom';
import type { PopupState } from '@/types';

interface StreamViewProps {
  state: PopupState;
  output: string;
  errorMessage?: string;
  onBack: () => void;
  onCopy: () => void;
  onInsert: () => void;
  onStop: () => void;
}

export function StreamView({
  state,
  output,
  errorMessage,
  onBack,
  onCopy,
  onInsert,
  onStop,
}: StreamViewProps): HTMLElement {
  const shell = createElement('div', { className: 'query-shell' });
  const isStreaming = state === 'streaming';
  const isError = state === 'error';

  const outputBox = createElement('div', {
    className: `stream-output${isError ? ' is-error' : ''}`,
    text: isError ? errorMessage || 'Có lỗi xảy ra. Thử lại sau nhé.' : output,
    attributes: { role: 'status', 'aria-live': isStreaming ? 'polite' : 'off' },
  });

  if (!output && isStreaming) {
    outputBox.append(createElement('span', { className: 'stream-placeholder', text: 'Đang chuẩn bị câu trả lời...' }));
  }

  const actions = createElement('div', { className: 'stream-actions' }, [
    createElement('div', { className: 'stream-group' }, [
      createButton('assist-command', 'Back', onBack, { ariaLabel: 'Back to actions' }),
      isStreaming
        ? createButton('assist-command is-danger', 'Stop', onStop, { ariaLabel: 'Stop streaming' })
        : createButton('assist-command', 'Copy', onCopy, { ariaLabel: 'Copy result' }),
    ]),
    createElement('div', { className: 'stream-group' }, [
      createButton('assist-command is-primary', 'Insert', onInsert, { ariaLabel: 'Insert result into selected text' }),
    ]),
  ]);

  shell.append(outputBox, actions);
  return shell;
}
