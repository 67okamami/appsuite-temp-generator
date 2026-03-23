import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { Renderer } from '../../renderer/index.js';
import { COMPONENT_TYPE_TO_APPSUITE, APPSUITE_TEMPLATE_VERSION } from '../../types/appsuite.js';
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
    ],
    layout: {
      pc: [{ sectionName: '基本情報', rows: [{ components: ['comp_001', 'comp_002'] }] }],
    },
    claudeInstruction: '# テスト用操作指示',
    generatedAt: '2026-01-01T00:00:00Z',
    inputSummary: '受注管理アプリを作りたい',
  };
}

const renderer = new Renderer();

// --- renderTemplate テスト ---

describe('Renderer.renderTemplate', () => {
  it('AppSuite 実形式の template.json を生成する', () => {
    const design = createSampleDesign();
    const template = renderer.renderTemplate(design);

    expect(template.version).toBe(APPSUITE_TEMPLATE_VERSION);
    expect(template.applications).toHaveLength(1);
    expect(template.applications[0].application.Name).toBe('受注管理');
    expect(template.applications[0].application.type_).toBe('normal');
  });

  it('システムフィールド（5件）+ ユーザー定義フィールドが生成される', () => {
    const design = createSampleDesign();
    const template = renderer.renderTemplate(design);
    const fields = template.applications[0].table_fileds;

    // システムフィールド 5件 + ユーザー定義 4件
    expect(fields).toHaveLength(9);

    const systemFields = fields.filter((f) => f.system_ === '1');
    expect(systemFields).toHaveLength(5);
    expect(systemFields.map((f) => f.Name)).toEqual(['No.', '登録日時', '登録者', '更新日時', '更新者']);

    const userFields = fields.filter((f) => f.system_ === '0');
    expect(userFields).toHaveLength(4);
  });

  it('ComponentType → AppSuite フィールドタイプに変換される', () => {
    const design = createSampleDesign();
    const template = renderer.renderTemplate(design);
    const userFields = template.applications[0].table_fileds.filter((f) => f.system_ === '0');

    expect(userFields[0].type_).toBe('textbox');   // text → textbox
    expect(userFields[1].type_).toBe('number');     // number → number
    expect(userFields[2].type_).toBe('select');     // select → select
    expect(userFields[3].type_).toBe('expression'); // calc → expression
  });

  it('select タイプの options が改行区切り文字列で設定される', () => {
    const design = createSampleDesign();
    const template = renderer.renderTemplate(design);
    const selectField = template.applications[0].table_fileds.find((f) => f.Name === 'ステータス');

    expect(selectField?.options).toBe('未処理\n処理中\n完了');
  });

  it('calc タイプの calc_expr に計算式が設定される', () => {
    const design = createSampleDesign();
    const template = renderer.renderTemplate(design);
    const calcField = template.applications[0].table_fileds.find((f) => f.Name === '税込金額');

    expect(calcField?.calc_expr).toBe('comp_002 * 1.1');
    expect(calcField?.calc_result_type).toBe('number');
  });

  it('required フィールドが "0"/"1" 文字列で設定される', () => {
    const design = createSampleDesign();
    const template = renderer.renderTemplate(design);
    const userFields = template.applications[0].table_fileds.filter((f) => f.system_ === '0');

    expect(userFields[0].required_).toBe('1'); // 商品名: required
    expect(userFields[3].required_).toBe('0'); // 税込金額: not required
  });

  it('カードビューと view_parts が生成される', () => {
    const design = createSampleDesign();
    const template = renderer.renderTemplate(design);
    const app = template.applications[0];

    expect(app.views).toHaveLength(1);
    expect(app.views[0].type_).toBe('card');
    expect(app.views[0].Name).toBe('詳細画面');
    expect(app.view_parts).toHaveLength(4); // ユーザー定義4フィールド分
  });

  it('テーブル定義が生成される', () => {
    const design = createSampleDesign();
    const template = renderer.renderTemplate(design);
    const tables = template.applications[0].tables;

    expect(tables).toHaveLength(1);
    expect(tables[0].Name).toBe('受注管理');
  });
});

// --- renderDesignDocument テスト ---

