// ============================================================
// Renderer — DesignInfo を各種出力形式に変換する
// design.md「コンポーネントとインターフェース > Renderer」セクションに準拠
// ============================================================

import JSZip from 'jszip';
import type {
  DesignInfo,
  TemplateFile,
  TemplateComponent,
  TemplateRelation,
  TemplateAutomation,
} from '../types/index.js';

const TEMPLATE_VERSION = '1.0';

/**
 * Renderer クラス — DesignInfo を各種出力形式に変換する
 *
 * 責務:
 * - AppSuite テンプレートファイル（JSON）の生成
 * - 設計ドキュメント（Markdown）の生成
 * - ZIP アーカイブの生成
 */
export class Renderer {
  /**
   * DesignInfo から AppSuite インポート可能なテンプレートファイルを生成する。
   */
  renderTemplate(design: DesignInfo): TemplateFile {
    const components: TemplateComponent[] = design.components.map((c) => {
      const tc: TemplateComponent = {
        id: c.id,
        name: c.name,
        type: c.type,
        required: c.required,
      };
      if (c.options) tc.options = c.options;
      if (c.formula) tc.formula = c.formula;
      if (c.autoConfig) tc.autoConfig = c.autoConfig;
      return tc;
    });

    const relations: TemplateRelation[] = design.relations.map((r) => ({
      sourceApp: r.sourceApp,
      targetApp: r.targetApp,
      keyField: r.keyField,
      fetchFields: r.fetchFields,
    }));

    const automations: TemplateAutomation[] = design.automations.map((a) => {
      const ta: TemplateAutomation = {
        type: a.type,
        targetComponent: a.targetComponent,
      };
      if (a.formula) ta.formula = a.formula;
      if (a.conditions) ta.conditions = a.conditions;
      return ta;
    });

    return {
      version: TEMPLATE_VERSION,
      appName: design.appInfo.name,
      appIcon: design.appInfo.iconId,
      appDescription: design.appInfo.description,
      components,
      relations,
      automations,
      layout: {
        pc: design.layout.pc,
        ...(design.layout.mobile ? { mobile: design.layout.mobile } : {}),
      },
    };
  }

