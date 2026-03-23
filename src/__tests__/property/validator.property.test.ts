import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { Validator } from '../../validator/index.js';
import { Renderer } from '../../renderer/index.js';
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
      iconId: fc.constant('icon-document'),
      description: fc.string({ minLength: 0, maxLength: 200 }),
    }),
    components: fc.array(componentArb, { minLength: 1, maxLength: 5 }),
    relations: fc.constant([]),
    automations: fc.constant([]),
    layout: fc.constant({ pc: [] }),
    claudeInstruction: fc.constant(''),
    generatedAt: fc.constant(new Date().toISOString()),
    inputSummary: fc.string({ minLength: 1, maxLength: 100 }),
  }) as fc.Arbitrary<DesignInfo>;
}

const renderer = new Renderer();
const validator = new Validator();

// Feature: appsuite-template-generator, Property 16: テンプレートファイルの必須フィールド検証
describe('プロパティ16: テンプレートファイルの必須フィールド検証', () => {
  it('Renderer が生成した有効なテンプレートはバリデーションを通過する', () => {
    fc.assert(
      fc.property(
        designInfoArbitrary(),
        (designInfo) => {
          const template = renderer.renderTemplate(designInfo);
          const result = validator.validate(template);
          expect(result.valid).toBe(true);
          expect(result.errors).toHaveLength(0);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('version が空の場合はエラーを返す', () => {
    fc.assert(
      fc.property(
        designInfoArbitrary(),
        (designInfo) => {
          const template = renderer.renderTemplate(designInfo);
          template.version = '';
          const result = validator.validate(template);
          expect(result.valid).toBe(false);
          expect(result.errors.some((e) => e.field === 'version')).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('アプリ名が空の場合はエラーを返す', () => {
    fc.assert(
      fc.property(
        designInfoArbitrary(),
        (designInfo) => {
          const template = renderer.renderTemplate(designInfo);
          template.applications[0].application.Name = '';
          const result = validator.validate(template);
          expect(result.valid).toBe(false);
          expect(result.errors.some((e) => e.field.includes('Name'))).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('ユーザー定義フィールドが空の場合はエラーを返す', () => {
    fc.assert(
      fc.property(
        designInfoArbitrary(),
        (designInfo) => {
          const template = renderer.renderTemplate(designInfo);
          template.applications[0].table_fileds = template.applications[0].table_fileds.filter(
            (f) => f.system_ === '1',
          );
          const result = validator.validate(template);
          expect(result.valid).toBe(false);
          expect(result.errors.some((e) => e.field.includes('table_fileds'))).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });
});
