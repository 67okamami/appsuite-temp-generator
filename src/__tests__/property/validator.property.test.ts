import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { Validator } from '../../validator/index.js';
import type { TemplateFile, ComponentType } from '../../types/index.js';
import { VALID_COMPONENT_TYPES } from '../../types/index.js';

// --- テスト用ヘルパー ---

/** 有効な TemplateFile の任意生成器 */
function validTemplateFileArbitrary(): fc.Arbitrary<TemplateFile> {
  return fc.record({
    version: fc.string({ minLength: 1, maxLength: 10 }).filter((s) => s.trim().length > 0),
    appName: fc.string({ minLength: 1, maxLength: 20 }).filter((s) => s.trim().length > 0),
    appIcon: fc.string({ minLength: 1, maxLength: 30 }),
    appDescription: fc.string({ minLength: 0, maxLength: 200 }),
    components: fc.array(
      fc.record({
        id: fc.string({ minLength: 1, maxLength: 10 }),
        name: fc.string({ minLength: 1, maxLength: 30 }),
        type: fc.constantFrom(...VALID_COMPONENT_TYPES),
        required: fc.boolean(),
      }),
      { minLength: 1, maxLength: 5 },
    ),
    relations: fc.constant([]),
    automations: fc.constant([]),
    layout: fc.constant({ pc: [] }),
  }) as fc.Arbitrary<TemplateFile>;
}

// Feature: appsuite-template-generator, Property 16: テンプレートファイルの必須フィールド検証
describe('プロパティ16: テンプレートファイルの必須フィールド検証', () => {
  const validator = new Validator();

  it('有効なテンプレートファイルはバリデーションを通過する', () => {
    fc.assert(
      fc.property(
        validTemplateFileArbitrary(),
        (template) => {
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
        validTemplateFileArbitrary(),
        (template) => {
          const invalid = { ...template, version: '' };
          const result = validator.validate(invalid);
          expect(result.valid).toBe(false);
          expect(result.errors.some((e) => e.field === 'version')).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('appName が空の場合はエラーを返す', () => {
    fc.assert(
      fc.property(
        validTemplateFileArbitrary(),
        (template) => {
          const invalid = { ...template, appName: '' };
          const result = validator.validate(invalid);
          expect(result.valid).toBe(false);
          expect(result.errors.some((e) => e.field === 'appName')).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('components が空配列の場合はエラーを返す', () => {
    fc.assert(
      fc.property(
        validTemplateFileArbitrary(),
        (template) => {
          const invalid = { ...template, components: [] };
          const result = validator.validate(invalid);
          expect(result.valid).toBe(false);
          expect(result.errors.some((e) => e.field === 'components')).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('無効な部品タイプが含まれる場合はエラーを返す', () => {
    fc.assert(
      fc.property(
        validTemplateFileArbitrary(),
        fc.string({ minLength: 1, maxLength: 20 }).filter(
          (s) => !VALID_COMPONENT_TYPES.includes(s as ComponentType),
        ),
        (template, invalidType) => {
          const invalid = {
            ...template,
            components: [
              ...template.components,
              { id: 'invalid_comp', name: 'テスト', type: invalidType as ComponentType, required: false },
            ],
          };
          const result = validator.validate(invalid);
          expect(result.valid).toBe(false);
          expect(result.errors.some((e) => e.field.includes('invalid_comp'))).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });
});
