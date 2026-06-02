# 009 売上登録 API を作成する

## 目的

売上日、得意先、商品明細、数量、単価を受け取り、売上と売上明細を登録する Web API を作成する。

売上は過去の取引記録として扱うため、登録時点で採用した得意先履歴、商品履歴、税率、金額情報を保存する。

## 背景

`004-create-backend-tables.md` で `Sales` と `SaleDetails` のテーブル定義、制約、マイグレーションは作成済みである。

売上登録では、商品マスタ、得意先マスタ、税率マスタの履歴取得ルールを組み合わせる必要がある。そのため、商品マスタ API、税率マスタ API、得意先マスタ API の後に実装する。

## 前提タスク

- `006-create-product-master-api.md`
- `007-create-tax-rate-api.md`
- `008-create-customer-master-api.md`

## 対象仕様

- `specs/sales-entry.md`
- `specs/product-master.md`
- `specs/customer-master.md`
- `specs/tax-rates.md`
- `specs/overview.md`

## 実装内容

- `Features/Sales` 配下に売上登録 API の実装を追加する。
- `Program.cs` から売上 API のエンドポイントを登録する。
- 売上登録 API を作成する。
  - 売上日、得意先 ID、明細行を受け取ること。
  - 売上日以前で一番新しい `CustomerVersions` を取得し、`CustomerVersionId` を保存すること。
  - 明細ごとに売上日以前で一番新しい `ProductVersions` を取得し、`ProductVersionId` を保存すること。
  - 商品履歴の `TaxCategory` から、売上日以前で一番新しい `TaxRates` を取得すること。
  - 明細金額、税額、合計金額を仕様どおりに計算して保存すること。
  - 登録処理はトランザクションで実行すること。
- 売上一覧 API を作成する。
  - 売上日範囲で絞り込めること。
  - 得意先 ID または得意先コードで絞り込めること。
  - 登録時点の得意先名と合計金額を表示できること。
- 売上詳細 API を作成する。
  - 売上ヘッダーと明細を取得できること。
  - 登録時点の商品名、単価、税率、税額、金額を表示できること。
- 売上入力補助 API を必要に応じて作成する。
  - 売上日、得意先 ID から適用得意先履歴を確認できること。
  - 売上日、商品 ID から適用商品履歴、標準単価、税率を確認できること。
- 入力 DTO とレスポンス DTO を定義する。
- 入力バリデーションを実装する。
  - 売上日は必須。
  - 得意先 ID は必須。
  - 明細は 1 行以上必須。
  - 商品 ID は必須。
  - 数量は 0 より大きく、小数 3 桁まで。
  - 単価は 0 以上、小数 2 桁まで。
- 認可要件を設定する。
  - 参照系 API は `AuthenticatedUser` を要求する。
  - 売上登録 API は業務更新のため `MasterMaintainer` を要求する。
- API の正常系、異常系テストを追加する。
- 認証ヘッダーなし、ロール不足、必要ロールありの認可テストを追加する。
- 必要に応じて `.http` ファイルに手動確認用リクエストを追加する。

## 想定エンドポイント

- `POST /api/sales`
  - 売上を登録する。
- `GET /api/sales`
  - 売上一覧を取得する。
  - クエリ例: `salesDateFrom`, `salesDateTo`, `customerId`, `customerCode`
- `GET /api/sales/{saleId}`
  - 売上詳細を取得する。
- `GET /api/sales/preview-customer?customerId=1&salesDate=yyyy-MM-dd`
  - 売上日時点で有効な得意先履歴を取得する。
- `GET /api/sales/preview-product?productId=1&salesDate=yyyy-MM-dd`
  - 売上日時点で有効な商品履歴、標準単価、税率を取得する。

## 注意点

- 売上は過去の取引記録として扱い、登録後にマスタ履歴や税率が変わっても売上明細の金額情報は変更しない。
- 売上登録時には、採用した `CustomerVersionId` と `ProductVersionId` を必ず保存する。
- 税率は `TaxRates` の ID ではなく、適用した税率値を売上明細に保存する。
- 商品履歴、得意先履歴、税率が売上日に対して存在しない場合は登録できない。
- 販売停止中の商品履歴が適用される場合の扱いを実装時に明確にする。
  - 初期方針としては、適用履歴の `IsDiscontinued` が `true` の商品は売上登録できない。
