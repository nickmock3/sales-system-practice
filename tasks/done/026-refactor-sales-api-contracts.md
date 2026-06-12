# 026 売上 API と入力補助 API の契約を修正する

## 目的

タスク 024 で確定した契約に従い、売上 API からマスタ履歴行 ID への外部依存を除き、登録時点の取引スナップショットと業務上必要な単価根拠を返す構成へ修正する。

## 前提タスク

- `024-redesign-api-contracts-around-aggregates.md`
- `025-refactor-master-apis-around-aggregates.md`

## 対象範囲

- `Features/Sales`
- 売上登録 API
- 売上一覧・詳細 API
- 売上取消 API
- 売上入力補助 API
- 売上 API テスト
- 得意先別商品単価 API テスト内の売上連携確認
- `backend/requests/sales.http`

## 実装方針

- 売上登録リクエストは引き続き売上日、得意先 ID、商品 ID を受け取り、採用する履歴と税率はバックエンドで決定する。
- `CustomerVersionId`、`ProductVersionId`、`TaxRateId`、`CustomerProductPriceId` を通常の売上一覧・詳細・入力補助レスポンスから除外する。
- 売上詳細では、登録時点の得意先名、商品名、単位、単価、税率、税区分、会計分類、単価根拠を返す。
- 単価根拠は内部レコード ID ではなく、得意先別単価または商品標準単価を表すコードで返す。
- 売上状態履歴は業務上の監査情報として維持するが、通常画面で不要な状態履歴行 ID は公開しない。
- 売上機能から得意先機能の `CustomerVersionResponse` への依存を除き、売上用途の DTO を定義する。
- `preview-customer`、`preview-product`、`preview-sales-line` の責務重複を、タスク 024 の決定に従って整理する。
- DB に保存する履歴 ID と外部キー制約は変更しない。

## テスト方針

- 既存の売上 API テストを新契約へ更新する。
- 各テストには確認内容を示す日本語の一行コメントを残す。
- 登録日時点で適用される得意先、商品、税率、単価が保存されることを DB 側でも確認する。
- マスタ変更後も、売上詳細が登録時点の内容を返すことを確認する。
- 得意先別単価と商品標準単価の根拠を内部 ID なしで区別できることを確認する。
- 取消売上と元売上で保存済みスナップショットが維持されることを確認する。

## 確認項目

- 売上関連 API テストが成功すること。
- マスタ系 API テストを含む `dotnet test` が成功すること。
- 通常レスポンスへ内部履歴 ID が露出していないこと。
- 売上テーブルには採用履歴 ID が引き続き保存されていること。
- HTTP リクエスト例が新 API 契約と一致すること。

## 完了時に追記すること

- 変更した売上 DTO と入力補助 API
- 削除または統合したプレビュー API
- 外部レスポンスから除外した内部 ID
- 保存済みスナップショットの確認結果
- 実行した確認コマンドと結果

## 完了メモ

### 変更した売上 DTO と入力補助 API

- 売上一覧、売上詳細、売上明細、状態履歴の DTO を通常利用者向けの項目へ整理した。
- 売上明細へ `unitPriceSource` を追加し、`CUSTOMER_PRODUCT_PRICE` または `PRODUCT_STANDARD` を返すようにした。
- `GET /api/sales/line-preview?salesDate=&customerId=&productId=` を追加し、商品情報、自動取得単価、単価根拠、税区分、会計分類、税率、販売停止状態を返すようにした。
- 売上登録リクエストと、DB に採用履歴 ID を保存する処理は変更していない。

### 削除・統合したプレビュー API

- `GET /api/sales/preview-customer` を削除し、`GET /api/customers/{customerId}?asOf=` へ移管した。
- `GET /api/sales/preview-product` を削除した。
- `GET /api/sales/preview-sales-line` を削除し、`GET /api/sales/line-preview` へ統合した。
- `backend/requests/sales.http` を新しい URI と責務に合わせて更新した。

### 外部レスポンスから除外した内部 ID

- `CustomerVersionId`
- `ProductVersionId`
- `TaxRateId`
- `CustomerProductPriceId`
- `SaleStatusHistoryId`

これらは DB の外部キーと採用履歴追跡のため内部では引き続き保存する。

### 保存済みスナップショットの確認結果

- 売上登録後に得意先名、商品名、税率マスタを変更しても、売上詳細が登録時点の名称、税区分、会計分類、税率、金額を返すことを確認した。
- 得意先別商品単価と商品標準単価を、内部 ID を公開せず `unitPriceSource` で区別できることを確認した。
- 単価を手入力で変更しても、自動取得単価の採用元を `unitPriceSource` として維持することを確認した。
- 取消売上へ元売上の履歴 ID とスナップショットがコピーされ、元売上と取消売上の API レスポンスでも登録時点の内容が維持されることを確認した。
- 通常レスポンスに内部履歴 ID が含まれない一方、DB には採用した履歴 ID が保存されることを確認した。

### 確認結果

- `dotnet test SalesSystem.slnx --no-restore --filter FullyQualifiedName~SalesSystem.Tests.Sales`: 25 件成功
- `dotnet test SalesSystem.slnx --no-restore --filter FullyQualifiedName~SalesSystem.Tests.CustomerProductPrices`: 14 件成功
- `dotnet test SalesSystem.slnx --no-restore`: 100 件成功
- `git diff --check`: 成功
- 旧売上プレビュー URI と公開 DTO の内部履歴 ID が対象実装、テスト、HTTP 例に残っていないことを確認した。

### Oracle で追加確認が必要な項目

- 保存済み `CustomerVersionId`、`ProductVersionId` を使う複合条件 JOIN の SQL 変換
- `ValidFrom <= salesDate` の日付比較と履歴選択
- 金額、数量、税率の精度と丸め
- 売上登録・取消トランザクションと外部キー制約

SQLite in-memory のテスト成功だけでは Oracle 互換を保証しないため、Oracle 環境で上記を確認する。
