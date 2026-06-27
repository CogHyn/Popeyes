import { createElement } from '@/components/dom';
import {
  createShortcutStringFromKeyboardEvent,
  getDashboardSettings,
  isSupportedShortcutString,
  normalizeSafeShortcutString,
  resetDashboardSettings,
  saveDashboardSettings,
  type AnswerStyle,
  type DashboardSettings,
  type LlmProvider,
  type SearchProvider,
  type SummaryLength,
} from '@/dashboard/settings';
import './dashboard.css';

type DashboardTab = 'provider' | 'prompts' | 'behavior';
type StatusTone = 'idle' | 'success' | 'error';

const TABS: Array<{ id: DashboardTab; label: string }> = [
  { id: 'provider', label: 'Provider' },
  { id: 'prompts', label: 'Prompts' },
  { id: 'behavior', label: 'Behavior' },
];

export function createDashboardApp(): HTMLElement {
  const app = new DashboardApp();
  return app.element;
}

class DashboardApp {
  private readonly root = createElement('section', { className: 'dashboard-shell' });
  private settings?: DashboardSettings;
  private activeTab: DashboardTab = 'provider';
  private statusMessage = 'Loading settings...';
  private statusTone: StatusTone = 'idle';
  private isSaving = false;
  private isRecordingShortcut = false;

  constructor() {
    this.render();
    void this.load();
  }

  get element(): HTMLElement {
    return this.root;
  }

  private async load(): Promise<void> {
    try {
      this.settings = await getDashboardSettings();
      this.statusMessage = 'Settings ready.';
      this.statusTone = 'idle';
    } catch (error) {
      this.statusMessage = `Could not load settings: ${getErrorMessage(error)}`;
      this.statusTone = 'error';
    }

    this.render();
  }

  private async save(): Promise<void> {
    if (!this.settings || this.isSaving) return;

    this.isSaving = true;
    this.statusMessage = 'Saving settings...';
    this.statusTone = 'idle';
    this.render();

    try {
      this.settings = await saveDashboardSettings(this.settings);
      this.statusMessage = 'Settings saved.';
      this.statusTone = 'success';
    } catch (error) {
      this.statusMessage = `Could not save settings: ${getErrorMessage(error)}`;
      this.statusTone = 'error';
    } finally {
      this.isSaving = false;
      this.render();
    }
  }

  private async reset(): Promise<void> {
    if (!window.confirm('Reset provider, prompts, and behavior settings to defaults?')) return;

    this.isSaving = true;
    this.statusMessage = 'Resetting defaults...';
    this.statusTone = 'idle';
    this.render();

    try {
      this.settings = await resetDashboardSettings();
      this.statusMessage = 'Defaults restored.';
      this.statusTone = 'success';
    } catch (error) {
      this.statusMessage = `Could not reset settings: ${getErrorMessage(error)}`;
      this.statusTone = 'error';
    } finally {
      this.isSaving = false;
      this.render();
    }
  }

  private render(): void {
    this.root.replaceChildren(
      this.renderHeader(),
      this.renderMain(),
    );
  }

  private renderHeader(): HTMLElement {
    const title = createElement('h1', { className: 'dashboard-title', text: 'AI Assistant Dashboard' });
    const subtitle = createElement('p', {
      className: 'dashboard-subtitle',
      text: 'Manage provider credentials, models, prompts, and answer behavior.',
    });
    const status = createElement('div', {
      className: `dashboard-status is-${this.statusTone}`,
      text: this.statusMessage,
      attributes: { role: 'status' },
    });

    return createElement('header', { className: 'dashboard-header' }, [
      createElement('div', { className: 'dashboard-heading' }, [title, subtitle]),
      status,
    ]);
  }

