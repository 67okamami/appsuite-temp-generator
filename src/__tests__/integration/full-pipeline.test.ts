import { describe, it, expect, vi } from 'vitest';
import { Pipeline } from '../../pipeline/index.js';
import { InputValidationError } from '../../types/errors.js';

// --- LLM モッククライアント ---

function createFullMockClient() {
  return {
    messages: {
      create: vi.fn().mockImplementation(async (args: any) => {
        const system: string = typeof args.system === 'string' ? args.system : '';
        let response: object;

        if (system.includes('リレーション設計')) {
          response = {
            relations: [
              { sourceApp: 'テストアプリ', targetApp: '社員マスタ', keyField: '社員ID', fetchFields: ['氏名'], comment: '社員情報を参照' },
            ],
          };
        } else if (system.includes('計算式・自動設定')) {
          response = {
            automations: [
              { type: 'calc', targetComponent: 'comp_003', formula: 'comp_002 * 8', comment: '日給を計算' },
            ],
            additionalComponents: [
              { id: 'comp_003', name: '日給', type: 'calc', required: false },
            ],
          };
        } else if (system.includes('画面レイアウトを生成')) {
          response = {
            pc: [
              { sectionName: '基本情報', rows: [{ components: ['comp_001', 'comp_002'] }] },
              { sectionName: '計算結果', rows: [{ components: ['comp_003'] }] },
            ],
          };
        } else if (system.includes('部品定義表を生成')) {
          response = {
            components: [
              { id: 'comp_001', name: '社員名', type: 'text', required: true },
              { id: 'comp_002', name: '勤務時間', type: 'number', required: true },
            ],
          };
        } else if (system.includes('既存の設計情報')) {
          // regenerate 用
          const userMsg: string = typeof args.messages?.[0]?.content === 'string' ? args.messages[0].content : '';
          if (userMsg.includes('修正指示')) {
            response = {
              appInfo: { name: '勤怠管理v2', iconId: 'icon-people', description: '更新版' },
              components: [
                { id: 'comp_001', name: '社員名', type: 'text', required: true },
                { id: 'comp_002', name: '勤務時間', type: 'number', required: true },
                { id: 'comp_003', name: '日給', type: 'calc', required: false },
              ],
              relations: [],
              automations: [],
            };
          } else {
            response = {};
          }
        } else if (system.includes('アプリ要件を解析')) {
          // Parser
          response = {
            appName: '勤怠管理',
            purpose: '勤怠を管理する',
            targetUsers: ['管理者'],
            mainFeatures: ['出勤管理'],
          };
        } else {
          // AppInfo
          response = { name: '勤怠管理', iconId: 'icon-people', description: '勤怠を管理するアプリ' };
        }

        return { content: [{ type: 'text', text: JSON.stringify(response) }] };
      }),
    },
  } as any;
}

// --- テスト ---

describe('Pipeline.run（フルパイプライン）', () => {
  it('テキスト入力から全出力を生成する', async () => {
    const client = createFullMockClient();
    const pipeline = new Pipeline({ llmClient: client });
    const result = await pipeline.run('勤怠管理アプリを作りたい');

    // DesignInfo
    expect(result.design.appInfo.name).toBe('勤怠管理');
    expect(result.design.components.length).toBeGreaterThanOrEqual(2);

    // Validation
    expect(result.validation.valid).toBe(true);

    // 設計ドキュメント
    expect(result.designDocument).toContain('勤怠管理');
    expect(result.designDocument).toContain('部品定義表');

    // GUI操作ガイド
    expect(result.guiGuide).toContain('ステップ1');
    expect(result.guiGuide).toContain('勤怠管理');

    // テンプレート
    expect(result.template.version).toBeTruthy();
    expect(result.template.applications).toHaveLength(1);

    // ZIPアーカイブ
    expect(result.zipArchive).toBeInstanceOf(Uint8Array);
    expect(result.zipArchive.length).toBeGreaterThan(0);
  });

  it('空文字列はバリデーションエラーを返す', async () => {
    const client = createFullMockClient();
    const pipeline = new Pipeline({ llmClient: client });

    await expect(pipeline.run('')).rejects.toThrow(InputValidationError);
  });

  it('5000文字超はバリデーションエラーを返す', async () => {
    const client = createFullMockClient();
    const pipeline = new Pipeline({ llmClient: client });

    await expect(pipeline.run('x'.repeat(5001))).rejects.toThrow(InputValidationError);
  });
});

describe('Pipeline.regenerate（部分再生成）', () => {
  it('修正指示を反映して再生成する', async () => {
    const client = createFullMockClient();
    const pipeline = new Pipeline({ llmClient: client });

    // まず初回生成
    const initial = await pipeline.run('勤怠管理アプリを作りたい');

    // 部分再生成
    const result = await pipeline.regenerate(
      '勤怠管理アプリを作りたい',
      'アプリ名をv2に変更',
      initial.design,
    );

    expect(result.regenerateResult.updated).toBeDefined();
    expect(result.regenerateResult.diff).toBeDefined();
    expect(result.designDocument).toContain('部品定義表');
    expect(result.guiGuide).toContain('ステップ1');
    expect(result.zipArchive.length).toBeGreaterThan(0);
  });
});

describe('Pipeline.regenerateAll（全体再生成）', () => {
  it('全設計情報を最初から再生成する', async () => {
    const client = createFullMockClient();
    const pipeline = new Pipeline({ llmClient: client });

    const result = await pipeline.regenerateAll('勤怠管理アプリを作りたい');

    expect(result.design.appInfo.name).toBe('勤怠管理');
    expect(result.validation.valid).toBe(true);
    expect(result.zipArchive.length).toBeGreaterThan(0);
  });
});
