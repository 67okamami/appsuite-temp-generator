import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { Renderer } from '../../renderer/index.js';
import { APPSUITE_TEMPLATE_VERSION } from '../../types/appsuite.js';
import type { DesignInfo } from '../../types/index.js';
import { VALID_COMPONENT_TYPES } from '../../types/index.js';

// --- テスト用ヘルパー ---

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
  it('同じ DesignInfo から2回生成した template.json は同一', () => {
    fc.assert(
      fc.property(
        designInfoArbitrary(),
        (designInfo) => {
          const template1 = renderer.renderTemplate(designInfo);
          const template2 = renderer.renderTemplate(designInfo);
          expect(JSON.stringify(template1)).toBe(JSON.stringify(template2));
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

          expect(doc).toContain('アプリ基本情報');
          expect(doc).toContain(designInfo.appInfo.name);
          expect(doc).toContain('部品定義表');
          expect(doc).toContain('リレーション設計');
          expect(doc).toContain('計算式・自動設定');
          expect(doc).toContain('画面デザイン案');
          expect(doc).toContain('Claude Code 用操作指示');
          expect(doc).toContain(designInfo.generatedAt);
          expect(doc).toContain(designInfo.inputSummary);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// Feature: appsuite-template-generator, Property 19: ZIPアーカイブの内容完全性
describe('プロパティ19: ZIPアーカイブの内容完全性', () => {
  it('ZIPに template.json, template_desc.json, design-document.md が含まれる', async () => {
    const JSZip = (await import('jszip')).default;

    await fc.assert(
      fc.asyncProperty(
        designInfoArbitrary(),
        async (designInfo) => {
          const zipData = await renderer.renderZipArchive(designInfo);
          const zip = await JSZip.loadAsync(zipData);

          expect(zip.file('template.json')).not.toBeNull();
          expect(zip.file('template_desc.json')).not.toBeNull();
          expect(zip.file('design-document.md')).not.toBeNull();

          // template.json が AppSuite 形式
          const content = await zip.file('template.json')!.async('string');
          const parsed = JSON.parse(content);
          expect(parsed.version).toBe(APPSUITE_TEMPLATE_VERSION);
          expect(parsed.applications[0].application.Name).toBe(designInfo.appInfo.name);
        },
      ),
      { numRuns: 50 },
    );
  });
});
