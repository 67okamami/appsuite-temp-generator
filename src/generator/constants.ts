// ============================================================
// Generator 用定数
// ============================================================

/**
 * AppSuite 標準アイコンセット
 * アプリの用途に応じてアイコンを選択する際に使用する。
 */
export const APPSUITE_ICON_IDS = [
  'icon-document',
  'icon-spreadsheet',
  'icon-calendar',
  'icon-task',
  'icon-mail',
  'icon-address',
  'icon-workflow',
  'icon-report',
  'icon-inventory',
  'icon-money',
  'icon-chart',
  'icon-people',
  'icon-building',
  'icon-cart',
  'icon-truck',
  'icon-tools',
  'icon-clipboard',
  'icon-folder',
  'icon-star',
  'icon-flag',
] as const;

export type AppSuiteIconId = (typeof APPSUITE_ICON_IDS)[number];
