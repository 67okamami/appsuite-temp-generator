import { describe, it, expect, vi } from 'vitest';
import * as fc from 'fast-check';
import { Generator } from '../../generator/index.js';
import { APPSUITE_ICON_IDS } from '../../generator/constants.js';
import { VALID_COMPONENT_TYPES } from '../../types/index.js';
import type { ParsedRequirements } from '../../types/index.js';
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
