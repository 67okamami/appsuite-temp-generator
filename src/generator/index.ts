// ============================================================
// Generator — ParsedRequirements から DesignInfo を生成する
// design.md「コンポーネントとインターフェース > Generator」セクションに準拠
// ============================================================

import Anthropic from '@anthropic-ai/sdk';
import type {
  ParsedRequirements,
  DesignInfo,
  AppInfo,
  ComponentDefinition,
  ComponentType,
  RelationDefinition,
  AutomationDefinition,
  AutoCondition,
  LayoutDefinition,
  LayoutSection,
  RegenerateResult,
  DesignDiff,
} from '../types/index.js';
import { VALID_COMPONENT_TYPES } from '../types/index.js';
import {
  DEFAULT_VALUES,
  CONSTRAINTS,
  LLMApiError,
} from '../types/errors.js';
import { APPSUITE_ICON_IDS } from './constants.js';

export interface GeneratorDeps {
  llmClient: Anthropic;
  model?: string;
}

// --- LLM プロンプト ---

const APP_INFO_PROMPT = `あなたはAppSuite（デスクネッツ ネオの業務アプリ作成ツール）の設計支援AIです。
以下のアプリ要件からアプリ基本情報を生成してください。

出力フォーマット（JSONのみ、他のテキストは不要）:
{
  "name": "アプリ名（20文字以内）",
  "iconId": "アイコン識別子",
  "description": "アプリの説明文（200文字以内、目的・対象ユーザー・主要機能を含む）"
}

使用可能なアイコン識別子:
${APPSUITE_ICON_IDS.join(', ')}

ルール:
- name は20文字以内の簡潔な名前にする
- iconId は上記リストから最も適切なものを1つ選ぶ
- description は200文字以内でアプリの目的・対象ユーザー・主要機能を含める
- 必ず有効なJSONのみを出力する`;

const COMPONENTS_PROMPT = `あなたはAppSuite（デスクネッツ ネオの業務アプリ作成ツール）の設計支援AIです。
以下のアプリ要件から部品定義表を生成してください。

出力フォーマット（JSONのみ、他のテキストは不要）:
{
  "components": [
    {
      "id": "comp_001",
      "name": "部品名",
      "type": "部品タイプ",
      "required": true,
      "options": ["選択肢1", "選択肢2"],
      "formula": "計算式"
    }
  ]
}

使用可能な部品タイプ:
text, textarea, number, date, time, select, checkbox, attachment, relation, calc, auto

ルール:
- id は "comp_" + 3桁の連番（comp_001, comp_002, ...）
- type は上記の有効な部品タイプのみ使用する
- 名前・タイトル等の短い文字列は type を "text"（1行テキスト）にする
- 業務内容・所感・コメント・備考等の長文入力が想定される項目は type を "textarea"（複数行テキスト）にする
- 金額・数量・合計等の数値項目は type を "number" または "calc" にする
- 出勤時刻・退勤時刻等の時刻項目は type を "time" にする
- 承認・確認・選択等の択一項目は type を "select" または "checkbox" にする
- options は type が "select" の場合のみ設定する
- formula は type が "calc" の場合のみ設定する
- required は業務上必須かどうかを判断して設定する
- 必ず有効なJSONのみを出力する`;

const RELATIONS_PROMPT = `あなたはAppSuite（デスクネッツ ネオの業務アプリ作成ツール）の設計支援AIです。
以下のアプリ要件からリレーション設計を生成してください。

出力フォーマット（JSONのみ、他のテキストは不要）:
{
  "relations": [
    {
      "sourceApp": "参照元アプリ名",
      "targetApp": "参照先アプリ名",
      "keyField": "紐付けキー",
      "fetchFields": ["取得フィールド1", "取得フィールド2"],
      "comment": "紐付けの目的説明"
    }
  ]
}

ルール:
- 要件に他アプリとのデータ参照・連携が含まれない場合は空配列を返す
- 参照先アプリが明示されていない場合、targetApp は "[既存アプリ名を指定してください]" とする
- comment は必ず設定し、紐付けの目的を説明する（空文字列不可）
- 必ず有効なJSONのみを出力する`;

