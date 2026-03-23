// ============================================================
// Parser — 自然言語テキストを ParsedRequirements に変換する
// design.md「コンポーネントとインターフェース > Parser」セクションに準拠
// ============================================================

import Anthropic from '@anthropic-ai/sdk';
import type { ParsedRequirements } from '../types/index.js';
import {
  ERROR_MESSAGES,
  CONSTRAINTS,
  InputValidationError,
  LLMApiError,
} from '../types/errors.js';

export interface ParserDeps {
  llmClient: Anthropic;
  model?: string;
}

const PARSE_SYSTEM_PROMPT = `あなたはAppSuite（デスクネッツ ネオの業務アプリ作成ツール）の設計支援AIです。
ユーザーが入力したアプリ要件テキストを解析し、以下のJSON形式で構造化してください。

出力フォーマット（JSONのみ、他のテキストは不要）:
{
  "appName": "推定アプリ名",
  "purpose": "アプリの目的",
  "targetUsers": ["想定ユーザー1", "想定ユーザー2"],
  "mainFeatures": ["主要機能1", "主要機能2"]
}

ルール:
- appName は簡潔で分かりやすい名前にする
- purpose はアプリの主目的を1〜2文で説明する
- targetUsers は想定される利用者を配列で列挙する
- mainFeatures は主要な機能・データ項目を配列で列挙する
- 入力が日本語でも英語でも対応する
- 必ず有効なJSONのみを出力する`;

/**
 * LLM応答からMarkdownコードフェンスを除去してJSON文字列を取り出す。
 */
function stripMarkdownFences(text: string): string {
  const match = text.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
  return match ? match[1].trim() : text.trim();
}

/**
 * 入力テキストのバリデーションを行う。
 * 空文字列・空白のみ、または5000文字超の場合は InputValidationError をスローする。
 */
export function validateInput(input: string): void {
  if (!input || input.trim().length === 0) {
    throw new InputValidationError(ERROR_MESSAGES.EMPTY_INPUT);
  }
  if (input.length > CONSTRAINTS.MAX_INPUT_LENGTH) {
    throw new InputValidationError(ERROR_MESSAGES.INPUT_TOO_LONG);
  }
}

/**
 * Parser クラス — 自然言語テキストを構造化データに変換する
 */
export class Parser {
  private client: Anthropic;
  private model: string;

  constructor(deps: ParserDeps) {
    this.client = deps.llmClient;
    this.model = deps.model ?? 'claude-sonnet-4-20250514';
  }

  /**
   * 入力テキストを解析し、ParsedRequirements を返す。
   * - 入力バリデーション（空文字・空白のみ・5000文字超）
   * - LLM への解析プロンプト送信
   * - 解析結果の JSON 構造化
   */
  async parse(input: string): Promise<ParsedRequirements> {
    validateInput(input);

    const parsed = await this.callLLM(input);

    return {
      ...parsed,
      rawText: input,
    };
  }

  private async callLLM(
    input: string,
  ): Promise<Omit<ParsedRequirements, 'rawText'>> {
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= CONSTRAINTS.LLM_MAX_RETRIES; attempt++) {
      try {
        const response = await this.client.messages.create({
          model: this.model,
          max_tokens: 1024,
          system: PARSE_SYSTEM_PROMPT,
          messages: [
            {
              role: 'user',
              content: `以下のアプリ要件を解析してください:\n\n${input}`,
            },
          ],
        });

        const textBlock = response.content.find((b) => b.type === 'text');
        if (!textBlock || textBlock.type !== 'text') {
          throw new Error('LLM応答にテキストブロックが含まれていません');
        }

        const json = JSON.parse(stripMarkdownFences(textBlock.text)) as {
          appName: string;
          purpose: string;
          targetUsers: string[];
          mainFeatures: string[];
        };

        return {
          appName: json.appName ?? '',
          purpose: json.purpose ?? '',
          targetUsers: Array.isArray(json.targetUsers) ? json.targetUsers : [],
          mainFeatures: Array.isArray(json.mainFeatures)
            ? json.mainFeatures
            : [],
        };
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
