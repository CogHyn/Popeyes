export function createElement<K extends keyof HTMLElementTagNameMap>(
  tagName: K,
  options: {
    className?: string;
    text?: string;
    title?: string;
    attributes?: Record<string, string>;
    onClick?: (event: MouseEvent) => void;
  } = {},
  children: Array<Node | string> = [],
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tagName);

  if (options.className) element.className = options.className;
  if (options.text !== undefined) element.textContent = options.text;
  if (options.title) element.title = options.title;
  if (options.onClick) {
    element.addEventListener('click', (event) => options.onClick?.(event as MouseEvent));
  }

  for (const [name, value] of Object.entries(options.attributes ?? {})) {
    element.setAttribute(name, value);
  }

  for (const child of children) {
    element.append(child);
  }

  return element;
}

export function createButton(
  className: string,
  label: string,
  onClick: (event: MouseEvent) => void,
  options: { title?: string; ariaLabel?: string; type?: 'button' | 'submit' } = {},
): HTMLButtonElement {
  const button = createElement('button', {
    className,
    title: options.title,
    text: label,
    onClick,
    attributes: {
      type: options.type ?? 'button',
      ...(options.ariaLabel ? { 'aria-label': options.ariaLabel } : {}),
    },
  });

  return button;
}
