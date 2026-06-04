# 014 売上入力補助 API を見直す

## 目的

売上入力画面で商品を選択したとき、売上日・得意先・商品をもとに、採用する商品履歴、単価、税区分、税率を一括で確認できるようにする。

## 背景

現在の `GET /api/sales/preview-product` は、商品 ID と売上日だけを受け取り、商品履歴、標準単価、税率を返す。

今後は得意先別単価を考慮するため、商品だけでは採用単価を決められない。また、税率値だけでなく税区分も画面と登録処理で扱う必要がある。

## 前提タスク

- `011-redesign-tax-rate-master.md`
- `012-store-tax-category-on-sale-details.md`
- `013-create-customer-specific-unit-price-design.md`

## 対象仕様

- `specs/sales-entry.md`
- `specs/tax-rates.md`
- `specs/unit-prices.md`

## 実装内容

- 売上入力補助 API の仕様を更新する。
- 商品プレビュー API の入力を見直す。
  - 売上日
  - 得意先 ID
  - 商品 ID
- 商品プレビュー API のレスポンスを見直す。
  - 商品 ID
  - 商品コード
  - 商品履歴 ID
  - 商品名
  - 単位
  - 自動取得単価
  - 得意先別商品単価 ID
  - 税区分コード
  - 税区分名
  - 税率
  - 税率履歴 ID
  - 販売停止フラグ
  - 商品履歴の適用開始日
- 売上登録 API と補助 API で、単価・税区分決定ロジックがずれないように共通化を検討する。
- 既存の `preview-product` を破壊的に変更するか、新しいエンドポイントを追加するかを決める。
- API テストを追加・更新する。

## 検討項目

- 既存フロントエンド実装への影響を抑えるため、新エンドポイントにするか。
- 得意先別商品単価の採用有無を画面に表示するか。
- 得意先履歴が対象日に存在しない場合、商品プレビューもエラーにするか。
- 商品が販売停止中の場合、プレビューは返して登録だけ禁止するか、プレビュー時点でエラーにするか。

## テスト観点

- 売上日、得意先、商品から自動取得単価を取得できる。
- 得意先別単価がある場合、その単価が返る。
- 得意先別単価がない場合、商品標準単価が返る。
- 税区分コード、税区分名、税率が返る。
- 対象日に得意先履歴、商品履歴、税率が存在しない場合はエラーになる。
- 売上登録 API と補助 API の自動取得単価・税区分が一致する。

## 完了時の記録

タスク完了時には、以下をこのファイルに追記してから `tasks/done/` に移動する。

- 更新した仕様
- 変更または追加したエンドポイント
- 自動取得単価・税区分決定ロジックの共通化方針
- 変更した DTO
- 実行した確認コマンド
- Oracle 対応で後続確認が必要な点

## 完了記録

### 更新した仕様

- `specs/sales-entry.md` に売上入力補助 API `GET /api/sales/preview-sales-line` の入力、レスポンス、エラー方針を追記した。
- `specs/unit-prices.md` に、売上入力補助 API と売上登録 API が同じ単価決定ロジックを使い、登録時に `AutoUnitPrice` と `IsManualUnitPrice` を保存する方針を追記した。

### 変更または追加したエンドポイント

- `GET /api/sales/preview-sales-line` を追加した。
  - 入力: `salesDate`, `customerId`, `productId`
  - 出力: 商品 ID、商品コード、商品履歴 ID、商品名、単位、自動取得単価、得意先別商品単価 ID、税区分コード、税区分名、税率、税率履歴 ID、販売停止フラグ、商品履歴適用開始日
- 既存の `GET /api/sales/preview-product` は破壊的変更を避けるため残した。

### 自動取得単価・税区分決定ロジックの共通化方針

- `SaleEndpoints` 内の `ResolveSalesLineAsync` に、商品履歴、税率、得意先別商品単価、商品標準単価フォールバックの解決処理を集約した。
- `GET /api/sales/preview-sales-line` と `POST /api/sales` の両方で `ResolveSalesLineAsync` を使うようにした。
- 売上登録時は画面送信単価と再計算した自動取得単価を比較し、差がある場合に `IsManualUnitPrice = true` として保存する。

### 変更した DTO

- `CreateSaleLineRequest`
  - `ManualUnitPriceReason` を追加した。
- `SaleDetailLineResponse`
  - `CustomerProductPriceId`
  - `IsManualUnitPrice`
  - `AutoUnitPrice`
  - `ManualUnitPriceReason`
- `SalesLinePreviewResponse` を追加した。

### 追加した DB 要素

- `CustomerProductPrice` エンティティと `CUSTOMER_PRODUCT_PRICES` テーブルを追加した。
- `SALE_DETAILS` に以下を追加した。
  - `CUSTOMER_PRODUCT_PRICE_ID`
  - `IS_MANUAL_UNIT_PRICE`
  - `AUTO_UNIT_PRICE`
  - `MANUAL_UNIT_PRICE_REASON`
- マイグレーション `20260604021447_AddCustomerProductPriceAndSaleDetailUnitPriceSource` を追加した。

### 実行した確認コマンド

```bash
dotnet ef migrations add AddCustomerProductPriceAndSaleDetailUnitPriceSource --project src/SalesSystem.Api/SalesSystem.Api.csproj --startup-project src/SalesSystem.Api/SalesSystem.Api.csproj --output-dir Persistence/Migrations
dotnet test SalesSystem.slnx
```

確認結果:

- `dotnet test SalesSystem.slnx`: 成功。77 件成功、失敗 0 件。

### Oracle 対応で後続確認が必要な点

- 生成済みマイグレーションは SQLite ローカル確認ベースの型になっているため、Oracle provider で `CUSTOMER_PRODUCT_PRICES`、nullable FK、decimal 精度、bool 変換、インデックス名が期待どおり生成されるか確認する。
- `AUTO_UNIT_PRICE` 追加時に既存行へ `UNIT_PRICE` をコピーする補正 SQL が Oracle provider のマイグレーション SQL として問題ないか確認する。
- `ResolveSalesLineAsync` は EF Core の `OrderByDescending(...).FirstOrDefaultAsync()` を使っており、Oracle で適切な `FETCH FIRST 1 ROWS ONLY` 相当に変換されることを確認する。
