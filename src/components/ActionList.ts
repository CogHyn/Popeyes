import { createElement } from '@/components/dom';
import type { Action, ActionId } from '@/types';

interface ActionListProps {
  actions: Action[];
  activeActionId: ActionId;
  onSelect: (actionId: ActionId) => void;
}

export function ActionList({ actions, activeActionId, onSelect }: ActionListProps): HTMLElement {
  const list = createElement('div', {
    className: 'action-list',
    attributes: { role: 'listbox', 'aria-label': 'AI actions' },
  });

  for (const action of actions) {
    const button = createElement(
      'button',
      {
        className: `action-button${action.id === activeActionId ? ' is-active' : ''}`,
        attributes: {
          type: 'button',
          role: 'option',
          'aria-selected': String(action.id === activeActionId),
        },
        onClick: () => onSelect(action.id),
      },
      [
        createElement('span', { className: 'action-icon', text: action.id === 'translate' ? 'T' : 'S' }),
        createElement('span', { className: 'action-copy' }, [
          createElement('span', { className: 'action-label', text: action.label }),
          createElement('span', { className: 'action-description', text: action.description }),
        ]),
        createElement('span', { className: 'action-meta' }, [
          createElement('span', { className: 'confidence', text: `${Math.round(action.confidence * 100)}%` }),
          createElement('span', { className: 'hotkey', text: action.hotkey }),
        ]),
      ],
    );

    list.append(button);
  }

  return list;
}
