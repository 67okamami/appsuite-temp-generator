// ============================================================
// エラー型・エラーメッセージ定数 — design.md「エラーハンドリング」セクションに準拠
// ============================================================

// --- 入力バリデーションエラーメッセージ ---

export const ERROR_MESSAGES = {
  EMPTY_INPUT: '要件を入力してください',
  INPUT_TOO_LONG: '入力は5000文字以内にしてください',
  SPEECH_RECOGNITION_FAILED:
    '音声を認識できませんでした。もう一度お試しいただくか、テキストで入力してください',
} as const;

// --- 生成デフォルト値 ---

export const DEFAULT_VALUES = {
  APP_NAME: '新規アプリ',
  RELATION_PLACEHOLDER: '[既存アプリ名を指定してください]',
} as const;

// --- 制約定数 ---

export const CONSTRAINTS = {
  MAX_INPUT_LENGTH: 5000,
  MAX_APP_NAME_LENGTH: 20,
  MAX_DESCRIPTION_LENGTH: 200,
  LLM_MAX_RETRIES: 3,
} as const;

// --- カスタムエラークラス ---

export class InputValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InputValidationError';
  }
}

export class GenerationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GenerationError';
  }
}

export class TemplateValidationError extends Error {
  public readonly fields: string[];

  constructor(message: string, fields: string[] = []) {
    super(message);
    this.name = 'TemplateValidationError';
    this.fields = fields;
  }
}

export class LLMApiError extends Error {
  public readonly retryCount: number;

  constructor(message: string, retryCount: number = 0) {
    super(message);
    this.name = 'LLMApiError';
    this.retryCount = retryCount;
  }
}
