# API 契約仕様

## 目的

商品、得意先、得意先別商品単価、税率、売上の主要 API を、業務上の集約単位で定義する。

バックエンド内部では履歴レコードの追加と参照 ID の保存を維持するが、通常の API 利用者には「指定日から情報を変更する」「指定日時点の情報を取得する」「登録時点の取引内容を確認する」という業務意味だけを公開する。

本仕様はタスク 025、026、027 の実装判断の根拠とする。

## 二層モデル

| 層 | 扱い | 例 |
| --- | --- | --- |
| 外部 API 契約 | 集約に対する情報変更・指定日時点参照 | `POST /api/products/{productId}/changes` |
| 内部永続化 | 履歴レコードの追加、FK による参照 | `ProductVersions` への INSERT、`Sales.CustomerVersionId` |

外部向けには「履歴追加」ではなく「指定日からの情報変更」「変更履歴」として表現する。内部実装では既存の履歴追加ルール、一意制約、売上登録時の履歴 ID 保存を変更しない。

## 共通原則

### 集約識別子

| 集約 | 識別子 |
| --- | --- |
| 商品 | `productId` |
| 得意先 | `customerId` |
| 得意先別商品単価 | `customerId` + `productId` |
| 税率 | `taxCategory` |
| 売上 | `saleId` |

### 日付パラメータの名称

| 用途 | 名称 | 例 |
| --- | --- | --- |
| リクエスト body / 通常レスポンスの適用開始日 | `effectiveFrom` | `"2026-04-01"` |
| クエリの指定日時点参照 | `asOf` | `?asOf=2026-04-01` |
| 売上の取引日 | `salesDate` | `"2026-04-15"` |

DB カラム `ValidFrom` は API では `effectiveFrom` として公開する。旧 API の `targetDate` は `asOf` に統一する。

`asOf` を省略できる参照 API では、アプリケーションが解決した JST の業務日を使う。変更履歴 API は `asOf` で絞り込まず、将来適用予定を含む全件を `effectiveFrom` の降順で返す。

### 非公開の内部 ID

通常レスポンスに含めない項目:

- `ProductVersionId`
- `CustomerVersionId`
- `TaxRateId`
- `CustomerProductPriceId`
- `SaleStatusHistoryId`

これらは DB 保存、外部キー、将来の監査 API で維持する。売上登録リクエストでも受け取らない。

### 単価根拠

| フィールド | 値 |
| --- | --- |
| `unitPriceSource` | `CUSTOMER_PRODUCT_PRICE` |
| | `PRODUCT_STANDARD` |

リクエストでは受け取らず、バックエンドが採用ルールに従って決定する。売上詳細と `line-preview` レスポンスで返す。

手入力で単価を変更した場合も、`unitPriceSource` は変更前の自動取得単価の採用元を表す。

### HTTP ステータス

| 操作 | ステータス | 備考 |
| --- | --- | --- |
| 集約の新規作成（collection POST） | `201 Created` | `Location` ヘッダーに作成した集約 URI |
| 集約への情報変更（changes POST） | `200 OK` | 変更後の集約情報を返す |
| 参照系 GET | `200 OK` | |
| 集約未存在 | `404 Not Found` | |
| 指定日時点で利用可能な情報なし | `404 Not Found` | 業務向けメッセージを返す |
| 同じ `effectiveFrom` の重複 | `409 Conflict` | |
| 入力バリデーション違反 | `400 Bad Request` | ASP.NET Core の `ValidationProblem` 形式 |
| 認証なし | `401 Unauthorized` | |
| 権限不足 | `403 Forbidden` | |
| 業務ルール違反（販売停止商品の売上登録など） | `409 Conflict` | |

### 変更 POST のレスポンス

- 新規集約作成（collection POST）は `201` と、作成した集約の情報を返す。
- 情報変更（changes POST）は `200` と、リクエストで指定した `effectiveFrom` 時点の集約情報を返す。

### エラー文言方針

「履歴がない」ではなく、指定日時点で利用できる業務情報がないことを示す。