- 金額計算は `decimal` で行い、浮動小数点型は使わない。
- 明細金額は `数量 × 単価` で計算し、小数第3位を四捨五入して小数第2位にする。
- 税額は `明細金額 × 税率` で計算し、1円未満を切り捨てる。
- 合計金額は明細ごとの `明細金額 + 税額` の合計とする。
- 税額の丸めは明細ごとに行い、伝票合計に対してまとめて税額計算しない。
- SQLite で動作確認できても Oracle 互換を保証した扱いにはしない。
- 履歴取得、日付範囲検索、ページングを追加する場合は Oracle 上での実行計画確認を後続課題に残す。

## 確認内容

- `dotnet test backend/SalesSystem.slnx` が成功する。
- 売上を登録できる。
- 売上登録時に `CustomerVersionId` が保存される。
- 売上登録時に `ProductVersionId` が保存される。
- 登録時点の単価、税率、税額、金額が売上明細に保存される。
- 売上日以前で一番新しい商品履歴、得意先履歴、税率が採用される。
- 商品履歴、得意先履歴、税率が存在しない売上日は登録エラーになる。
- 販売停止中の商品は登録エラーになる。
- 明細金額は小数第3位を四捨五入して小数第2位になる。
- 税額は明細ごとに1円未満を切り捨てる。
- 合計金額は明細ごとの税込金額合計になる。
- 登録後にマスタ履歴や税率を追加しても、既存売上明細の保存値は変わらない。
- 売上一覧を売上日範囲と得意先で絞り込める。
- 売上詳細で登録時点の商品名、単価、税率、税額、金額を確認できる。
- 認証なしでは売上 API にアクセスできない。
- `MasterMaintainer` ロールなしでは売上登録 API にアクセスできない。

## 完了時の記録

タスク完了時には、以下をこのファイルに追記してから `tasks/done/` に移動する。

- 追加したエンドポイント
- 設定した認可要件
- 主な DTO とバリデーション
- 履歴取得ロジックの実装方針
- 金額計算と丸めの実装方針
- 実行した確認コマンド
- Oracle 対応で後続確認が必要な点

## 完了記録

- 追加したエンドポイント
  - `POST /api/sales`
  - `GET /api/sales`
  - `GET /api/sales/{saleId}`
  - `GET /api/sales/preview-customer`
  - `GET /api/sales/preview-product`
- 設定した認可要件
  - 参照系は `AuthenticatedUser`
  - 登録系は `MasterMaintainer`
- 主な DTO とバリデーション
  - `CreateSaleRequest`
  - `CreateSaleLineRequest`
  - `SaleListItemResponse`
  - `SaleResponse`
  - `SaleDetailLineResponse`
  - `SalesProductPreviewResponse`
  - 売上日必須、得意先 ID 必須、明細 1 行以上、商品 ID 必須、数量 > 0 かつ小数 3 桁まで、単価 >= 0 かつ小数 2 桁まで
- 履歴取得ロジックの実装方針
  - 売上日以前で最新の `CustomerVersions` / `ProductVersions` / `TaxRates` を `ValidFrom` 降順で取得し、売上登録時の `CustomerVersionId` / `ProductVersionId` を保存
  - 販売停止中の `ProductVersion` は登録不可
  - 一覧と詳細は売上保存時の `CustomerVersionId` / `ProductVersionId` を使って当時の名称を復元
- 金額計算と丸めの実装方針
  - 明細金額は `数量 × 単価` を `MidpointRounding.AwayFromZero` で小数 2 桁へ丸め
  - 税額は `明細金額 × 税率` を `decimal.Floor` で 1 円未満切り捨て
  - 合計金額は各明細の `明細金額 + 税額` の合計
- 実行した確認コマンド
  - `dotnet test backend/SalesSystem.slnx`
- Oracle 対応で後続確認が必要な点
  - 売上一覧の絞り込みと履歴取得は SQLite で確認済みだが、Oracle 上で実行計画とインデックス利用を確認する必要がある
  - `decimal` 精度と丸め結果が Oracle provider でも同等になることを後続で確認する必要がある