const AUTOMATIONS_PROMPT = `あなたはAppSuite（デスクネッツ ネオの業務アプリ作成ツール）の設計支援AIです。
以下のアプリ要件と部品定義から計算式・自動設定ロジックを生成してください。

出力フォーマット（JSONのみ、他のテキストは不要）:
{
  "automations": [
    {
      "type": "calc",
      "targetComponent": "対象部品ID",
      "formula": "計算式",
      "comment": "動作説明"
    },
    {
      "type": "auto",
      "targetComponent": "対象部品ID",
      "conditions": [
        {
          "field": "条件対象部品ID",
          "operator": "eq",
          "value": "条件値",
          "setValue": "設定値"
        }
      ],
      "comment": "動作説明"
    }
  ],
  "additionalComponents": [
    {
      "id": "comp_xxx",
      "name": "追加部品名",
      "type": "部品タイプ",
      "required": false
    }
  ]
}

ルール:
- 要件に計算・集計・合計等の処理が含まれない場合は空配列を返す
- type は "calc"（計算式）または "auto"（自動設定）のみ
- operator は eq/neq/gt/lt/gte/lte のいずれか
- comment は必ず設定し、動作を説明する（空文字列不可）
- 計算式に必要な部品が部品定義に存在しない場合は additionalComponents に追加する
- 必ず有効なJSONのみを出力する`;

const LAYOUT_PROMPT = `あなたはAppSuite（デスクネッツ ネオの業務アプリ作成ツール）の設計支援AIです。
以下の部品定義から画面レイアウトを生成してください。

出力フォーマット（JSONのみ、他のテキストは不要）:
{
  "pc": [
    {
      "sectionName": "セクション名",
      "rows": [
        { "components": ["comp_001", "comp_002"] },
        { "components": ["comp_003"] }
      ]
    }
  ],
  "mobile": [
    {
      "sectionName": "セクション名",
      "rows": [
        { "components": ["comp_001"] },
        { "components": ["comp_002"] },
        { "components": ["comp_003"] }
      ]
    }
  ]
}

ルール:
- PC版は必須。関連する部品をグループ化し、セクション名を付与する
- PC版は1行に複数部品を配置可能
- モバイル版が要求された場合のみ mobile を生成する（要求されていなければ省略）
- モバイル版は全部品を縦1列に配置（1行に1部品のみ）し、重要度の高い部品を上部に配置する
- 全部品がいずれかのセクションに配置されること
- 必ず有効なJSONのみを出力する`;

const REGENERATE_PROMPT = `あなたはAppSuite（デスクネッツ ネオの業務アプリ作成ツール）の設計支援AIです。
既存の設計情報に対して、ユーザーの修正指示を反映してください。

出力フォーマット（JSONのみ、他のテキストは不要）:
{
  "appInfo": { "name": "...", "iconId": "...", "description": "..." },
  "components": [...],
  "relations": [...],
  "automations": [...]
}

ルール:
- 修正指示に関係しない要素はそのまま維持する
- 修正指示に関係する要素のみ更新する
- 部品を追加する場合は既存のIDと重複しないようにする
- 部品を削除する場合はその部品への参照（計算式・リレーション等）も整理する
- 必ず有効なJSONのみを出力する`;

/**
 * LLM応答からMarkdownコードフェンスを除去してJSON文字列を取り出す。
 */
function stripMarkdownFences(text: string): string {
  const match = text.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
  return match ? match[1].trim() : text.trim();
}

/**
 * Generator クラス — ParsedRequirements から設計情報を生成する
 */
export class Generator {
  private client: Anthropic;
  private model: string;

  constructor(deps: GeneratorDeps) {
    this.client = deps.llmClient;
    this.model = deps.model ?? 'claude-sonnet-4-20250514';
  }

