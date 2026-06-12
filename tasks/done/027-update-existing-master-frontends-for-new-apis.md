# 027 既存の商品・得意先画面を新 API と業務用語へ修正する

## 目的

商品マスタ画面と得意先マスタ画面を、履歴レコードを直接操作する画面から、指定日から情報を変更する業務画面へ修正する。

## 前提タスク

- `024-redesign-api-contracts-around-aggregates.md`
- `025-refactor-master-apis-around-aggregates.md`
- `026-refactor-sales-api-contracts.md`

## 対象範囲

- `frontend/src/app/products`
- `frontend/src/app/customers`
- 商品・得意先画面の Zod スキーマと TypeScript 型
- 商品・得意先画面の API クライアント
- 商品・得意先画面の Playwright テスト
- 必要に応じて `/ui-catalog` の履歴関連サンプル

## 実装方針

- 「商品履歴追加」「得意先履歴追加」を「商品情報変更」「得意先情報変更」などの業務用語へ変更する。
- `ProductVersion`、`CustomerVersion` を通常画面の中心概念にしない。
- 履歴 ID と内部 ID を画面から除外する。
- 変更履歴は監査や問い合わせ対応に必要な情報として表示できるようにする。
- 適用開始日は、変更が反映される日として利用者に説明する。
- 現在情報、将来適用予定、過去の変更を必要に応じて区別する。
- 新 API 契約に合わせて型、Zod スキーマ、API クライアントを更新する。
- 既存の選択状態、遅延レスポンス対策、エラー表示を維持する。

## 確認項目

- 商品と得意先を新規登録できること。
- 指定日から商品情報と得意先情報を変更できること。
- 変更後に一覧と選択中詳細が適切に更新されること。
- 変更履歴を確認できること。
- 履歴 ID や `Version` を利用者向け画面へ表示しないこと。
- API エラー時に画面がクラッシュしないこと。
- `bun lint`、型チェック、Vitest、対象 Playwright テストが成功すること。

## 完了時に追記すること

- 変更した画面文言と操作フロー
- 変更した TypeScript 型と API クライアント
- 内部履歴情報を表示しないための対応
- 実行した確認コマンドと結果
- 残した制約

## 完了メモ

### 変更した画面文言と操作フロー

- 商品・得意先の「履歴追加」を「情報変更」へ変更し、適用開始日を「変更が反映される日」と説明する画面へ修正した。
- 一覧と選択中詳細は業務日時点の現在情報として表示し、指定日時点の情報は `asOf` を指定して参照できるようにした。
- 変更履歴には「現在適用中」「将来適用予定」「過去の変更」の状態を表示するようにした。
- 商品・得意先の変更後は一覧、選択中データ、変更履歴、指定日時点参照を再取得するようにした。
- 検索結果や選択対象が変わった場合の表示クリアと、遅延した古い API 応答を表示しない既存対策を維持した。

### 変更した TypeScript 型と API クライアント

- `ProductVersion`、`CustomerVersion` を通常画面用型から除去し、`ProductSummary`、`ProductChange`、`CustomerSummary`、`CustomerChange` へ置き換えた。
- 適用開始日を `validFrom` から `effectiveFrom`、指定日参照を `targetDate` から `asOf` へ統一した。
- 商品・得意先の履歴 API を `/versions` から `/changes` へ変更した。
- 商品・得意先の旧 `/preview` を廃止し、`GET /api/products/{productId}?asOf=` と `GET /api/customers/{customerId}?asOf=` を使用するようにした。
- Zod スキーマを通常情報と変更履歴で分離し、新 API の DTO を境界で検証するようにした。
- JST 業務日と変更状態の判定処理を共通化した。

### 内部履歴情報を表示しないための対応

- `productVersionId`、`customerVersionId` を画面用 TypeScript 型、Zod スキーマ、画面、E2E モックから除去した。
- 変更履歴テーブルの履歴 ID 列と、選択中詳細の商品 ID・得意先 ID 表示を削除した。
- 変更履歴行の React key は、適用開始日と業務属性から作る安定した複合キーを使用した。

### 確認結果

- `cd frontend && bun lint`: 成功
- `cd frontend && bunx tsc --noEmit`: 成功
- `cd frontend && bun run test`: 6 ファイル、16 件成功
- `cd frontend && bunx playwright test e2e/products.spec.ts`: 6 件成功
- `cd frontend && bunx playwright test e2e/customers.spec.ts`: 10 件成功
- `git diff --check`: 成功
- ブラウザで商品・得意先画面を確認し、業務用語、指定日時点参照、変更履歴、内部 ID 非表示を確認した。
- バックエンド停止時に通信エラーを表示し、画面がクラッシュしないことを確認した。

### 残した制約

- Playwright は API モックを使用した画面 E2E であり、実バックエンド API を使う結合 E2E は実施していない。
- `/ui-catalog` には今回変更対象となる商品・得意先履歴の専用サンプルがなかったため変更していない。
