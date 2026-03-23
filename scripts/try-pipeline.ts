/**
 * 動作確認スクリプト
 *
 * 初回生成:
 *   npx tsx scripts/try-pipeline.ts "日報管理アプリを作りたい"
 *
 * 修正・再生成 (前回の設計情報を読み込んで部分再生成):
 *   npx tsx scripts/try-pipeline.ts --regenerate "承認機能を追加して"
 *
 * 全体再生成:
 *   npx tsx scripts/try-pipeline.ts --regenerate-all "日報管理アプリを作りたい"
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import Anthropic from '@anthropic-ai/sdk';
import { Pipeline } from '../src/pipeline/index.js';

// .env ファイルから環境変数を読み込む
function loadEnv(): void {
  try {
    const envPath = resolve(import.meta.dirname ?? '.', '..', '.env');
    const content = readFileSync(envPath, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIndex = trimmed.indexOf('=');
      if (eqIndex === -1) continue;
      const key = trimmed.slice(0, eqIndex).trim();
      const value = trimmed.slice(eqIndex + 1).trim();
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  } catch {
    // .env ファイルがなくても環境変数で設定されていればOK
  }
}

loadEnv();

const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) {
  console.error('❌ ANTHROPIC_API_KEY 環境変数を設定してください');
  console.error('   .env ファイルに ANTHROPIC_API_KEY=sk-ant-xxx を記載するか、');
  console.error('   環境変数を設定してから実行してください');
  process.exit(1);
}

const DESIGN_FILE = 'output-design-info.json';

const client = new Anthropic({ apiKey });
const pipeline = new Pipeline({ llmClient: client });

// コマンドライン引数を解析
const mode = process.argv[2] === '--regenerate' ? 'regenerate'
  : process.argv[2] === '--regenerate-all' ? 'regenerate-all'
  : 'run';
const input = (mode === 'run' ? process.argv[2] : process.argv[3])
  || '勤怠管理アプリを作りたい。社員名、出勤日、出勤時刻、退勤時刻、勤務時間を管理できるようにしてほしい。';

function saveResults(design: any, designDocument: string, guiGuide: string, template: any, zipArchive: Uint8Array): void {
  writeFileSync(DESIGN_FILE, JSON.stringify(design, null, 2), 'utf-8');
  writeFileSync('output-design.md', designDocument, 'utf-8');
  writeFileSync('output-gui-guide.md', guiGuide, 'utf-8');
  writeFileSync('output-template.json', JSON.stringify(template, null, 2), 'utf-8');
  writeFileSync('output-archive.zip', zipArchive);
}

function printDesignSummary(design: any): void {
  console.log('アプリ名:', design.appInfo.name);
  console.log('部品数:', design.components.length);
  console.log('リレーション数:', design.relations.length);
  console.log('自動化ルール数:', design.automations.length);
}

try {
  if (mode === 'regenerate') {
    // --- 修正・再生成 ---
    if (!existsSync(DESIGN_FILE)) {
      console.error('❌ 前回の設計情報が見つかりません。まず初回生成を実行してください。');
      process.exit(1);
    }
    const existing = JSON.parse(readFileSync(DESIGN_FILE, 'utf-8'));

    console.log('🔄 修正・再生成モード');
    console.log('📝 修正指示:', input);
    console.log('📂 元の設計:', existing.appInfo.name);
    console.log('⏳ 再生成中...\n');

    const result = await pipeline.regenerate(existing.inputSummary, input, existing);

    console.log('✅ 再生成完了!\n');

    // 差分表示
    const { diff } = result.regenerateResult;
    console.log('--- 変更差分 ---');
    if (diff.added.length > 0) console.log('  追加:', diff.added.join(', '));
    if (diff.modified.length > 0) console.log('  変更:', diff.modified.join(', '));
    if (diff.removed.length > 0) console.log('  削除:', diff.removed.join(', '));
    if (diff.added.length === 0 && diff.modified.length === 0 && diff.removed.length === 0) {
      console.log('  (差分なし)');
    }

    console.log('\n--- 設計情報 ---');
    printDesignSummary(result.regenerateResult.updated);
    console.log('バリデーション:', result.validation.valid ? '✅ OK' : '❌ NG');

    saveResults(result.regenerateResult.updated, result.designDocument, result.guiGuide, result.regenerateResult.updated, result.zipArchive);

  } else if (mode === 'regenerate-all') {
    // --- 全体再生成 ---
    console.log('🔁 全体再生成モード');
    console.log('📝 入力:', input);
    console.log('⏳ 全体再生成中...\n');

    const result = await pipeline.regenerateAll(input);

    console.log('✅ 全体再生成完了!\n');
    console.log('--- 設計情報 ---');
    printDesignSummary(result.design);
    console.log('バリデーション:', result.validation.valid ? '✅ OK' : '❌ NG');

    saveResults(result.design, result.designDocument, result.guiGuide, result.template, result.zipArchive);

  } else {
    // --- 初回生成 ---
    console.log('📝 入力:', input);
    console.log('⏳ パイプライン実行中...\n');

    const result = await pipeline.run(input);

    console.log('✅ 生成完了!\n');
    console.log('--- 設計情報 ---');
    printDesignSummary(result.design);
    console.log('バリデーション:', result.validation.valid ? '✅ OK' : '❌ NG');
    if (!result.validation.valid) {
      console.log('  エラー:', result.validation.errors);
    }

    saveResults(result.design, result.designDocument, result.guiGuide, result.template, result.zipArchive);
  }

  console.log('\n--- 出力ファイル ---');
  console.log('  output-design-info.json  設計情報（再生成用）');
  console.log('  output-design.md         設計ドキュメント');
  console.log('  output-gui-guide.md      GUI操作ガイド');
  console.log('  output-template.json     参考用テンプレート');
  console.log('  output-archive.zip       ZIPアーカイブ');
} catch (err) {
  console.error('❌ エラー:', err);
  process.exit(1);
}
