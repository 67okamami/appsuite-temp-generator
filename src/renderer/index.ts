// ============================================================
// Renderer — DesignInfo を各種出力形式に変換する
// 実物のAppSuiteテンプレート形式に準拠
// ============================================================

import JSZip from 'jszip';
import type { DesignInfo, ComponentDefinition } from '../types/index.js';
import type {
  AppSuiteTemplateJson,
  AppSuiteTemplateDesc,
  AppSuiteAppEntry,
  AppSuiteField,
  AppSuiteView,
  AppSuiteViewPart,
} from '../types/appsuite.js';
import {
  COMPONENT_TYPE_TO_APPSUITE,
  APPSUITE_ICON_PATHS,
  APPSUITE_TEMPLATE_VERSION,
} from '../types/appsuite.js';

const DEFAULT_APP_ID = 1;
const MAIN_TABLE_ID_BASE = 1000; // app_id * 1000 → 1000
const SYSTEM_FIELD_COUNT = 5; // id, 登録日時, 登録者, 更新日時, 更新者
const USER_FIELD_ID_START = 101;

/**
 * Renderer クラス — DesignInfo を各種出力形式に変換する
 */
export class Renderer {
  /**
   * DesignInfo から AppSuite テンプレートJSON を生成する。
   */
  renderTemplate(design: DesignInfo): AppSuiteTemplateJson {
    const appId = DEFAULT_APP_ID;
    const tableId = appId * MAIN_TABLE_ID_BASE;

    const systemFields = this.createSystemFields(tableId);
    const userFields = this.createUserFields(design.components, tableId);
    const allFields = [...systemFields, ...userFields];

    const cardView = this.createCardView(tableId, 1);
    const cardViewParts = this.createCardViewParts(userFields, tableId, cardView.ID);

    const iconPaths = APPSUITE_ICON_PATHS[design.appInfo.iconId] ?? APPSUITE_ICON_PATHS['icon-document'];

    const appEntry: AppSuiteAppEntry = {
      application: {
        Name: design.appInfo.name,
        type_: 'normal',
        overview_: design.appInfo.description,
        card_view_id: cardView.ID,
        capture_file_name: '',
        capture_mime_type: '',
        portalfilename: iconPaths?.portal ?? '',
        portalmimetype: 'image/png',
        menufilename: iconPaths?.menu ?? '',
        menumimetype: 'image/png',
        card_date_format: 'middle',
        table_date_format: 'short',
        user_format: 'name_only',
        view_menu: 'top_menu',
        use_field_alias: '0',
        save_change_log: '1',
        button_name_addnew: '',
        button_name_copyadd: '',
        button_name_add: '',
        ID: appId,
      },
      tables: [
        {
          Name: design.appInfo.name,
          table_id: tableId,
          ID: 0,
          lastid: USER_FIELD_ID_START + design.components.length - 1,
        },
      ],
      table_fileds: allFields,
      filed_cond_styles: [],
      views: [cardView],
      view_parts: cardViewParts,
      filters: [],
      filter_items: [],
      sort_items: [],
      keyword_search_fields: [],
      tasks: [],
      task_actions: [],
      task_Watch_fields: [],
      notice_fields: [],
      copydata_fields: [],
      aggr_settings: [],
      aggr_methods: [],
      aggr_method_item_details: [],
      aggr_report_settings: [],
      app_coord: {},
      validations: [],
    };

    return {
      version: APPSUITE_TEMPLATE_VERSION,
      applications: [appEntry],
    };
  }

