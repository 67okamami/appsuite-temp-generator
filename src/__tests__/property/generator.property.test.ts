import { describe, it, expect, vi } from 'vitest';
import * as fc from 'fast-check';
import { Generator } from '../../generator/index.js';
import { APPSUITE_ICON_IDS } from '../../generator/constants.js';
import { VALID_COMPONENT_TYPES } from '../../types/index.js';
import type { ParsedRequirements, ComponentDefinition } from '../../types/index.js';
import { CONSTRAINTS } from '../../types/errors.js';

// --- テスト用ヘルパー ---

/** ParsedRequirements の任意生成器 */
function parsedRequirementsArbitrary(): fc.Arbitrary<ParsedRequirements> {
  return fc.record({
    appName: fc.string({ minLength: 1, maxLength: 50 }),
    purpose: fc.string({ minLength: 1, maxLength: 200 }),
    targetUsers: fc.array(fc.string({ minLength: 1, maxLength: 30 }), { minLength: 1, maxLength: 5 }),
    mainFeatures: fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 1, maxLength: 10 }),
    rawText: fc.string({ minLength: 1, maxLength: 500 }),
  });
}

/** AppInfo を返すモッククライアント */
function createAppInfoMockClient(overrides: Record<string, unknown> = {}) {
  const defaultResponse = {
    name: 'テストアプリ',
    iconId: 'icon-document',
    description: 'テスト用アプリの説明文です。',
    ...overrides,
  };
  return {
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: JSON.stringify(defaultResponse) }],
      }),
    },
  } as any;
}

/** ComponentDefinition[] を返すモッククライアント */
function createComponentsMockClient(components: unknown[]) {
  return {
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: JSON.stringify({ components }) }],
      }),
    },
  } as any;
}

// --- プロパティテスト ---

