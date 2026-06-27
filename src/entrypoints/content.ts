import { SelectionPopupApp } from '@/components/SelectionPopupApp';
import { popupStyles } from '@/styles/popup';
import type { VisibleSelection } from '@/types';
import {
  calculatePopupPosition,
  getVisibleSelection,
  SELECTION_CONFIRM_DELAY_MS,
} from '@/utils/selectionUtils';

export default defineContentScript({
  matches: ['http://*/*', 'https://*/*'],
  main() {
    const host = document.createElement('selection-assist-ui');
    const shadow = host.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    const mount = document.createElement('div');

    style.textContent = popupStyles;
    host.style.display = 'none';
    shadow.append(style, mount);
    document.documentElement.append(host);

    let app: SelectionPopupApp | undefined;
    let activeSelection: VisibleSelection | undefined;
    let selectionTimer: number | undefined;
    let pointerStartedInsidePopup = false;

    const closePopup = () => {
      app?.dispose();
      app = undefined;
      activeSelection = undefined;
      mount.replaceChildren();
      host.style.display = 'none';
    };

    const openPopup = (selection: VisibleSelection) => {
      activeSelection = selection;
      app?.dispose();
      app = new SelectionPopupApp({
        selection,
        onClose: closePopup,
      });

      mount.replaceChildren(app.element);
      app.element.addEventListener('mousedown', stopPopupMouseDown, { capture: true });
      updatePopupPosition();
      host.style.display = 'block';
    };

    const confirmSelection = () => {
      if (pointerStartedInsidePopup || isPopupInputFocused()) return;

      const selection = getVisibleSelection();
      if (!selection) {
        if (!app) closePopup();
        return;
      }

      if (activeSelection?.text === selection.text && app) {
        activeSelection = selection;
        updatePopupPosition();
        return;
      }

      openPopup(selection);
    };

    const openFromContextMenu = () => {
      window.clearTimeout(selectionTimer);

      const selection = getVisibleSelection();
      if (!selection) return;

      openPopup(selection);
    };

    const scheduleSelectionCheck = () => {
      window.clearTimeout(selectionTimer);
      selectionTimer = window.setTimeout(confirmSelection, SELECTION_CONFIRM_DELAY_MS);
    };

    function updatePopupPosition() {
      if (!activeSelection) return;

      const latestSelection = getVisibleSelection();
      if (latestSelection?.text === activeSelection.text) {
        activeSelection = latestSelection;
      }

      const position = calculatePopupPosition(activeSelection.rect);
      host.style.left = `${position.left}px`;
      host.style.top = `${position.top}px`;
    }

    function stopPopupMouseDown(event: MouseEvent) {
      pointerStartedInsidePopup = true;
      event.preventDefault();
      event.stopPropagation();
      window.setTimeout(() => {
        pointerStartedInsidePopup = false;
      }, 0);
    }

    function handleKeyboard(event: KeyboardEvent) {
      if (!app) return;

      if (isPopupTextInputEvent(event)) {
        if (event.type === 'keydown' && event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          app.handleKey(event);
        }

        return;
      }

      event.stopPropagation();
      if (event.type !== 'keydown') {
        event.preventDefault();
        return;
      }

      app.handleKey(event);
    }

    function handleOutsidePointer(event: MouseEvent) {
      if (!app) return;
      if (event.composedPath().includes(host)) return;

      closePopup();
    }

    function isPopupTextInputEvent(event: KeyboardEvent): boolean {
      return event.composedPath().some((target) => {
        return target instanceof HTMLInputElement && target.classList.contains('query-input');
      });
    }

    function isPopupInputFocused(): boolean {
      return shadow.activeElement instanceof HTMLInputElement && shadow.activeElement.classList.contains('query-input');
    }

    browser.runtime.onMessage.addListener((message) => {
      if (message?.type !== 'OPEN_SELECTION_ASSIST') return;

      openFromContextMenu();
    });

    document.addEventListener('selectionchange', scheduleSelectionCheck);
    window.addEventListener('mousedown', handleOutsidePointer, true);
    window.addEventListener('mouseup', scheduleSelectionCheck, true);
    window.addEventListener('resize', updatePopupPosition);
    window.addEventListener('scroll', updatePopupPosition, true);
    window.addEventListener('keydown', handleKeyboard, true);
    window.addEventListener('keypress', handleKeyboard, true);
    window.addEventListener('keyup', handleKeyboard, true);
  },
});
