// ============================================================
// Validator — テンプレートファイルの整合性を検証する
// design.md「コンポーネントとインターフェース > Validator」セクションに準拠
// ============================================================

import type {
  TemplateFile,
  ValidationResult,
  ValidationError,
  ComponentType,
} from '../types/index.js';
import { VALID_COMPONENT_TYPES } from '../types/index.js';

/**
 * Validator クラス — テンプレートファイルの整合性を検証する
 *
 * 責務:
 * - 必須フィールドの存在確認（アプリ名・部品定義・バージョン情報）
 * - 部品タイプの有効性確認
 * - リレーション参照の整合性確認
 */
export class Validator {
  /**
   * テンプレートファイルを検証し、ValidationResult を返す。
   */
  validate(template: TemplateFile): ValidationResult {
    const errors: ValidationError[] = [
      ...this.validateRequiredFields(template),
      ...this.validateComponentTypes(template),
      ...this.validateRelationReferences(template),
    ];

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  // --- 必須フィールド検証（要件 8.2） ---

  private validateRequiredFields(template: TemplateFile): ValidationError[] {
    const errors: ValidationError[] = [];

    if (!template.version || template.version.trim().length === 0) {
      errors.push({
        field: 'version',
        message: 'バージョン情報が設定されていません',
      });
    }

    if (!template.appName || template.appName.trim().length === 0) {
      errors.push({
        field: 'appName',
        message: 'アプリ名が設定されていません',
      });
    }

    if (!Array.isArray(template.components) || template.components.length === 0) {
      errors.push({
        field: 'components',
        message: '部品定義が1つ以上必要です',
      });
    }

    return errors;
  }

  // --- 部品タイプの有効性確認 ---

  private validateComponentTypes(template: TemplateFile): ValidationError[] {
    const errors: ValidationError[] = [];

    if (!Array.isArray(template.components)) return errors;

    for (const comp of template.components) {
      if (!VALID_COMPONENT_TYPES.includes(comp.type as ComponentType)) {
        errors.push({
          field: `components.${comp.id}.type`,
          message: `無効な部品タイプ「${comp.type}」です。有効な部品タイプ: ${VALID_COMPONENT_TYPES.join(', ')}`,
        });
      }
    }

    return errors;
  }

  // --- リレーション参照の整合性確認 ---

  private validateRelationReferences(template: TemplateFile): ValidationError[] {
    const errors: ValidationError[] = [];

    if (!Array.isArray(template.relations)) return errors;

    const componentIds = new Set(
      Array.isArray(template.components) ? template.components.map((c) => c.id) : [],
    );

    for (let i = 0; i < template.relations.length; i++) {
      const rel = template.relations[i];

      if (!rel.sourceApp || rel.sourceApp.trim().length === 0) {
        errors.push({
          field: `relations[${i}].sourceApp`,
          message: 'リレーションの参照元アプリ名が設定されていません',
        });
      }

      if (!rel.targetApp || rel.targetApp.trim().length === 0) {
        errors.push({
          field: `relations[${i}].targetApp`,
          message: 'リレーションの参照先アプリ名が設定されていません',
        });
      }

      if (!rel.keyField || rel.keyField.trim().length === 0) {
        errors.push({
          field: `relations[${i}].keyField`,
          message: 'リレーションの紐付けキーが設定されていません',
        });
      }
    }

    return errors;
  }
}
