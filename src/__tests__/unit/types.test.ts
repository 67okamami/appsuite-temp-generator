import { describe, it, expect } from 'vitest';
import { VALID_COMPONENT_TYPES } from '../../types/index.js';
import { ERROR_MESSAGES, CONSTRAINTS, DEFAULT_VALUES } from '../../types/errors.js';

describe('型定義のスモークテスト', () => {
  it('VALID_COMPONENT_TYPES に9種類の部品タイプが定義されている', () => {
    expect(VALID_COMPONENT_TYPES).toHaveLength(9);
    expect(VALID_COMPONENT_TYPES).toContain('text');
    expect(VALID_COMPONENT_TYPES).toContain('number');
    expect(VALID_COMPONENT_TYPES).toContain('date');
    expect(VALID_COMPONENT_TYPES).toContain('select');
    expect(VALID_COMPONENT_TYPES).toContain('checkbox');
    expect(VALID_COMPONENT_TYPES).toContain('attachment');
    expect(VALID_COMPONENT_TYPES).toContain('relation');
    expect(VALID_COMPONENT_TYPES).toContain('calc');
    expect(VALID_COMPONENT_TYPES).toContain('auto');
  });

  it('エラーメッセージ定数が設計書通り定義されている', () => {
    expect(ERROR_MESSAGES.EMPTY_INPUT).toBe('要件を入力してください');
    expect(ERROR_MESSAGES.INPUT_TOO_LONG).toBe('入力は5000文字以内にしてください');
    expect(ERROR_MESSAGES.SPEECH_RECOGNITION_FAILED).toBe(
      '音声を認識できませんでした。もう一度お試しいただくか、テキストで入力してください'
    );
  });

  it('制約定数が設計書通り定義されている', () => {
    expect(CONSTRAINTS.MAX_INPUT_LENGTH).toBe(5000);
    expect(CONSTRAINTS.MAX_APP_NAME_LENGTH).toBe(20);
    expect(CONSTRAINTS.MAX_DESCRIPTION_LENGTH).toBe(200);
    expect(CONSTRAINTS.LLM_MAX_RETRIES).toBe(3);
  });

  it('デフォルト値定数が設計書通り定義されている', () => {
    expect(DEFAULT_VALUES.APP_NAME).toBe('新規アプリ');
    expect(DEFAULT_VALUES.RELATION_PLACEHOLDER).toBe('[既存アプリ名を指定してください]');
  });
});
