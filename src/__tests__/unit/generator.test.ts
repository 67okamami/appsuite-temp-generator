import { describe, it, expect, vi } from 'vitest';
import { Generator } from '../../generator/index.js';
import { APPSUITE_ICON_IDS } from '../../generator/constants.js';
import { DEFAULT_VALUES, LLMApiError } from '../../types/errors.js';
import type { ParsedRequirements, ComponentDefinition, DesignInfo } from '../../types/index.js';

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

// --- RelationDefinition 生成テスト ---

function createRelationsMock(relations: object[]) {
  return {
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: JSON.stringify({ relations }) }],
      }),
    },
  } as any;
}

describe('Generator.generateRelations', () => {
  it('正常な応答からリレーション定義を生成する', async () => {
    const client = createRelationsMock([
      { sourceApp: '受注管理', targetApp: '顧客マスタ', keyField: '顧客ID', fetchFields: ['顧客名', '住所'], comment: '顧客情報を参照するため' },
    ]);
    const generator = new Generator({ llmClient: client });
    const result = await generator.generateRelations(sampleRequirements);

    expect(result).toHaveLength(1);
    expect(result[0].sourceApp).toBe('受注管理');
    expect(result[0].comment).toBe('顧客情報を参照するため');
  });

  it('targetApp が空の場合はプレースホルダーを使用する（要件 4.3）', async () => {
    const client = createRelationsMock([
      { sourceApp: 'アプリA', targetApp: '', keyField: 'id', fetchFields: [], comment: '参照用' },
    ]);
    const generator = new Generator({ llmClient: client });
    const result = await generator.generateRelations(sampleRequirements);

    expect(result[0].targetApp).toBe(DEFAULT_VALUES.RELATION_PLACEHOLDER);
  });

  it('コメントが空のリレーションは除外される（要件 4.2）', async () => {
    const client = createRelationsMock([
      { sourceApp: 'A', targetApp: 'B', keyField: 'id', fetchFields: [], comment: '' },
      { sourceApp: 'A', targetApp: 'C', keyField: 'id', fetchFields: [], comment: '有効' },
    ]);
    const generator = new Generator({ llmClient: client });
    const result = await generator.generateRelations(sampleRequirements);

    expect(result).toHaveLength(1);
  });

  it('LLM API失敗時は空配列を返す', async () => {
    const client = {
      messages: { create: vi.fn().mockRejectedValue(new Error('API Error')) },
    } as any;
    const generator = new Generator({ llmClient: client });
    const result = await generator.generateRelations(sampleRequirements);

    expect(result).toEqual([]);
  });
});

// --- AutomationDefinition 生成テスト ---

describe('Generator.generateAutomations', () => {
  const sampleComponents: ComponentDefinition[] = [
    { id: 'comp_001', name: '単価', type: 'number', required: true },
    { id: 'comp_002', name: '数量', type: 'number', required: true },
  ];

  it('計算式と自動設定を生成する', async () => {
    const client = {
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [{ type: 'text', text: JSON.stringify({
            automations: [
              { type: 'calc', targetComponent: 'comp_003', formula: 'comp_001 * comp_002', comment: '合計金額を計算' },
              { type: 'auto', targetComponent: 'comp_004', conditions: [{ field: 'comp_003', operator: 'gt', value: 10000, setValue: '要承認' }], comment: '高額の場合は承認必要' },
            ],
            additionalComponents: [
              { id: 'comp_003', name: '合計金額', type: 'calc', required: false },
            ],
          }) }],
        }),
      },
    } as any;
    const generator = new Generator({ llmClient: client });
    const result = await generator.generateAutomations(sampleRequirements, sampleComponents);

    expect(result.automations).toHaveLength(2);
    expect(result.automations[0].type).toBe('calc');
    expect(result.automations[1].type).toBe('auto');
    expect(result.additionalComponents).toHaveLength(1);
    expect(result.additionalComponents[0].name).toBe('合計金額');
  });

  it('コメントが空の自動化定義は除外される（要件 5.3）', async () => {
    const client = {
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [{ type: 'text', text: JSON.stringify({
            automations: [
              { type: 'calc', targetComponent: 'comp_003', formula: 'x', comment: '' },
              { type: 'calc', targetComponent: 'comp_004', formula: 'y', comment: '有効' },
            ],
            additionalComponents: [],
          }) }],
        }),
      },
    } as any;
    const generator = new Generator({ llmClient: client });
    const result = await generator.generateAutomations(sampleRequirements, sampleComponents);

    expect(result.automations).toHaveLength(1);
  });

  it('不足部品を自動追加する（要件 5.4）', async () => {
    const client = {
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [{ type: 'text', text: JSON.stringify({
            automations: [
              { type: 'calc', targetComponent: 'comp_003', formula: 'comp_001 * comp_002', comment: '計算' },
            ],
            additionalComponents: [
              { id: 'comp_003', name: '合計', type: 'calc', required: false },
            ],
          }) }],
        }),
      },
    } as any;
    const generator = new Generator({ llmClient: client });
    const result = await generator.generateAutomations(sampleRequirements, sampleComponents);

    expect(result.additionalComponents).toHaveLength(1);
    expect(result.additionalComponents[0].id).toBe('comp_003');
  });
});

