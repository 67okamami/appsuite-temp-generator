import { html, render } from 'lit-html';
import { unsafeHTML } from 'lit-html/directives/unsafe-html.js';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import type { ChatMessage } from './chat-state.js';
import { renderResultView } from './result-view.js';

marked.setOptions({ breaks: true });

function safeMarkdown(md: string) {
  return unsafeHTML(DOMPurify.sanitize(marked.parse(md) as string));
}

function renderMessage(msg: ChatMessage) {
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
          ${msg.result ? renderResultView(msg.result) : ''}
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
): void {
  const template = html`
    ${messages.map(renderMessage)}
    ${isGenerating ? renderLoading() : ''}
  `;
  render(template, container);
  container.scrollTop = container.scrollHeight;
}
