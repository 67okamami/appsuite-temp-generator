import { describe, it, expect, vi } from 'vitest';
import { Generator } from '../../generator/index.js';
import { APPSUITE_ICON_IDS } from '../../generator/constants.js';
import { DEFAULT_VALUES, LLMApiError } from '../../types/errors.js';
import type { ParsedRequirements } from '../../types/index.js';

// --- テスト用ヘルパー ---

const sampleRequirements: ParsedRequirements = {
  appName: '勤怠管理',
  purpose: '従業員の出退勤を管理する',
  targetUsers: ['管理者', '一般社員'],
  mainFeatures: ['出勤打刻', '退勤打刻', '月次集計'],
  rawText: '勤怠管理アプリを作りたい',
};

function createMockClient(appInfoResponse: object, componentsResponse: object) {
  let callCount = 0;
  return {
    messages: {
      create: vi.fn().mockImplementation(async () => {
        callCount++;
        // generate() は AppInfo と Components を並列呼び出しするため
        // 呼び出し順は保証されないが、システムプロンプトで判別する
        // ここでは callCount で簡易的に分岐
        const response = callCount <= 1 ? appInfoResponse : componentsResponse;
        return {
          content: [{ type: 'text', text: JSON.stringify(response) }],
        };
      }),
    },
  } as any;
}

function createAppInfoOnlyMock(response: object) {
  return {
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: JSON.stringify(response) }],
      }),
    },
  } as any;
}

// --- AppInfo 生成テスト ---

describe('Generator.generateAppInfo', () => {
  it('正常な応答からAppInfoを生成する', async () => {
    const client = createAppInfoOnlyMock({
      name: '勤怠管理',
      iconId: 'icon-people',
      description: '従業員の出退勤を管理するアプリです。',
    });
    const generator = new Generator({ llmClient: client });
    const result = await generator.generateAppInfo(sampleRequirements);

    expect(result.name).toBe('勤怠管理');
    expect(result.iconId).toBe('icon-people');
    expect(result.description).toBe('従業員の出退勤を管理するアプリです。');
  });

  it('アプリ名が20文字を超える場合は切り詰める', async () => {
    const client = createAppInfoOnlyMock({
      name: 'あ'.repeat(25),
      iconId: 'icon-document',
      description: 'テスト',
    });
    const generator = new Generator({ llmClient: client });
    const result = await generator.generateAppInfo(sampleRequirements);

    expect(result.name.length).toBe(20);
  });

  it('アプリ名が空の場合はデフォルト値を使用する（要件 2.4）', async () => {
    const client = createAppInfoOnlyMock({
      name: '',
      iconId: 'icon-document',
      description: 'テスト',
    });
    const generator = new Generator({ llmClient: client });
    const result = await generator.generateAppInfo(sampleRequirements);

    expect(result.name).toBe(DEFAULT_VALUES.APP_NAME);
  });

  it('アイコンIDが無効な場合はデフォルトアイコンを使用する', async () => {
    const client = createAppInfoOnlyMock({
      name: 'テスト',
      iconId: 'icon-invalid-xxx',
      description: 'テスト',
    });
    const generator = new Generator({ llmClient: client });
    const result = await generator.generateAppInfo(sampleRequirements);

    expect(result.iconId).toBe(APPSUITE_ICON_IDS[0]);
  });

  it('説明文が200文字を超える場合は切り詰める', async () => {
    const client = createAppInfoOnlyMock({
      name: 'テスト',
      iconId: 'icon-document',
      description: 'あ'.repeat(250),
    });
    const generator = new Generator({ llmClient: client });
    const result = await generator.generateAppInfo(sampleRequirements);

    expect(result.description.length).toBe(200);
  });

  it('LLM API失敗時はフォールバック値を返す', async () => {
    const client = {
      messages: {
        create: vi.fn().mockRejectedValue(new Error('API Error')),
      },
    } as any;
    const generator = new Generator({ llmClient: client });
    const result = await generator.generateAppInfo(sampleRequirements);

    expect(result.name).toBe(DEFAULT_VALUES.APP_NAME);
    expect(result.iconId).toBe(APPSUITE_ICON_IDS[0]);
    expect(result.description).toBe('');
  });
});

// --- ComponentDefinition 生成テスト ---

describe('Generator.generateComponents', () => {
  it('正常な応答から部品定義を生成する', async () => {
    const client = createAppInfoOnlyMock({
      components: [
        { id: 'comp_001', name: '社員名', type: 'text', required: true },
        { id: 'comp_002', name: '出勤日', type: 'date', required: true },
        { id: 'comp_003', name: '勤務時間', type: 'calc', required: false, formula: 'comp_end - comp_start' },
      ],
    });
    const generator = new Generator({ llmClient: client });
    const result = await generator.generateComponents(sampleRequirements);

    expect(result).toHaveLength(3);
    expect(result[0].name).toBe('社員名');
    expect(result[0].type).toBe('text');
    expect(result[2].type).toBe('calc');
    expect(result[2].formula).toBe('comp_end - comp_start');
  });

  it('無効な部品タイプはフィルタリングされる', async () => {
    const client = createAppInfoOnlyMock({
      components: [
        { id: 'comp_001', name: '有効', type: 'text', required: true },
        { id: 'comp_002', name: '無効', type: 'invalid_type', required: false },
        { id: 'comp_003', name: '有効2', type: 'number', required: false },
      ],
    });
    const generator = new Generator({ llmClient: client });
    const result = await generator.generateComponents(sampleRequirements);

    expect(result).toHaveLength(2);
    expect(result.map((c) => c.name)).toEqual(['有効', '有効2']);
  });

  it('select タイプには options が設定される', async () => {
    const client = createAppInfoOnlyMock({
      components: [
        { id: 'comp_001', name: 'ステータス', type: 'select', required: true, options: ['未着手', '進行中', '完了'] },
      ],
    });
    const generator = new Generator({ llmClient: client });
    const result = await generator.generateComponents(sampleRequirements);

    expect(result[0].options).toEqual(['未着手', '進行中', '完了']);
  });

  it('LLM APIが3回失敗するとLLMApiErrorをスローする', async () => {
    const client = {
      messages: {
        create: vi.fn().mockRejectedValue(new Error('API Error')),
      },
    } as any;
    const generator = new Generator({ llmClient: client });

    await expect(generator.generateComponents(sampleRequirements)).rejects.toThrow(LLMApiError);
    expect(client.messages.create).toHaveBeenCalledTimes(3);
  });

  it('空の components 配列を返す場合は空配列を返す', async () => {
    const client = createAppInfoOnlyMock({ components: [] });
    const generator = new Generator({ llmClient: client });
    const result = await generator.generateComponents(sampleRequirements);

    expect(result).toEqual([]);
  });
});

// --- generate() 統合テスト ---

describe('Generator.generate', () => {
  it('DesignInfo を返す（タスク4時点のフィールド）', async () => {
    const client = createMockClient(
      { name: '勤怠管理', iconId: 'icon-people', description: 'テスト説明' },
      { components: [{ id: 'comp_001', name: '社員名', type: 'text', required: true }] },
    );
    const generator = new Generator({ llmClient: client });
    const result = await generator.generate(sampleRequirements);

    expect(result.appInfo.name).toBe('勤怠管理');
    expect(result.components).toHaveLength(1);
    expect(result.relations).toEqual([]);
    expect(result.automations).toEqual([]);
    expect(result.layout).toEqual({ pc: [] });
    expect(result.claudeInstruction).toBe('');
    expect(result.generatedAt).toBeTruthy();
    expect(result.inputSummary).toBe(sampleRequirements.rawText);
  });
});