// --- LayoutDefinition 生成テスト ---

describe('Generator.generateLayout', () => {
  const sampleComps: ComponentDefinition[] = [
    { id: 'comp_001', name: '氏名', type: 'text', required: true },
    { id: 'comp_002', name: '日付', type: 'date', required: true },
  ];

  it('PC版レイアウトを生成する', async () => {
    const client = {
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [{ type: 'text', text: JSON.stringify({
            pc: [{ sectionName: '基本情報', rows: [{ components: ['comp_001', 'comp_002'] }] }],
          }) }],
        }),
      },
    } as any;
    const generator = new Generator({ llmClient: client });
    const result = await generator.generateLayout(sampleComps, false);

    expect(result.pc).toHaveLength(1);
    expect(result.pc[0].sectionName).toBe('基本情報');
    expect(result.mobile).toBeUndefined();
  });

  it('モバイル版レイアウトで各行が1部品に制限される（要件 6.6）', async () => {
    const client = {
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [{ type: 'text', text: JSON.stringify({
            pc: [{ sectionName: '基本', rows: [{ components: ['comp_001', 'comp_002'] }] }],
            mobile: [{ sectionName: '基本', rows: [{ components: ['comp_001', 'comp_002'] }, { components: ['comp_002'] }] }],
          }) }],
        }),
      },
    } as any;
    const generator = new Generator({ llmClient: client });
    const result = await generator.generateLayout(sampleComps, true);

    expect(result.mobile).toBeDefined();
    for (const section of result.mobile!) {
      for (const row of section.rows) {
        expect(row.components.length).toBeLessThanOrEqual(1);
      }
    }
  });

  it('セクション名が空のセクションは除外される', async () => {
    const client = {
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [{ type: 'text', text: JSON.stringify({
            pc: [
              { sectionName: '', rows: [{ components: ['comp_001'] }] },
              { sectionName: '有効', rows: [{ components: ['comp_002'] }] },
            ],
          }) }],
        }),
      },
    } as any;
    const generator = new Generator({ llmClient: client });
    const result = await generator.generateLayout(sampleComps, false);

    expect(result.pc).toHaveLength(1);
    expect(result.pc[0].sectionName).toBe('有効');
  });
});

// --- Claude Code 操作指示テスト ---

