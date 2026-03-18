import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { Renderer } from '../../renderer/index.js';
import type { DesignInfo } from '../../types/index.js';

// --- テスト用ヘルパー ---

function createSampleDesign(): DesignInfo {
  return {
    appInfo: {
      name: '受注管理',
      iconId: 'icon-cart',
      description: '受注を管理するアプリです。',
    },
    components: [
      { id: 'comp_001', name: '商品名', type: 'text', required: true },
      { id: 'comp_002', name: '金額', type: 'number', required: true },
      { id: 'comp_003', name: 'ステータス', type: 'select', required: true, options: ['未処理', '処理中', '完了'] },
      { id: 'comp_004', name: '税込金額', type: 'calc', required: false, formula: 'comp_002 * 1.1' },
    ],
    relations: [
      { sourceApp: '受注管理', targetApp: '顧客マスタ', keyField: '顧客ID', fetchFields: ['顧客名', '住所'], comment: '顧客情報を参照' },
    ],
    automations: [
      { type: 'calc', targetComponent: 'comp_004', formula: 'comp_002 * 1.1', comment: '税込金額を自動計算' },
      { type: 'auto', targetComponent: 'comp_003', conditions: [{ field: 'comp_002', operator: 'gt' as const, value: 10000, setValue: '要確認' }], comment: '高額時にステータス変更' },
    ],
    layout: {
      pc: [
        { sectionName: '基本情報', rows: [{ components: ['comp_001', 'comp_002'] }, { components: ['comp_003', 'comp_004'] }] },
      ],
    },
    claudeInstruction: '# テスト用操作指示',
    generatedAt: '2026-01-01T00:00:00Z',
    inputSummary: '受注管理アプリを作りたい',
  };
}

const renderer = new Renderer();

// --- renderTemplate テスト ---

describe('Renderer.renderTemplate', () => {
  it('DesignInfo から TemplateFile を生成する', () => {
    const design = createSampleDesign();
    const template = renderer.renderTemplate(design);

    expect(template.version).toBe('1.0');
    expect(template.appName).toBe('受注管理');
    expect(template.appIcon).toBe('icon-cart');
    expect(template.appDescription).toBe('受注を管理するアプリです。');
    expect(template.components).toHaveLength(4);
    expect(template.relations).toHaveLength(1);
    expect(template.automations).toHaveLength(2);
  });

  it('select タイプの options が保持される', () => {
    const design = createSampleDesign();
    const template = renderer.renderTemplate(design);
    const selectComp = template.components.find((c) => c.id === 'comp_003');

    expect(selectComp?.options).toEqual(['未処理', '処理中', '完了']);
  });

  it('calc タイプの formula が保持される', () => {
    const design = createSampleDesign();
    const template = renderer.renderTemplate(design);
    const calcComp = template.components.find((c) => c.id === 'comp_004');

    expect(calcComp?.formula).toBe('comp_002 * 1.1');
  });

  it('リレーションから comment が除外される', () => {
    const design = createSampleDesign();
    const template = renderer.renderTemplate(design);

    expect(template.relations[0]).not.toHaveProperty('comment');
  });

  it('自動化から comment が除外される', () => {
    const design = createSampleDesign();
    const template = renderer.renderTemplate(design);

    expect(template.automations[0]).not.toHaveProperty('comment');
  });
});

// --- renderDesignDocument テスト ---

describe('Renderer.renderDesignDocument', () => {
  it('Markdown 形式の設計ドキュメントを生成する', () => {
    const design = createSampleDesign();
    const doc = renderer.renderDesignDocument(design);

    expect(doc).toContain('# 受注管理 設計ドキュメント');
  });

  it('部品定義表が Markdown テーブル形式（要件 3.5）', () => {
    const design = createSampleDesign();
    const doc = renderer.renderDesignDocument(design);

    expect(doc).toContain('| ID | 部品名 | タイプ | 必須 |');
    expect(doc).toContain('|---|---|---|---|');
    expect(doc).toContain('| comp_001 | 商品名 | text | ○ |');
  });

  it('リレーション設計が Markdown テーブル形式（要件 4.4）', () => {
    const design = createSampleDesign();
    const doc = renderer.renderDesignDocument(design);

    expect(doc).toContain('| 参照元 | 参照先 | キー | 取得フィールド | 目的 |');
    expect(doc).toContain('| 受注管理 | 顧客マスタ | 顧客ID | 顧客名, 住所 | 顧客情報を参照 |');
  });

  it('生成日時と入力要件サマリーが含まれる（要件 9.2）', () => {
    const design = createSampleDesign();
    const doc = renderer.renderDesignDocument(design);

    expect(doc).toContain('2026-01-01T00:00:00Z');
    expect(doc).toContain('受注管理アプリを作りたい');
  });

  it('Claude Code 用操作指示が含まれる', () => {
    const design = createSampleDesign();
    const doc = renderer.renderDesignDocument(design);

    expect(doc).toContain('## Claude Code 用操作指示');
    expect(doc).toContain('# テスト用操作指示');
  });

  it('リレーションがない場合は「リレーションなし」と表示', () => {
    const design = { ...createSampleDesign(), relations: [] };
    const doc = renderer.renderDesignDocument(design);

    expect(doc).toContain('リレーションなし');
  });

  it('自動化がない場合は「計算式・自動設定なし」と表示', () => {
    const design = { ...createSampleDesign(), automations: [] };
    const doc = renderer.renderDesignDocument(design);

    expect(doc).toContain('計算式・自動設定なし');
  });
});

// --- renderZipArchive テスト ---

describe('Renderer.renderZipArchive', () => {
  it('ZIP にテンプレートファイルと設計ドキュメントが含まれる（要件 9.3）', async () => {
    const design = createSampleDesign();
    const zipData = await renderer.renderZipArchive(design);
    const zip = await JSZip.loadAsync(zipData);

    expect(zip.file('template.json')).not.toBeNull();
    expect(zip.file('design-document.md')).not.toBeNull();
  });

  it('ZIP 内のテンプレートファイルが有効な JSON', async () => {
    const design = createSampleDesign();
    const zipData = await renderer.renderZipArchive(design);
    const zip = await JSZip.loadAsync(zipData);

    const content = await zip.file('template.json')!.async('string');
    const parsed = JSON.parse(content);

    expect(parsed.version).toBe('1.0');
    expect(parsed.appName).toBe('受注管理');
    expect(parsed.components).toHaveLength(4);
  });

  it('ZIP 内の設計ドキュメントが Markdown', async () => {
    const design = createSampleDesign();
    const zipData = await renderer.renderZipArchive(design);
    const zip = await JSZip.loadAsync(zipData);

    const content = await zip.file('design-document.md')!.async('string');

    expect(content).toContain('# 受注管理 設計ドキュメント');
    expect(content).toContain('## 部品定義表');
  });
});
