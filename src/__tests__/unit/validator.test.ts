import { describe, it, expect } from 'vitest';
import { Validator } from '../../validator/index.js';
import { Renderer } from '../../renderer/index.js';
import type { AppSuiteTemplateJson } from '../../types/appsuite.js';
import type { DesignInfo } from '../../types/index.js';

// --- テスト用ヘルパー ---

function createSampleDesign(): DesignInfo {
  return {
    appInfo: { name: 'テストアプリ', iconId: 'icon-document', description: 'テスト用' },
    components: [
      { id: 'comp_001', name: '氏名', type: 'text', required: true },
      { id: 'comp_002', name: '金額', type: 'number', required: false },
    ],
    relations: [],
    automations: [],
    layout: { pc: [] },
    claudeInstruction: '',
    generatedAt: new Date().toISOString(),
    inputSummary: 'テスト',
  };
}

function createValidTemplate(): AppSuiteTemplateJson {
  const renderer = new Renderer();
  return renderer.renderTemplate(createSampleDesign());
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

  it('applications が空配列の場合はエラー', () => {
    const template = { ...createValidTemplate(), applications: [] };
    const result = validator.validate(template);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ field: 'applications' }),
    );
  });

  it('アプリ名が空の場合はエラー', () => {
    const template = createValidTemplate();
    template.applications[0].application.Name = '';
    const result = validator.validate(template);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field.includes('Name'))).toBe(true);
  });

  it('ユーザー定義フィールドが0件の場合はエラー', () => {
    const template = createValidTemplate();
    // システムフィールドのみ残す
    template.applications[0].table_fileds = template.applications[0].table_fileds.filter(
      (f) => f.system_ === '1',
    );
    const result = validator.validate(template);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field.includes('table_fileds'))).toBe(true);
  });

  it('複数エラーがある場合は全エラーを返す（要件 8.3）', () => {
    const template: AppSuiteTemplateJson = {
      version: '',
      applications: [{
        ...createValidTemplate().applications[0],
        application: { ...createValidTemplate().applications[0].application, Name: '' },
        table_fileds: [],
        tables: [],
        views: [],
      }],
    };
    const result = validator.validate(template);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(3);
  });

  // --- フィールドタイプ有効性確認 ---

  it('無効なフィールドタイプが含まれる場合はエラーと有効タイプ一覧を返す', () => {
    const template = createValidTemplate();
    template.applications[0].table_fileds.push({
      ...template.applications[0].table_fileds[0],
      type_: 'invalid_type' as any,
      system_: '0',
      ID: 999,
    });
    const result = validator.validate(template);
    expect(result.valid).toBe(false);
    const typeError = result.errors.find((e) => e.field.includes('999'));
    expect(typeError).toBeDefined();
    expect(typeError!.message).toContain('textbox');
    expect(typeError!.message).toContain('number');
  });

  it('全フィールドタイプが有効な場合はエラーなし', () => {
    const result = validator.validate(createValidTemplate());
    expect(result.valid).toBe(true);
  });

  // --- 構造の整合性 ---

  it('テーブルが空の場合はエラー', () => {
    const template = createValidTemplate();
    template.applications[0].tables = [];
    const result = validator.validate(template);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field.includes('tables'))).toBe(true);
  });

  it('ビューが空の場合はエラー', () => {
    const template = createValidTemplate();
    template.applications[0].views = [];
    const result = validator.validate(template);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field.includes('views'))).toBe(true);
  });
});