describe('Generator.buildClaudeInstruction', () => {
  it('全セクションを含む操作指示を生成する（要件 7.1〜7.4）', () => {
    const client = createAppInfoOnlyMock({});
    const generator = new Generator({ llmClient: client });

    const design: DesignInfo = {
      appInfo: { name: '受注管理', iconId: 'icon-cart', description: '受注を管理する' },
      components: [
        { id: 'comp_001', name: '商品名', type: 'text', required: true },
        { id: 'comp_002', name: '金額', type: 'number', required: true },
      ],
      relations: [
        { sourceApp: '受注管理', targetApp: '顧客マスタ', keyField: '顧客ID', fetchFields: ['顧客名'], comment: '顧客情報参照' },
      ],
      automations: [
        { type: 'calc', targetComponent: 'comp_003', formula: 'comp_002 * 1.1', comment: '税込金額計算' },
      ],
      layout: { pc: [{ sectionName: '基本', rows: [{ components: ['comp_001', 'comp_002'] }] }] },
      claudeInstruction: '',
      generatedAt: '2026-01-01T00:00:00Z',
      inputSummary: 'テスト',
    };

    const instruction = generator.buildClaudeInstruction(design);

    // アプリ基本情報
    expect(instruction).toContain('受注管理');
    expect(instruction).toContain('icon-cart');
    // 部品定義テーブル
    expect(instruction).toContain('商品名');
    expect(instruction).toContain('金額');
    // リレーション設計テーブル
    expect(instruction).toContain('顧客マスタ');
    expect(instruction).toContain('顧客情報参照');
    // 計算式
    expect(instruction).toContain('税込金額計算');
    // レイアウト
    expect(instruction).toContain('基本');
    // テンプレート形式仕様
    expect(instruction).toContain('```json');
    expect(instruction).toContain('"version"');
  });
});

// --- generate() 統合テスト ---

describe('Generator.generate', () => {
  it('完全な DesignInfo を返す', async () => {
    const responses: Record<string, object> = {
      appInfo: { name: '勤怠管理', iconId: 'icon-people', description: 'テスト説明' },
      components: { components: [{ id: 'comp_001', name: '社員名', type: 'text', required: true }] },
      relations: { relations: [] },
      automations: { automations: [], additionalComponents: [] },
      layout: { pc: [{ sectionName: '基本', rows: [{ components: ['comp_001'] }] }] },
    };
    const client = {
      messages: {
        create: vi.fn().mockImplementation(async (args: any) => {
          const system: string = typeof args.system === 'string' ? args.system : '';
          let response: object;
          if (system.includes('リレーション設計')) {
            response = responses.relations;
          } else if (system.includes('計算式・自動設定')) {
            response = responses.automations;
          } else if (system.includes('画面レイアウトを生成')) {
            response = responses.layout;
          } else if (system.includes('部品定義表を生成')) {
            response = responses.components;
          } else {
            response = responses.appInfo;
          }
          return { content: [{ type: 'text', text: JSON.stringify(response) }] };
        }),
      },
    } as any;
    const generator = new Generator({ llmClient: client });
    const result = await generator.generate(sampleRequirements);

    expect(result.appInfo.name).toBe('勤怠管理');
    expect(result.components).toHaveLength(1);
    expect(result.relations).toEqual([]);
    expect(result.automations).toEqual([]);
    expect(result.layout.pc).toHaveLength(1);
    expect(result.claudeInstruction).toContain('勤怠管理');
    expect(result.generatedAt).toBeTruthy();
    expect(result.inputSummary).toBe(sampleRequirements.rawText);
  });
});

// --- regenerate() テスト ---

