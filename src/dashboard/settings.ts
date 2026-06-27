export type LlmProvider = 'groq' | 'mock';
export type SearchProvider = 'tavily' | 'disabled' | 'mock';
export type SummaryLength = 'short' | 'medium' | 'detailed';
export type AnswerStyle = 'concise' | 'detailed' | 'bullet_points';

export const DEFAULT_QUICK_SEARCH_SHORTCUT = 'Ctrl+Shift+K';
const SHORTCUT_MODIFIERS = ['Ctrl', 'Alt', 'Shift', 'Meta'] as const;

export interface AiProviderSettings {
  llmProvider: LlmProvider;
  groqApiKey: string;
  groqModel: string;
  searchProvider: SearchProvider;
  tavilyApiKey: string;
}

export interface PromptSettings {
  translatePrompt: string;
  summaryPrompt: string;
  searchAnswerPrompt: string;
}

export interface BehaviorSettings {
  summaryLength: SummaryLength;
  answerStyle: AnswerStyle;
  includeSelectionContext: boolean;
  enableWebSearch: boolean;
}

export interface ShortcutSettings {
  enableQuickSearchShortcut: boolean;
  quickSearchShortcut: string;
}

export interface DashboardSettings {
  provider: AiProviderSettings;
  prompts: PromptSettings;
  behavior: BehaviorSettings;
  shortcuts: ShortcutSettings;
}

export const DASHBOARD_SETTINGS_KEY = 'ai-assistant-dashboard-settings';

const DEFAULT_TRANSLATE_PROMPT = [
  'You are a precise translation engine.',
  'Translate the selected text into natural Vietnamese.',
  'Preserve meaning, tone, formatting, proper nouns, and customer-message nuance.',
  'Return only the translated text.',
].join(' ');

const DEFAULT_SUMMARY_PROMPT = [
  'You summarize text for Vietnamese users.',
  'Preserve the key ideas and important details.',
  'Return only the summary, without prefacing or explaining your answer.',
].join(' ');

const DEFAULT_SEARCH_ANSWER_PROMPT = [
  'You answer search questions for Vietnamese users.',
  'Prioritize the highlighted context over web results.',
  'Use web results only as supporting context.',
  'If the available information is insufficient, say that briefly.',
].join(' ');

export function getDefaultDashboardSettings(): DashboardSettings {
  return {
    provider: {
      llmProvider: 'groq',
      groqApiKey: '',
      groqModel: 'qwen/qwen3-32b',
      searchProvider: 'tavily',
      tavilyApiKey: '',
    },
    prompts: {
      translatePrompt: DEFAULT_TRANSLATE_PROMPT,
      summaryPrompt: DEFAULT_SUMMARY_PROMPT,
      searchAnswerPrompt: DEFAULT_SEARCH_ANSWER_PROMPT,
    },
    behavior: {
      summaryLength: 'medium',
      answerStyle: 'concise',
      includeSelectionContext: true,
      enableWebSearch: true,
    },
    shortcuts: {
      enableQuickSearchShortcut: true,
      quickSearchShortcut: DEFAULT_QUICK_SEARCH_SHORTCUT,
    },
  };
}

export async function getDashboardSettings(): Promise<DashboardSettings> {
  const result = await browser.storage.local.get(DASHBOARD_SETTINGS_KEY);
  return normalizeDashboardSettings(result[DASHBOARD_SETTINGS_KEY]);
}

export async function saveDashboardSettings(settings: DashboardSettings): Promise<DashboardSettings> {
  const normalized = normalizeDashboardSettings(settings);
  await browser.storage.local.set({
    [DASHBOARD_SETTINGS_KEY]: normalized,
  });

  return normalized;
}

export async function resetDashboardSettings(): Promise<DashboardSettings> {
  const defaults = getDefaultDashboardSettings();
  await browser.storage.local.set({
    [DASHBOARD_SETTINGS_KEY]: defaults,
  });

  return defaults;
}

