import { describe, it, expect, vi } from 'vitest';
import { Parser, validateInput } from '../../parser/index.js';
import {
  ERROR_MESSAGES,
  InputValidationError,
  LLMApiError,
} from '../../types/errors.js';

// --- validateInput のユニットテスト ---

describe('validateInput', () => {
  it('空文字列はエラーを返す', () => {
    expect(() => validateInput('')).toThrow(InputValidationError);
    expect(() => validateInput('')).toThrow(ERROR_MESSAGES.EMPTY_INPUT);
  });

  it('スペースのみはエラーを返す', () => {
    expect(() => validateInput('   ')).toThrow(InputValidationError);
    expect(() => validateInput('   ')).toThrow(ERROR_MESSAGES.EMPTY_INPUT);
  });

  it('タブ・改行のみはエラーを返す', () => {
    expect(() => validateInput('\t\n\r')).toThrow(InputValidationError);
    expect(() => validateInput('\t\n\r')).toThrow(ERROR_MESSAGES.EMPTY_INPUT);
  });

  it('5001文字の入力はエラーを返す', () => {
    const longInput = 'あ'.repeat(5001);
    expect(() => validateInput(longInput)).toThrow(InputValidationError);
    expect(() => validateInput(longInput)).toThrow(ERROR_MESSAGES.INPUT_TOO_LONG);
  });

  it('5000文字の入力は通過する', () => {
    const maxInput = 'あ'.repeat(5000);
    expect(() => validateInput(maxInput)).not.toThrow();
  });

  it('有効な日本語入力は通過する', () => {
    expect(() => validateInput('勤怠管理アプリを作りたい')).not.toThrow();
  });

  it('有効な英語入力は通過する', () => {
    expect(() => validateInput('I want to create an attendance management app')).not.toThrow();
  });
});

// --- Parser クラスのユニットテスト ---

function createMockClient(response: object) {
  return {
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: JSON.stringify(response) }],
      }),
    },
  } as any;
}

function createFailingMockClient(error: Error) {
  return {
    messages: {
      create: vi.fn().mockRejectedValue(error),
    },
  } as any;
}

describe('Parser.parse', () => {
  it('正常な入力から ParsedRequirements を返す', async () => {
    const mockResponse = {
      appName: '勤怠管理',
      purpose: '従業員の出退勤を管理する',
      targetUsers: ['管理者', '一般社員'],
      mainFeatures: ['出勤打刻', '退勤打刻', '月次集計'],
    };
    const client = createMockClient(mockResponse);
    const parser = new Parser({ llmClient: client });

    const result = await parser.parse('勤怠管理アプリを作りたい');

    expect(result.appName).toBe('勤怠管理');
    expect(result.purpose).toBe('従業員の出退勤を管理する');
    expect(result.targetUsers).toEqual(['管理者', '一般社員']);
    expect(result.mainFeatures).toEqual(['出勤打刻', '退勤打刻', '月次集計']);
    expect(result.rawText).toBe('勤怠管理アプリを作りたい');
  });

  it('空文字列を渡すと InputValidationError をスローする', async () => {
    const client = createMockClient({});
    const parser = new Parser({ llmClient: client });

    await expect(parser.parse('')).rejects.toThrow(InputValidationError);
    await expect(parser.parse('')).rejects.toThrow(ERROR_MESSAGES.EMPTY_INPUT);
  });

  it('5000文字超を渡すと InputValidationError をスローする', async () => {
    const client = createMockClient({});
    const parser = new Parser({ llmClient: client });
    const longInput = 'x'.repeat(5001);

    await expect(parser.parse(longInput)).rejects.toThrow(InputValidationError);
    await expect(parser.parse(longInput)).rejects.toThrow(ERROR_MESSAGES.INPUT_TOO_LONG);
  });

  it('LLM API が3回失敗すると LLMApiError をスローする', async () => {
    const client = createFailingMockClient(new Error('API Error'));
    const parser = new Parser({ llmClient: client });

    await expect(parser.parse('テスト入力')).rejects.toThrow(LLMApiError);
    expect(client.messages.create).toHaveBeenCalledTimes(3);
  });

  it('LLM API が2回失敗し3回目に成功するとリトライして結果を返す', async () => {
    const mockResponse = {
      appName: 'テストアプリ',
      purpose: 'テスト目的',
      targetUsers: ['テストユーザー'],
      mainFeatures: ['テスト機能'],
    };
    const client = {
      messages: {
        create: vi
          .fn()
          .mockRejectedValueOnce(new Error('API Error 1'))
          .mockRejectedValueOnce(new Error('API Error 2'))
          .mockResolvedValueOnce({
            content: [{ type: 'text', text: JSON.stringify(mockResponse) }],
          }),
      },
    } as any;
    const parser = new Parser({ llmClient: client });

    const result = await parser.parse('テスト入力');

    expect(result.appName).toBe('テストアプリ');
    expect(client.messages.create).toHaveBeenCalledTimes(3);
  });

  it('LLM応答のJSONにフィールドが欠けている場合はデフォルト値を使用する', async () => {
    const client = createMockClient({ appName: '部分応答アプリ' });
    const parser = new Parser({ llmClient: client });

    const result = await parser.parse('部分的な応答のテスト');

    expect(result.appName).toBe('部分応答アプリ');
    expect(result.purpose).toBe('');
    expect(result.targetUsers).toEqual([]);
    expect(result.mainFeatures).toEqual([]);
  });

  it('日本語・英語混在入力を処理できる', async () => {
    const mockResponse = {
      appName: '在庫管理 Inventory',
      purpose: '在庫をリアルタイムで管理する',
      targetUsers: ['倉庫担当者', 'Warehouse Manager'],
      mainFeatures: ['入庫登録', 'Stock Out', '棚卸し'],
    };
    const client = createMockClient(mockResponse);
    const parser = new Parser({ llmClient: client });

    const result = await parser.parse('在庫管理 inventory management アプリが欲しい');

    expect(result.appName).toBe('在庫管理 Inventory');
    expect(result.rawText).toBe('在庫管理 inventory management アプリが欲しい');
  });
});