  /**
   * DesignInfo から設計ドキュメント（Markdown）を生成する。
   */
  renderDesignDocument(design: DesignInfo): string {
    const sections: string[] = [];

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
    sections.push('| 項目 | 値 |');
    sections.push('|---|---|');
    sections.push(`| アプリ名 | ${design.appInfo.name} |`);
    sections.push(`| アイコン | ${design.appInfo.iconId} |`);
    sections.push(`| 説明 | ${design.appInfo.description} |`);
    sections.push('');

    // 部品定義表（要件 3.5: Markdown テーブル形式）
    sections.push('## 部品定義表');
    sections.push('');
    sections.push('| ID | 部品名 | タイプ | AppSuiteタイプ | 必須 |');
    sections.push('|---|---|---|---|---|');
    for (const comp of design.components) {
      const asType = COMPONENT_TYPE_TO_APPSUITE[comp.type] ?? comp.type;
      sections.push(`| ${comp.id} | ${comp.name} | ${comp.type} | ${asType} | ${comp.required ? '○' : '-'} |`);
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
   * DesignInfo から AppSuite GUI操作ガイド（Markdown）を生成する。
   * AppSuiteのGUI画面でアプリを構築するためのステップバイステップ手順。
   */
  renderGuiGuide(design: DesignInfo): string {
    const s: string[] = [];

    s.push(`# 「${design.appInfo.name}」AppSuite GUI操作ガイド`);
    s.push('');
    s.push('このガイドでは、AppSuiteのGUI画面でアプリを構築する手順をステップバイステップで説明します。');
    s.push('');

    // ステップ1: アプリ作成
    s.push('## ステップ1: アプリの新規作成');
    s.push('');
    s.push('1. デスクネッツ ネオにログインし、AppSuiteを開く');
    s.push('2. 「アプリケーションの管理」→「アプリケーションの追加」をクリック');
    s.push('3. 「新規作成」を選択');
    s.push('4. 以下の基本情報を設定:');
    s.push('');
    s.push(`   | 項目 | 設定値 |`);
    s.push(`   |---|---|`);
    s.push(`   | アプリ名 | ${design.appInfo.name} |`);
    s.push(`   | 説明 | ${design.appInfo.description} |`);
    s.push(`   | アイコン | ${design.appInfo.iconId} に対応するアイコンを選択 |`);
    s.push('');

    // ステップ2: 部品の追加
    s.push('## ステップ2: 部品（フィールド）の追加');
    s.push('');
    s.push('「ビューの設定」画面で、以下の部品を順番に追加してください。');
    s.push('左側の部品パレットからドラッグ＆ドロップで配置します。');
    s.push('');

    for (let i = 0; i < design.components.length; i++) {
      const comp = design.components[i];
      const asType = COMPONENT_TYPE_TO_APPSUITE[comp.type] ?? comp.type;
      s.push(`### 部品${i + 1}: ${comp.name}`);
      s.push('');
      s.push(`| 設定項目 | 設定値 |`);
      s.push(`|---|---|`);
      s.push(`| 部品タイプ | **${this.getJapaneseTypeName(asType)}** |`);
      s.push(`| 部品名 | ${comp.name} |`);
      s.push(`| 必須 | ${comp.required ? 'チェックを入れる' : 'チェックなし'} |`);

      if (comp.options && comp.options.length > 0) {
        s.push(`| 選択肢 | ${comp.options.join(' / ')} |`);
      }
      if (comp.formula) {
        s.push(`| 計算式 | \`${comp.formula}\` |`);
      }
      s.push('');
    }

    // ステップ3: リレーション設定
    if (design.relations.length > 0) {
      s.push('## ステップ3: リレーションの設定');
      s.push('');
      s.push('以下のリレーション部品を追加し、他アプリとの紐付けを設定してください。');
      s.push('');

      for (let i = 0; i < design.relations.length; i++) {
        const rel = design.relations[i];
        s.push(`### リレーション${i + 1}: ${rel.comment}`);
        s.push('');
        s.push(`| 設定項目 | 設定値 |`);
        s.push(`|---|---|`);
        s.push(`| 参照先アプリ | ${rel.targetApp} |`);
        s.push(`| 紐付けキー | ${rel.keyField} |`);
        s.push(`| 取得フィールド | ${rel.fetchFields.join(', ')} |`);
        s.push('');
      }
    }

    // ステップ4: 計算式・自動設定
    if (design.automations.length > 0) {
      const stepNum = design.relations.length > 0 ? 4 : 3;
      s.push(`## ステップ${stepNum}: 計算式・自動設定の設定`);
      s.push('');

      for (const auto of design.automations) {
        if (auto.type === 'calc') {
          s.push(`### 計算部品: ${auto.targetComponent}`);
          s.push('');
          s.push(`1. 対象の計算部品（${auto.targetComponent}）の設定を開く`);
          s.push(`2. 計算式に \`${auto.formula ?? ''}\` を入力`);
          s.push(`3. 説明: ${auto.comment}`);
          s.push('');
        } else {
          s.push(`### 自動設定: ${auto.targetComponent}`);
          s.push('');
          s.push(`1. 「タスクの設定」から新規タスクを追加`);
          s.push(`2. 対象部品: ${auto.targetComponent}`);
          s.push(`3. 説明: ${auto.comment}`);
          if (auto.conditions) {
            s.push('4. 条件:');
            for (const cond of auto.conditions) {
              s.push(`   - ${cond.field} が ${cond.value} ${this.getOperatorLabel(cond.operator)} の場合 → ${cond.setValue} を設定`);
            }
          }
          s.push('');
        }
      }
    }

    // ステップ: ビュー・レイアウトの設定
    const layoutStepNum = 3 + (design.relations.length > 0 ? 1 : 0) + (design.automations.length > 0 ? 1 : 0);
    s.push(`## ステップ${layoutStepNum}: ビュー・レイアウトの設定`);
    s.push('');
    s.push('「ビューの設定」画面で、部品の配置を調整してください。');
    s.push('');

    if (design.layout.pc.length > 0) {
      s.push('### PC版レイアウト');
      s.push('');
      for (const section of design.layout.pc) {
        s.push(`#### セクション: ${section.sectionName}`);
        s.push('');
        for (const row of section.rows) {
          const compNames = row.components.map((cid) => {
            const comp = design.components.find((c) => c.id === cid);
            return comp ? comp.name : cid;
          });
          s.push(`- 1行に配置: ${compNames.join('、')}`);
        }
        s.push('');
      }
    }

    if (design.layout.mobile && design.layout.mobile.length > 0) {
      s.push('### モバイル版レイアウト');
      s.push('');
      s.push('モバイル版ビューを作成し、以下の順序で縦1列に部品を配置してください。');
      s.push('');
      for (const section of design.layout.mobile) {
        for (const row of section.rows) {
          const compNames = row.components.map((cid) => {
            const comp = design.components.find((c) => c.id === cid);
            return comp ? comp.name : cid;
          });
          s.push(`- ${compNames.join('、')}`);
        }
      }
      s.push('');
    }

    // 最終ステップ
    s.push(`## ステップ${layoutStepNum + 1}: 公開設定`);
    s.push('');
    s.push('1. 「アプリケーションの管理」でアプリを選択');
    s.push('2. 利用ユーザーのアクセス権限を設定');
    s.push('3. ポータルやメニューへの表示設定を行う');
    s.push('4. アプリを公開する');
    s.push('');

    return s.join('\n');
  }

  // --- GUI操作ガイド用ヘルパー ---

  private getJapaneseTypeName(type: string): string {
    const map: Record<string, string> = {
      textbox: 'テキスト（1行）',
      textarea: 'テキスト（複数行）',
      richeditor: 'リッチテキスト',
      number: '数値',
      date: '日付',
      datetime: '日時',
      time: '時刻',
      select: 'プルダウン',
      listbox: 'リストボックス',
      radio: 'ラジオボタン',
      checkbox: 'チェックボックス',
      files: '添付ファイル',
      users: 'ユーザー選択',
      groups: '組織選択',
      expression: '計算',
      rel_list: 'リレーション（一覧）',
      rel_field: 'リレーション（フィールド）',
      input_list: '入力リスト',
    };
    return map[type] ?? type;
  }

  private getOperatorLabel(op: string): string {
    const map: Record<string, string> = {
      eq: 'と等しい',
      neq: 'と等しくない',
      gt: 'より大きい',
      lt: 'より小さい',
      gte: '以上',
      lte: '以下',
    };
    return map[op] ?? op;
  }

  /**
   * DesignInfo から ZIP アーカイブを生成する。
   * 主出力: design-document.md + gui-guide.md
   * 参考資料: template.json
   */
  async renderZipArchive(design: DesignInfo): Promise<Uint8Array> {
    const zip = new JSZip();

    // 主出力: 設計ドキュメント
    zip.file('design-document.md', this.renderDesignDocument(design));

    // 主出力: GUI操作ガイド
    zip.file('gui-guide.md', this.renderGuiGuide(design));

    // 参考資料: template.json（署名問題のため直接インポート不可）
    const template = this.renderTemplate(design);
    zip.file('reference/template.json', JSON.stringify(template, null, 4));

    // 参考資料: template_desc.json（AppSuiteテンプレートZIPのメタ情報）
    const templateDesc = {
      Name: design.appInfo.name,
      overview: design.appInfo.description,
      filename: 'template.json',
      mimetype: 'application/json',
    };
    zip.file('reference/template_desc.json', JSON.stringify(templateDesc, null, 4));

    return zip.generateAsync({ type: 'uint8array' });
  }

  // --- システムフィールド（id, 登録日時, 登録者, 更新日時, 更新者） ---

  private createSystemFields(tableId: number): AppSuiteField[] {
    const base = {
      placeholder_: '',
      format_: '',
      field_attribute: '',
      system_: '1',
      required_: '1',
      unique_: '0',
      sortable_: '1',
      min_: '',
      max_: '',
      input_charactor_type: '',
      unit_: '',
      unit_arrangement: '',
      unapply_on_copy: '0',
      options: '',
      calc_expr: '',
      calc_result_type: '',
      rel_lookup: '0',
      rel_key_matching: '',
      rel_on_delete: '',
      alt_image_file_name: '',
      alt_image_mime_type: '',
      identity_: '0',
      identity_reset_timing: '',
      field_alias: '',
      cond_input_id: '',
      time_unit: '',
      table_id: tableId,
    };

    return [
      { ...base, Name: 'No.', type_: 'id', unique_: '1', default_value: '', field_alias: 'data_id', ID: 1, SEQNO: 1 },
      { ...base, Name: '登録日時', type_: 'datetime', default_value: 'NOW()', time_unit: '1', ID: 2, SEQNO: 2 },
      { ...base, Name: '登録者', type_: 'user', default_value: 'LOGINUSER()', ID: 3, SEQNO: 3 },
      { ...base, Name: '更新日時', type_: 'datetime', default_value: 'NOW()', time_unit: '1', ID: 4, SEQNO: 4 },
      { ...base, Name: '更新者', type_: 'user', default_value: 'LOGINUSER()', ID: 5, SEQNO: 5 },
    ] as AppSuiteField[];
  }

  // --- ユーザー定義フィールド ---

  private createUserFields(components: ComponentDefinition[], tableId: number): AppSuiteField[] {
    return components.map((comp, index) => {
      const fieldId = USER_FIELD_ID_START + index;
      const appSuiteType = COMPONENT_TYPE_TO_APPSUITE[comp.type] ?? 'textbox';

      const field: AppSuiteField = {
        Name: comp.name,
        placeholder_: '',
        type_: appSuiteType,
        format_: '',
        field_attribute: '',
        system_: '0',
        required_: comp.required ? '1' : '0',
        unique_: '0',
        sortable_: '1',
        min_: '',
        max_: '',
        input_charactor_type: '',
        unit_: '',
        unit_arrangement: '',
        default_value: '',
        unapply_on_copy: '0',
        options: comp.options ? comp.options.join('\n') : '',
        calc_expr: comp.formula ?? '',
        calc_result_type: comp.formula ? 'number' : '',
        rel_lookup: '0',
        rel_key_matching: '',
        rel_on_delete: '',
        alt_image_file_name: '',
        alt_image_mime_type: '',
        identity_: '0',
        identity_reset_timing: '',
        field_alias: '',
        cond_input_id: '',
        time_unit: appSuiteType === 'datetime' ? '1' : '',
        table_id: tableId,
        ID: fieldId,
        SEQNO: fieldId,
      };

      return field;
    });
  }

  // --- カードビュー（詳細画面） ---

  private createCardView(tableId: number, viewId: number): AppSuiteView {
    return {
      Name: '詳細画面',
      layout_grid_size: 20,
      width_: 0,
      height_: 0,
      type_: 'card',
      enabled_: '0',
      view_user_type: '0',
      sort_order: '',
      view_style: '',
      class_name: '',
      bg_image_file_name: '',
      bg_image_mime_type: '',
      apply_cond_style: '1',
      mobile_layout: '',
      table_id: tableId,
      ID: viewId,
      lastid: 0, // will be updated
      SEQNO: 1,
    };
  }

  // --- カードビュー上の部品配置 ---

  private createCardViewParts(
    userFields: AppSuiteField[],
    tableId: number,
    viewId: number,
  ): AppSuiteViewPart[] {
    const TOP_START = 20;
    const ROW_HEIGHT = 60;

    return userFields.map((field, index) => ({
      type_: 'field',
      block_style: `left:20px;top:${TOP_START + index * ROW_HEIGHT}px`,
      field_style: 'width:400px',
      title_style: '',
      partial_style: '',
      class_name: '',
      field_tid: tableId,
      field_fid: field.ID,
      editable_: '1',
      label_text: '',
      no_print: '0',
      image_type_file_name: '',
      image_type_mime_type: '',
      total_method: '',
      total_decimal: '',
      plugin_id: '',
      component_id: '',
      component_settings: '',
      table_id: tableId,
      view_id: viewId,
      ID: index + 1,
      SEQNO: index + 1,
    }));
  }
}
