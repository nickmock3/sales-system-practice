# 015 得意先別商品単価 API を作成する

## 目的

商品標準単価をデフォルトとし、得意先ごとに例外単価を設定できるようにする。

売上入力時には、得意先別商品単価があればそれを採用し、なければ商品標準単価を採用する。

## 背景

得意先単価は、すべての商品と得意先の組み合わせを事前登録するより、標準単価を基本にして例外だけを得意先別商品単価として登録する方が運用しやすい。

得意先ランク別単価は、ランクマスタ、得意先履歴、ランク別単価、得意先別単価との優先順位が増えるため、現段階では後続課題とする。

## 前提タスク

- `013-create-customer-specific-unit-price-design.md`

## 対象仕様

- `specs/unit-prices.md`
- `specs/sales-entry.md`
- `specs/product-master.md`
- `specs/customer-master.md`

## 実装内容

- `014-revise-sales-entry-preview-api.md` で追加済みの `CustomerProductPrice` エンティティ、EF Core テーブル定義、マイグレーション、売上明細の単価根拠列を確認し、不足があれば補う。
- 得意先別商品単価 API を追加する。
  - 一覧取得
  - 得意先別商品単価の新規登録
  - 得意先別商品単価の履歴追加
  - 指定日での得意先別商品単価プレビュー
- `014-revise-sales-entry-preview-api.md` で共通化済みの売上入力時の単価決定ロジックを確認し、得意先別単価 API 側でも同じルールを使う。
  - 得意先別商品単価がある場合はそれを採用する。
  - 得意先別商品単価がない場合は、売上日時点の商品標準単価を採用する。
- 売上登録 API と売上入力補助 API で共通化済みの単価決定ロジックを、必要に応じて独立サービス化するか検討する。
- `014-revise-sales-entry-preview-api.md` で保存済みになった売上明細の採用単価の根拠を、得意先別単価 API のテストでも確認する。
  - 採用単価
  - 得意先別商品単価 ID
  - 手入力変更有無
  - 自動取得単価
- 売上詳細 API で得意先別商品単価 ID、手入力変更有無、自動取得単価を確認できるようにする。
- API テストを追加する。

## データ案

```text
CustomerProductPrices
- Id
- CustomerId
- ProductId
- UnitPrice
- ValidFrom
- CreatedAt
```

制約:

- `CustomerId`, `ProductId`, `ValidFrom` の組み合わせは重複不可。
- `UnitPrice` は 0 以上、小数第2位まで。
- `ValidFrom` は必須。

## 単価採用ルール

```text
1. 売上日以前で一番新しい得意先別商品単価を探す。
2. 見つかれば、その単価を採用する。
3. 見つからなければ、売上日以前で一番新しい商品履歴の標準単価を採用する。
4. 売上登録後に単価マスタや商品標準単価が変わっても、登録済み売上明細の単価は変えない。
```

## 売上明細への単価根拠保存案

```text
SaleDetails
- CustomerProductPriceId nullable
- IsManualUnitPrice
- AutoUnitPrice
- ManualUnitPriceReason nullable
```

得意先別商品単価を採用した場合は `CustomerProductPriceId` に `CustomerProductPrices.Id` を保存する。

商品標準単価を採用した場合は `CustomerProductPriceId` を `null` にし、既存の `ProductVersionId` を標準単価の根拠として扱う。

売上入力画面で単価を手入力変更した場合は `IsManualUnitPrice` を `true` にし、`UnitPrice` には変更後単価、`AutoUnitPrice` には変更前に自動取得した単価を保存する。手入力変更理由を必須にするかは後続で検討する。

## テスト観点

- 得意先別商品単価を登録できる。
- 同じ得意先、商品、適用開始日の単価履歴を重複登録できない。
- 売上日以前で一番新しい得意先別商品単価を取得できる。
- 得意先別商品単価がある場合、売上登録でその単価が採用される。
- 得意先別商品単価がない場合、商品標準単価が採用される。
- 売上明細に得意先別商品単価 ID、手入力変更有無、自動取得単価が保存される。
- 単価マスタ変更後も、登録済み売上明細の単価は変わらない。
- 売上入力補助 API と売上登録 API の自動取得単価が一致する。

## 完了時の記録

タスク完了時には、以下をこのファイルに追記してから `tasks/done/` に移動する。

- 追加した仕様
- 追加したエンティティと DB カラム
- 追加したマイグレーション
- 追加した API
- 単価決定ロジックの実装方針
- 売上明細への採用単価根拠の保存方針
- 実行した確認コマンド
- Oracle 対応で後続確認が必要な点

