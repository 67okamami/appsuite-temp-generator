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
text, number, date, select, checkbox, attachment, relation, calc, auto

ルール:
- id は "comp_" + 3桁の連番（comp_001, comp_002, ...）
- type は上記の有効な部品タイプのみ使用する
- 金額・数量・合計等の数値項目は type を "number" または "calc" にする
- 承認・確認・選択等の択一項目は type を "select" または "checkbox" にする
- options は type が "select" の場合のみ設定する
- formula は type が "calc" の場合のみ設定する
- required は業務上必須かどうかを判断して設定する
- 必ず有効なJSONのみを出力する`;

/**
 * Generator クラス — ParsedRequirements から設計情報を生成する
 *
 * タスク4ではアプリ基本情報と部品定義の生成を実装する。
 * リレーション・自動化・レイアウト・Claude Code 指示はタスク5で追加予定。
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
   * タスク4時点では appInfo と components のみ生成し、
   * 残りのフィールドはプレースホルダーを設定する。
   */
  async generate(requirements: ParsedRequirements): Promise<DesignInfo> {
    const [appInfo, components] = await Promise.all([
      this.generateAppInfo(requirements),
      this.generateComponents(requirements),
    ]);

    return {
      appInfo,
      components,
      relations: [],          // タスク5で実装
      automations: [],        // タスク5で実装
      layout: { pc: [] },     // タスク5で実装
      claudeInstruction: '',  // タスク5で実装
      generatedAt: new Date().toISOString(),
      inputSummary: requirements.rawText,
    };
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

        return textBlock.text;
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
