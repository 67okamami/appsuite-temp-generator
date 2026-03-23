// ============================================================
// コア型定義 — design.md「データモデル」セクションに準拠
// ============================================================

// --- ParsedRequirements ---

export interface ParsedRequirements {
  appName: string;
  purpose: string;
  targetUsers: string[];
  mainFeatures: string[];
  rawText: string;
}

// --- AppInfo ---

export interface AppInfo {
  name: string;        // 20文字以内
  iconId: string;      // AppSuite標準アイコン識別子
  description: string; // 200文字以内
}

// --- ComponentDefinition ---

export type ComponentType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'date'
  | 'time'
  | 'select'
  | 'checkbox'
  | 'attachment'
  | 'relation'
  | 'calc'
  | 'auto';

export const VALID_COMPONENT_TYPES: readonly ComponentType[] = [
  'text',
  'textarea',
  'number',
  'date',
  'time',
  'select',
  'checkbox',
  'attachment',
  'relation',
  'calc',
  'auto',
] as const;

export interface AutoConfig {
  conditions: AutoCondition[];
}

export interface ComponentDefinition {
  id: string;
  name: string;
  type: ComponentType;
  required: boolean;
  options?: string[];      // 選択肢タイプの場合
  formula?: string;        // 計算タイプの場合
  autoConfig?: AutoConfig; // 自動設定タイプの場合
}

// --- RelationDefinition ---

export interface RelationDefinition {
  sourceApp: string;
  targetApp: string;   // 未定の場合はプレースホルダー
  keyField: string;
  fetchFields: string[];
  comment: string;     // 紐付けの目的説明（空文字列不可）
}

// --- AutomationDefinition ---

export interface AutoCondition {
  field: string;
  operator: 'eq' | 'neq' | 'gt' | 'lt' | 'gte' | 'lte';
  value: string | number;
  setValue: string | number;
}

export interface AutomationDefinition {
  type: 'calc' | 'auto';
  targetComponent: string; // 対象部品ID
  formula?: string;        // 計算式（calcの場合）
  conditions?: AutoCondition[]; // 条件（autoの場合）
  comment: string;         // 動作説明（空文字列不可）
}

// --- LayoutDefinition ---

export interface LayoutRow {
  components: string[]; // 部品IDのリスト（1行に複数配置可能）
}

export interface LayoutSection {
  sectionName: string;
  rows: LayoutRow[];
}

export interface LayoutDefinition {
  pc: LayoutSection[];
  mobile?: LayoutSection[]; // ユーザーが選択した場合のみ
}

// --- DesignInfo ---

export interface DesignInfo {
  appInfo: AppInfo;
  components: ComponentDefinition[];
  relations: RelationDefinition[];
  automations: AutomationDefinition[];
  layout: LayoutDefinition;
  claudeInstruction: string;
  generatedAt: string; // ISO 8601形式
  inputSummary: string;
}

// --- TemplateFile ---

export interface TemplateComponent {
  id: string;
  name: string;
  type: ComponentType;
  required: boolean;
  options?: string[];
  formula?: string;
  autoConfig?: AutoConfig;
}

export interface TemplateRelation {
  sourceApp: string;
  targetApp: string;
  keyField: string;
  fetchFields: string[];
}

export interface TemplateAutomation {
  type: 'calc' | 'auto';
  targetComponent: string;
  formula?: string;
  conditions?: AutoCondition[];
}

export interface TemplateLayout {
  pc: LayoutSection[];
  mobile?: LayoutSection[];
}

export interface TemplateFile {
  version: string;
  appName: string;
  appIcon: string;
  appDescription: string;
  components: TemplateComponent[];
  relations: TemplateRelation[];
  automations: TemplateAutomation[];
  layout: TemplateLayout;
}

// --- RegenerateResult ---

export interface DesignDiff {
  added: string[];
  modified: string[];
  removed: string[];
}

export interface RegenerateResult {
  updated: DesignInfo;
  diff: DesignDiff;
}

// --- ValidationResult ---

export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}