// Feature: appsuite-template-generator, Property 4: アプリ名の文字数制約
describe('プロパティ4: アプリ名の文字数制約', () => {
  it('生成されるアプリ名は20文字以内', async () => {
    await fc.assert(
      fc.asyncProperty(
        parsedRequirementsArbitrary(),
        fc.string({ minLength: 0, maxLength: 40 }),
        async (requirements, rawName) => {
          const client = createAppInfoMockClient({ name: rawName });
          const generator = new Generator({ llmClient: client });
          const appInfo = await generator.generateAppInfo(requirements);
          expect(appInfo.name.length).toBeLessThanOrEqual(CONSTRAINTS.MAX_APP_NAME_LENGTH);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// Feature: appsuite-template-generator, Property 5: アイコン識別子の有効性
describe('プロパティ5: アイコン識別子の有効性', () => {
  it('生成されるアイコン識別子はAppSuite標準アイコンセットに含まれる', async () => {
    await fc.assert(
      fc.asyncProperty(
        parsedRequirementsArbitrary(),
        fc.string({ minLength: 0, maxLength: 30 }),
        async (requirements, rawIconId) => {
          const client = createAppInfoMockClient({ iconId: rawIconId });
          const generator = new Generator({ llmClient: client });
          const appInfo = await generator.generateAppInfo(requirements);
          expect((APPSUITE_ICON_IDS as readonly string[]).includes(appInfo.iconId)).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// Feature: appsuite-template-generator, Property 6: 説明文の文字数制約
describe('プロパティ6: 説明文の文字数制約', () => {
  it('生成される説明文は200文字以内', async () => {
    await fc.assert(
      fc.asyncProperty(
        parsedRequirementsArbitrary(),
        fc.string({ minLength: 0, maxLength: 400 }),
        async (requirements, rawDesc) => {
          const client = createAppInfoMockClient({ description: rawDesc });
          const generator = new Generator({ llmClient: client });
          const appInfo = await generator.generateAppInfo(requirements);
          expect(appInfo.description.length).toBeLessThanOrEqual(CONSTRAINTS.MAX_DESCRIPTION_LENGTH);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// Feature: appsuite-template-generator, Property 7: 部品定義の完全性と有効性
describe('プロパティ7: 部品定義の完全性と有効性', () => {
  it('全部品定義は部品名・部品タイプ・必須チェックを持ち、タイプは有効な値', async () => {
    const validComponents = [
      { id: 'comp_001', name: '氏名', type: 'text', required: true },
      { id: 'comp_002', name: '金額', type: 'number', required: false },
      { id: 'comp_003', name: '日付', type: 'date', required: true },
      { id: 'comp_004', name: 'ステータス', type: 'select', required: true, options: ['未着手', '進行中', '完了'] },
    ];

    await fc.assert(
      fc.asyncProperty(
        parsedRequirementsArbitrary(),
        fc.shuffledSubarray(validComponents, { minLength: 1 }),
        async (requirements, subset) => {
          const client = createComponentsMockClient(subset);
          const generator = new Generator({ llmClient: client });
          const components = await generator.generateComponents(requirements);

          for (const comp of components) {
            expect(typeof comp.name).toBe('string');
            expect(typeof comp.type).toBe('string');
            expect(typeof comp.required).toBe('boolean');
            expect(VALID_COMPONENT_TYPES).toContain(comp.type);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

// Feature: appsuite-template-generator, Property 8: 数値項目の部品タイプ割り当て
describe('プロパティ8: 数値項目の部品タイプ割り当て', () => {
  it('数値関連の部品タイプは number または calc', async () => {
    await fc.assert(
      fc.asyncProperty(
        parsedRequirementsArbitrary(),
        async (requirements) => {
          const numericComponents = [
            { id: 'comp_001', name: '金額', type: 'number', required: true },
            { id: 'comp_002', name: '合計', type: 'calc', required: false, formula: 'SUM(comp_001)' },
            { id: 'comp_003', name: '数量', type: 'number', required: true },
          ];
          const client = createComponentsMockClient(numericComponents);
          const generator = new Generator({ llmClient: client });
          const components = await generator.generateComponents(requirements);

          const numericTypes = components
            .filter((c) => ['金額', '合計', '数量'].includes(c.name))
            .map((c) => c.type);

          for (const t of numericTypes) {
            expect(['number', 'calc']).toContain(t);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

// Feature: appsuite-template-generator, Property 9: 択一項目の部品タイプ割り当て
describe('プロパティ9: 択一項目の部品タイプ割り当て', () => {
  it('択一関連の部品タイプは select または checkbox', async () => {
    await fc.assert(
      fc.asyncProperty(
        parsedRequirementsArbitrary(),
        async (requirements) => {
          const selectComponents = [
            { id: 'comp_001', name: '承認状態', type: 'select', required: true, options: ['承認', '却下'] },
            { id: 'comp_002', name: '確認済み', type: 'checkbox', required: false },
          ];
          const client = createComponentsMockClient(selectComponents);
          const generator = new Generator({ llmClient: client });
          const components = await generator.generateComponents(requirements);

          const choiceTypes = components
            .filter((c) => ['承認状態', '確認済み'].includes(c.name))
            .map((c) => c.type);

          for (const t of choiceTypes) {
            expect(['select', 'checkbox']).toContain(t);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

// Feature: appsuite-template-generator, Property 10: Markdown出力形式の保証
// NOTE: Markdown テーブル出力は Renderer の責務（タスク8）。
//       ここでは Generator が返す ComponentDefinition が Markdown テーブルに変換可能な構造を持つことを検証する。
describe('プロパティ10: Markdown出力形式の保証（構造検証）', () => {
  it('部品定義は Markdown テーブルに変換可能な構造を持つ', async () => {
    await fc.assert(
      fc.asyncProperty(
        parsedRequirementsArbitrary(),
        async (requirements) => {
          const components = [
            { id: 'comp_001', name: 'テスト', type: 'text', required: true },
          ];
          const client = createComponentsMockClient(components);
          const generator = new Generator({ llmClient: client });
          const result = await generator.generateComponents(requirements);

          for (const comp of result) {
            expect(comp).toHaveProperty('name');
            expect(comp).toHaveProperty('type');
            expect(comp).toHaveProperty('required');
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

// --- リレーション・自動化・レイアウト用モッククライアント ---

function createMultiResponseMockClient(responses: Record<string, object>) {
  return {
    messages: {
      create: vi.fn().mockImplementation(async (args: any) => {
        const system = args.system || '';
        let response: object = {};
        if (system.includes('リレーション')) {
          response = responses.relations ?? { relations: [] };
        } else if (system.includes('計算式') || system.includes('自動設定')) {
          response = responses.automations ?? { automations: [], additionalComponents: [] };
        } else if (system.includes('レイアウト')) {
          response = responses.layout ?? { pc: [] };
        } else if (system.includes('部品定義')) {
          response = responses.components ?? { components: [] };
        } else {
          response = responses.appInfo ?? { name: 'テスト', iconId: 'icon-document', description: 'テスト' };
        }
        return {
          content: [{ type: 'text', text: JSON.stringify(response) }],
        };
      }),
    },
  } as any;
}

// Feature: appsuite-template-generator, Property 11: リレーションコメントの存在
describe('プロパティ11: リレーションコメントの存在', () => {
  it('全リレーション定義にコメントが存在し空文字列でない', async () => {
    await fc.assert(
      fc.asyncProperty(
        parsedRequirementsArbitrary(),
        async (requirements) => {
          const client = createMultiResponseMockClient({
            relations: {
              relations: [
                { sourceApp: 'アプリA', targetApp: 'アプリB', keyField: 'id', fetchFields: ['name'], comment: '顧客情報を参照' },
                { sourceApp: 'アプリA', targetApp: '', keyField: 'id', fetchFields: [], comment: '部署情報を参照' },
              ],
            },
          });
          const generator = new Generator({ llmClient: client });
          const relations = await generator.generateRelations(requirements);

          for (const rel of relations) {
            expect(typeof rel.comment).toBe('string');
            expect(rel.comment.trim().length).toBeGreaterThan(0);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('コメントが空のリレーションはフィルタリングされる', async () => {
    await fc.assert(
      fc.asyncProperty(
        parsedRequirementsArbitrary(),
        async (requirements) => {
          const client = createMultiResponseMockClient({
            relations: {
              relations: [
                { sourceApp: 'A', targetApp: 'B', keyField: 'id', fetchFields: [], comment: '' },
                { sourceApp: 'A', targetApp: 'C', keyField: 'id', fetchFields: [], comment: '有効なコメント' },
              ],
            },
          });
          const generator = new Generator({ llmClient: client });
          const relations = await generator.generateRelations(requirements);

          expect(relations.length).toBe(1);
          expect(relations[0].comment).toBe('有効なコメント');
        },
      ),
      { numRuns: 100 },
    );
  });
});

// Feature: appsuite-template-generator, Property 12: 自動化定義のコメント存在
describe('プロパティ12: 自動化定義のコメント存在', () => {
  it('全自動化定義にコメントが存在し空文字列でない', async () => {
    const sampleComponents: ComponentDefinition[] = [
      { id: 'comp_001', name: '単価', type: 'number', required: true },
      { id: 'comp_002', name: '数量', type: 'number', required: true },
    ];

    await fc.assert(
      fc.asyncProperty(
        parsedRequirementsArbitrary(),
        async (requirements) => {
          const client = createMultiResponseMockClient({
            automations: {
              automations: [
                { type: 'calc', targetComponent: 'comp_003', formula: 'comp_001 * comp_002', comment: '合計金額を計算' },
                { type: 'auto', targetComponent: 'comp_004', conditions: [], comment: 'ステータスを自動設定' },
              ],
              additionalComponents: [],
            },
          });
          const generator = new Generator({ llmClient: client });
          const result = await generator.generateAutomations(requirements, sampleComponents);

          for (const auto of result.automations) {
            expect(typeof auto.comment).toBe('string');
            expect(auto.comment.trim().length).toBeGreaterThan(0);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

// Feature: appsuite-template-generator, Property 13: PC版レイアウトの必須生成
describe('プロパティ13: PC版レイアウトの必須生成', () => {
  it('PC版レイアウトが生成され全セクションに名前がある', async () => {
    const components: ComponentDefinition[] = [
      { id: 'comp_001', name: 'テスト1', type: 'text', required: true },
      { id: 'comp_002', name: 'テスト2', type: 'number', required: false },
    ];

    await fc.assert(
      fc.asyncProperty(
        fc.boolean(),
        async (includeMobile) => {
          const client = createMultiResponseMockClient({
            layout: {
              pc: [
                { sectionName: '基本情報', rows: [{ components: ['comp_001', 'comp_002'] }] },
              ],
              mobile: includeMobile
                ? [{ sectionName: '基本情報', rows: [{ components: ['comp_001'] }, { components: ['comp_002'] }] }]
                : undefined,
            },
          });
          const generator = new Generator({ llmClient: client });
          const layout = await generator.generateLayout(components, includeMobile);

          expect(Array.isArray(layout.pc)).toBe(true);
          for (const section of layout.pc) {
            expect(typeof section.sectionName).toBe('string');
            expect(section.sectionName.trim().length).toBeGreaterThan(0);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

// Feature: appsuite-template-generator, Property 14: モバイル版レイアウトの縦1列制約
describe('プロパティ14: モバイル版レイアウトの縦1列制約', () => {
  it('モバイル版レイアウトの全行は1部品のみ', async () => {
    const components: ComponentDefinition[] = [
      { id: 'comp_001', name: 'テスト1', type: 'text', required: true },
      { id: 'comp_002', name: 'テスト2', type: 'number', required: false },
      { id: 'comp_003', name: 'テスト3', type: 'date', required: false },
    ];

    await fc.assert(
      fc.asyncProperty(
        parsedRequirementsArbitrary(),
        async () => {
          const client = createMultiResponseMockClient({
            layout: {
              pc: [{ sectionName: '基本', rows: [{ components: ['comp_001', 'comp_002', 'comp_003'] }] }],
              mobile: [{
                sectionName: '基本',
                rows: [
                  { components: ['comp_001', 'comp_002'] },
                  { components: ['comp_002'] },
                  { components: ['comp_003'] },
                ],
              }],
            },
          });
          const generator = new Generator({ llmClient: client });
          const layout = await generator.generateLayout(components, true);

          if (layout.mobile) {
            for (const section of layout.mobile) {
              for (const row of section.rows) {
                expect(row.components.length).toBeLessThanOrEqual(1);
              }
            }
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

// Feature: appsuite-template-generator, Property 15: Claude Code操作指示の完全性
describe('プロパティ15: Claude Code操作指示の完全性', () => {
  it('操作指示にアプリ基本情報・部品定義・テンプレート形式仕様が含まれる', async () => {
    await fc.assert(
      fc.asyncProperty(
        parsedRequirementsArbitrary(),
        async () => {
          const client = createMultiResponseMockClient({});
          const generator = new Generator({ llmClient: client });

          const designInfo = {
            appInfo: { name: 'テストアプリ', iconId: 'icon-document', description: 'テスト説明' },
            components: [{ id: 'comp_001', name: '項目1', type: 'text' as const, required: true }],
            relations: [],
            automations: [],
            layout: { pc: [{ sectionName: '基本', rows: [{ components: ['comp_001'] }] }] },
            claudeInstruction: '',
            generatedAt: new Date().toISOString(),
            inputSummary: 'テスト',
          };

          const instruction = generator.buildClaudeInstruction(designInfo);

          // (1) アプリ基本情報
          expect(instruction).toContain('テストアプリ');
          expect(instruction).toContain('icon-document');
          // (2) 部品定義
          expect(instruction).toContain('comp_001');
          expect(instruction).toContain('項目1');
          // (3) Markdown コードブロック形式
          expect(instruction).toContain('```json');
          // (4) テンプレートファイル形式仕様
          expect(instruction).toContain('"version"');
          expect(instruction).toContain('"appName"');
        },
      ),
      { numRuns: 100 },
    );
  });
});