  private renderMain(): HTMLElement {
    if (!this.settings) {
      return createElement('main', { className: 'dashboard-main' }, [
        createElement('div', { className: 'dashboard-empty', text: 'Loading...' }),
      ]);
    }

    const form = createElement('form', { className: 'dashboard-form' }, [
      this.renderActivePanel(),
      this.renderFooter(),
    ]);

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      void this.save();
    });

    return createElement('main', { className: 'dashboard-main' }, [
      this.renderTabs(),
      form,
    ]);
  }

  private renderTabs(): HTMLElement {
    const tabButtons = TABS.map((tab) => {
      const button = createElement('button', {
        className: tab.id === this.activeTab ? 'dashboard-tab is-active' : 'dashboard-tab',
        text: tab.label,
        attributes: {
          type: 'button',
          'aria-selected': String(tab.id === this.activeTab),
        },
      });

      button.addEventListener('click', () => {
        this.activeTab = tab.id;
        this.render();
      });

      return button;
    });

    return createElement('nav', {
      className: 'dashboard-tabs',
      attributes: { 'aria-label': 'Dashboard sections' },
    }, tabButtons);
  }

  private renderActivePanel(): HTMLElement {
    if (!this.settings) return createElement('section');

    if (this.activeTab === 'prompts') {
      return this.renderPromptsPanel(this.settings);
    }

    if (this.activeTab === 'behavior') {
      return this.renderBehaviorPanel(this.settings);
    }

    return this.renderProviderPanel(this.settings);
  }

  private renderProviderPanel(settings: DashboardSettings): HTMLElement {
    return createPanel('AI Provider', [
      createSelectField<LlmProvider>({
        label: 'LLM provider',
        value: settings.provider.llmProvider,
        options: [
          { value: 'groq', label: 'Groq' },
          { value: 'mock', label: 'Mock' },
        ],
        onChange: (value) => {
          settings.provider.llmProvider = value;
        },
      }),
      createInputField({
        label: 'Groq API key',
        value: settings.provider.groqApiKey,
        type: 'password',
        placeholder: 'gsk_...',
        description: 'Leave empty to use the build-time VITE_GROQ_API_KEY fallback.',
        onInput: (value) => {
          settings.provider.groqApiKey = value.trim();
        },
      }),
      createInputField({
        label: 'Groq model',
        value: settings.provider.groqModel,
        placeholder: 'qwen/qwen3-32b',
        onInput: (value) => {
          settings.provider.groqModel = value.trim();
        },
      }),
      createSelectField<SearchProvider>({
        label: 'Search provider',
        value: settings.provider.searchProvider,
        options: [
          { value: 'tavily', label: 'Tavily' },
          { value: 'disabled', label: 'Disabled' },
          { value: 'mock', label: 'Mock' },
        ],
        onChange: (value) => {
          settings.provider.searchProvider = value;
        },
      }),
      createInputField({
        label: 'Tavily API key',
        value: settings.provider.tavilyApiKey,
        type: 'password',
        placeholder: 'tvly-...',
        description: 'Leave empty to use the build-time VITE_TAVILY_API_KEY fallback.',
        onInput: (value) => {
          settings.provider.tavilyApiKey = value.trim();
        },
      }),
    ]);
  }

  private renderPromptsPanel(settings: DashboardSettings): HTMLElement {
    return createPanel('Prompt / Behavior', [
      createTextareaField({
        label: 'Translate prompt',
        value: settings.prompts.translatePrompt,
        rows: 7,
        onInput: (value) => {
          settings.prompts.translatePrompt = value;
        },
      }),
      createTextareaField({
        label: 'Summary prompt',
        value: settings.prompts.summaryPrompt,
        rows: 7,
        onInput: (value) => {
          settings.prompts.summaryPrompt = value;
        },
      }),
      createTextareaField({
        label: 'Search answer prompt',
        value: settings.prompts.searchAnswerPrompt,
        rows: 8,
        onInput: (value) => {
          settings.prompts.searchAnswerPrompt = value;
        },
      }),
    ]);
  }

  private renderBehaviorPanel(settings: DashboardSettings): HTMLElement {
    return createPanel('Answer Behavior', [
      createSelectField<SummaryLength>({
        label: 'Summary length',
        value: settings.behavior.summaryLength,
        options: [
          { value: 'short', label: 'Short' },
          { value: 'medium', label: 'Medium' },
          { value: 'detailed', label: 'Detailed' },
        ],
        onChange: (value) => {
          settings.behavior.summaryLength = value;
        },
      }),
      createSelectField<AnswerStyle>({
        label: 'Answer style',
        value: settings.behavior.answerStyle,
        options: [
          { value: 'concise', label: 'Concise' },
          { value: 'detailed', label: 'Detailed' },
          { value: 'bullet_points', label: 'Bullet points' },
        ],
        onChange: (value) => {
          settings.behavior.answerStyle = value;
        },
      }),
      createToggleField({
        label: 'Use surrounding selection context',
        checked: settings.behavior.includeSelectionContext,
        onChange: (checked) => {
          settings.behavior.includeSelectionContext = checked;
        },
      }),
      createToggleField({
        label: 'Use web search for questions',
        checked: settings.behavior.enableWebSearch,
        onChange: (checked) => {
          settings.behavior.enableWebSearch = checked;
        },
      }),
      createToggleField({
        label: 'Enable type-to-search',
        checked: settings.behavior.enableTypeToSearch,
        onChange: (checked) => {
          settings.behavior.enableTypeToSearch = checked;
        },
      }),
      createToggleField({
        label: 'Enable quick search shortcut',
        checked: settings.shortcuts.enableQuickSearchShortcut,
        onChange: (checked) => {
          settings.shortcuts.enableQuickSearchShortcut = checked;
        },
      }),
      createShortcutField({
        label: 'Quick search shortcut',
        value: settings.shortcuts.quickSearchShortcut,
        isRecording: this.isRecordingShortcut,
        description: 'Click Record, then press a modifier combo such as Ctrl+Shift+K or Alt+Space.',
        onStartRecording: () => {
          this.isRecordingShortcut = true;
          this.statusMessage = 'Press the shortcut you want to use. Esc cancels.';
          this.statusTone = 'idle';
          this.render();
        },
        onCancelRecording: () => {
          this.isRecordingShortcut = false;
          this.statusMessage = 'Shortcut recording cancelled.';
          this.statusTone = 'idle';
          this.render();
        },
        onShortcutChange: (value) => {
          const normalized = normalizeSafeShortcutString(value);
          if (!normalized || !isSupportedShortcutString(normalized)) {
            this.statusMessage = 'Shortcut must include at least one modifier plus one key.';
            this.statusTone = 'error';
            this.isRecordingShortcut = false;
            this.render();
            return;
          }

          settings.shortcuts.quickSearchShortcut = normalized;
          this.isRecordingShortcut = false;
          this.statusMessage = `Shortcut set to ${normalized}. Save changes to apply it.`;
          this.statusTone = 'success';
          this.render();
        },
      }),
    ]);
  }

  private renderFooter(): HTMLElement {
    const saveButton = createElement('button', {
      className: 'dashboard-primary',
      text: this.isSaving ? 'Saving...' : 'Save changes',
      attributes: { type: 'submit' },
    });
    saveButton.disabled = this.isSaving;

    const resetButton = createElement('button', {
      className: 'dashboard-secondary',
      text: 'Reset defaults',
      attributes: { type: 'button' },
    });
    resetButton.disabled = this.isSaving;
    resetButton.addEventListener('click', () => {
      void this.reset();
    });

    return createElement('footer', { className: 'dashboard-footer' }, [
      resetButton,
      saveButton,
    ]);
  }
}

