// ============================================================
// Validator — テンプレートファイルの整合性を検証する
// design.md「コンポーネントとインターフェース > Validator」セクションに準拠
// AppSuite 実テンプレート形式（AppSuiteTemplateJson）を検証対象とする
// ============================================================

import type {
  ValidationResult,
  ValidationError,
} from '../types/index.js';
import type { AppSuiteTemplateJson } from '../types/appsuite.js';

/**
 * Validator クラス — AppSuite テンプレートファイルの整合性を検証する
 *
 * 責務:
 * - 必須フィールドの存在確認（バージョン・アプリ名・部品定義）
 * - フィールドタイプの有効性確認
 * - 構造の整合性確認
 */
export class Validator {
  private static readonly VALID_FIELD_TYPES = new Set([
    'id', 'datetime', 'user', 'number', 'textbox', 'textarea', 'richeditor',
    'files', 'input_list', 'select', 'listbox', 'radio', 'checkbox',
    'users', 'groups', 'date', 'time', 'expression', 'rel_list', 'rel_field',
  ]);

  /**
   * AppSuite テンプレート JSON を検証し、ValidationResult を返す。
   */
  validate(template: AppSuiteTemplateJson): ValidationResult {
    const errors: ValidationError[] = [
      ...this.validateRequiredFields(template),
      ...this.validateFieldTypes(template),
      ...this.validateStructure(template),
    ];

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  // --- 必須フィールド検証（要件 8.2） ---

  private validateRequiredFields(template: AppSuiteTemplateJson): ValidationError[] {
    const errors: ValidationError[] = [];

    // バージョン情報
    if (!template.version || template.version.trim().length === 0) {
      errors.push({
        field: 'version',
        message: 'バージョン情報が設定されていません',
      });
    }

    // applications 配列
    if (!Array.isArray(template.applications) || template.applications.length === 0) {
      errors.push({
        field: 'applications',
        message: 'アプリケーション定義が1つ以上必要です',
      });
      return errors; // これ以降の検証は不可
    }

    for (let i = 0; i < template.applications.length; i++) {
      const app = template.applications[i];

      // アプリ名
      if (!app.application?.Name || app.application.Name.trim().length === 0) {
        errors.push({
          field: `applications[${i}].application.Name`,
          message: 'アプリ名が設定されていません',
        });
      }

      // 部品定義（ユーザー定義フィールドが1つ以上必要）
      if (!Array.isArray(app.table_fileds)) {
        errors.push({
          field: `applications[${i}].table_fileds`,
          message: '部品定義が必要です',
        });
      } else {
        const userFields = app.table_fileds.filter((f) => f.system_ === '0');
        if (userFields.length === 0) {
          errors.push({
            field: `applications[${i}].table_fileds`,
            message: 'ユーザー定義の部品が1つ以上必要です',
          });
        }
      }
    }

    return errors;
  }

  // --- フィールドタイプの有効性確認 ---

  private validateFieldTypes(template: AppSuiteTemplateJson): ValidationError[] {
    const errors: ValidationError[] = [];

    if (!Array.isArray(template.applications)) return errors;

    for (let i = 0; i < template.applications.length; i++) {
      const app = template.applications[i];
      if (!Array.isArray(app.table_fileds)) continue;

      for (const field of app.table_fileds) {
        if (!Validator.VALID_FIELD_TYPES.has(field.type_)) {
          errors.push({
            field: `applications[${i}].table_fileds.${field.ID}.type_`,
            message: `無効なフィールドタイプ「${field.type_}」です。有効なタイプ: ${[...Validator.VALID_FIELD_TYPES].join(', ')}`,
          });
        }
      }
    }

    return errors;
  }

  // --- 構造の整合性確認 ---

  private validateStructure(template: AppSuiteTemplateJson): ValidationError[] {
    const errors: ValidationError[] = [];

    if (!Array.isArray(template.applications)) return errors;

    for (let i = 0; i < template.applications.length; i++) {
      const app = template.applications[i];

      // テーブルが存在すること
      if (!Array.isArray(app.tables) || app.tables.length === 0) {
        errors.push({
          field: `applications[${i}].tables`,
          message: 'テーブル定義が1つ以上必要です',
        });
      }

      // ビューが存在すること
      if (!Array.isArray(app.views) || app.views.length === 0) {
        errors.push({
          field: `applications[${i}].views`,
          message: 'ビュー定義が1つ以上必要です',
        });
      }
    }

    return errors;
  }
}
