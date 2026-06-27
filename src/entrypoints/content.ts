import { SelectionPopupApp } from '@/components/SelectionPopupApp';
import {
  createShortcutStringFromKeyboardEvent,
  DASHBOARD_SETTINGS_KEY,
  getDashboardSettings,
  getDefaultDashboardSettings,
  normalizeDashboardSettings,
  normalizeSafeShortcutString,
  type ShortcutSettings,
} from '@/dashboard/settings';
import { popupStyles } from '@/styles/popup';
import type { VisibleSelection } from '@/types';
import {
  calculatePopupPosition,
  getQuickSearchSelection,
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
    host.addEventListener('keydown', handlePopupSelectAllShortcut, true);
    shadow.append(style, mount);
    document.documentElement.append(host);

    let app: SelectionPopupApp | undefined;
    let activeSelection: VisibleSelection | undefined;
    let selectionTimer: number | undefined;
    let pointerStartedInsidePopup = false;
    let shortcutSettings: ShortcutSettings = getDefaultDashboardSettings().shortcuts;
    let enableTypeToSearch = getDefaultDashboardSettings().behavior.enableTypeToSearch;
    let lastMousePosition: { left: number; top: number } | undefined;

    void refreshShortcutSettings();

    const closePopup = () => {
      app?.dispose();
      app = undefined;
      activeSelection = undefined;
      mount.replaceChildren();
      host.style.display = 'none';
    };

    const openPopup = (
      selection: VisibleSelection,
      options: { initialMode?: 'actions' | 'search'; initialQuery?: string } = {},
    ) => {
      activeSelection = selection;
      app?.dispose();
      app = new SelectionPopupApp({
        selection,
        onClose: closePopup,
        initialMode: options.initialMode,
        initialQuery: options.initialQuery,
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

    const openQuickSearchPopup = () => {
      window.clearTimeout(selectionTimer);
      openPopup(getQuickSearchSelection(), { initialMode: 'search' });
    };

    const openTypeToSearchPopup = (initialQuery: string) => {
      window.clearTimeout(selectionTimer);
      openPopup(getQuickSearchSelection(lastMousePosition), {
        initialMode: 'search',
        initialQuery,
      });
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
      const isPopupInputEvent = isPopupTextInputEvent(event);

      if (event.type === 'keydown' && !isPopupInputEvent && isQuickSearchShortcut(event)) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        openQuickSearchPopup();
        return;
      }

      if (event.type === 'keydown' && isTypeToSearchTrigger(event)) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        openTypeToSearchPopup(event.key);
        return;
      }

      if (!app) return;

      if (isPopupInputEvent) {
        if (event.type === 'keydown' && event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          app.handleKey(event);
        }

        return;
      }

      if (isSelectAllShortcut(event)) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
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

    function updateLastMousePosition(event: MouseEvent) {
      lastMousePosition = {
        left: event.clientX,
        top: event.clientY,
      };
    }

    function handlePopupSelectAllShortcut(event: KeyboardEvent) {
      if (!app || !isSelectAllShortcut(event) || isPopupTextInputEvent(event)) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
    }

    function isPopupTextInputEvent(event: KeyboardEvent): boolean {
      return event.composedPath().some((target) => {
        return target instanceof HTMLInputElement && target.classList.contains('query-input');
      });
    }

    function isPopupInputFocused(): boolean {
      return shadow.activeElement instanceof HTMLInputElement && shadow.activeElement.classList.contains('query-input');
    }

    function isSelectAllShortcut(event: KeyboardEvent): boolean {
      return event.key.toLowerCase() === 'a' && (event.ctrlKey || event.metaKey) && !event.altKey;
    }

    async function refreshShortcutSettings(): Promise<void> {
      try {
        const settings = await getDashboardSettings();
        shortcutSettings = settings.shortcuts;
        enableTypeToSearch = settings.behavior.enableTypeToSearch;
      } catch {
        const defaults = getDefaultDashboardSettings();
        shortcutSettings = defaults.shortcuts;
        enableTypeToSearch = defaults.behavior.enableTypeToSearch;
      }
    }

    function isQuickSearchShortcut(event: KeyboardEvent): boolean {
      if (!shortcutSettings.enableQuickSearchShortcut || event.repeat) return false;
      return doesKeyboardEventMatchShortcut(event, shortcutSettings.quickSearchShortcut);
    }

    function doesKeyboardEventMatchShortcut(event: KeyboardEvent, shortcut: string): boolean {
      const normalizedShortcut = normalizeSafeShortcutString(shortcut);
      if (!normalizedShortcut) return false;

      return createShortcutStringFromKeyboardEvent(event) === normalizedShortcut;
    }

    function isTypeToSearchTrigger(event: KeyboardEvent): boolean {
      if (!enableTypeToSearch || app || event.repeat || event.isComposing) return false;
      if (event.ctrlKey || event.metaKey || event.altKey) return false;
      if (!isPrintableNonSpaceKey(event.key)) return false;
      if (isEditablePageEvent(event)) return false;
      return !getVisibleSelection();
    }

    function isPrintableNonSpaceKey(key: string): boolean {
      return key.length === 1 && key.trim().length > 0;
    }

    function isEditablePageEvent(event: KeyboardEvent): boolean {
      return event.composedPath().some((target) => {
        if (target instanceof HTMLInputElement) return true;
        if (target instanceof HTMLTextAreaElement) return true;
        if (target instanceof HTMLSelectElement) return true;
        return target instanceof HTMLElement && target.isContentEditable;
      });
    }

    browser.runtime.onMessage.addListener((message) => {
      if (message?.type !== 'OPEN_SELECTION_ASSIST') return;

      openFromContextMenu();
    });

    browser.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== 'local') return;

      const settingsChange = changes[DASHBOARD_SETTINGS_KEY];
      if (!settingsChange) return;

      const settings = normalizeDashboardSettings(settingsChange.newValue);
      shortcutSettings = settings.shortcuts;
      enableTypeToSearch = settings.behavior.enableTypeToSearch;
    });

    document.addEventListener('selectionchange', scheduleSelectionCheck);
    window.addEventListener('mousedown', updateLastMousePosition, true);
    window.addEventListener('mousedown', handleOutsidePointer, true);
    window.addEventListener('mousemove', updateLastMousePosition, true);
    window.addEventListener('mouseup', scheduleSelectionCheck, true);
    window.addEventListener('resize', updatePopupPosition);
    window.addEventListener('scroll', updatePopupPosition, true);
    window.addEventListener('keydown', handleKeyboard, true);
    window.addEventListener('keypress', handleKeyboard, true);
    window.addEventListener('keyup', handleKeyboard, true);
  },
});