describe('Renderer.renderDesignDocument', () => {
  it('Markdown 形式の設計ドキュメントを生成する', () => {
    const design = createSampleDesign();
    const doc = renderer.renderDesignDocument(design);

    expect(doc).toContain('# 受注管理 設計ドキュメント');
  });

  it('部品定義表にAppSuiteタイプが含まれる', () => {
    const design = createSampleDesign();
    const doc = renderer.renderDesignDocument(design);

    expect(doc).toContain('| ID | 部品名 | タイプ | AppSuiteタイプ | 必須 |');
    expect(doc).toContain('textbox');
    expect(doc).toContain('expression');
  });

  it('リレーション設計が Markdown テーブル形式（要件 4.4）', () => {
    const design = createSampleDesign();
    const doc = renderer.renderDesignDocument(design);

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
});

// --- renderGuiGuide テスト ---

describe('Renderer.renderGuiGuide', () => {
  it('アプリ作成手順が含まれる', () => {
    const design = createSampleDesign();
    const guide = renderer.renderGuiGuide(design);

    expect(guide).toContain('ステップ1: アプリの新規作成');
    expect(guide).toContain('受注管理');
    expect(guide).toContain('受注を管理するアプリです。');
  });

  it('全部品の追加手順が含まれる', () => {
    const design = createSampleDesign();
    const guide = renderer.renderGuiGuide(design);

    expect(guide).toContain('ステップ2: 部品（フィールド）の追加');
    expect(guide).toContain('商品名');
    expect(guide).toContain('金額');
    expect(guide).toContain('ステータス');
    expect(guide).toContain('税込金額');
  });

  it('各部品のAppSuiteタイプが日本語で表示される', () => {
    const design = createSampleDesign();
    const guide = renderer.renderGuiGuide(design);

    expect(guide).toContain('テキスト（1行）');  // text → textbox
    expect(guide).toContain('数値');              // number
    expect(guide).toContain('プルダウン');        // select
    expect(guide).toContain('計算');              // calc → expression
  });

  it('select 部品に選択肢が記載される', () => {
    const design = createSampleDesign();
    const guide = renderer.renderGuiGuide(design);

    expect(guide).toContain('未処理 / 処理中 / 完了');
  });

  it('計算部品に計算式が記載される', () => {
    const design = createSampleDesign();
    const guide = renderer.renderGuiGuide(design);

    expect(guide).toContain('`comp_002 * 1.1`');
  });

  it('リレーション設定手順が含まれる', () => {
    const design = createSampleDesign();
    const guide = renderer.renderGuiGuide(design);

    expect(guide).toContain('リレーションの設定');
    expect(guide).toContain('顧客マスタ');
    expect(guide).toContain('顧客ID');
  });

  it('計算式・自動設定の設定手順が含まれる', () => {
    const design = createSampleDesign();
    const guide = renderer.renderGuiGuide(design);

    expect(guide).toContain('計算式・自動設定の設定');
    expect(guide).toContain('税込金額を自動計算');
  });

  it('レイアウト設定手順が含まれる', () => {
    const design = createSampleDesign();
    const guide = renderer.renderGuiGuide(design);

    expect(guide).toContain('ビュー・レイアウトの設定');
  });

  it('公開設定手順が含まれる', () => {
    const design = createSampleDesign();
    const guide = renderer.renderGuiGuide(design);

    expect(guide).toContain('公開設定');
    expect(guide).toContain('アクセス権限');
  });

  it('リレーション・自動設定がない場合はそのステップが省略される', () => {
    const design = { ...createSampleDesign(), relations: [], automations: [] };
    const guide = renderer.renderGuiGuide(design);

    expect(guide).not.toContain('リレーションの設定');
    expect(guide).not.toContain('計算式・自動設定の設定');
    expect(guide).toContain('ステップ3: ビュー・レイアウトの設定');
  });
});

// --- renderZipArchive テスト ---

describe('Renderer.renderZipArchive', () => {
  it('ZIP に design-document.md, gui-guide.md, reference/template.json が含まれる', async () => {
    const design = createSampleDesign();
    const zipData = await renderer.renderZipArchive(design);
    const zip = await JSZip.loadAsync(zipData);

    expect(zip.file('design-document.md')).not.toBeNull();
    expect(zip.file('gui-guide.md')).not.toBeNull();
    expect(zip.file('reference/template.json')).not.toBeNull();
  });

  it('ZIP 内の reference/template.json が AppSuite 形式', async () => {
    const design = createSampleDesign();
    const zipData = await renderer.renderZipArchive(design);
    const zip = await JSZip.loadAsync(zipData);

    const content = await zip.file('reference/template.json')!.async('string');
    const parsed = JSON.parse(content);

    expect(parsed.version).toBe(APPSUITE_TEMPLATE_VERSION);
    expect(parsed.applications[0].application.Name).toBe('受注管理');
  });

  it('ZIP 内の gui-guide.md にアプリ名が含まれる', async () => {
    const design = createSampleDesign();
    const zipData = await renderer.renderZipArchive(design);
    const zip = await JSZip.loadAsync(zipData);

    const content = await zip.file('gui-guide.md')!.async('string');

    expect(content).toContain('受注管理');
    expect(content).toContain('ステップ1');
  });
});
