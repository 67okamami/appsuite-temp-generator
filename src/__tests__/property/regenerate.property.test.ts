import { describe, it, expect, vi } from 'vitest';
import * as fc from 'fast-check';
import { Generator } from '../../generator/index.js';
import type { ParsedRequirements, DesignInfo, ComponentDefinition } from '../../types/index.js';
import { VALID_COMPONENT_TYPES } from '../../types/index.js';

// --- テスト用ヘルパー ---

function parsedRequirementsArbitrary(): fc.Arbitrary<ParsedRequirements> {
  return fc.record({
    appName: fc.string({ minLength: 1, maxLength: 50 }),
    purpose: fc.string({ minLength: 1, maxLength: 200 }),
    targetUsers: fc.array(fc.string({ minLength: 1, maxLength: 30 }), { minLength: 1, maxLength: 3 }),
    mainFeatures: fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 1, maxLength: 5 }),
    rawText: fc.string({ minLength: 1, maxLength: 200 }),
  });
}

function createExistingDesign(components: ComponentDefinition[]): DesignInfo {
  return {
    appInfo: { name: 'テストアプリ', iconId: 'icon-document', description: 'テスト用' },
    components,
    relations: [{ sourceApp: 'A', targetApp: 'B', keyField: 'id', fetchFields: ['name'], comment: 'テスト' }],
    automations: [{ type: 'calc', targetComponent: 'comp_001', formula: '1+1', comment: '計算' }],
    layout: { pc: [{ sectionName: '基本', rows: [{ components: ['comp_001'] }] }] },
    claudeInstruction: 'test',
    generatedAt: '2026-01-01T00:00:00Z',
    inputSummary: 'テスト要件',
  };
}

/**
 * LLM が既存の設計情報をそのまま返すモッククライアント
 * → 修正なしの場合、非修正要素が維持されることを検証
 */
function createNoChangeMockClient(existing: DesignInfo) {
  return {
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: JSON.stringify({
          appInfo: existing.appInfo,
          components: existing.components,
          relations: existing.relations,
          automations: existing.automations,
        }) }],
      }),
    },
  } as any;
}

// Feature: appsuite-template-generator, Property 20: 部分再生成の整合性
describe('プロパティ20: 部分再生成の整合性', () => {
  it('修正指示に関係しない設計要素は変更されない（LLMが同一データを返す場合）', async () => {
    await fc.assert(
      fc.asyncProperty(
        parsedRequirementsArbitrary(),
        fc.string({ minLength: 1, maxLength: 100 }),
        async (requirements, instruction) => {
          const components: ComponentDefinition[] = [
            { id: 'comp_001', name: 'テスト', type: 'text', required: true },
          ];
          const existing = createExistingDesign(components);
          const client = createNoChangeMockClient(existing);
          const generator = new Generator({ llmClient: client });

          const result = await generator.regenerate(requirements, instruction, existing);

          // 非修正要素が維持される
          expect(result.updated.appInfo).toEqual(existing.appInfo);
          expect(result.updated.components).toEqual(existing.components);
          expect(result.updated.layout).toEqual(existing.layout);

          // 差分は空
          expect(result.diff.added).toHaveLength(0);
          expect(result.diff.modified).toHaveLength(0);
          expect(result.diff.removed).toHaveLength(0);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('差分情報（追加・変更・削除）が明示される', async () => {
    await fc.assert(
      fc.asyncProperty(
        parsedRequirementsArbitrary(),
        async (requirements) => {
          const components: ComponentDefinition[] = [
            { id: 'comp_001', name: '元部品', type: 'text', required: true },
          ];
          const existing = createExistingDesign(components);

          // LLMが部品を追加して返すモック
          const client = {
            messages: {
              create: vi.fn().mockResolvedValue({
                content: [{ type: 'text', text: JSON.stringify({
                  appInfo: existing.appInfo,
                  components: [
                    ...existing.components,
                    { id: 'comp_002', name: '新部品', type: 'number', required: false },
                  ],
                  relations: existing.relations,
                  automations: existing.automations,
                }) }],
              }),
            },
          } as any;
          const generator = new Generator({ llmClient: client });
          const result = await generator.regenerate(requirements, '部品追加', existing);

          // 追加が明示される
          expect(result.diff.added.length).toBeGreaterThan(0);
          expect(result.diff.added.some((d) => d.includes('新部品'))).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });
});