| 状況 | メッセージ例 |
| --- | --- |
| 商品の指定日時点参照 | 指定日時点で利用できる商品情報がありません。 |
| 得意先の指定日時点参照 | 指定日時点で利用できる得意先情報がありません。 |
| 税率の指定日時点参照 | 指定日時点で利用できる税率情報がありません。 |
| 得意先別単価の指定日時点参照 | 指定日時点で利用できる単価情報がありません。 |
| 売上入力補助 | 指定日時点で利用できる商品情報がありません。 / 指定日時点で利用できる得意先情報がありません。 / 指定日時点で利用できる税率情報がありません。 |
| 重複登録 | 同じ適用開始日の商品情報は既に登録されています。 / 同じ適用開始日の得意先情報は既に登録されています。 / 同じ適用開始日の単価情報は既に登録されています。 / 同じ適用開始日の税率情報は既に登録されています。 |

### 通常 API と監査 API の境界

| 区分 | 内容 | 実装 |
| --- | --- | --- |
| 通常 API | 集約操作、指定日時点参照、変更履歴、売上操作 | タスク 025、026 で実装 |
| 監査 API | 内部履歴 ID、変更実行者、変更日時などの保守・監査専用参照 | 将来課題。本仕様で URI と DTO の方向性のみ定義し、今回は実装しない |

監査 API の想定例（実装対象外）:

```text
GET /api/audit/products/{productId}/history-records
GET /api/audit/sales/{saleId}/adopted-master-ids
```

### 互換方針

本学習リポジトリでは旧 API を併存させない。タスク 025、026 で即時置換する。外部利用者や本番運用がないため、移行期間は設けない。

---

## 商品 API

ベースパス: `/api/products`

### エンドポイント一覧

| メソッド | URI | 責務 |
| --- | --- | --- |
| GET | `/` | 業務日時点の商品一覧 |
| POST | `/` | 商品新規登録（初回情報を同時に登録） |
| GET | `/{productId}?asOf=` | 指定日時点の商品情報 |
| GET | `/{productId}/changes` | 変更履歴一覧 |
| POST | `/{productId}/changes` | 指定日からの商品情報変更 |

一覧 GET のクエリ: `productCode`, `name`, `isDiscontinued`。`asOf` 未指定時は JST 業務日を使う。

変更履歴は将来適用予定を含む全件を `effectiveFrom` の降順で返す。

### DTO 例

一覧・詳細（`ProductSummary`）:

```json
{
  "productId": 1,
  "productCode": "P001",
  "name": "コピー用紙 A4",
  "unit": "箱",
  "standardUnitPrice": 1200.00,
  "taxCategory": "STANDARD",
  "isDiscontinued": false,
  "effectiveFrom": "2026-01-01"
}
```

新規登録リクエスト:

```json
{
  "productCode": "P001",
  "name": "コピー用紙 A4",
  "unit": "箱",
  "standardUnitPrice": 1200.00,
  "taxCategory": "STANDARD",
  "isDiscontinued": false,
  "effectiveFrom": "2026-01-01"
}
```

情報変更リクエスト:

```json
{
  "name": "コピー用紙 A4 改良版",
  "unit": "箱",
  "standardUnitPrice": 1250.00,
  "taxCategory": "STANDARD",
  "isDiscontinued": false,
  "effectiveFrom": "2026-04-01"
}
```

変更履歴 1 件（行 ID なし、`changedAt` なし）:

```json
{
  "effectiveFrom": "2026-04-01",
  "name": "コピー用紙 A4 改良版",
  "unit": "箱",
  "standardUnitPrice": 1250.00,
  "taxCategory": "STANDARD",
  "isDiscontinued": false
}
```

---

## 得意先 API

ベースパス: `/api/customers`

### エンドポイント一覧

| メソッド | URI | 責務 |
| --- | --- | --- |
| GET | `/` | 業務日時点の得意先一覧 |
| POST | `/` | 得意先新規登録 |
| GET | `/{customerId}?asOf=` | 指定日時点の得意先情報 |
| GET | `/{customerId}/changes` | 変更履歴一覧 |
| POST | `/{customerId}/changes` | 指定日からの得意先情報変更 |

一覧 GET のクエリ: `customerCode`, `name`。

一覧と詳細の `asOf` 未指定時は JST 業務日を使う。変更履歴は将来適用予定を含む全件を `effectiveFrom` の降順で返す。

### DTO 例

一覧・詳細（`CustomerSummary`）:

```json
{
  "customerId": 1,
  "customerCode": "C001",
  "name": "青山商事",
  "address": "東京都港区1-1-1",
  "phoneNumber": "03-1111-2222",
  "effectiveFrom": "2026-01-01"
}
```

