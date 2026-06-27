import { createElement } from '@/components/dom';

interface SearchQueryViewProps {
  query: string;
  onQueryChange: (query: string) => void;
  onSubmit: () => void;
}

export function SearchQueryView({ query, onQueryChange, onSubmit }: SearchQueryViewProps): HTMLElement {
  const shell = createElement('div', { className: 'query-shell' });
  const input = createElement('input', {
    className: 'query-input',
    attributes: {
      type: 'text',
      placeholder: 'Hỏi AI về đoạn đã chọn...',
      value: query,
      autocomplete: 'off',
      spellcheck: 'false',
      'aria-label': 'Search question',
    },
  });

  input.addEventListener('input', () => onQueryChange(input.value));
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && input.value.trim()) {
      event.preventDefault();
      onSubmit();
    }
  });

  shell.append(
    input,
    createElement('div', {
      className: 'query-hint',
      text: 'Enter để hỏi. Esc để đóng. Phím bạn gõ ở đây không bị gửi vào trang đang mở.',
    }),
  );

  window.setTimeout(() => input.focus({ preventScroll: true }), 0);
  return shell;
}