export function normalizeDashboardSettings(value: unknown): DashboardSettings {
  const defaults = getDefaultDashboardSettings();
  const root = asRecord(value);
  const provider = asRecord(root.provider);
  const prompts = asRecord(root.prompts);
  const behavior = asRecord(root.behavior);
  const shortcuts = asRecord(root.shortcuts);

  return {
    provider: {
      llmProvider: asEnum(provider.llmProvider, ['groq', 'mock'], defaults.provider.llmProvider),
      groqApiKey: asString(provider.groqApiKey, defaults.provider.groqApiKey),
      groqModel: asString(provider.groqModel, defaults.provider.groqModel),
      searchProvider: asEnum(provider.searchProvider, ['tavily', 'disabled', 'mock'], defaults.provider.searchProvider),
      tavilyApiKey: asString(provider.tavilyApiKey, defaults.provider.tavilyApiKey),
    },
    prompts: {
      translatePrompt: asString(prompts.translatePrompt, defaults.prompts.translatePrompt),
      summaryPrompt: asString(prompts.summaryPrompt, defaults.prompts.summaryPrompt),
      searchAnswerPrompt: asString(prompts.searchAnswerPrompt, defaults.prompts.searchAnswerPrompt),
    },
    behavior: {
      summaryLength: asEnum(behavior.summaryLength, ['short', 'medium', 'detailed'], defaults.behavior.summaryLength),
      answerStyle: asEnum(behavior.answerStyle, ['concise', 'detailed', 'bullet_points'], defaults.behavior.answerStyle),
      includeSelectionContext: asBoolean(behavior.includeSelectionContext, defaults.behavior.includeSelectionContext),
      enableWebSearch: asBoolean(behavior.enableWebSearch, defaults.behavior.enableWebSearch),
    },
    shortcuts: {
      enableQuickSearchShortcut: asBoolean(
        shortcuts.enableQuickSearchShortcut,
        defaults.shortcuts.enableQuickSearchShortcut,
      ),
      quickSearchShortcut: normalizeSafeShortcutString(
        asString(shortcuts.quickSearchShortcut, defaults.shortcuts.quickSearchShortcut),
      ) || defaults.shortcuts.quickSearchShortcut,
    },
  };
}

export function normalizeShortcutString(value: string): string {
  const tokens = value
    .split('+')
    .map((token) => normalizeShortcutToken(token))
    .filter(Boolean);
  const modifiers = [
    tokens.includes('Ctrl') ? 'Ctrl' : '',
    tokens.includes('Alt') ? 'Alt' : '',
    tokens.includes('Shift') ? 'Shift' : '',
    tokens.includes('Meta') ? 'Meta' : '',
  ].filter(Boolean);
  const key = tokens.find((token) => !isShortcutModifier(token));

  return key ? [...modifiers, key].join('+') : '';
}

export function normalizeSafeShortcutString(value: string): string {
  const normalized = normalizeShortcutString(value);
  return isSupportedShortcutString(normalized) ? normalized : '';
}

export function isSupportedShortcutString(value: string): boolean {
  const parts = normalizeShortcutString(value).split('+').filter(Boolean);
  const hasModifier = parts.some(isShortcutModifier);
  const hasKey = parts.some((part) => !isShortcutModifier(part));

  return hasModifier && hasKey;
}

export function createShortcutStringFromKeyboardEvent(event: KeyboardEvent): string {
  const key = normalizeShortcutToken(event.key === ' ' ? 'Space' : event.key);
  if (!key || isShortcutModifier(key)) return '';

  return normalizeShortcutString([
    event.ctrlKey ? 'Ctrl' : '',
    event.altKey ? 'Alt' : '',
    event.shiftKey ? 'Shift' : '',
    event.metaKey ? 'Meta' : '',
    key,
  ].filter(Boolean).join('+'));
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function asString(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

function asBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function asEnum<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && allowed.includes(value as T)
    ? value as T
    : fallback;
}

function normalizeShortcutToken(value: string): string {
  const token = value.trim().toLowerCase();
  if (!token) return '';
  if (token === 'control' || token === 'ctrl') return 'Ctrl';
  if (token === 'option' || token === 'alt') return 'Alt';
  if (token === 'shift') return 'Shift';
  if (token === 'cmd' || token === 'command' || token === 'meta') return 'Meta';
  if (token === 'space') return 'Space';
  if (token.length === 1) return token.toUpperCase();
  return token[0].toUpperCase() + token.slice(1);
}

function isShortcutModifier(value: string): boolean {
  return SHORTCUT_MODIFIERS.includes(value as typeof SHORTCUT_MODIFIERS[number]);
}