  /**
   * ParsedRequirements を受け取り、DesignInfo を生成する。
   * @param options.includeMobile モバイル版レイアウトを生成するか（デフォルト: false）
   */
  async generate(
    requirements: ParsedRequirements,
    options: { includeMobile?: boolean } = {},
  ): Promise<DesignInfo> {
    // Phase 1: AppInfo と Components を並列生成
    const [appInfo, components] = await Promise.all([
      this.generateAppInfo(requirements),
      this.generateComponents(requirements),
    ]);

    // Phase 2: Relations と Automations を並列生成（Components に依存）
    const [relations, automationsResult] = await Promise.all([
      this.generateRelations(requirements),
      this.generateAutomations(requirements, components),
    ]);

    // Automations で追加された部品をマージ
    const allComponents = [...components, ...automationsResult.additionalComponents];

    // Phase 3: Layout 生成（全部品に依存）
    const layout = await this.generateLayout(allComponents, options.includeMobile ?? false);

    // Phase 4: Claude Code 用操作指示の生成
    const designInfo: DesignInfo = {
      appInfo,
      components: allComponents,
      relations,
      automations: automationsResult.automations,
      layout,
      claudeInstruction: '', // 後で設定
      generatedAt: new Date().toISOString(),
      inputSummary: requirements.rawText,
    };

    designInfo.claudeInstruction = this.buildClaudeInstruction(designInfo);

    return designInfo;
  }

  /**
   * 既存の DesignInfo に対して修正指示を反映し、部分的に再生成する。
   * 修正対象の要素のみ更新し、他の要素は維持する。
   */
  async regenerate(
    requirements: ParsedRequirements,
    instruction: string,
    existing: DesignInfo,
  ): Promise<RegenerateResult> {
    const existingJson = JSON.stringify({
      appInfo: existing.appInfo,
      components: existing.components,
      relations: existing.relations,
      automations: existing.automations,
    }, null, 2);

    const userMessage = [
      `元の要件: ${requirements.rawText}`,
      '',
      '既存の設計情報:',
      existingJson,
      '',
      `修正指示: ${instruction}`,
    ].join('\n');

    const raw = await this.callLLM(REGENERATE_PROMPT, userMessage);
    const json = JSON.parse(raw) as {
      appInfo?: Partial<AppInfo>;
      components?: unknown[];
      relations?: unknown[];
      automations?: unknown[];
    };

    // 更新された設計情報を構築
    const updatedAppInfo: AppInfo = {
      name: this.sanitizeAppName(json.appInfo?.name ?? existing.appInfo.name),
      iconId: this.sanitizeIconId(json.appInfo?.iconId ?? existing.appInfo.iconId),
      description: this.sanitizeDescription(json.appInfo?.description ?? existing.appInfo.description),
    };

    const updatedComponents = Array.isArray(json.components)
      ? json.components
          .map((c: any) => this.sanitizeComponent(c))
          .filter((c): c is ComponentDefinition => c !== null)
      : existing.components;

    const updatedRelations = Array.isArray(json.relations)
      ? json.relations
          .map((r: any) => this.sanitizeRelation(r))
          .filter((r): r is RelationDefinition => r !== null)
      : existing.relations;

    const updatedAutomations = Array.isArray(json.automations)
      ? json.automations
          .map((a: any) => this.sanitizeAutomation(a))
          .filter((a): a is AutomationDefinition => a !== null)
      : existing.automations;

    // 差分を計算
    const diff = this.computeDiff(existing, {
      appInfo: updatedAppInfo,
      components: updatedComponents,
      relations: updatedRelations,
      automations: updatedAutomations,
    });

    const updated: DesignInfo = {
      appInfo: updatedAppInfo,
      components: updatedComponents,
      relations: updatedRelations,
      automations: updatedAutomations,
      layout: existing.layout, // レイアウトは維持
      claudeInstruction: '',
      generatedAt: new Date().toISOString(),
      inputSummary: existing.inputSummary,
    };

    updated.claudeInstruction = this.buildClaudeInstruction(updated);

    return { updated, diff };
  }

  /**
   * 全設計情報を最初から再生成する。
   */
  async regenerateAll(
    requirements: ParsedRequirements,
    options: { includeMobile?: boolean } = {},
  ): Promise<DesignInfo> {
    return this.generate(requirements, options);
  }

  // --- 差分計算 ---

