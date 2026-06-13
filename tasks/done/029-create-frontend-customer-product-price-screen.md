# 029 フロントエンドの得意先別商品単価画面を作成する

## 目的

得意先別商品単価をブラウザから確認・登録できるようにし、得意先と商品ごとの例外単価を指定日から変更できるようにする。

売上入力時に採用される自動取得単価が、得意先別商品単価なのか商品標準単価へのフォールバックなのかを確認できる状態にする。

## 前提タスク

- `024-redesign-api-contracts-around-aggregates.md`
- `025-refactor-master-apis-around-aggregates.md`
- `026-refactor-sales-api-contracts.md`
- `027-update-existing-master-frontends-for-new-apis.md`
- `028-create-frontend-tax-rate-screen.md`

## 対象範囲

- Next.js フロントエンドに得意先別商品単価画面を追加する。
- 得意先別商品単価一覧を表示する。
- 得意先、商品、得意先コード、商品コードで絞り込みできるようにする。
- 得意先別商品単価の新規登録フォームを作成する。
- 既存の得意先・商品組み合わせに対する単価変更フォームを作成する。
- 得意先別商品単価の変更履歴を確認できるようにする。
- 指定日時点で適用される得意先別商品単価を確認できるようにする。
- 得意先別商品単価 API 呼び出し処理と TypeScript 型を整理する。
- ローディング、入力エラー、API エラーを画面上で確認できるようにする。

## 前提仕様

- 得意先別商品単価は、得意先と商品の組み合わせに対する例外単価として扱う。
- 得意先別商品単価は、得意先履歴や商品履歴ではなく別マスタとして管理する。
- 得意先別商品単価の変更は、画面上は指定日からの単価変更として扱い、バックエンド内部では履歴レコードの追加で表現する。
- 得意先別商品単価は `ValidFrom` のみを持ち、`ValidTo` は持たない。
- 指定日時点の得意先別商品単価は、対象日以前で一番新しい履歴を使う。
- 得意先別商品単価が存在しない場合は、対象日時点の商品標準単価へフォールバックする。
- 売上登録済みの単価は、得意先別商品単価や商品標準単価が後で変わっても変更しない。
- バックエンド API はダミー認証を使うため、フロントエンドから必要なヘッダーを付与する。

## 利用 API

- タスク 024、025 で確定・実装した得意先別商品単価 API を使用する。
- 一覧、初回登録、指定日からの単価変更、変更履歴、指定日時点の単価確認を扱う。
- `/versions` や履歴行 ID を前提にしない。

## 表示項目

一覧:

- 得意先コード
- 得意先名
- 商品コード
- 商品名
- 単価
- 適用開始日

変更履歴:

- 得意先コード
- 得意先名
- 商品コード
- 商品名
- 単価
- 適用開始日
- 登録日時

指定日時点の確認:

- 対象日
- 得意先コード
- 得意先名
- 商品コード
- 商品名
- 単位
- 自動取得単価
- 単価根拠
- 得意先別商品単価の適用開始日
- 商品標準単価
- 商品情報の適用開始日

## 実装方針

- 商品マスタ画面、得意先マスタ画面、税率マスタ画面で作成した API クライアントや UI パターンがあれば、それに合わせる。
- 一覧、絞り込み、登録、単価変更、変更履歴、指定日確認を同じ画面内で扱える構成にする。
- 得意先と商品は ID 入力だけに依存せず、既存の得意先一覧・商品一覧 API を使った選択補助を検討する。
- 単価根拠は `CustomerProductPrice` と `ProductStandard` を画面上で区別して表示する。
- 商品標準単価へフォールバックした場合は、単価根拠の表示で確認できるようにする。
- API のレスポンス型は TypeScript で定義し、画面側に ad hoc な `any` を広げない。

## 確認項目

- `bun lint` またはプロジェクトで定義されているフロントエンド検証コマンドが成功すること。
- 得意先別商品単価を新規登録できること。
- 既存の得意先・商品組み合わせの単価を指定日から変更できること。
- 同じ得意先、商品、適用開始日の重複登録エラーを画面で確認できること。
- 得意先、商品、得意先コード、商品コードで一覧を絞り込めること。
- 変更履歴が適用開始日の新しい順で確認できること。
- 指定日時点の確認で、得意先別商品単価がある場合はその単価が表示されること。
- 指定日時点の確認で、得意先別商品単価がない場合は商品標準単価へのフォールバックが表示されること。
- API エラー時に画面がクラッシュせず、ユーザーに原因が分かる表示になること。

