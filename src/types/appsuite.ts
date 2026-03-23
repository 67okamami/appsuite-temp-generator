// ============================================================
// AppSuite 実テンプレート形式の型定義
// 実物の template.json を解析して定義
// ============================================================

/**
 * AppSuite の実際のフィールドタイプ
 */
export type AppSuiteFieldType =
  | 'id'
  | 'datetime'
  | 'user'
  | 'number'
  | 'textbox'
  | 'textarea'
  | 'richeditor'
  | 'files'
  | 'input_list'
  | 'select'
  | 'listbox'
  | 'radio'
  | 'checkbox'
  | 'users'
  | 'groups'
  | 'date'
  | 'time'
  | 'expression'
  | 'rel_list'
  | 'rel_field';

/**
 * 設計書の ComponentType → AppSuite フィールドタイプ のマッピング
 */
export const COMPONENT_TYPE_TO_APPSUITE: Record<string, AppSuiteFieldType> = {
  text: 'textbox',
  textarea: 'textarea',
  number: 'number',
  date: 'date',
  time: 'time',
  select: 'select',
  checkbox: 'checkbox',
  attachment: 'files',
  relation: 'rel_list',
  calc: 'expression',
  auto: 'expression', // 自動設定は tasks で表現するが、フィールドとしては expression
};

/**
 * AppSuite 標準アイコンパス
 */
export const APPSUITE_ICON_PATHS: Record<string, { portal: string; menu: string }> = {
  'icon-document': {
    portal: '/dneores/dneo/images/cdb/app/menu_icon/app_icon_001.png',
    menu: '/dneores/dneo/images/cdb/app/menu_pallet/pmenu_icon_001.png',
  },
  'icon-spreadsheet': {
    portal: '/dneores/dneo/images/cdb/app/menu_icon/app_icon_002.png',
    menu: '/dneores/dneo/images/cdb/app/menu_pallet/pmenu_icon_002.png',
  },
  'icon-calendar': {
    portal: '/dneores/dneo/images/cdb/app/menu_icon/app_icon_003.png',
    menu: '/dneores/dneo/images/cdb/app/menu_pallet/pmenu_icon_003.png',
  },
  'icon-task': {
    portal: '/dneores/dneo/images/cdb/app/menu_icon/app_icon_004.png',
    menu: '/dneores/dneo/images/cdb/app/menu_pallet/pmenu_icon_004.png',
  },
  'icon-mail': {
    portal: '/dneores/dneo/images/cdb/app/menu_icon/app_icon_005.png',
    menu: '/dneores/dneo/images/cdb/app/menu_pallet/pmenu_icon_005.png',
  },
  'icon-address': {
    portal: '/dneores/dneo/images/cdb/app/menu_icon/app_icon_006.png',
    menu: '/dneores/dneo/images/cdb/app/menu_pallet/pmenu_icon_006.png',
  },
  'icon-workflow': {
    portal: '/dneores/dneo/images/cdb/app/menu_icon/app_icon_007.png',
    menu: '/dneores/dneo/images/cdb/app/menu_pallet/pmenu_icon_007.png',
  },
  'icon-report': {
    portal: '/dneores/dneo/images/cdb/app/menu_icon/app_icon_008.png',
    menu: '/dneores/dneo/images/cdb/app/menu_pallet/pmenu_icon_008.png',
  },
  'icon-inventory': {
    portal: '/dneores/dneo/images/cdb/app/menu_icon/app_icon_009.png',
    menu: '/dneores/dneo/images/cdb/app/menu_pallet/pmenu_icon_009.png',
  },
  'icon-money': {
    portal: '/dneores/dneo/images/cdb/app/menu_icon/app_icon_010.png',
    menu: '/dneores/dneo/images/cdb/app/menu_pallet/pmenu_icon_010.png',
  },
};

// --- template.json 内の構造体 ---

export interface AppSuiteApplication {
  Name: string;
  type_: 'normal';
  overview_: string;
  card_view_id: number;
  capture_file_name: string;
  capture_mime_type: string;
  portalfilename: string;
  portalmimetype: string;
  menufilename: string;
  menumimetype: string;
  card_date_format: string;
  table_date_format: string;
  user_format: string;
  view_menu: string;
  use_field_alias: string;
  save_change_log: string;
  button_name_addnew: string;
  button_name_copyadd: string;
  button_name_add: string;
  ID: number;
}

export interface AppSuiteTable {
  Name: string;
  table_id: number;
  ID: number;
  lastid: number;
}

export interface AppSuiteField {
  Name: string;
  placeholder_: string;
  type_: AppSuiteFieldType;
  format_: string;
  field_attribute: string;
  system_: string; // "0" or "1"
  required_: string; // "0" or "1"
  unique_: string;
  sortable_: string;
  min_: string;
  max_: string;
  input_charactor_type: string;
  unit_: string;
  unit_arrangement: string;
  default_value: string;
  unapply_on_copy: string;
  options: string; // 選択肢はカンマ区切り文字列
  calc_expr: string;
  calc_result_type: string;
  rel_lookup: string;
  rel_key_matching: string;
  rel_on_delete: string;
  alt_image_file_name: string;
  alt_image_mime_type: string;
  identity_: string;
  identity_reset_timing: string;
  field_alias: string;
  cond_input_id: string;
  time_unit: string;
  table_id: number;
  ID: number;
  SEQNO: number;
}

export interface AppSuiteView {
  Name: string;
  layout_grid_size: number;
  width_: number;
  height_: number;
  type_: string;
  enabled_: string;
  view_user_type: string;
  sort_order: string;
  view_style: string;
  class_name: string;
  bg_image_file_name: string;
  bg_image_mime_type: string;
  apply_cond_style: string;
  mobile_layout: string;
  table_id: number;
  ID: number;
  lastid: number;
  SEQNO: number;
}

export interface AppSuiteViewPart {
  type_: string;
  block_style: string;
  field_style: string;
  title_style: string;
  partial_style: string;
  class_name: string;
  field_tid: number;
  field_fid: number;
  editable_: string;
  label_text: string;
  no_print: string;
  image_type_file_name: string;
  image_type_mime_type: string;
  total_method: string;
  total_decimal: string;
  plugin_id: string;
  component_id: string;
  component_settings: string;
  table_id: number;
  view_id: number;
  ID: number;
  SEQNO: number;
}

export interface AppSuiteAppEntry {
  application: AppSuiteApplication;
  tables: AppSuiteTable[];
  table_fileds: AppSuiteField[]; // Note: "fileds" is the actual typo in AppSuite
  filed_cond_styles: unknown[];
  views: AppSuiteView[];
  view_parts: AppSuiteViewPart[];
  filters: unknown[];
  filter_items: unknown[];
  sort_items: unknown[];
  keyword_search_fields: unknown[];
  tasks: unknown[];
  task_actions: unknown[];
  task_Watch_fields: unknown[];
  notice_fields: unknown[];
  copydata_fields: unknown[];
  aggr_settings: unknown[];
  aggr_methods: unknown[];
  aggr_method_item_details: unknown[];
  aggr_report_settings: unknown[];
  app_coord: Record<string, unknown>;
  validations: unknown[];
}

/**
 * AppSuite template.json のルート構造
 */
export interface AppSuiteTemplateJson {
  version: string;
  applications: AppSuiteAppEntry[];
}

/**
 * AppSuite template_desc.json の構造
 */
export interface AppSuiteTemplateDesc {
  Name: string;
  overview: string;
  filename: string;
  mimetype: string;
}

/** template.json のバージョン */
export const APPSUITE_TEMPLATE_VERSION = '1.0.9';