  private computeDiff(
    existing: DesignInfo,
    updated: {
      appInfo: AppInfo;
      components: ComponentDefinition[];
      relations: RelationDefinition[];
      automations: AutomationDefinition[];
    },
  ): DesignDiff {
    const added: string[] = [];
    const modified: string[] = [];
    const removed: string[] = [];

    // AppInfo の差分
    if (existing.appInfo.name !== updated.appInfo.name) {
      modified.push(`アプリ名: 「${existing.appInfo.name}」→「${updated.appInfo.name}」`);
    }
    if (existing.appInfo.description !== updated.appInfo.description) {
      modified.push('アプリ説明文を変更');
    }

    // Components の差分
    const existingIds = new Set(existing.components.map((c) => c.id));
    const updatedIds = new Set(updated.components.map((c) => c.id));

    for (const comp of updated.components) {
      if (!existingIds.has(comp.id)) {
        added.push(`部品「${comp.name}」(${comp.type}) を追加`);
      } else {
        const old = existing.components.find((c) => c.id === comp.id);
        if (old && JSON.stringify(old) !== JSON.stringify(comp)) {
          modified.push(`部品「${comp.name}」を変更`);
        }
      }
    }
    for (const comp of existing.components) {
      if (!updatedIds.has(comp.id)) {
        removed.push(`部品「${comp.name}」(${comp.type}) を削除`);
      }
    }

    // Relations の差分
    if (updated.relations.length > existing.relations.length) {
      added.push(`リレーション ${updated.relations.length - existing.relations.length}件 を追加`);
    } else if (updated.relations.length < existing.relations.length) {
      removed.push(`リレーション ${existing.relations.length - updated.relations.length}件 を削除`);
    }

    // Automations の差分
    if (updated.automations.length > existing.automations.length) {
      added.push(`自動化定義 ${updated.automations.length - existing.automations.length}件 を追加`);
    } else if (updated.automations.length < existing.automations.length) {
      removed.push(`自動化定義 ${existing.automations.length - updated.automations.length}件 を削除`);
    }

    return { added, modified, removed };
  }

  // --- AppInfo 生成 ---

  async generateAppInfo(requirements: ParsedRequirements): Promise<AppInfo> {
    try {
      const raw = await this.callLLM(APP_INFO_PROMPT, this.buildRequirementsText(requirements));
      const json = JSON.parse(raw) as { name?: string; iconId?: string; description?: string };

      return {
        name: this.sanitizeAppName(json.name),
        iconId: this.sanitizeIconId(json.iconId),
        description: this.sanitizeDescription(json.description),
      };
    } catch {
      // アプリ名生成失敗時のフォールバック（要件 2.4）
      return {
        name: DEFAULT_VALUES.APP_NAME,
        iconId: APPSUITE_ICON_IDS[0],
        description: '',
      };
    }
  }

  // --- ComponentDefinition 生成 ---

  async generateComponents(requirements: ParsedRequirements): Promise<ComponentDefinition[]> {
    const raw = await this.callLLM(COMPONENTS_PROMPT, this.buildRequirementsText(requirements));
    const json = JSON.parse(raw) as { components?: unknown[] };

    if (!Array.isArray(json.components)) {
      return [];
    }

    return json.components
      .map((c: any) => this.sanitizeComponent(c))
      .filter((c): c is ComponentDefinition => c !== null);
  }

  // --- サニタイズ ---

  private sanitizeAppName(name: string | undefined): string {
    if (!name || name.trim().length === 0) {
      return DEFAULT_VALUES.APP_NAME;
    }
    if (name.length > CONSTRAINTS.MAX_APP_NAME_LENGTH) {
      return name.slice(0, CONSTRAINTS.MAX_APP_NAME_LENGTH);
    }
    return name;
  }

  private sanitizeIconId(iconId: string | undefined): string {
    if (iconId && (APPSUITE_ICON_IDS as readonly string[]).includes(iconId)) {
      return iconId;
    }
    return APPSUITE_ICON_IDS[0];
  }