## 完了時に追記すること

- 実装した画面・コンポーネントの概要
- 追加・変更した API クライアント処理
- 単価根拠とフォールバック表示の実装方針
- 実行した確認コマンドと結果
- 残した制約や次タスク候補

---

## 実装概要

`frontend/src/app/customer-product-prices/` に得意先別商品単価画面を追加した。商品・得意先・税率マスタと同様に、一覧＋選択サマリー、初回登録、単価変更、変更履歴、指定日プレビューを 1 画面で扱う。

主なファイル:

- `page.tsx` — 画面本体。`customerId:productId` の複合キーで行選択、`useListSelectionState`、URL 検索パラメータからの初回絞り込み、非同期応答の世代管理
- `_api.ts` — 一覧・登録・変更・履歴・プレビュー合成 API クライアント
- `_types.ts` / `_schemas.ts` — DTO 型と Zod スキーマ
- `_selection.ts` — 複合選択キーと URL パラメータ解析
- `_field-errors.ts` — ValidationProblem キーの camelCase 変換
- `_change-status.ts` — 変更履歴の適用状態分類

Vitest: `_schemas.test.ts`, `_field-errors.test.ts`, `_selection.test.ts`, `_change-status.test.ts`, `_api.test.ts`

E2E: `frontend/e2e/customer-product-prices.spec.ts`（モック API）

## API クライアント

- `fetchCustomerProductPrices` — `GET /api/customer-product-prices`（`customerId`, `productId`, `customerCode`, `productCode`）
- `createCustomerProductPrice` — `POST /api/customer-product-prices`
- `changeCustomerProductPrice` — `POST /api/customer-product-prices/{customerId}/{productId}/changes`
- `fetchCustomerProductPriceChanges` — `GET .../changes`
- `fetchCustomerProductPriceAsOf` — `GET .../{customerId}/{productId}?asOf=`
- `fetchCustomerProductPricePreviewComposed` — `GET /preview` に加え、`fetchProductAsOf` と、根拠が `CUSTOMER_PRODUCT_PRICE` のときのみ `fetchCustomerProductPriceAsOf` を呼び、`CustomerProductPricePreviewComposed` を返す

初回登録フォームの得意先・商品選択肢は、既存の `fetchCustomers` / `fetchProducts` を利用。

## 単価根拠とフォールバック表示

- `unitPriceSourceLabels` で `CUSTOMER_PRODUCT_PRICE` → 「得意先別商品単価」、`PRODUCT_STANDARD` → 「商品標準単価（フォールバック）」
- プレビュー DTO に `effectiveFrom` が無いため、`_api.ts` で商品 asOf と（得意先別単価採用時のみ）得意先別単価 asOf を合成
- `PRODUCT_STANDARD` 時は得意先別商品単価の適用開始日を `—` 表示
- 変更履歴 DTO に identity が無いため、選択中サマリーの得意先・商品コード/名を各行に表示。行キーは `effectiveFrom|unitPrice|createdAt`

## 確認コマンドと結果

```bash
cd frontend && bun lint
# 成功

cd frontend && bun run test
# Test Files  14 passed (14)
# Tests       49 passed (49)

cd frontend && bunx playwright test e2e/customer-product-prices.spec.ts
# 7 passed

cd frontend && bunx tsc --noEmit
# 成功

cd frontend && bun run build
# 成功。/customer-product-prices を静的ページとして生成
```

補足: `package.json` の Vitest 実行は `bun run test`。`bun test` は Bun ネイティブランナーが e2e も拾うため、本タスクの単体テスト確認は `bun run test` を使用した。

## 残した制約・次タスク候補

- プレビューは選択中の組み合わせに紐づけて参照する（一覧未選択時は案内メッセージ）
- バックエンド preview DTO に `effectiveFrom` が追加された場合は合成 API 呼び出しを簡略化できる
- タスク 030（売上入力画面）で `line-preview` と同じ根拠表示を再利用する余地あり
- Playwright は API モックを使った画面 E2E であり、実バックエンドとの主要正常系結合確認は別途実施対象とする
