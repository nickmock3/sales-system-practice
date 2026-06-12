# 018 フロントエンドの得意先マスタ画面を作成する

## 目的

得意先マスタをブラウザから確認・登録できるようにし、得意先履歴を追加する業務ルールを画面から学習できるようにする。

## 対象範囲

- Next.js フロントエンドに得意先マスタ画面を追加する。
- 得意先一覧を表示する。
- 得意先の詳細と履歴を確認できるようにする。
- 得意先の新規登録フォームを作成する。
- 既存得意先の履歴追加フォームを作成する。
- 得意先 API 呼び出し処理と TypeScript 型を整理する。
- ローディング、入力エラー、API エラーを画面上で確認できるようにする。

## 前提仕様

- 得意先マスタの変更は既存行の更新ではなく、履歴レコードの追加で表現する。
- 得意先の適用履歴は、対象日以前で一番新しい履歴を使う。
- 得意先ごとの商品単価は得意先履歴ではなく、`specs/unit-prices.md` で定義する得意先別商品単価として別管理する。
- 得意先別商品単価の管理画面は `029-create-frontend-customer-product-price-screen.md` で作成する。
- バックエンド API はダミー認証を使うため、フロントエンドから必要なヘッダーを付与する。

## 実装方針

- 商品マスタ画面で作成した API クライアントや UI パターンがあれば、それに合わせる。
- 一覧、詳細、登録、履歴追加を同じ画面内で扱える構成にする。
- 得意先詳細では、得意先別商品単価が得意先履歴とは独立した別マスタであることが分かる導線にする。
- 得意先詳細から、後続の得意先別商品単価画面で対象得意先に絞り込める導線を検討する。
- API のレスポンス型は TypeScript で定義し、画面側に ad hoc な `any` を広げない。

## 確認項目

- `bun lint` またはプロジェクトで定義されているフロントエンド検証コマンドが成功すること。
- 得意先を新規登録できること。
- 既存得意先に履歴を追加できること。
- 得意先一覧と履歴表示が更新後の内容を反映すること。
- 得意先履歴を追加しても、得意先別商品単価履歴とは独立して扱われることが画面構成から分かること。
- API エラー時に画面がクラッシュせず、ユーザーに原因が分かる表示になること。

## 完了時に追記すること

- 実装した画面・コンポーネントの概要
- 追加・変更した API クライアント処理
- 実行した確認コマンドと結果
- 残した制約や次タスク候補

## 完了記録

### 実装した画面・コンポーネントの概要

- `frontend/src/app/customers/page.tsx` に得意先マスタ画面を追加した。
- 得意先コード・得意先名での検索、得意先一覧、選択中得意先の詳細、得意先新規登録、得意先履歴追加、得意先履歴一覧、指定日プレビューを同一画面で扱う構成にした。
- 得意先詳細には、得意先別商品単価が別マスタであることが分かる導線として `/customer-product-prices?customerId=...` へのリンクを追加した。
- 入力エラー、API エラー、ローディング、登録・履歴追加の完了メッセージを画面上に表示するようにした。

### 追加・変更した API クライアント処理

- `frontend/src/app/customers/_types.ts` に得意先一覧、履歴、検索条件、フォーム値の TypeScript 型を追加した。
- `frontend/src/app/customers/_schemas.ts` に API レスポンスとフォーム入力の Zod スキーマを追加した。
- `frontend/src/app/customers/_api.ts` に以下の API 呼び出しを追加した。
  - `GET /api/customers`
  - `POST /api/customers`
  - `GET /api/customers/{customerId}/versions`
  - `POST /api/customers/{customerId}/versions`
  - `GET /api/customers/{customerId}/preview?targetDate=...`
- `frontend/eslint.config.mjs` で Playwright 生成物の `test-results/` と `playwright-report/` を lint 対象外にした。

### 実行した確認コマンドと結果

- `cd frontend && bun lint`: 成功。
- `cd frontend && bun run test`: 成功。3 test files / 3 tests passed。
- `cd frontend && bun run test:e2e -- customers.spec.ts`: 成功。10 tests passed。

### 残した制約や次タスク候補

- 得意先別商品単価画面は task029 の範囲のため、今回はリンク導線のみ追加した。
- `bun test` を直接実行すると Bun のテストランナーが Playwright E2E まで読み込み、既存構成上失敗する。通常の確認は `bun run test` と `bun run test:e2e` を使う。