function createPanel(title: string, fields: HTMLElement[]): HTMLElement {
  return createElement('section', { className: 'dashboard-panel' }, [
    createElement('h2', { className: 'dashboard-panel-title', text: title }),
    createElement('div', { className: 'dashboard-fields' }, fields),
  ]);
}

function createInputField(options: {
  label: string;
  value: string;
  type?: 'text' | 'password';
  placeholder?: string;
  description?: string;
  onInput: (value: string) => void;
}): HTMLElement {
  const input = createElement('input', {
    className: 'dashboard-input',
    attributes: {
      type: options.type ?? 'text',
      placeholder: options.placeholder ?? '',
      autocomplete: 'off',
      spellcheck: 'false',
    },
  });
  input.value = options.value;
  input.addEventListener('input', () => options.onInput(input.value));

  return createFieldShell(options.label, input, options.description);
}

function createTextareaField(options: {
  label: string;
  value: string;
  rows: number;
  onInput: (value: string) => void;
}): HTMLElement {
  const textarea = createElement('textarea', {
    className: 'dashboard-textarea',
    attributes: {
      rows: String(options.rows),
      spellcheck: 'false',
    },
  });
  textarea.value = options.value;
  textarea.addEventListener('input', () => options.onInput(textarea.value));

  return createFieldShell(options.label, textarea);
}

