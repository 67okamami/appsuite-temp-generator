# 実装計画: AppSuite テンプレートジェネレーター

## 概要

パイプライン型アーキテクチャ（Parser → Generator → Validator → Renderer）に沿って段階的に実装する。
各コンポーネントを独立したモジュールとして構築し、最後にパイプライン全体を結合する。

## タスク

- [ ] 1. プロジェクト構造とコア型定義のセットアップ
  - `src/types/index.ts` に全インターフェース（ParsedRequirements / DesignInfo / AppInfo / ComponentDefinition / RelationDefinition / AutomationDefinition / LayoutDefinition / TemplateFile / RegenerateResult / ValidationResult 等）を定義する
  - `src/types/errors.ts` にエラー型・エラーメッセージ定数を定義する
  - `package.json` に fast-check / vitest / jszip / @anthropic-ai/sdk の依存関係を追加する
  - `vitest.config.ts` を作成し、`src/__tests__/` 配下のテストを実行できるよう設定する
  - _要件: 1.5, 1.8, 2.1, 3.1, 4.1, 5.1, 6.1, 8.1_

- [ ] 2. Parser の実装
  - [ ] 2.1 `src/parser/index.ts` に Parser クラスを実装する
    - 入力バリデーション（空文字・空白のみ・5000文字超）を実装する
    - Claude API へ解析プロンプトを送信し、ParsedRequirements を返す `parse(input: string)` メソッドを実装する
    - _要件: 1.1, 1.5, 1.6, 1.7, 1.8_

  - [ ]* 2.2 プロパティテスト: 解析結果の構造完全性（プロパティ1）
    - **プロパティ1: 解析結果の構造完全性**
    - **検証対象: 要件 1.5, 1.8**
    - `src/__tests__/property/parser.property.test.ts` に実装する

  - [ ]* 2.3 プロパティテスト: 空白入力の拒否（プロパティ2）
    - **プロパティ2: 空白入力の拒否**
    - **検証対象: 要件 1.6**
    - `src/__tests__/property/parser.property.test.ts` に実装する

  - [ ]* 2.4 プロパティテスト: 文字数上限の強制（プロパティ3）
    - **プロパティ3: 文字数上限の強制**
    - **検証対象: 要件 1.7**
    - `src/__tests__/property/parser.property.test.ts` に実装する

  - [ ]* 2.5 ユニットテスト: Parser のエッジケース
    - 音声認識失敗時のエラーメッセージ検証
    - 日本語・英語混在入力の解析検証
    - `src/__tests__/unit/parser.test.ts` に実装する
    - _要件: 1.1, 1.4, 1.6, 1.7_

- [ ] 3. チェックポイント - Parser の動作確認
  - 全テストが通ることを確認する。疑問点があればユーザーに確認する。

- [ ] 4. Generator の実装（アプリ基本情報・部品定義）
  - [ ] 4.1 `src/generator/index.ts` に Generator クラスの骨格と `generate()` メソッドを実装する
    - ParsedRequirements を受け取り AppInfo を生成するロジックを実装する（アプリ名20文字以内・アイコン選択・説明文200文字以内）
    - アプリ名生成失敗時のデフォルト値「新規アプリ」フォールバックを実装する
    - _要件: 2.1, 2.2, 2.3, 2.4_

  - [ ]* 4.2 プロパティテスト: アプリ名の文字数制約（プロパティ4）
    - **プロパティ4: アプリ名の文字数制約**
    - **検証対象: 要件 2.1**
    - `src/__tests__/property/generator.property.test.ts` に実装する

  - [ ]* 4.3 プロパティテスト: アイコン識別子の有効性（プロパティ5）
    - **プロパティ5: アイコン識別子の有効性**
    - **検証対象: 要件 2.2**
    - `src/__tests__/property/generator.property.test.ts` に実装する

  - [ ]* 4.4 プロパティテスト: 説明文の文字数制約（プロパティ6）
    - **プロパティ6: 説明文の文字数制約**
    - **検証対象: 要件 2.3**
    - `src/__tests__/property/generator.property.test.ts` に実装する

  - [ ] 4.5 Generator に部品定義表生成ロジックを追加する
    - Claude API へ部品定義生成プロンプトを送信し ComponentDefinition[] を返すロジックを実装する
    - 有効な部品タイプ（text/number/date/select/checkbox/attachment/relation/calc/auto）のみを使用するよう制約する
    - _要件: 3.1, 3.2, 3.3, 3.4_

  - [ ]* 4.6 プロパティテスト: 部品定義の完全性と有効性（プロパティ7）
    - **プロパティ7: 部品定義の完全性と有効性**
    - **検証対象: 要件 3.1, 3.2**
    - `src/__tests__/property/generator.property.test.ts` に実装する

  - [ ]* 4.7 プロパティテスト: 数値項目の部品タイプ割り当て（プロパティ8）
    - **プロパティ8: 数値項目の部品タイプ割り当て**
    - **検証対象: 要件 3.3**
    - `src/__tests__/property/generator.property.test.ts` に実装する

  - [ ]* 4.8 プロパティテスト: 択一項目の部品タイプ割り当て（プロパティ9）
    - **プロパティ9: 択一項目の部品タイプ割り当て**
    - **検証対象: 要件 3.4**
    - `src/__tests__/property/generator.property.test.ts` に実装する

  - [ ]* 4.9 プロパティテスト: Markdown出力形式の保証（プロパティ10）
    - **プロパティ10: Markdown出力形式の保証**
    - **検証対象: 要件 3.5, 4.4**
    - `src/__tests__/property/generator.property.test.ts` に実装する

