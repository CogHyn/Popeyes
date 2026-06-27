export type ActionId = 'translate' | 'summary';
export type StreamMode = ActionId | 'search';
export type PopupState = 'list' | 'streaming' | 'completed' | 'error' | 'chat-streaming' | 'chat-completed';

export type ChatRole = 'user' | 'assistant';
export type ChatMessageStatus = 'streaming' | 'done' | 'error';

export interface ChatMessage {
  role: ChatRole;
  content: string;
  status?: ChatMessageStatus;
}

export interface Action {
  id: ActionId;
  label: string;
  description: string;
  hotkey: '1' | '2';
  confidence: number;
}

export interface VisibleSelection {
  text: string;
  rect: DOMRect;
  context: string;
  sourceElement?: HTMLInputElement | HTMLTextAreaElement;
  sourceRange?: {
    start: number;
    end: number;
  };
}

export interface PopupPosition {
  top: number;
  left: number;
}

export interface StreamRequest {
  mode: StreamMode;
  selectedText: string;
  query?: string;
  context?: string;
}

export type StreamMessage =
  | { type: 'chunk'; chunk: string }
  | { type: 'replacement'; text: string }
  | { type: 'done' }
  | { type: 'error'; message: string };

export const ACTIONS: Action[] = [
  {
    id: 'translate',
    label: 'Translate',
    description: 'Dịch nhanh đoạn đã chọn sang tiếng Việt.',
    hotkey: '1',
    confidence: 0.72,
  },
  {
    id: 'summary',
    label: 'Summary',
    description: 'Tóm tắt ý chính, gọn và dễ quét.',
    hotkey: '2',
    confidence: 0.72,
  },
];