describe('Generator.regenerate', () => {
  const existingDesign: DesignInfo = {
    appInfo: { name: '勤怠管理', iconId: 'icon-people', description: '出退勤を管理する' },
    components: [
      { id: 'comp_001', name: '社員名', type: 'text', required: true },
      { id: 'comp_002', name: '出勤日', type: 'date', required: true },
    ],
    relations: [],
    automations: [],
    layout: { pc: [{ sectionName: '基本', rows: [{ components: ['comp_001', 'comp_002'] }] }] },
    claudeInstruction: '',
    generatedAt: '2026-01-01T00:00:00Z',
    inputSummary: '勤怠管理アプリ',
  };

  it('修正指示に基づいて部品を追加し差分を返す', async () => {
    const client = {
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [{ type: 'text', text: JSON.stringify({
            appInfo: { name: '勤怠管理', iconId: 'icon-people', description: '出退勤を管理する' },
            components: [
              { id: 'comp_001', name: '社員名', type: 'text', required: true },
              { id: 'comp_002', name: '出勤日', type: 'date', required: true },
              { id: 'comp_003', name: '退勤時刻', type: 'date', required: false },
            ],
            relations: [],
            automations: [],
          }) }],
        }),
      },
    } as any;
    const generator = new Generator({ llmClient: client });
    const result = await generator.regenerate(sampleRequirements, '退勤時刻の部品を追加して', existingDesign);

    expect(result.updated.components).toHaveLength(3);
    expect(result.diff.added).toContainEqual(expect.stringContaining('退勤時刻'));
    expect(result.diff.removed).toHaveLength(0);
  });

  it('修正指示に基づいて部品を削除し差分を返す', async () => {
    const client = {
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [{ type: 'text', text: JSON.stringify({
            appInfo: { name: '勤怠管理', iconId: 'icon-people', description: '出退勤を管理する' },
            components: [
              { id: 'comp_001', name: '社員名', type: 'text', required: true },
            ],
            relations: [],
            automations: [],
          }) }],
        }),
      },
    } as any;
    const generator = new Generator({ llmClient: client });
    const result = await generator.regenerate(sampleRequirements, '出勤日を削除して', existingDesign);

    expect(result.updated.components).toHaveLength(1);
    expect(result.diff.removed).toContainEqual(expect.stringContaining('出勤日'));
  });

  it('修正指示に基づいてアプリ名を変更し差分を返す', async () => {
    const client = {
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [{ type: 'text', text: JSON.stringify({
            appInfo: { name: '出退勤管理', iconId: 'icon-people', description: '出退勤を管理する' },
            components: existingDesign.components,
            relations: [],
            automations: [],
          }) }],
        }),
      },
    } as any;
    const generator = new Generator({ llmClient: client });
    const result = await generator.regenerate(sampleRequirements, 'アプリ名を出退勤管理に変えて', existingDesign);

    expect(result.updated.appInfo.name).toBe('出退勤管理');
    expect(result.diff.modified).toContainEqual(expect.stringContaining('アプリ名'));
  });

  it('変更がない場合は差分が空', async () => {
    const client = {
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [{ type: 'text', text: JSON.stringify({
            appInfo: existingDesign.appInfo,
            components: existingDesign.components,
            relations: [],
            automations: [],
          }) }],
        }),
      },
    } as any;
    const generator = new Generator({ llmClient: client });
    const result = await generator.regenerate(sampleRequirements, '何も変えないで', existingDesign);

    expect(result.diff.added).toHaveLength(0);
    expect(result.diff.modified).toHaveLength(0);
    expect(result.diff.removed).toHaveLength(0);
  });

  it('レイアウトは維持される', async () => {
    const client = {
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [{ type: 'text', text: JSON.stringify({
            appInfo: existingDesign.appInfo,
            components: existingDesign.components,
            relations: [],
            automations: [],
          }) }],
        }),
      },
    } as any;
    const generator = new Generator({ llmClient: client });
    const result = await generator.regenerate(sampleRequirements, 'テスト', existingDesign);

    expect(result.updated.layout).toEqual(existingDesign.layout);
  });
});

// --- regenerateAll() テスト ---

describe('Generator.regenerateAll', () => {
  it('全設計情報を最初から再生成する', async () => {
    const client = {
      messages: {
        create: vi.fn().mockImplementation(async (args: any) => {
          const system: string = typeof args.system === 'string' ? args.system : '';
          let response: object;
          if (system.includes('リレーション設計')) {
            response = { relations: [] };
          } else if (system.includes('計算式・自動設定')) {
            response = { automations: [], additionalComponents: [] };
          } else if (system.includes('画面レイアウトを生成')) {
            response = { pc: [{ sectionName: '新基本', rows: [{ components: ['comp_001'] }] }] };
          } else if (system.includes('部品定義表を生成')) {
            response = { components: [{ id: 'comp_001', name: '新部品', type: 'text', required: true }] };
          } else {
            response = { name: '新アプリ', iconId: 'icon-document', description: '新しい説明' };
          }
          return { content: [{ type: 'text', text: JSON.stringify(response) }] };
        }),
      },
    } as any;
    const generator = new Generator({ llmClient: client });
    const result = await generator.regenerateAll(sampleRequirements);

    expect(result.appInfo.name).toBe('新アプリ');
    expect(result.components).toHaveLength(1);
    expect(result.components[0].name).toBe('新部品');
  });
});
