import { createElement } from '@/components/dom';
import { getDashboardSettings } from '@/dashboard/settings';
import './style.css';

const app = document.querySelector<HTMLDivElement>('#app');

if (app) {
  void renderPopup(app);
}

async function renderPopup(root: HTMLElement): Promise<void> {
  try {
    const settings = await getDashboardSettings();
    const openButton = createElement('button', {
      className: 'popup-primary',
      text: 'Open dashboard',
      attributes: { type: 'button' },
    });
    openButton.addEventListener('click', () => {
      void browser.runtime.openOptionsPage();
      window.close();
    });

    root.replaceChildren(
      createElement('section', { className: 'popup-shell' }, [
        createElement('h1', { className: 'popup-title', text: 'AI Assistant' }),
        createElement('div', { className: 'popup-status-list' }, [
          createStatusRow('LLM', settings.provider.llmProvider === 'groq' ? settings.provider.groqModel : 'Mock'),
          createStatusRow('Search', settings.provider.searchProvider),
          createStatusRow('Web search', settings.behavior.enableWebSearch ? 'Enabled' : 'Disabled'),
        ]),
        openButton,
      ]),
    );
  } catch {
    root.replaceChildren(
      createElement('section', { className: 'popup-shell' }, [
        createElement('h1', { className: 'popup-title', text: 'AI Assistant' }),
        createElement('p', { className: 'popup-error', text: 'Could not load settings.' }),
      ]),
    );
  }
}

function createStatusRow(label: string, value: string): HTMLElement {
  return createElement('div', { className: 'popup-status-row' }, [
    createElement('span', { className: 'popup-status-label', text: label }),
    createElement('span', { className: 'popup-status-value', text: value }),
  ]);
}