  private sanitizeDescription(description: string | undefined): string {
    if (!description) {
      return '';
    }
    if (description.length > CONSTRAINTS.MAX_DESCRIPTION_LENGTH) {
      return description.slice(0, CONSTRAINTS.MAX_DESCRIPTION_LENGTH);
    }
    return description;
  }

  private sanitizeComponent(raw: any): ComponentDefinition | null {
    if (!raw || typeof raw !== 'object') return null;

    const type = raw.type as string;
    if (!VALID_COMPONENT_TYPES.includes(type as ComponentType)) {
      return null;
    }

    const component: ComponentDefinition = {
      id: typeof raw.id === 'string' ? raw.id : `comp_${String(Math.random()).slice(2, 5)}`,
      name: typeof raw.name === 'string' ? raw.name : '',
      type: type as ComponentType,
      required: typeof raw.required === 'boolean' ? raw.required : false,
    };

    if (type === 'select' && Array.isArray(raw.options)) {
      component.options = raw.options.filter((o: unknown) => typeof o === 'string');
    }

    if (type === 'calc' && typeof raw.formula === 'string') {
      component.formula = raw.formula;
    }

    return component;
  }

  // --- RelationDefinition 生成 ---

  async generateRelations(requirements: ParsedRequirements): Promise<RelationDefinition[]> {
    try {
      const raw = await this.callLLM(RELATIONS_PROMPT, this.buildRequirementsText(requirements));
      const json = JSON.parse(raw) as { relations?: unknown[] };

      if (!Array.isArray(json.relations)) {
        return [];
      }

      return json.relations
        .map((r: any) => this.sanitizeRelation(r))
        .filter((r): r is RelationDefinition => r !== null);
    } catch {
      return [];
    }
  }

  private sanitizeRelation(raw: any): RelationDefinition | null {
    if (!raw || typeof raw !== 'object') return null;

    const comment = typeof raw.comment === 'string' && raw.comment.trim().length > 0
      ? raw.comment
      : null;

    // コメントが空の場合は無効（要件 4.2: コメント必須）
    if (!comment) return null;

    return {
      sourceApp: typeof raw.sourceApp === 'string' ? raw.sourceApp : '',
      targetApp: typeof raw.targetApp === 'string' && raw.targetApp.trim().length > 0
        ? raw.targetApp
        : DEFAULT_VALUES.RELATION_PLACEHOLDER,
      keyField: typeof raw.keyField === 'string' ? raw.keyField : '',
      fetchFields: Array.isArray(raw.fetchFields)
        ? raw.fetchFields.filter((f: unknown) => typeof f === 'string')
        : [],
      comment,
    };
  }

  // --- AutomationDefinition 生成 ---

  async generateAutomations(
    requirements: ParsedRequirements,
    components: ComponentDefinition[],
  ): Promise<{ automations: AutomationDefinition[]; additionalComponents: ComponentDefinition[] }> {
    try {
      const componentsList = components
        .map((c) => `${c.id}: ${c.name} (${c.type})`)
        .join('\n');
      const userMessage = `${this.buildRequirementsText(requirements)}\n\n既存の部品定義:\n${componentsList}`;

      const raw = await this.callLLM(AUTOMATIONS_PROMPT, userMessage);
      const json = JSON.parse(raw) as {
        automations?: unknown[];
        additionalComponents?: unknown[];
      };

      const automations = Array.isArray(json.automations)
        ? json.automations
            .map((a: any) => this.sanitizeAutomation(a))
            .filter((a): a is AutomationDefinition => a !== null)
        : [];

      const additionalComponents = Array.isArray(json.additionalComponents)
        ? json.additionalComponents
            .map((c: any) => this.sanitizeComponent(c))
            .filter((c): c is ComponentDefinition => c !== null)
        : [];

      return { automations, additionalComponents };
    } catch {
      return { automations: [], additionalComponents: [] };
    }
  }

