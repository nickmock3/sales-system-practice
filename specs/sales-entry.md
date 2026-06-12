# 売上入力仕様

## 目的

売上日、得意先、商品明細を入力し、売上を登録する。

売上は過去の取引記録として扱うため、登録時点で採用したマスタ履歴、税率、金額情報を保存する。

登録済み売上に入力間違いがあった場合も、売上ヘッダーや明細を直接更新しない。訂正は取消と再登録で表現する。詳細は `specs/sales-correction.md` に定義する。

## 画面機能

- 売上日入力
- 得意先選択
- 商品明細追加
- 商品選択
- 数量入力
- 売上日時点の商品情報取得
- 売上日時点の得意先情報取得
- 売上日時点の税率取得
- 得意先別単価または商品標準単価の自動反映
- 単価の手入力変更
- 明細金額の自動計算
- 税額の自動計算
- 合計金額表示
- 明細行の追加、削除
- 売上登録
- 登録済み売上一覧
- 売上詳細表示

## 入力画面の表示項目

- 売上日
- 得意先
- 得意先名
- 商品
- 商品名
- 単位
- 数量
- 単価
- 税率
- 税額
- 明細金額
- 合計金額

## 売上一覧・詳細

売上一覧・詳細は売上入力画面の一部として扱う。

必要な機能:

- 売上一覧表示
- 売上日範囲検索
- 得意先検索
- 売上詳細表示
- 明細表示
- 登録時点の商品名、単価、税率表示
- 合計金額表示

一覧表示項目:

- 売上番号
- 売上日
- 得意先コード
- 得意先名
- 合計金額
- 登録日時

## データ

```text
Sales
- Id
- SalesDate
- CustomerId
- CustomerVersionId
- TotalAmount
- CreatedAt

SaleDetails
- Id
- SaleId
- ProductId
- ProductVersionId
- TaxRateId
- TaxCategory
- TaxCategoryName
- AccountingCategory
- Quantity
- UnitPrice
- CustomerProductPriceId nullable
- IsManualUnitPrice
- AutoUnitPrice
- ManualUnitPriceReason
- TaxRate
- TaxAmount
- Amount
```

## 売上登録時の流れ

1. 売上日を入力する。
2. 得意先を選択する。
3. 売上日以前で一番新しい `CustomerVersions` を取得する。
4. 商品を選択する。
5. 売上日以前で一番新しい `ProductVersions` を取得する。
6. 商品履歴の税区分から、売上日以前で一番新しい `TaxRates` を取得する。
7. `specs/unit-prices.md` の単価採用ルールに従い、得意先別商品単価または商品標準単価を初期単価にする。
8. 数量、単価、税率から金額と税額を計算する。
9. 売上に `CustomerVersionId` を保存する。
10. 売上明細に `ProductVersionId`、登録時点の `TaxRateId`、税区分コード、税区分名、会計分類、単価、得意先別商品単価 ID、手入力変更有無、自動取得単価、手入力変更理由、税率、税額、金額を保存する。

売上明細の採用税区分は、税率マスタ履歴を追跡する `TaxRateId` に加えて、登録時点の `TaxCategory`、`TaxCategoryName`、`AccountingCategory` をスナップショットとして保存する。税率マスタの名称や会計分類の扱いが後で変わっても、登録済み売上の表示・会計集計はこのスナップショットを使い、後から変えない。

売上明細の採用単価は、登録時点の `UnitPrice` に加えて、`CustomerProductPriceId`、`IsManualUnitPrice`、`AutoUnitPrice`、`ManualUnitPriceReason` を保存する。得意先別商品単価を採用した場合は `CustomerProductPriceId` で根拠を追跡し、商品標準単価を採用した場合は既存の `ProductVersionId` を根拠として扱う。得意先別単価や商品標準単価が後で変わっても、登録済み売上の単価と採用単価根拠は後から変えない。単価採用ルールの詳細は `specs/unit-prices.md` に定義する。

## 売上日変更時のルール

売上日を変更すると、選択済みの得意先、商品、税率に適用される履歴が変わる可能性がある。

そのため、売上日変更時には選択済み明細の単価や税率を再取得するか、再取得するかどうかを確認する。

## API

`specs/api-contracts.md` の売上 API に従う。

- `POST /api/sales` — 売上登録
- `GET /api/sales` — 売上一覧
- `GET /api/sales/{saleId}` — 売上詳細
- `POST /api/sales/{saleId}/cancel` — 売上取消
- `GET /api/sales/line-preview?salesDate=&customerId=&productId=` — 明細入力補助

