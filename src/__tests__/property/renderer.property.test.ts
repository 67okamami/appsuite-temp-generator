import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { Renderer, parseTemplateToDesignInfo } from '../../renderer/index.js';
import type { DesignInfo, ComponentType } from '../../types/index.js';
import { VALID_COMPONENT_TYPES } from '../../types/index.js';

// --- テスト用ヘルパー ---

/** DesignInfo の任意生成器 */
function designInfoArbitrary(): fc.Arbitrary<DesignInfo> {
  const componentArb = fc.record({
    id: fc.string({ minLength: 1, maxLength: 10 }).filter((s) => s.trim().length > 0),
    name: fc.string({ minLength: 1, maxLength: 30 }).filter((s) => s.trim().length > 0),
    type: fc.constantFrom(...VALID_COMPONENT_TYPES),
    required: fc.boolean(),
  });

  return fc.record({
    appInfo: fc.record({
      name: fc.string({ minLength: 1, maxLength: 20 }).filter((s) => s.trim().length > 0),
      iconId: fc.string({ minLength: 1, maxLength: 30 }).filter((s) => s.trim().length > 0),
      description: fc.string({ minLength: 0, maxLength: 200 }),
    }),
    components: fc.array(componentArb, { minLength: 1, maxLength: 5 }),
    relations: fc.constant([]),
    automations: fc.constant([]),
    layout: fc.constant({ pc: [{ sectionName: '基本', rows: [{ components: ['c1'] }] }] }),
    claudeInstruction: fc.string({ minLength: 0, maxLength: 100 }),
    generatedAt: fc.constant(new Date().toISOString()),
    inputSummary: fc.string({ minLength: 1, maxLength: 100 }),
  }) as fc.Arbitrary<DesignInfo>;
}

const renderer = new Renderer();

// Feature: appsuite-template-generator, Property 17: テンプレートファイルのラウンドトリップ
describe('プロパティ17: テンプレートファイルのラウンドトリップ', () => {
  it('テンプレートファイルを生成→パース→再生成した結果は元と等価', () => {
    fc.assert(
      fc.property(
        designInfoArbitrary(),
        (designInfo) => {
          const template1 = renderer.renderTemplate(designInfo);
          const parsed = parseTemplateToDesignInfo(template1, designInfo);
          const template2 = renderer.renderTemplate(parsed);
          expect(template2).toEqual(template1);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// Feature: appsuite-template-generator, Property 18: 設計ドキュメントの完全性
describe('プロパティ18: 設計ドキュメントの完全性', () => {
  it('設計ドキュメントに全必須セクションが含まれる', () => {
    fc.assert(
      fc.property(
        designInfoArbitrary(),
        (designInfo) => {
          const doc = renderer.renderDesignDocument(designInfo);

          // アプリ基本情報
          expect(doc).toContain('アプリ基本情報');
          expect(doc).toContain(designInfo.appInfo.name);
          // 部品定義表
          expect(doc).toContain('部品定義表');
          // リレーション設計
          expect(doc).toContain('リレーション設計');
          // 計算式・自動設定
          expect(doc).toContain('計算式・自動設定');
          // 画面デザイン案
          expect(doc).toContain('画面デザイン案');
          // Claude Code 用操作指示
          expect(doc).toContain('Claude Code 用操作指示');
          // 生成日時（要件 9.2）
          expect(doc).toContain(designInfo.generatedAt);
          // 入力要件サマリー（要件 9.2）
          expect(doc).toContain(designInfo.inputSummary);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// Feature: appsuite-template-generator, Property 19: ZIPアーカイブの内容完全性
describe('プロパティ19: ZIPアーカイブの内容完全性', () => {
  it('ZIPアーカイブにテンプレートファイルと設計ドキュメントが含まれる', async () => {
    // JSZip を動的インポートして ZIP を展開検証
    const JSZip = (await import('jszip')).default;

    await fc.assert(
      fc.asyncProperty(
        designInfoArbitrary(),
        async (designInfo) => {
          const zipData = await renderer.renderZipArchive(designInfo);
          const zip = await JSZip.loadAsync(zipData);

          // テンプレートファイルが含まれる
          expect(zip.file('template.json')).not.toBeNull();
          // 設計ドキュメントが含まれる
          expect(zip.file('design-document.md')).not.toBeNull();

          // テンプレートファイルの内容が有効な JSON
          const templateContent = await zip.file('template.json')!.async('string');
          const parsed = JSON.parse(templateContent);
          expect(parsed.appName).toBe(designInfo.appInfo.name);

          // 設計ドキュメントの内容にアプリ名が含まれる
          const docContent = await zip.file('design-document.md')!.async('string');
          expect(docContent).toContain(designInfo.appInfo.name);
        },
      ),
      { numRuns: 50 },
    );
  });
});