  /**
   * DesignInfo から設計ドキュメント（Markdown）を生成する。
   * 全セクション: アプリ基本情報・部品定義表・リレーション設計・計算式・
   * 画面デザイン案・Claude Code用操作指示・生成日時・入力要件サマリー
   */
  renderDesignDocument(design: DesignInfo): string {
    const sections: string[] = [];

    // ヘッダー
    sections.push(`# ${design.appInfo.name} 設計ドキュメント`);
    sections.push('');

    // 生成日時・入力要件サマリー（要件 9.2）
    sections.push('## 概要');
    sections.push('');
    sections.push(`- **生成日時**: ${design.generatedAt}`);
    sections.push(`- **入力要件サマリー**: ${design.inputSummary}`);
    sections.push('');

    // アプリ基本情報
    sections.push('## アプリ基本情報');
    sections.push('');
    sections.push(`| 項目 | 値 |`);
    sections.push(`|---|---|`);
    sections.push(`| アプリ名 | ${design.appInfo.name} |`);
    sections.push(`| アイコン | ${design.appInfo.iconId} |`);
    sections.push(`| 説明 | ${design.appInfo.description} |`);
    sections.push('');

    // 部品定義表（要件 3.5: Markdown テーブル形式）
    sections.push('## 部品定義表');
    sections.push('');
    sections.push('| ID | 部品名 | タイプ | 必須 |');
    sections.push('|---|---|---|---|');
    for (const comp of design.components) {
      sections.push(`| ${comp.id} | ${comp.name} | ${comp.type} | ${comp.required ? '○' : '-'} |`);
    }
    sections.push('');

    // リレーション設計（要件 4.4: Markdown テーブル形式）
    sections.push('## リレーション設計');
    sections.push('');
    if (design.relations.length > 0) {
      sections.push('| 参照元 | 参照先 | キー | 取得フィールド | 目的 |');
      sections.push('|---|---|---|---|---|');
      for (const rel of design.relations) {
        sections.push(`| ${rel.sourceApp} | ${rel.targetApp} | ${rel.keyField} | ${rel.fetchFields.join(', ')} | ${rel.comment} |`);
      }
    } else {
      sections.push('リレーションなし');
    }
    sections.push('');

    // 計算式・自動設定
    sections.push('## 計算式・自動設定');
    sections.push('');
    if (design.automations.length > 0) {
      for (const auto of design.automations) {
        if (auto.type === 'calc') {
          sections.push(`- **計算**: ${auto.targetComponent} = \`${auto.formula ?? ''}\` — ${auto.comment}`);
        } else {
          sections.push(`- **自動設定**: ${auto.targetComponent} — ${auto.comment}`);
          if (auto.conditions) {
            for (const cond of auto.conditions) {
              sections.push(`  - 条件: ${cond.field} ${cond.operator} ${cond.value} → ${cond.setValue}`);
            }
          }
        }
      }
    } else {
      sections.push('計算式・自動設定なし');
    }
    sections.push('');

    // 画面デザイン案
    sections.push('## 画面デザイン案');
    sections.push('');
    sections.push('### PC版');
    sections.push('');
    if (design.layout.pc.length > 0) {
      for (const section of design.layout.pc) {
        sections.push(`#### ${section.sectionName}`);
        sections.push('');
        for (const row of section.rows) {
          sections.push(`| ${row.components.join(' | ')} |`);
        }
        sections.push('');
      }
    } else {
      sections.push('レイアウト未定義');
      sections.push('');
    }

    if (design.layout.mobile) {
      sections.push('### モバイル版');
      sections.push('');
      for (const section of design.layout.mobile) {
        sections.push(`#### ${section.sectionName}`);
        sections.push('');
        for (const row of section.rows) {
          sections.push(`| ${row.components.join(' | ')} |`);
        }
        sections.push('');
      }
    }

    // Claude Code 用操作指示
    sections.push('## Claude Code 用操作指示');
    sections.push('');
    sections.push(design.claudeInstruction);
    sections.push('');

    return sections.join('\n');
  }

  /**
   * DesignInfo からテンプレートファイルと設計ドキュメントを含む ZIP アーカイブを生成する。
   */
  async renderZipArchive(design: DesignInfo): Promise<Uint8Array> {
    const zip = new JSZip();

    const template = this.renderTemplate(design);
    zip.file('template.json', JSON.stringify(template, null, 2));

    const document = this.renderDesignDocument(design);
    zip.file('design-document.md', document);

    return zip.generateAsync({ type: 'uint8array' });
  }
}

/**
 * テンプレートファイル（JSON文字列）を DesignInfo にパースする。
 * ラウンドトリップテスト用のユーティリティ。
 */
export function parseTemplateToDesignInfo(template: TemplateFile, originalDesign: DesignInfo): DesignInfo {
  return {
    appInfo: {
      name: template.appName,
      iconId: template.appIcon,
      description: template.appDescription,
    },
    components: template.components.map((c) => ({
      id: c.id,
      name: c.name,
      type: c.type,
      required: c.required,
      ...(c.options ? { options: c.options } : {}),
      ...(c.formula ? { formula: c.formula } : {}),
      ...(c.autoConfig ? { autoConfig: c.autoConfig } : {}),
    })),
    relations: template.relations.map((r, i) => ({
      ...r,
      comment: originalDesign.relations[i]?.comment ?? '',
    })),
    automations: template.automations.map((a, i) => ({
      ...a,
      comment: originalDesign.automations[i]?.comment ?? '',
    })),
    layout: {
      pc: template.layout.pc,
      ...(template.layout.mobile ? { mobile: template.layout.mobile } : {}),
    },
    claudeInstruction: originalDesign.claudeInstruction,
    generatedAt: originalDesign.generatedAt,
    inputSummary: originalDesign.inputSummary,
  };
}
