export const popupStyles = `
  :host {
    all: initial;
    position: fixed;
    z-index: 2147483647;
    width: 340px;
    min-height: 164px;
    max-height: 320px;
    color-scheme: light;
    font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    -webkit-user-select: none;
    user-select: none;
  }

  * {
    box-sizing: border-box;
    letter-spacing: 0;
  }

  button,
  input,
  textarea {
    font: inherit;
  }

  .assist-popup {
    width: 340px;
    max-height: 320px;
    overflow: hidden;
    border: 1px solid rgba(15, 23, 42, 0.12);
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.98);
    box-shadow: 0 16px 44px rgba(15, 23, 42, 0.18), 0 4px 14px rgba(15, 23, 42, 0.12);
    color: #111827;
    display: flex;
    flex-direction: column;
    -webkit-user-select: none;
    user-select: none;
  }

  .assist-header {
    min-height: 38px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 8px 9px 6px 12px;
    border-bottom: 1px solid rgba(15, 23, 42, 0.08);
  }

  .assist-title {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .assist-kicker {
    color: #64748b;
    font-size: 11px;
    line-height: 1.2;
    font-weight: 650;
  }

  .assist-selection {
    max-width: 238px;
    overflow: hidden;
    color: #334155;
    font-size: 12px;
    line-height: 1.25;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .assist-close,
  .assist-icon-button {
    width: 28px;
    height: 28px;
    flex: 0 0 28px;
    display: inline-grid;
    place-items: center;
    border: 0;
    border-radius: 6px;
    background: transparent;
    color: #475569;
    cursor: pointer;
  }

  .assist-close:hover,
  .assist-icon-button:hover {
    background: #f1f5f9;
    color: #0f172a;
  }

  .assist-body {
    min-height: 0;
    padding: 10px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .action-list {
    display: grid;
    gap: 7px;
  }

  .action-button {
    width: 100%;
    min-height: 52px;
    display: grid;
    grid-template-columns: 28px minmax(0, 1fr) auto;
    align-items: center;
    gap: 9px;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    background: #ffffff;
    color: #0f172a;
    padding: 8px;
    text-align: left;
    cursor: pointer;
  }

  .action-button:hover,
  .action-button.is-active {
    border-color: #2563eb;
    background: #eff6ff;
  }

  .action-button:focus-visible,
  .assist-close:focus-visible,
  .assist-icon-button:focus-visible,
  .query-input:focus-visible {
    outline: 2px solid #2563eb;
    outline-offset: 2px;
  }

  .action-icon {
    width: 28px;
    height: 28px;
    display: grid;
    place-items: center;
    border-radius: 7px;
    background: #e0f2fe;
    color: #075985;
    font-size: 15px;
    font-weight: 800;
  }

  .action-copy {
    min-width: 0;
  }

  .action-label {
    display: block;
    font-size: 13px;
    line-height: 1.2;
    font-weight: 760;
  }

  .action-description {
    display: block;
    margin-top: 2px;
    color: #64748b;
    font-size: 12px;
    line-height: 1.25;
  }

  .action-meta {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .hotkey {
    width: 22px;
    height: 22px;
    display: inline-grid;
    place-items: center;
    border: 1px solid #cbd5e1;
    border-radius: 6px;
    background: #f8fafc;
    color: #334155;
    font-size: 11px;
    font-weight: 760;
  }

  .confidence {
    color: #64748b;
    font-size: 11px;
    font-weight: 700;
  }

  .query-shell {
    display: grid;
    gap: 7px;
  }

  .query-input {
    width: 100%;
    min-height: 38px;
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    background: #ffffff;
    color: #0f172a;
    padding: 9px 10px;
    font-size: 13px;
    -webkit-user-select: text;
    user-select: text;
  }

  .query-input::placeholder {
    color: #94a3b8;
  }

  .query-hint {
    color: #64748b;
    font-size: 11px;
    line-height: 1.35;
  }

  .chat-shell {
    min-height: 0;
    display: grid;
    gap: 8px;
  }

  .chat-transcript {
    min-height: 156px;
    max-height: 230px;
    overflow: auto;
    padding: 2px;
  }

  .chat-answer {
    width: 100%;
    min-height: 156px;
    border-radius: 8px;
    border: 1px solid #e2e8f0;
    background: #f8fafc;
    color: #0f172a;
    padding: 8px 10px;
    font-size: 13px;
    line-height: 1.45;
    white-space: pre-wrap;
    word-break: break-word;
  }

  .chat-answer.is-error {
    border-color: #fecaca;
    background: #fef2f2;
    color: #991b1b;
  }

  .stream-output {
    min-height: 104px;
    max-height: 144px;
    overflow: auto;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    background: #f8fafc;
    color: #0f172a;
    padding: 9px 10px;
    font-size: 13px;
    line-height: 1.45;
    white-space: pre-wrap;
  }

  .stream-output.is-error {
    border-color: #fecaca;
    background: #fef2f2;
    color: #991b1b;
  }

  .stream-placeholder {
    color: #64748b;
  }

  .stream-actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .stream-group {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .assist-command {
    height: 30px;
    border: 1px solid #dbe3ee;
    border-radius: 7px;
    background: #ffffff;
    color: #1e293b;
    padding: 0 9px;
    font-size: 12px;
    font-weight: 730;
    cursor: pointer;
  }

  .assist-command:hover {
    border-color: #94a3b8;
    background: #f8fafc;
  }

  .assist-command.is-primary {
    border-color: #2563eb;
    background: #2563eb;
    color: #ffffff;
  }

  .assist-command.is-danger {
    border-color: #fecaca;
    color: #b91c1c;
  }
`;