  private sanitizeAutomation(raw: any): AutomationDefinition | null {
    if (!raw || typeof raw !== 'object') return null;

    const type = raw.type as string;
    if (type !== 'calc' && type !== 'auto') return null;

    const comment = typeof raw.comment === 'string' && raw.comment.trim().length > 0
      ? raw.comment
      : null;

    // コメントが空の場合は無効（要件 5.3: コメント必須）
    if (!comment) return null;

    const automation: AutomationDefinition = {
      type,
      targetComponent: typeof raw.targetComponent === 'string' ? raw.targetComponent : '',
      comment,
    };

    if (type === 'calc' && typeof raw.formula === 'string') {
      automation.formula = raw.formula;
    }

    if (type === 'auto' && Array.isArray(raw.conditions)) {
      automation.conditions = raw.conditions
        .map((c: any) => this.sanitizeAutoCondition(c))
        .filter((c: AutoCondition | null): c is AutoCondition => c !== null);
    }

    return automation;
  }

  private sanitizeAutoCondition(raw: any): AutoCondition | null {
    if (!raw || typeof raw !== 'object') return null;

    const validOperators = ['eq', 'neq', 'gt', 'lt', 'gte', 'lte'];
    if (!validOperators.includes(raw.operator)) return null;

    return {
      field: typeof raw.field === 'string' ? raw.field : '',
      operator: raw.operator,
      value: raw.value ?? '',
      setValue: raw.setValue ?? '',
    };
  }

  // --- LayoutDefinition 生成 ---

  async generateLayout(
    components: ComponentDefinition[],
    includeMobile: boolean,
  ): Promise<LayoutDefinition> {
    try {
      const componentsList = components
        .map((c) => `${c.id}: ${c.name} (${c.type})`)
        .join('\n');
      const userMessage = `以下の部品でレイアウトを生成してください。${includeMobile ? 'モバイル版も生成してください。' : 'PC版のみ生成してください。'}\n\n部品一覧:\n${componentsList}`;

      const raw = await this.callLLM(LAYOUT_PROMPT, userMessage);
      const json = JSON.parse(raw) as {
        pc?: unknown[];
        mobile?: unknown[];
      };

      const pc = Array.isArray(json.pc)
        ? json.pc.map((s: any) => this.sanitizeLayoutSection(s)).filter((s): s is LayoutSection => s !== null)
        : [];

      const layout: LayoutDefinition = { pc };

      if (includeMobile && Array.isArray(json.mobile)) {
        layout.mobile = json.mobile
          .map((s: any) => this.sanitizeMobileLayoutSection(s))
          .filter((s): s is LayoutSection => s !== null);
      }

      return layout;
    } catch {
      return { pc: [] };
    }
  }

  private sanitizeLayoutSection(raw: any): LayoutSection | null {
    if (!raw || typeof raw !== 'object') return null;

    const sectionName = typeof raw.sectionName === 'string' && raw.sectionName.trim().length > 0
      ? raw.sectionName
      : null;

    if (!sectionName) return null;

    const rows = Array.isArray(raw.rows)
      ? raw.rows
          .filter((r: any) => r && Array.isArray(r.components) && r.components.length > 0)
          .map((r: any) => ({
            components: r.components.filter((c: unknown) => typeof c === 'string'),
          }))
      : [];

    return { sectionName, rows };
  }

  private sanitizeMobileLayoutSection(raw: any): LayoutSection | null {
    if (!raw || typeof raw !== 'object') return null;

    const sectionName = typeof raw.sectionName === 'string' && raw.sectionName.trim().length > 0
      ? raw.sectionName
      : null;

    if (!sectionName) return null;

    // モバイル版: 各行は1部品のみ（要件 6.6）
    const rows = Array.isArray(raw.rows)
      ? raw.rows
          .filter((r: any) => r && Array.isArray(r.components) && r.components.length > 0)
          .map((r: any) => ({
            components: [r.components[0]].filter((c: unknown) => typeof c === 'string'),
          }))
      : [];

    return { sectionName, rows };
  }

  // --- Claude Code 用操作指示生成 ---