function createSelectField<T extends string>(options: {
  label: string;
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
}): HTMLElement {
  const select = createElement('select', { className: 'dashboard-select' });

  for (const optionConfig of options.options) {
    const option = createElement('option', {
      text: optionConfig.label,
      attributes: { value: optionConfig.value },
    });
    option.selected = optionConfig.value === options.value;
    select.append(option);
  }

  select.addEventListener('change', () => {
    options.onChange(select.value as T);
  });

  return createFieldShell(options.label, select);
}

function createToggleField(options: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}): HTMLElement {
  const input = createElement('input', {
    className: 'dashboard-checkbox',
    attributes: { type: 'checkbox' },
  });
  input.checked = options.checked;
  input.addEventListener('change', () => options.onChange(input.checked));

  const label = createElement('label', { className: 'dashboard-toggle' }, [
    input,
    createElement('span', { text: options.label }),
  ]);

  return createElement('div', { className: 'dashboard-field' }, [label]);
}

function createShortcutField(options: {
  label: string;
  value: string;
  isRecording: boolean;
  description: string;
  onStartRecording: () => void;
  onCancelRecording: () => void;
  onShortcutChange: (value: string) => void;
}): HTMLElement {
  const value = createElement('kbd', {
    className: options.isRecording ? 'dashboard-shortcut-value is-recording' : 'dashboard-shortcut-value',
    text: options.isRecording ? 'Press keys...' : options.value,
  });
  const button = createElement('button', {
    className: options.isRecording ? 'dashboard-secondary is-recording' : 'dashboard-secondary',
    text: options.isRecording ? 'Cancel' : 'Record shortcut',
    attributes: { type: 'button' },
  });

  button.addEventListener('click', () => {
    if (options.isRecording) {
      options.onCancelRecording();
      return;
    }

    options.onStartRecording();
  });

  const recorder = createElement('div', {
    className: options.isRecording ? 'dashboard-shortcut-recorder is-recording' : 'dashboard-shortcut-recorder',
    attributes: {
      tabindex: options.isRecording ? '0' : '-1',
      role: 'button',
      'aria-label': 'Record quick search shortcut',
    },
  }, [value, button]);

  recorder.addEventListener('keydown', (event) => {
    if (!options.isRecording) return;

    event.preventDefault();
    event.stopPropagation();

    if (event.key === 'Escape') {
      options.onCancelRecording();
      return;
    }

    const shortcut = createShortcutStringFromKeyboardEvent(event);
    if (shortcut) options.onShortcutChange(shortcut);
  });

  if (options.isRecording) {
    window.setTimeout(() => recorder.focus({ preventScroll: true }), 0);
  }

  return createElement('div', { className: 'dashboard-field' }, [
    createElement('span', { className: 'dashboard-label', text: options.label }),
    recorder,
    createElement('span', { className: 'dashboard-description', text: options.description }),
  ]);
}

function createFieldShell(labelText: string, control: HTMLElement, description?: string): HTMLElement {
  const children: HTMLElement[] = [
    createElement('span', { className: 'dashboard-label', text: labelText }),
    control,
  ];

  if (description) {
    children.push(createElement('span', { className: 'dashboard-description', text: description }));
  }

  return createElement('label', { className: 'dashboard-field' }, children);
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