売上登録リクエストは売上日、得意先 ID、商品 ID、数量、単価を受け取る。採用するマスタ情報と税率、単価根拠はバックエンドが決定する。`ProductVersionId`、`CustomerVersionId`、`TaxRateId`、`CustomerProductPriceId` はリクエストでもレスポンスでも受け取らない。

## 売上入力補助 API

売上入力画面で明細商品を選択したときは、`GET /api/sales/line-preview` を使い、売上日・得意先・商品から登録時に採用される商品情報、税区分、税率、自動取得単価、単価根拠を確認する。

入力:

```text
salesDate
customerId
productId
```

レスポンス:

```text
productId
productCode
productName
unit
autoUnitPrice
unitPriceSource
taxCategory
taxCategoryName
accountingCategory
taxRate
isDiscontinued
```

自動取得単価は `specs/unit-prices.md` の単価採用ルールで決定する。単価根拠は `unitPriceSource`（`CUSTOMER_PRODUCT_PRICE` または `PRODUCT_STANDARD`）で返す。

得意先の売上日時点確認は `GET /api/customers/{customerId}?asOf={salesDate}` で行う。`GET /api/sales/preview-customer`、`GET /api/sales/preview-product`、`GET /api/sales/preview-sales-line` は廃止する。

指定日時点で利用できる得意先情報、商品情報、税率情報が存在しない場合はエラーにする。販売停止中の商品は `line-preview` では `isDiscontinued = true` として返し、売上登録 API では登録不可にする。

## 売上詳細レスポンス

売上詳細は登録時点のスナップショットを返す。以下を含める。

- 得意先コード、得意先名
- 商品コード、商品名、単位
- 単価、税率、税区分、税区分名、会計分類
- `unitPriceSource`
- 手入力変更有無、自動取得単価、手入力変更理由

`CustomerVersionId`、`ProductVersionId`、`TaxRateId`、`CustomerProductPriceId` は通常レスポンスに含めない。DB 内部では引き続き保存する。

## 金額計算

- 明細金額は数量と単価から計算する。
- 税額は明細金額と税率から計算する。
- 合計金額は明細金額と税額をもとに計算する。
- 登録後にマスタ履歴や税率が変わっても、過去の売上金額は変えない。
- 登録後に入力間違いが見つかった場合も、保存済みの売上金額は直接更新せず、取消と再登録で訂正する。
- 軽減税率 8% と旧標準税率 8% のように税率値が同じ場合でも、売上登録時点の税区分を後続の会計集計で区別できるようにする。

### 保存精度

- 数量は小数第3位まで保持する。
- 単価は小数第2位まで保持する。
- 明細金額、税額、合計金額は小数第2位まで保持する。
- 税率は小数第4位まで保持し、10% は `0.1000` として扱う。

DB カラムの精度は以下を基本とする。

```text
Quantity    decimal(18, 3)
UnitPrice   decimal(18, 2)
Amount      decimal(18, 2)
TaxAmount   decimal(18, 2)
TotalAmount decimal(18, 2)
TaxRate     decimal(5, 4)
```

### 丸めルール

- 明細金額は `数量 × 単価` で計算し、小数第3位を四捨五入して小数第2位にする。
- 税額は `明細金額 × 税率` で計算し、1円未満を切り捨てる。
- 合計金額は `明細金額 + 税額` を明細ごとに計算し、その合計とする。
- 税額の丸めは明細ごとに行い、伝票合計に対してまとめて税額計算しない。

例:

```text
数量: 3
単価: 101.00
税率: 0.1000

明細金額: 3 × 101.00 = 303.00
税額: 303.00 × 0.1000 = 30.300000 → 30.00
明細税込金額: 303.00 + 30.00 = 333.00
```

## テスト観点

- 売上日以前で一番新しい商品履歴を取得できる。
- 売上日以前で一番新しい得意先履歴を取得できる。
- 売上日以前で一番新しい税率を取得できる。
- 数量、単価、税率から金額と税額を計算できる。
- 明細金額は小数第3位を四捨五入して小数第2位にできる。
- 税額は明細ごとに1円未満を切り捨てできる。
- 売上登録時に `CustomerVersionId` と `ProductVersionId` が保存される。
- 登録時点の単価、税率、税額、金額が売上明細に保存される。
- 登録時点の得意先別商品単価 ID、手入力変更有無、自動取得単価が売上明細に保存される。
- 登録時点の税区分と税率マスタ履歴を保存できる。