  buildClaudeInstruction(design: DesignInfo): string {
    const sections: string[] = [];

    sections.push('# AppSuite テンプレートファイル作成指示');
    sections.push('');
    sections.push('以下の設計情報に基づいて、AppSuiteにインポート可能なテンプレートファイル（JSON形式）を作成してください。');
    sections.push('');

    // アプリ基本情報
    sections.push('## アプリ基本情報');
    sections.push('');
    sections.push(`- アプリ名: ${design.appInfo.name}`);
    sections.push(`- アイコン: ${design.appInfo.iconId}`);
    sections.push(`- 説明: ${design.appInfo.description}`);
    sections.push('');

    // 部品定義
    sections.push('## 部品定義');
    sections.push('');
    sections.push('| ID | 部品名 | タイプ | 必須 |');
    sections.push('|---|---|---|---|');
    for (const comp of design.components) {
      sections.push(`| ${comp.id} | ${comp.name} | ${comp.type} | ${comp.required ? '○' : '-'} |`);
    }
    sections.push('');

    // リレーション設計
    if (design.relations.length > 0) {
      sections.push('## リレーション設計');
      sections.push('');
      sections.push('| 参照元 | 参照先 | キー | 取得フィールド | 目的 |');
      sections.push('|---|---|---|---|---|');
      for (const rel of design.relations) {
        sections.push(`| ${rel.sourceApp} | ${rel.targetApp} | ${rel.keyField} | ${rel.fetchFields.join(', ')} | ${rel.comment} |`);
      }
      sections.push('');
    }

    // 計算式・自動設定
    if (design.automations.length > 0) {
      sections.push('## 計算式・自動設定');
      sections.push('');
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
      sections.push('');
    }

    // 画面レイアウト
    sections.push('## 画面レイアウト（PC版）');
    sections.push('');
    for (const section of design.layout.pc) {
      sections.push(`### ${section.sectionName}`);
      for (const row of section.rows) {
        sections.push(`- [ ${row.components.join(' | ')} ]`);
      }
    }
    sections.push('');

    if (design.layout.mobile) {
      sections.push('## 画面レイアウト（モバイル版）');
      sections.push('');
      for (const section of design.layout.mobile) {
        sections.push(`### ${section.sectionName}`);
        for (const row of section.rows) {
          sections.push(`- [ ${row.components.join(' | ')} ]`);
        }
      }
      sections.push('');
    }

    // テンプレートファイル形式の仕様
    sections.push('## テンプレートファイル形式');
    sections.push('');
    sections.push('AppSuiteテンプレートファイルはJSON形式で、以下の構造を持ちます:');
    sections.push('');
    sections.push('```json');
    sections.push('{');
    sections.push('  "version": "1.0",');
    sections.push('  "appName": "アプリ名",');
    sections.push('  "appIcon": "アイコンID",');
    sections.push('  "appDescription": "説明文",');
    sections.push('  "components": [...],');
    sections.push('  "relations": [...],');
    sections.push('  "automations": [...],');
    sections.push('  "layout": { "pc": [...], "mobile": [...] }');
    sections.push('}');
    sections.push('```');

    return sections.join('\n');
  }

  // --- ヘルパー ---

  private buildRequirementsText(req: ParsedRequirements): string {
    return [
      `アプリ名候補: ${req.appName}`,
      `目的: ${req.purpose}`,
      `想定ユーザー: ${req.targetUsers.join(', ')}`,
      `主要機能: ${req.mainFeatures.join(', ')}`,
      `元の要件テキスト: ${req.rawText}`,
    ].join('\n');
  }

  private async callLLM(systemPrompt: string, userMessage: string): Promise<string> {
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= CONSTRAINTS.LLM_MAX_RETRIES; attempt++) {
      try {
        const response = await this.client.messages.create({
          model: this.model,
          max_tokens: 4096,
          system: systemPrompt,
          messages: [{ role: 'user', content: userMessage }],
        });

        const textBlock = response.content.find((b) => b.type === 'text');
        if (!textBlock || textBlock.type !== 'text') {
          throw new Error('LLM応答にテキストブロックが含まれていません');
        }

        return stripMarkdownFences(textBlock.text);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
      }
    }

    throw new LLMApiError(
      `LLM API呼び出しに${CONSTRAINTS.LLM_MAX_RETRIES}回失敗しました: ${lastError?.message}`,
      CONSTRAINTS.LLM_MAX_RETRIES,
    );
  }
}