- [ ] 5. Generator の実装（リレーション・自動化・レイアウト）
  - [ ] 5.1 Generator にリレーション設計生成ロジックを追加する
    - RelationDefinition[] を生成するロジックを実装する
    - 対象アプリ不明時のプレースホルダー「[既存アプリ名を指定してください]」を実装する
    - 各リレーションへのコメント付与を実装する
    - _要件: 4.1, 4.2, 4.3_

  - [ ]* 5.2 プロパティテスト: リレーションコメントの存在（プロパティ11）
    - **プロパティ11: リレーションコメントの存在**
    - **検証対象: 要件 4.2**
    - `src/__tests__/property/generator.property.test.ts` に実装する

  - [ ] 5.3 Generator に計算式・自動設定ロジック生成を追加する
    - AutomationDefinition[] を生成するロジックを実装する
    - 計算式に必要な部品が不足している場合の自動追加ロジックを実装する
    - 各定義への動作説明コメント付与を実装する
    - _要件: 5.1, 5.2, 5.3, 5.4_

  - [ ]* 5.4 プロパティテスト: 自動化定義のコメント存在（プロパティ12）
    - **プロパティ12: 自動化定義のコメント存在**
    - **検証対象: 要件 5.3**
    - `src/__tests__/property/generator.property.test.ts` に実装する

  - [ ] 5.5 Generator に画面レイアウト生成ロジックを追加する
    - PC版 LayoutDefinition を生成するロジックを実装する（セクション分け・部品グループ化）
    - モバイル版レイアウト生成ロジックを実装する（縦1列・重要度順）
    - _要件: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

  - [ ]* 5.6 プロパティテスト: PC版レイアウトの必須生成（プロパティ13）
    - **プロパティ13: PC版レイアウトの必須生成**
    - **検証対象: 要件 6.1, 6.4**
    - `src/__tests__/property/generator.property.test.ts` に実装する

  - [ ]* 5.7 プロパティテスト: モバイル版レイアウトの縦1列制約（プロパティ14）
    - **プロパティ14: モバイル版レイアウトの縦1列制約**
    - **検証対象: 要件 6.6**
    - `src/__tests__/property/generator.property.test.ts` に実装する

  - [ ] 5.8 Generator に Claude Code用操作指示生成ロジックを追加する
    - 全設計情報を含む Markdown コードブロック付きプロンプトを生成するロジックを実装する
    - AppSuiteテンプレートファイル形式（JSON/XML）の仕様を明示する
    - _要件: 7.1, 7.2, 7.3, 7.4_

  - [ ]* 5.9 プロパティテスト: Claude Code操作指示の完全性（プロパティ15）
    - **プロパティ15: Claude Code操作指示の完全性**
    - **検証対象: 要件 7.1, 7.2, 7.3, 7.4**
    - `src/__tests__/property/generator.property.test.ts` に実装する

  - [ ]* 5.10 ユニットテスト: Generator のエッジケース
    - アプリ名生成失敗時のデフォルト値検証
    - 計算式に必要な部品の自動追加検証
    - LLM API リトライロジック（最大3回）の検証
    - `src/__tests__/unit/generator.test.ts` に実装する
    - _要件: 2.4, 5.4_

- [ ] 6. チェックポイント - Generator の動作確認
  - 全テストが通ることを確認する。疑問点があればユーザーに確認する。

- [ ] 7. Validator の実装
  - [ ] 7.1 `src/validator/index.ts` に Validator クラスを実装する
    - 必須フィールド（アプリ名・部品定義・バージョン情報）の存在確認ロジックを実装する
    - 部品タイプの有効性確認ロジックを実装する
    - リレーション参照の整合性確認ロジックを実装する
    - 検証失敗時の不足フィールド特定とエラー詳細メッセージ生成を実装する
    - _要件: 8.2, 8.3_

  - [ ]* 7.2 プロパティテスト: テンプレートファイルの必須フィールド検証（プロパティ16）
    - **プロパティ16: テンプレートファイルの必須フィールド検証**
    - **検証対象: 要件 8.2**
    - `src/__tests__/property/validator.property.test.ts` に実装する

  - [ ]* 7.3 ユニットテスト: Validator のエッジケース
    - 無効な部品タイプ検出と有効タイプ一覧提示の検証
    - リレーション参照不整合の検出検証
    - `src/__tests__/unit/validator.test.ts` に実装する
    - _要件: 8.2, 8.3_