新規登録リクエスト:

```json
{
  "customerCode": "C001",
  "name": "青山商事",
  "address": "東京都港区1-1-1",
  "phoneNumber": "03-1111-2222",
  "effectiveFrom": "2026-01-01"
}
```

情報変更リクエスト:

```json
{
  "name": "青山商事 本社",
  "address": "東京都港区2-2-2",
  "phoneNumber": "03-1111-3333",
  "effectiveFrom": "2026-05-01"
}
```

変更履歴 1 件:

```json
{
  "effectiveFrom": "2026-05-01",
  "name": "青山商事 本社",
  "address": "東京都港区2-2-2",
  "phoneNumber": "03-1111-3333"
}
```

---

## 得意先別商品単価 API

ベースパス: `/api/customer-product-prices`

集約の識別は `customerId` と `productId` の組み合わせとする。

### エンドポイント一覧

| メソッド | URI | 責務 |
| --- | --- | --- |
| GET | `/` | 組み合わせごとに `asOf` 時点 1 件の一覧 |
| POST | `/` | 新しい得意先・商品の組み合わせに初回単価を登録 |
| GET | `/{customerId}/{productId}?asOf=` | 指定日時点の単価情報 |
| GET | `/{customerId}/{productId}/changes` | 変更履歴一覧 |
| POST | `/{customerId}/{productId}/changes` | 指定日からの単価変更 |
| GET | `/preview?customerId=&productId=&asOf=` | 指定日時点の自動取得単価確認 |

一覧 GET のクエリ: `customerId`, `productId`, `customerCode`, `productCode`。`asOf` 未指定時は JST 業務日を使う。各組み合わせについて `asOf` 以前で一番新しい単価を 1 件返す。

`/history` と `/versions` は廃止する。

collection POST は新しい得意先・商品の組み合わせを作成する操作とする。すでにその組み合わせの単価が1件以上存在する場合は `409 Conflict` とし、既存組み合わせの変更には changes POST を使う。変更履歴は将来適用予定を含む全件を `effectiveFrom` の降順で返す。

### DTO 例

一覧・詳細:

```json
{
  "customerId": 1,
  "customerCode": "C001",
  "customerName": "青山商事",
  "productId": 2,
  "productCode": "P002",
  "productName": "ボールペン",
  "unitPrice": 95.00,
  "effectiveFrom": "2026-03-01",
  "createdAt": "2026-03-01T00:00:00Z"
}
```

初回登録リクエスト:

```json
{
  "customerId": 1,
  "productId": 2,
  "unitPrice": 95.00,
  "effectiveFrom": "2026-03-01"
}
```

単価変更リクエスト:

```json
{
  "unitPrice": 90.00,
  "effectiveFrom": "2026-06-01"
}
```

変更履歴 1 件（行 ID なし）:

```json
{
  "unitPrice": 90.00,
  "effectiveFrom": "2026-06-01",
  "createdAt": "2026-06-01T00:00:00Z"
}
```

プレビュー:

```json
{
  "customerId": 1,
  "customerCode": "C001",
  "customerName": "青山商事",
  "productId": 2,
  "productCode": "P002",
  "productName": "ボールペン",
  "unit": "本",
  "autoUnitPrice": 95.00,
  "unitPriceSource": "CUSTOMER_PRODUCT_PRICE",
  "standardUnitPrice": 100.00,
  "asOf": "2026-04-15"
}
```

---

## 税率 API

ベースパス: `/api/tax-rates`

集約の識別は `taxCategory` とする。

### エンドポイント一覧

| メソッド | URI | 責務 |
| --- | --- | --- |
| GET | `/?asOf=` | 税区分ごとに `asOf` 時点 1 件の一覧 |
| GET | `/{taxCategory}?asOf=` | 指定日時点の税率情報 |
| GET | `/{taxCategory}/changes` | 変更履歴一覧 |
| POST | `/{taxCategory}/changes` | 指定日からの税率変更（初回登録もここ） |

`POST /api/tax-rates` と `GET /api/tax-rates/preview` は廃止する。

`asOf` 未指定時は JST 業務日を使う。税区分は定義済みコードだけを受け付ける。changes POST は初回登録と既存税区分の税率変更に共通で使い、変更履歴は将来適用予定を含む全件を `effectiveFrom` の降順で返す。

### DTO 例

