import type { PopupPosition, VisibleSelection } from '@/types';

export const SELECTION_CONFIRM_DELAY_MS = 500;
export const MIN_SELECTION_LENGTH = 2;
export const POPUP_WIDTH = 340;
export const POPUP_HEIGHT = 320;
export const POPUP_GAP = 10;
export const VIEWPORT_MARGIN = 12;
const CONTEXT_RADIUS = 500;

const INPUT_SELECTOR = 'textarea,input[type="text"],input[type="search"],input:not([type])';

export function getVisibleSelection(): VisibleSelection | null {
  const inputSelection = getInputSelection();
  if (inputSelection) return inputSelection;

  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
    return null;
  }

  const text = selection.toString().trim();
  if (text.length < MIN_SELECTION_LENGTH) return null;

  const range = selection.getRangeAt(0);
  const rect = getUsableRect(range);
  if (!rect) return null;

  return {
    text,
    rect,
    context: getSurroundingContext(text),
  };
}

export function getQuickSearchSelection(position?: PopupPosition): VisibleSelection {
  const visibleSelection = getVisibleSelection();
  if (visibleSelection) return visibleSelection;

  const activeInputContext = getActiveInputContext();
  if (activeInputContext && !position) return activeInputContext;

  return {
    text: '',
    rect: position ? getPointPopupRect(position) : getFallbackPopupRect(),
    context: getPageContext(),
  };
}

export function calculatePopupPosition(rect: DOMRect): PopupPosition {
  const desiredLeft = rect.right + POPUP_GAP;
  const desiredTop = rect.bottom + POPUP_GAP;
  const maxLeft = Math.max(VIEWPORT_MARGIN, window.innerWidth - POPUP_WIDTH - VIEWPORT_MARGIN);
  const maxTop = Math.max(VIEWPORT_MARGIN, window.innerHeight - POPUP_HEIGHT - VIEWPORT_MARGIN);

  return {
    left: clamp(desiredLeft, VIEWPORT_MARGIN, maxLeft),
    top: clamp(desiredTop, VIEWPORT_MARGIN, maxTop),
  };
}

function getActiveInputContext(): VisibleSelection | null {
  const active = document.activeElement;
  if (!(active instanceof HTMLTextAreaElement || active instanceof HTMLInputElement)) return null;
  if (!active.matches(INPUT_SELECTOR)) return null;

  const rect = active.getBoundingClientRect();
  if (!hasArea(rect)) return null;

  const caret = active.selectionStart ?? 0;
  const contextStart = Math.max(0, caret - CONTEXT_RADIUS);
  const contextEnd = Math.min(active.value.length, caret + CONTEXT_RADIUS);

  return {
    text: '',
    rect,
    context: active.value.slice(contextStart, contextEnd),
  };
}

function getFallbackPopupRect(): DOMRect {
  const left = Math.max(VIEWPORT_MARGIN, window.innerWidth / 2 - POPUP_WIDTH / 2 - POPUP_GAP);
  const top = Math.max(VIEWPORT_MARGIN, window.innerHeight * 0.22);

  return new DOMRect(left, top, 0, 0);
}

function getPointPopupRect(position: PopupPosition): DOMRect {
  return new DOMRect(position.left, position.top, 0, 0);
}

function getPageContext(): string {
  const title = document.title.trim();
  const url = window.location.href;
  const bodyText = (document.body?.innerText ?? '').replace(/\s+/g, ' ').trim();
  const clippedBody = bodyText.length > CONTEXT_RADIUS * 2
    ? bodyText.slice(0, CONTEXT_RADIUS * 2).trim()
    : bodyText;

  return [title, url, clippedBody].filter(Boolean).join('\n');
}

export async function copyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  document.body.append(textarea);
  textarea.select();
  document.execCommand('copy');
  textarea.remove();
}

export function replaceSelectedText(selection: VisibleSelection, value: string): boolean {
  if (selection.sourceElement) {
    const element = selection.sourceElement;
    const start = selection.sourceRange?.start ?? element.selectionStart ?? 0;
    const end = selection.sourceRange?.end ?? element.selectionEnd ?? start;

    if (!isSameSelectionText(element.value.slice(start, end), selection.text)) {
      return false;
    }

    element.setRangeText(value, start, end, 'end');
    element.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertReplacementText', data: value }));
    return true;
  }

  const activeSelection = window.getSelection();
  if (!activeSelection || activeSelection.rangeCount === 0) return false;
  if (!isSameSelectionText(activeSelection.toString(), selection.text)) return false;

  const range = activeSelection.getRangeAt(0);
  range.deleteContents();
  range.insertNode(document.createTextNode(value));
  activeSelection.removeAllRanges();
  return true;
}

function getInputSelection(): VisibleSelection | null {
  const active = document.activeElement;
  if (!(active instanceof HTMLTextAreaElement || active instanceof HTMLInputElement)) return null;
  if (!active.matches(INPUT_SELECTOR)) return null;

  const start = active.selectionStart ?? 0;
  const end = active.selectionEnd ?? start;
  if (end <= start) return null;

  const text = active.value.slice(start, end).trim();
  if (text.length < MIN_SELECTION_LENGTH) return null;

  const rect = active.getBoundingClientRect();
  if (!hasArea(rect)) return null;

  const contextStart = Math.max(0, start - CONTEXT_RADIUS);
  const contextEnd = Math.min(active.value.length, end + CONTEXT_RADIUS);

  return {
    text,
    rect,
    context: active.value.slice(contextStart, contextEnd),
    sourceElement: active,
    sourceRange: { start, end },
  };
}

function getUsableRect(range: Range): DOMRect | null {
  const rects = Array.from(range.getClientRects()).filter(hasArea);
  const lastRect = rects.at(-1);
  if (lastRect) return lastRect;

  const rect = range.getBoundingClientRect();
  return hasArea(rect) ? rect : null;
}

function getSurroundingContext(selectedText: string): string {
  const bodyText = document.body?.innerText ?? '';
  if (!bodyText) return selectedText;

  const index = bodyText.indexOf(selectedText);
  if (index === -1) return selectedText;

  const start = Math.max(0, index - CONTEXT_RADIUS);
  const end = Math.min(bodyText.length, index + selectedText.length + CONTEXT_RADIUS);
  return bodyText.slice(start, end);
}

function hasArea(rect: DOMRect): boolean {
  return rect.width > 0 || rect.height > 0;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function isSameSelectionText(currentText: string, originalText: string): boolean {
  return currentText.trim() === originalText.trim();
}