- [ ] 8. Renderer の実装
  - [ ] 8.1 `src/renderer/index.ts` に Renderer クラスを実装する
    - `renderTemplate(design: DesignInfo): TemplateFile` を実装する（AppSuite インポート可能な JSON/XML 形式）
    - `renderDesignDocument(design: DesignInfo): string` を実装する（Markdown 形式・全セクション含む）
    - `renderZipArchive(design: DesignInfo): Blob` を実装する（jszip を使用）
    - 設計ドキュメントに生成日時・入力要件サマリーを含める
    - _要件: 8.1, 8.4, 9.1, 9.2, 9.3_

  - [ ]* 8.2 プロパティテスト: テンプレートファイルのラウンドトリップ（プロパティ17）
    - **プロパティ17: テンプレートファイルのラウンドトリップ**
    - **検証対象: 要件 8.5**
    - `src/__tests__/property/renderer.property.test.ts` に実装する

  - [ ]* 8.3 プロパティテスト: 設計ドキュメントの完全性（プロパティ18）
    - **プロパティ18: 設計ドキュメントの完全性**
    - **検証対象: 要件 9.1, 9.2**
    - `src/__tests__/property/renderer.property.test.ts` に実装する

  - [ ]* 8.4 プロパティテスト: ZIPアーカイブの内容完全性（プロパティ19）
    - **プロパティ19: ZIPアーカイブの内容完全性**
    - **検証対象: 要件 9.3**
    - `src/__tests__/property/renderer.property.test.ts` に実装する

  - [ ]* 8.5 ユニットテスト: Renderer のエッジケース
    - 部品定義表・リレーション設計の Markdown テーブル形式出力検証
    - ZIP アーカイブにテンプレートファイルと設計ドキュメントの両方が含まれることの検証
    - `src/__tests__/unit/renderer.test.ts` に実装する
    - _要件: 3.5, 4.4, 9.3_

- [ ] 9. 修正・再生成機能の実装
  - [ ] 9.1 Generator に `regenerate()` と `regenerateAll()` メソッドを実装する
    - 部分修正: 修正対象要素のみ更新し、他の要素を維持するロジックを実装する
    - 差分情報（DesignDiff: 追加・変更・削除）の生成ロジックを実装する
    - 全体再生成: 全設計情報を最初から再生成するロジックを実装する
    - _要件: 10.1, 10.2, 10.3, 10.4_

  - [ ]* 9.2 プロパティテスト: 部分再生成の整合性（プロパティ20）
    - **プロパティ20: 部分再生成の整合性**
    - **検証対象: 要件 10.2, 10.3**
    - `src/__tests__/property/regenerate.property.test.ts` に実装する

  - [ ]* 9.3 ユニットテスト: 再生成のエッジケース
    - 全体再生成時に全設計情報が更新されることの検証
    - 差分情報の正確性検証
    - `src/__tests__/unit/generator.test.ts` に追記する
    - _要件: 10.1, 10.4_

- [ ] 10. パイプライン統合とエラーハンドリング
  - [ ] 10.1 `src/pipeline/index.ts` に全コンポーネントを結合するパイプラインを実装する
    - Parser → Generator → Validator → Renderer の一方向データフローを実装する
    - LLM API 呼び出しのリトライロジック（最大3回）を実装する
    - 各フェイルセーフ処理（デフォルト値・プレースホルダー補完）を統合する
    - _要件: 1.1, 2.4, 4.3, 5.4_

  - [ ]* 10.2 統合テスト: フルパイプラインの動作検証
    - テキスト入力から ZIP ダウンロードまでのエンドツーエンドフローを検証する
    - `src/__tests__/integration/full-pipeline.test.ts` に実装する
    - _要件: 1.1, 8.1, 9.3_

- [ ] 11. 音声入力機能の実装
  - [ ] 11.1 `src/audio/index.ts` に音声入力モジュールを実装する
    - Web Speech API を使用したリアルタイム音声→テキスト変換を実装する
    - 変換完了後にテキスト入力欄へ反映するロジックを実装する
    - 音声認識失敗時のエラーメッセージ「音声を認識できませんでした。もう一度お試しいただくか、テキストで入力してください」を実装する
    - _要件: 1.1, 1.2, 1.3, 1.4_

  - [ ]* 11.2 ユニットテスト: 音声入力モジュール
    - 音声認識失敗時のエラーメッセージ検証
    - テキスト入力欄への反映ロジック検証
    - `src/__tests__/unit/audio.test.ts` に実装する
    - _要件: 1.2, 1.3, 1.4_

- [ ] 12. 最終チェックポイント - 全テスト通過確認
  - 全テストが通ることを確認する。疑問点があればユーザーに確認する。

## 注意事項

- `*` が付いたサブタスクはオプションであり、MVP では省略可能
- 各タスクは要件番号でトレーサビリティを確保している
- プロパティテストは fast-check を使用し、最低100回のイテレーションを実行する
- 各プロパティテストには `// Feature: appsuite-template-generator, Property {番号}: {プロパティ名}` のタグコメントを付与する
- LLM API（Claude）の呼び出しはテスト時にモック化する
