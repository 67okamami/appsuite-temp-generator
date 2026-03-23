import { html, render } from 'lit-html';
import type { ChatMessage } from './chat-state.js';
import { renderResultView } from './result-view.js';
import { safeMarkdown } from './markdown-utils.js';

function renderMessage(msg: ChatMessage, getLatestZip: () => string) {
  switch (msg.role) {
    case 'user':
      return html`<div class="message message-user">${msg.content}</div>`;
    case 'system':
      return html`<div class="message message-assistant">${safeMarkdown(msg.content)}</div>`;
    case 'error':
      return html`<div class="message message-error">${msg.content}</div>`;
    case 'assistant':
      return html`
        <div class="message message-assistant">
          ${safeMarkdown(msg.content)}
          ${msg.result ? renderResultView(msg.result, getLatestZip) : ''}
        </div>
      `;
  }
}

function renderLoading() {
  return html`
    <div class="loading">
      <div class="loading-dots">
        <span></span><span></span><span></span>
      </div>
      生成中...
    </div>
  `;
}

export function renderChat(
  container: HTMLElement,
  messages: ChatMessage[],
  isGenerating: boolean,
  getLatestZip: () => string,
): void {
  const template = html`
    ${messages.map(m => renderMessage(m, getLatestZip))}
    ${isGenerating ? renderLoading() : ''}
  `;
  render(template, container);
  container.scrollTop = container.scrollHeight;
}