一覧・詳細:

```json
{
  "taxCategory": "STANDARD",
  "taxCategoryName": "標準税率",
  "accountingCategory": "TAXABLE_STANDARD",
  "rate": 0.1000,
  "effectiveFrom": "2019-10-01"
}
```

税率変更リクエスト（初回登録も同じ）:

```json
{
  "rate": 0.1000,
  "effectiveFrom": "2019-10-01"
}
```

変更履歴 1 件:

```json
{
  "taxCategory": "STANDARD",
  "taxCategoryName": "標準税率",
  "accountingCategory": "TAXABLE_STANDARD",
  "rate": 0.1000,
  "effectiveFrom": "2019-10-01"
}
```

---

## 売上 API

ベースパス: `/api/sales`

### エンドポイント一覧

| メソッド | URI | 責務 |
| --- | --- | --- |
| POST | `/` | 売上登録 |
| GET | `/` | 売上一覧 |
| GET | `/{saleId}` | 売上詳細 |
| POST | `/{saleId}/cancel` | 売上取消 |
| GET | `/line-preview?salesDate=&customerId=&productId=` | 明細入力補助 |

一覧 GET のクエリ: `salesDateFrom`, `salesDateTo`, `customerId`, `customerCode`, `includeCanceled`, `includeCorrections`。

`GET /api/sales/preview-customer`、`GET /api/sales/preview-product`、`GET /api/sales/preview-sales-line` は廃止する。

- 得意先の売上日時点確認は `GET /api/customers/{customerId}?asOf={salesDate}` で代替する。
- 商品と税率、単価の確認は `GET /api/sales/line-preview` に統合する。

### 売上登録

リクエストは売上日、得意先 ID、明細の商品 ID・数量・単価を受け取る。採用するマスタ情報と税率、単価根拠はバックエンドが決定する。

```json
{
  "salesDate": "2026-04-15",
  "customerId": 1,
  "lines": [
    {
      "productId": 2,
      "quantity": 3,
      "unitPrice": 95.00,
      "manualUnitPriceReason": null
    }
  ]
}
```

### 売上詳細

登録時点のスナップショットを返す。内部履歴 ID は含めない。

```json
{
  "saleId": 10,
  "salesDate": "2026-04-15",
  "customerId": 1,
  "customerCode": "C001",
  "customerName": "青山商事",
  "totalAmount": 313.50,
  "createdAt": "2026-04-15T02:30:00Z",
  "status": "Active",
  "statusChangedAt": "2026-04-15T02:30:00Z",
  "correctionType": null,
  "originalSaleId": null,
  "correctionSaleId": null,
  "correctionReason": null,
  "correctionCreatedBy": null,
  "statusHistories": [
    {
      "status": "Active",
      "reason": "売上登録",
      "changedAt": "2026-04-15T02:30:00Z",
      "changedBy": "admin1"
    }
  ],
  "details": [
    {
      "saleDetailId": 20,
      "productId": 2,
      "productCode": "P002",
      "productName": "ボールペン",
      "unit": "本",
      "taxCategory": "STANDARD",
      "taxCategoryName": "標準税率",
      "accountingCategory": "TAXABLE_STANDARD",
      "quantity": 3,
      "unitPrice": 95.00,
      "unitPriceSource": "CUSTOMER_PRODUCT_PRICE",
      "isManualUnitPrice": false,
      "autoUnitPrice": 95.00,
      "manualUnitPriceReason": null,
      "taxRate": 0.1000,
      "taxAmount": 28.50,
      "amount": 285.00
    }
  ]
}
```

`statusHistories` は業務上の状態確認のため返すが、`SaleStatusHistoryId` は含めない。

### 明細入力補助（line-preview）

```json
{
  "productId": 2,
  "productCode": "P002",
  "productName": "ボールペン",
  "unit": "本",
  "autoUnitPrice": 95.00,
  "unitPriceSource": "CUSTOMER_PRODUCT_PRICE",
  "taxCategory": "STANDARD",
  "taxCategoryName": "標準税率",
  "accountingCategory": "TAXABLE_STANDARD",
  "taxRate": 0.1000,
  "isDiscontinued": false
}
```

内部の `ProductVersionId`、`TaxRateId`、`CustomerProductPriceId` と、複数の採用元のどれを指すか曖昧になる単一の `effectiveFrom` は返さない。

---

