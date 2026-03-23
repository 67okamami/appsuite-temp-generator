import { ChatState } from './chat-state.js';
import type { GenerateResultData, RegenerateResultData } from './chat-state.js';
import { renderChat } from './chat-ui.js';
import { initAudioButton } from './audio-button.js';

const state = new ChatState();

const chatContainer = document.getElementById('chat-container')!;
const userInput = document.getElementById('user-input') as HTMLTextAreaElement;
const sendBtn = document.getElementById('send-btn') as HTMLButtonElement;
const audioBtn = document.getElementById('audio-btn') as HTMLButtonElement;

// Re-render on state change
state.setOnChange(() => {
  renderChat(chatContainer, state.messages, state.isGenerating);
  updateInputState();
});

function updateInputState(): void {
  const disabled = state.isGenerating;
  userInput.disabled = disabled;
  sendBtn.disabled = disabled;
}

// Welcome message
state.addSystemMessage(
  'AppSuiteテンプレートジェネレーターへようこそ。\n\n作りたいアプリの要件を入力してください。自然言語で記述するだけで、AppSuiteのテンプレートファイルを自動生成します。',
);

// Send handler
async function handleSend(): Promise<void> {
  const MAX_LENGTH = 5000;
  const text = userInput.value.trim();
  if (!text || state.isGenerating) return;
  if (text.length > MAX_LENGTH) {
    state.addErrorMessage(`入力は${MAX_LENGTH}文字以内にしてください（現在${text.length}文字）`);
    return;
  }

  userInput.value = '';
  userInput.style.height = 'auto';
  state.addUserMessage(text);
  state.setGenerating(true);

  try {
    if (state.isFirstMessage()) {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: text }),
      });
      const data = await res.json();
      if (!res.ok) {
        state.addErrorMessage(data.error || 'エラーが発生しました');
        return;
      }
      const result: GenerateResultData = {
        type: 'generate',
        design: data.design,
        designDocument: data.designDocument,
        guiGuide: data.guiGuide,
        validation: data.validation,
        zipBase64: data.zipBase64,
      };
      state.applyGenerateResult(text, result);
      state.addAssistantMessage(buildGenerateSummary(result), result);
    } else {
      const res = await fetch('/api/regenerate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originalInput: state.originalInput,
          instruction: text,
          existing: state.currentDesign,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        state.addErrorMessage(data.error || 'エラーが発生しました');
        return;
      }
      const result: RegenerateResultData = {
        type: 'regenerate',
        design: data.regenerateResult.updated,
        diff: data.regenerateResult.diff,
        designDocument: data.designDocument,
        guiGuide: data.guiGuide,
        validation: data.validation,
        zipBase64: data.zipBase64,
      };
      state.applyRegenerateResult(result);
      state.addAssistantMessage(buildRegenerateSummary(result), result);
    }
  } catch (err) {
    state.addErrorMessage('通信エラーが発生しました。ネットワーク接続を確認してください。');
  } finally {
    state.setGenerating(false);
  }
}

function buildGenerateSummary(result: GenerateResultData): string {
  const { design, validation } = result;
  const parts = [
    `**${design.appInfo.name}** のテンプレートを生成しました。`,
    '',
    `- 部品数: ${design.components.length}`,
    `- リレーション: ${design.relations.length}`,
    `- 自動処理: ${design.automations.length}`,
    `- 検証: ${validation.valid ? 'OK' : `${validation.errors.length}件のエラー`}`,
    '',
    '下のセクションを展開して詳細を確認できます。修正したい場合は追加の指示を入力してください。',
  ];
  return parts.join('\n');
}

function buildRegenerateSummary(result: RegenerateResultData): string {
  const { diff, validation } = result;
  const changes = diff.added.length + diff.modified.length + diff.removed.length;
  const parts = [
    `テンプレートを更新しました（${changes}件の変更）。`,
    '',
    `- 検証: ${validation.valid ? 'OK' : `${validation.errors.length}件のエラー`}`,
    '',
    '引き続き修正指示を入力できます。',
  ];
  return parts.join('\n');
}

// Event listeners
sendBtn.addEventListener('click', handleSend);
userInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    handleSend();
  }
});

// Auto-resize textarea
userInput.addEventListener('input', () => {
  userInput.style.height = 'auto';
  userInput.style.height = Math.min(userInput.scrollHeight, 120) + 'px';
});

// Audio button
initAudioButton(audioBtn, userInput);