## 完了記録

### 追加した仕様

- 得意先別商品単価 API のルートを `/api/customer-product-prices` とした。
- 得意先別商品単価の履歴取得・履歴追加は、既存の得意先・商品マスタ API に合わせて `/versions` を主ルートとした。
- 後方互換的に分かりやすい業務名として `/history` も同じ処理にマッピングした。
- 指定日プレビューでは、対象日に有効な得意先履歴・商品履歴を確認したうえで、得意先別商品単価があれば `CustomerProductPrice`、なければ `ProductStandard` を単価根拠として返す。

### 追加したエンティティと DB カラム

- 今回の新規追加はなし。
- `014-revise-sales-entry-preview-api.md` で追加済みの `CustomerProductPrice` エンティティ、`CUSTOMER_PRODUCT_PRICES` テーブル、`SALE_DETAILS` の単価根拠列を利用した。

### 追加したマイグレーション

- 今回の新規追加はなし。
- 既存の `20260604021447_AddCustomerProductPriceAndSaleDetailUnitPriceSource` で必要なテーブル・カラムが作成済みであることを確認した。

### 追加した API

- `GET /api/customer-product-prices`
  - 得意先別商品単価一覧を取得する。
  - `customerId`、`productId`、`customerCode`、`productCode` で絞り込みできる。
- `POST /api/customer-product-prices`
  - 得意先別商品単価履歴を新規登録する。
- `GET /api/customer-product-prices/{customerId}/{productId}/versions`
  - 指定した得意先・商品の単価履歴を取得する。
- `POST /api/customer-product-prices/{customerId}/{productId}/versions`
  - 指定した得意先・商品の単価履歴を追加する。
- `GET /api/customer-product-prices/{customerId}/{productId}/history`
  - `/versions` と同じ履歴取得 API。
- `POST /api/customer-product-prices/{customerId}/{productId}/history`
  - `/versions` と同じ履歴追加 API。
- `GET /api/customer-product-prices/preview`
  - `customerId`、`productId`、`targetDate` から指定日時点の自動取得単価を返す。

### 単価決定ロジックの実装方針

- 得意先別商品単価 API のプレビューでは、`ValidFrom <= targetDate` の得意先別商品単価を `ValidFrom desc, Id desc` で検索し、見つかった場合はその単価を採用する。
- 得意先別商品単価が見つからない場合は、同じ対象日の商品履歴 `ProductVersions.StandardUnitPrice` にフォールバックする。
- 売上登録 API と売上入力補助 API は既に同じ private 解決処理を使っているため、今回は独立サービス化せず、API 側に同一ルールのクエリを実装した。
- 今後、単価決定ルールが増える場合は、売上 API と得意先別単価 API の両方から呼べるサービスへ抽出する。

### 売上明細への採用単価根拠の保存方針

- 売上明細の保存方針は既存実装を利用する。
- 得意先別商品単価を採用した場合は `SaleDetails.CustomerProductPriceId` に採用元 ID を保存する。
- 商品標準単価にフォールバックした場合は `CustomerProductPriceId` を `null` とし、`ProductVersionId` を標準単価の根拠として扱う。
- `IsManualUnitPrice` と `AutoUnitPrice` は売上登録時に再計算した自動取得単価と入力単価を比較して保存する。
- 得意先別商品単価 API 経由で登録した単価を使って売上登録し、その後に単価履歴を追加しても登録済み売上明細の `UnitPrice`、`AutoUnitPrice`、`CustomerProductPriceId` が変わらないことをテストで確認した。

### 実行した確認コマンド

```bash
dotnet test backend/SalesSystem.slnx --filter CustomerProductPriceApiTests
dotnet test backend/SalesSystem.slnx
```

### Oracle 対応で後続確認が必要な点

- `CUSTOMER_PRODUCT_PRICES` の複合一意制約 `CustomerId, ProductId, ValidFrom` が Oracle provider でも期待どおり競合検出されること。
- `ValidFrom <= targetDate` と `OrderByDescending(...).ThenByDescending(...)` による履歴取得が Oracle SQL に意図どおり変換されること。
- `UnitPrice decimal(18, 2)` と `SaleDetails.AutoUnitPrice decimal(18, 2)` の精度・丸めが Oracle 上でも期待どおり扱われること。
- 一覧取得の相関サブクエリが Oracle 上で性能上問題ないか、件数が増えた段階で実行計画を確認すること。
