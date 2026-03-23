import { html } from 'lit-html';
import type { GenerateResultData, RegenerateResultData } from './chat-state.js';
import { safeMarkdown } from './markdown-utils.js';

function downloadZip(base64: string, appName: string) {
  const bytes = atob(base64);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) {
    arr[i] = bytes.charCodeAt(i);
  }
  const blob = new Blob([arr], { type: 'application/zip' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${appName}.zip`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

function renderValidation(result: GenerateResultData | RegenerateResultData) {
  const { validation } = result;
  if (validation.valid) {
    return html`<p class="validation-ok">検証OK</p>`;
  }
  return html`
    <ul class="validation-errors">
      ${validation.errors.map(e => html`<li>${e.field}: ${e.message}</li>`)}
    </ul>
  `;
}

function renderDiff(result: RegenerateResultData) {
  const { diff } = result;
  const hasChanges = diff.added.length || diff.modified.length || diff.removed.length;
  if (!hasChanges) {
    return html`<p>変更なし</p>`;
  }
  return html`
    <ul>
      ${diff.added.map(s => html`<li class="diff-added">+ ${s}</li>`)}
      ${diff.modified.map(s => html`<li class="diff-modified">~ ${s}</li>`)}
      ${diff.removed.map(s => html`<li class="diff-removed">- ${s}</li>`)}
    </ul>
  `;
}

export function renderResultView(
  result: GenerateResultData | RegenerateResultData,
  getLatestZip?: () => string,
) {
  const design = result.design;
  const appName = design.appInfo.name;

  const handleDownload = () => {
    const zip = getLatestZip?.() || result.zipBase64;
    if (!zip) return;
    downloadZip(zip, appName);
  };

  return html`
    <div class="result-view">
      ${result.type === 'regenerate' ? html`
        <details class="result-section">
          <summary>変更差分</summary>
          <div class="result-section-content">${renderDiff(result)}</div>
        </details>
      ` : ''}

      <details class="result-section">
        <summary>設計ドキュメント</summary>
        <div class="result-section-content">
          ${safeMarkdown(result.designDocument)}
        </div>
      </details>

      <details class="result-section">
        <summary>GUI操作ガイド</summary>
        <div class="result-section-content">
          ${safeMarkdown(result.guiGuide)}
        </div>
      </details>

      <details class="result-section">
        <summary>検証結果</summary>
        <div class="result-section-content">${renderValidation(result)}</div>
      </details>

      <button
        class="download-btn"
        @click=${handleDownload}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="7 10 12 15 17 10"/>
          <line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
        ZIPダウンロード (${appName})
      </button>
    </div>
  `;
}
