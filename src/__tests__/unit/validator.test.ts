import { describe, it, expect } from 'vitest';
import { Validator } from '../../validator/index.js';
import type { TemplateFile } from '../../types/index.js';

// --- テスト用ヘルパー ---

function createValidTemplate(): TemplateFile {
  return {
    version: '1.0',
    appName: 'テストアプリ',
    appIcon: 'icon-document',
    appDescription: 'テスト用アプリ',
    components: [
      { id: 'comp_001', name: '氏名', type: 'text', required: true },
      { id: 'comp_002', name: '金額', type: 'number', required: false },
    ],
    relations: [],
    automations: [],
    layout: { pc: [] },
  };
}

// --- テスト ---

describe('Validator.validate', () => {
  const validator = new Validator();

  // --- 必須フィールド検証 ---

  it('有効なテンプレートはバリデーション通過する', () => {
    const result = validator.validate(createValidTemplate());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('version が空の場合はエラー', () => {
    const template = { ...createValidTemplate(), version: '' };
    const result = validator.validate(template);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ field: 'version' }),
    );
  });

  it('version が空白のみの場合はエラー', () => {
    const template = { ...createValidTemplate(), version: '   ' };
    const result = validator.validate(template);
    expect(result.valid).toBe(false);
  });

  it('appName が空の場合はエラー', () => {
    const template = { ...createValidTemplate(), appName: '' };
    const result = validator.validate(template);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ field: 'appName' }),
    );
  });

  it('components が空配列の場合はエラー', () => {
    const template = { ...createValidTemplate(), components: [] };
    const result = validator.validate(template);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ field: 'components' }),
    );
  });

  it('複数の必須フィールドが欠けている場合は全エラーを返す（要件 8.3）', () => {
    const template = { ...createValidTemplate(), version: '', appName: '', components: [] as any[] };
    const result = validator.validate(template);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(3);
  });

  // --- 部品タイプ有効性確認 ---

  it('無効な部品タイプが含まれる場合はエラーと有効タイプ一覧を返す', () => {
    const template = createValidTemplate();
    template.components.push({
      id: 'comp_bad',
      name: '不正部品',
      type: 'invalid' as any,
      required: false,
    });
    const result = validator.validate(template);
    expect(result.valid).toBe(false);
    const typeError = result.errors.find((e) => e.field.includes('comp_bad'));
    expect(typeError).toBeDefined();
    expect(typeError!.message).toContain('text');
    expect(typeError!.message).toContain('number');
  });

  it('全部品タイプが有効な場合はエラーなし', () => {
    const template = createValidTemplate();
    template.components = [
      { id: 'c1', name: 'テキスト', type: 'text', required: false },
      { id: 'c2', name: '数値', type: 'number', required: false },
      { id: 'c3', name: '日付', type: 'date', required: false },
      { id: 'c4', name: '選択', type: 'select', required: false },
      { id: 'c5', name: 'チェック', type: 'checkbox', required: false },
      { id: 'c6', name: '添付', type: 'attachment', required: false },
      { id: 'c7', name: 'リレーション', type: 'relation', required: false },
      { id: 'c8', name: '計算', type: 'calc', required: false },
      { id: 'c9', name: '自動', type: 'auto', required: false },
    ];
    const result = validator.validate(template);
    expect(result.valid).toBe(true);
  });

  // --- リレーション参照整合性 ---

  it('リレーションの sourceApp が空の場合はエラー', () => {
    const template = createValidTemplate();
    template.relations = [
      { sourceApp: '', targetApp: 'アプリB', keyField: 'id', fetchFields: [] },
    ];
    const result = validator.validate(template);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field.includes('sourceApp'))).toBe(true);
  });

  it('リレーションの targetApp が空の場合はエラー', () => {
    const template = createValidTemplate();
    template.relations = [
      { sourceApp: 'アプリA', targetApp: '', keyField: 'id', fetchFields: [] },
    ];
    const result = validator.validate(template);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field.includes('targetApp'))).toBe(true);
  });

  it('リレーションの keyField が空の場合はエラー', () => {
    const template = createValidTemplate();
    template.relations = [
      { sourceApp: 'アプリA', targetApp: 'アプリB', keyField: '', fetchFields: [] },
    ];
    const result = validator.validate(template);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field.includes('keyField'))).toBe(true);
  });

  it('有効なリレーションはエラーなし', () => {
    const template = createValidTemplate();
    template.relations = [
      { sourceApp: 'アプリA', targetApp: 'アプリB', keyField: 'id', fetchFields: ['name'] },
    ];
    const result = validator.validate(template);
    expect(result.valid).toBe(true);
  });
});