## 変更前後対応表

### 商品

| 旧 | 新 | 備考 |
| --- | --- | --- |
| `GET /api/products` | `GET /api/products` | レスポンスから `productVersionId` を除外、`validFrom` → `effectiveFrom` |
| `POST /api/products` | `POST /api/products` | リクエストの `validFrom` → `effectiveFrom` |
| `GET /api/products/{id}/versions` | `GET /api/products/{id}/changes` | 履歴行 ID を除外 |
| `POST /api/products/{id}/versions` | `POST /api/products/{id}/changes` | `201` → `200`、レスポンスは集約情報 |
| `GET /api/products/{id}/preview?targetDate=` | `GET /api/products/{id}?asOf=` | クエリ名を `asOf` に統一 |

### 得意先

| 旧 | 新 | 備考 |
| --- | --- | --- |
| `GET /api/customers` | `GET /api/customers` | レスポンスから `customerVersionId` を除外 |
| `POST /api/customers` | `POST /api/customers` | `validFrom` → `effectiveFrom` |
| `GET /api/customers/{id}/versions` | `GET /api/customers/{id}/changes` | 履歴行 ID を除外 |
| `POST /api/customers/{id}/versions` | `POST /api/customers/{id}/changes` | `201` → `200` |
| `GET /api/customers/{id}/preview?targetDate=` | `GET /api/customers/{id}?asOf=` | |

### 得意先別商品単価

| 旧 | 新 | 備考 |
| --- | --- | --- |
| `GET /api/customer-product-prices` | `GET /api/customer-product-prices` | 組み合わせごとに `asOf` 時点 1 件、`customerProductPriceId` を除外 |
| `POST /api/customer-product-prices` | `POST /api/customer-product-prices` | 初回組み合わせ登録は維持、`validFrom` → `effectiveFrom` |
| `GET /.../history` | `GET /.../changes` | `/history` 廃止 |
| `POST /.../history` | `POST /.../changes` | |
| `GET /.../versions` | `GET /.../changes` | `/versions` 廃止 |
| `POST /.../versions` | `POST /.../changes` | |
| `GET /preview?targetDate=` | `GET /preview?asOf=` | 内部 ID を除外 |
| （なし） | `GET /{customerId}/{productId}?asOf=` | 指定日時点参照を追加 |

### 税率

| 旧 | 新 | 備考 |
| --- | --- | --- |
| `GET /api/tax-rates` | `GET /api/tax-rates?asOf=` | 全履歴一覧から税区分ごと 1 件へ |
| `POST /api/tax-rates` | `POST /api/tax-rates/{taxCategory}/changes` | 初回登録も changes POST |
| `GET /api/tax-rates/preview` | `GET /api/tax-rates/{taxCategory}?asOf=` | |
| （なし） | `GET /api/tax-rates/{taxCategory}/changes` | 変更履歴参照を追加 |

### 売上

| 旧 | 新 | 備考 |
| --- | --- | --- |
| `POST /api/sales` | `POST /api/sales` | リクエスト変更なし |
| `GET /api/sales` | `GET /api/sales` | 一覧から `customerVersionId` を除外 |
| `GET /api/sales/{saleId}` | `GET /api/sales/{saleId}` | 詳細から内部履歴 ID を除外、`unitPriceSource` を追加 |
| `POST /api/sales/{saleId}/cancel` | `POST /api/sales/{saleId}/cancel` | 変更なし |
| `GET /api/sales/preview-customer` | `GET /api/customers/{customerId}?asOf={salesDate}` | 得意先 API へ移管 |
| `GET /api/sales/preview-product` | 廃止 | `line-preview` で代替 |
| `GET /api/sales/preview-sales-line` | `GET /api/sales/line-preview` | 内部 ID を除外、`unitPriceSource` を追加 |

---

## 認可

既存方針を維持する。

| 操作種別 | 必要ロール |
| --- | --- |
| 参照系 GET | `AuthenticatedUser` |
| 登録・変更 POST | `MasterMaintainer` |
| 売上取消 POST | `MasterMaintainer` |

## 関連仕様

- 業務ルールと DB 構造: `specs/product-master.md`、`specs/customer-master.md`、`specs/unit-prices.md`、`specs/tax-rates.md`、`specs/sales-entry.md`、`specs/sales-correction.md`
- フロントエンド方針: `specs/frontend-architecture.md`
