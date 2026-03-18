// ============================================================
// Pipeline — 全コンポーネントを結合するパイプライン
// Parser → Generator → Validator → Renderer の一方向データフロー
// ============================================================

import Anthropic from '@anthropic-ai/sdk';
import { Parser } from '../parser/index.js';
import { Generator } from '../generator/index.js';
import { Validator } from '../validator/index.js';
import { Renderer } from '../renderer/index.js';
import type {
  DesignInfo,
  RegenerateResult,
  ValidationResult,
} from '../types/index.js';
import type { AppSuiteTemplateJson } from '../types/appsuite.js';

export interface PipelineOptions {
  /** Claude API クライアント */
  llmClient: Anthropic;
  /** 使用するモデル（デフォルト: claude-sonnet-4-20250514） */
  model?: string;
  /** モバイル版レイアウトを生成するか（デフォルト: false） */
  includeMobile?: boolean;
}

export interface PipelineResult {
  /** 生成された設計情報 */
  design: DesignInfo;
  /** テンプレートファイル検証結果 */
  validation: ValidationResult;
  /** 設計ドキュメント（Markdown） */
  designDocument: string;
  /** GUI操作ガイド（Markdown） */
  guiGuide: string;
  /** 参考用テンプレートファイル */
  template: AppSuiteTemplateJson;
  /** ZIPアーカイブ（Uint8Array） */
  zipArchive: Uint8Array;
}

export interface RegeneratePipelineResult {
  /** 再生成結果（更新された設計情報 + 差分） */
  regenerateResult: RegenerateResult;
  /** テンプレートファイル検証結果 */
  validation: ValidationResult;
  /** 設計ドキュメント（Markdown） */
  designDocument: string;
  /** GUI操作ガイド（Markdown） */
  guiGuide: string;
  /** ZIPアーカイブ（Uint8Array） */
  zipArchive: Uint8Array;
}

/**
 * Pipeline クラス — 全コンポーネントを結合して一方向データフローを実現する
 */
export class Pipeline {
  private parser: Parser;
  private generator: Generator;
  private validator: Validator;
  private renderer: Renderer;
  private includeMobile: boolean;

  constructor(options: PipelineOptions) {
    const deps = { llmClient: options.llmClient, model: options.model };
    this.parser = new Parser(deps);
    this.generator = new Generator(deps);
    this.validator = new Validator();
    this.renderer = new Renderer();
    this.includeMobile = options.includeMobile ?? false;
  }

  /**
   * 自然言語の要件テキストから設計情報を生成し、全出力を返す。
   */
  async run(input: string): Promise<PipelineResult> {
    // 1. Parse
    const requirements = await this.parser.parse(input);

    // 2. Generate
    const design = await this.generator.generate(requirements, {
      includeMobile: this.includeMobile,
    });

    // 3. Validate + Render
    return this.validateAndRender(design);
  }

  /**
   * 既存の設計情報に修正指示を反映して部分再生成する。
   */
  async regenerate(
    originalInput: string,
    instruction: string,
    existing: DesignInfo,
  ): Promise<RegeneratePipelineResult> {
    // 1. Parse（元の要件テキストを再解析）
    const requirements = await this.parser.parse(originalInput);

    // 2. Regenerate
    const regenerateResult = await this.generator.regenerate(
      requirements,
      instruction,
      existing,
    );

    // 3. Validate + Render
    const { validation, designDocument, guiGuide, zipArchive } =
      await this.validateAndRender(regenerateResult.updated);

    return {
      regenerateResult,
      validation,
      designDocument,
      guiGuide,
      zipArchive,
    };
  }

  /**
   * 全設計情報を最初から再生成する。
   */
  async regenerateAll(input: string): Promise<PipelineResult> {
    return this.run(input);
  }

  // --- 内部ヘルパー ---

  private async validateAndRender(design: DesignInfo): Promise<PipelineResult> {
    const template = this.renderer.renderTemplate(design);
    const validation = this.validator.validate(template);
    const designDocument = this.renderer.renderDesignDocument(design);
    const guiGuide = this.renderer.renderGuiGuide(design);
    const zipArchive = await this.renderer.renderZipArchive(design);

    return {
      design,
      validation,
      designDocument,
      guiGuide,
      template,
      zipArchive,
    };
  }
}
