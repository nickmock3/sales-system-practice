# 025 マスタ系 API を集約境界に合わせて修正する

## 目的

タスク 024 で確定した API 契約に従い、商品、得意先、得意先別商品単価、税率の API と DTO を、内部履歴構造を通常利用者へ意識させない構成へ修正する。

## 前提タスク

- `024-redesign-api-contracts-around-aggregates.md`

## 対象範囲

- `Features/Products`
- `Features/Customers`
- `Features/CustomerProductPrices`
- `Features/Taxes`
- 各機能の API テスト
- `backend/requests` の HTTP リクエスト例

## 実装方針

- 商品と得意先の変更 API は、内部で新しい履歴レコードを追加しつつ、外部向けには集約に対する情報変更として扱う。
- 一覧と通常詳細から履歴行 ID を除外する。
- 変更履歴 API は履歴 ID がなくても画面表示できる DTO にする。
- 指定日時点の参照は、商品または得意先の指定日時点情報として返す。
- 得意先別商品単価は、得意先 ID と商品 ID の組み合わせを業務上の識別子として扱う。
- 得意先別商品単価の `/history` と `/versions` の重複ルートを、タスク 024 の決定に従って整理する。
- 税率は税区分ごとの適用情報として返し、通常用途で不要な税率履歴行 ID を公開しない。
- DB エンティティ、履歴追加ルール、一意制約、売上から参照する履歴 ID は維持する。
- エラー文言も外部向けの業務用語へ揃える。

## テスト方針

- 既存の API テストを新契約へ更新する。
- 各テストには確認内容を示す日本語の一行コメントを残す。
- 新規登録、指定日からの変更、変更履歴参照、指定日時点参照を確認する。
- 同じ適用開始日の重複登録が競合になることを確認する。
- 通常レスポンスに内部履歴 ID が含まれないことを確認する。
- 内部では履歴レコードが追加され、既存行が更新されないことを確認する。
- SQLite in-memory の成功だけで Oracle 互換を保証しないことを完了メモへ残す。

## 確認項目

- 商品、得意先、得意先別商品単価、税率の API テストが成功すること。
- 売上 API が参照する既存の履歴解決処理を壊していないこと。
- `dotnet test` が成功すること。
- HTTP リクエスト例が新 API 契約と一致すること。

## 完了時に追記すること

- 変更したエンドポイントと DTO
- 廃止または互換用に残したエンドポイント
- 内部履歴 ID の扱い
- 実行した確認コマンドと結果
- Oracle で追加確認が必要な項目

## 完了メモ

### 変更したエンドポイントと DTO

- 商品 API を `GET /api/products/{productId}?asOf=` と `GET/POST /api/products/{productId}/changes` に置き換えた。
- 得意先 API を `GET /api/customers/{customerId}?asOf=` と `GET/POST /api/customers/{customerId}/changes` に置き換えた。
- 得意先別商品単価 API は、得意先 ID と商品 ID の組み合わせを識別子として、指定日時点参照と changes API を追加した。
- 得意先別商品単価一覧は、`asOf` 時点で組み合わせごとに適用される 1 件を返すようにした。
- 得意先別商品単価の collection POST は初回登録専用とし、登録済み組み合わせは `409 Conflict`、未登録組み合わせへの changes POST は `404 Not Found` とした。
- 税率 API は税区分を識別子として、`GET /api/tax-rates?asOf=`、指定日時点参照、changes GET/POST に置き換えた。
- DTO の適用開始日は `effectiveFrom`、指定日時点は `asOf` に統一した。
- 商品、得意先、得意先別商品単価、税率の通常 DTO と変更履歴 DTO を、集約単位の名称と項目へ再構成した。
- 得意先別商品単価プレビューの `unitPriceSource` は `CUSTOMER_PRODUCT_PRICE` と `PRODUCT_STANDARD` に統一した。
- `backend/requests` の商品、得意先、税率の例を更新し、得意先別商品単価のリクエスト例を追加した。

### 廃止したエンドポイント

- 商品と得意先の `/versions` と `/preview`
- 得意先別商品単価の `/history` と `/versions`
- 税率の collection POST と `/preview`

旧 API は互換用に残していない。売上 API の外部契約変更はタスク 026 の対象として維持した。

### 内部履歴 ID の扱い

- `ProductVersionId`、`CustomerVersionId`、`CustomerProductPriceId`、`TaxRateId` をマスタ系の通常レスポンスと変更履歴レスポンスから除外した。
- DB エンティティ、外部キー、一意制約は変更していない。
- 商品、得意先、得意先別商品単価、税率の変更は、既存行を更新せず新しい履歴レコードを追加する実装を維持した。
- 売上登録時に採用した内部履歴 ID を保存する既存処理は維持した。

### 確認結果

- `dotnet test SalesSystem.slnx --no-restore --filter FullyQualifiedName~SalesSystem.Tests.Products`: 13 件成功
- `dotnet test SalesSystem.slnx --no-restore --no-build --filter FullyQualifiedName~SalesSystem.Tests.Customers`: 12 件成功
- `dotnet test SalesSystem.slnx --no-restore --filter FullyQualifiedName~SalesSystem.Tests.CustomerProductPrices`: 14 件成功
- `dotnet test SalesSystem.slnx --no-restore --no-build --filter FullyQualifiedName~SalesSystem.Tests.Taxes`: 22 件成功
- `dotnet test SalesSystem.slnx --no-restore`: 98 件成功
- `git diff --check`: 成功
- 旧 `/versions`、`/history`、旧 `targetDate`、マスタ系レスポンスの内部履歴 ID が対象実装と HTTP 例に残っていないことを確認した。

### Oracle で追加確認が必要な項目

- 税率一覧と得意先別商品単価一覧で使用する `GroupBy`、`Max`、複合キー JOIN の Oracle provider による SQL 変換
- 得意先別商品単価レスポンスで名称を解決する相関サブクエリの SQL 変換と実行計画
- `DateTime` による `ValidFrom <= asOf` 比較と日付境界
- 金額と税率の精度、および同一適用開始日の一意制約

SQLite in-memory のテスト成功だけでは Oracle 互換を保証しないため、Oracle 環境で上記を確認する。
