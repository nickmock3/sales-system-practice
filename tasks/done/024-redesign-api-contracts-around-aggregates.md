# 024 集約境界に合わせて主要 API 契約を再設計する

## 目的

商品、得意先、得意先別商品単価、税率、売上の主要 API を、履歴テーブルや履歴行 ID を直接操作する構成から、業務上の集約と操作を表現する構成へ見直す。

バックエンド内部では履歴レコードと参照 ID を維持しつつ、通常の API 利用者には「指定日から情報を変更する」「指定日時点の情報を取得する」「登録時点の取引内容を確認する」という業務上の意味を公開する。

## 対象範囲

- `specs/product-master.md`
- `specs/customer-master.md`
- `specs/unit-prices.md`
- `specs/tax-rates.md`
- `specs/sales-entry.md`
- `specs/sales-correction.md`
- `specs/frontend-architecture.md`
- 商品 API
- 得意先 API
- 得意先別商品単価 API
- 税率 API
- 売上 API と売上入力補助 API

## 設計方針

- API の外部契約は DB テーブル単位ではなく、商品、得意先、得意先別商品単価設定、税区分ごとの税率設定、売上の集約単位で定義する。
- `ProductVersionId`、`CustomerVersionId`、`TaxRateId`、`CustomerProductPriceId` は、通常の API 利用者が判断や操作に使わない限りレスポンスへ公開しない。
- 履歴行 ID はバックエンド内部、外部キー、監査・保守用途では維持する。
- `ProductVersions`、`CustomerVersions` などの永続化モデルと、売上登録時に採用した履歴 ID を保存するルールは変更しない。
- 変更操作は「履歴追加」ではなく、「適用開始日を指定した情報変更」として表現する。
- 履歴参照が必要な管理機能では、履歴行を独立集約として扱わず、対象集約の変更履歴として返す。
- 指定日時点の参照は `asOf`、`effectiveDate` など、用途が分かる用語に統一する。
- 売上レスポンスは登録時点の名称、単価、税率、税区分などのスナップショットを返し、内部履歴 ID へ依存させない。
- 状態履歴や変更履歴は業務上確認する意味があるため、履歴そのものを削除せず、内部 ID の公開要否を分けて判断する。

## 決定する API 契約

- 各エンドポイントの URI、HTTP メソッド、クエリパラメータ
- 作成、変更、一覧、指定日時点参照、変更履歴参照の責務
- リクエスト DTO とレスポンス DTO の項目
- 一覧 DTO、詳細 DTO、変更履歴 DTO、入力補助 DTO の使い分け
- `ValidFrom` の外部向け名称
- 単価根拠の外部向け enum またはコード
- 通常レスポンスと監査・保守用途レスポンスの境界
- 旧 API を即時置換するか、移行期間だけ併存させるか
- エラー文言で「履歴がない」と表現するか、「対象日時点で利用できる情報がない」と表現するか

## 成果物

- 関連仕様に、画面と API から内部履歴構造を隠す方針と理由を追記する。
- 主要 API の変更前後対応表を仕様へ記載する。
- 各 API のリクエスト・レスポンス例を記載する。
- 後続タスク 025、026、027 が実装判断をせず進められる粒度まで契約を確定する。

## 確認項目

- 商品と得意先の変更が集約に対する操作として定義されていること。
- 得意先別商品単価の同一性が、履歴行 ID ではなく得意先と商品の組み合わせとして説明されていること。
- 税率が税区分ごとの適用情報として定義されていること。
- 売上登録リクエストが履歴 ID を要求しないこと。
- 売上レスポンスだけで登録時点の取引内容を表示できること。
- DB 内部で履歴 ID を保持する理由が仕様に残っていること。
- 未実装フロントタスク 028、029、030 が新 API 契約を前提としていること。

## 完了時に追記すること

- 確定した主要 API 一覧
- 外部公開しないことにした内部 ID
- 維持する既存 API と廃止する既存 API
- 後続実装で注意する互換性事項

## 完了メモ

### 確定した主要 API

- `specs/api-contracts.md` を新規作成し、商品、得意先、得意先別商品単価、税率、売上の外部 API 契約を集約単位で定義した。
- 商品と得意先は、collection の一覧・新規登録、`GET /{id}?asOf=`、`GET/POST /{id}/changes` に統一した。
- 得意先別商品単価は `customerId` と `productId` の組み合わせを集約識別子とし、指定日時点参照と changes API を定義した。
- 税率は `taxCategory` を集約識別子とし、指定日時点参照と changes API を定義した。
- 売上入力補助は `GET /api/sales/line-preview?salesDate=&customerId=&productId=` に統合した。
- 適用開始日は `effectiveFrom`、指定日時点参照は `asOf`、単価根拠は `unitPriceSource` に統一した。
- `unitPriceSource` の値は `CUSTOMER_PRODUCT_PRICE` と `PRODUCT_STANDARD` とした。
- 入力バリデーション違反は、既存の ASP.NET Core `ValidationProblem` とテストに合わせて `400 Bad Request` とした。

### 外部公開しない内部 ID

- `ProductVersionId`
- `CustomerVersionId`
- `TaxRateId`
- `CustomerProductPriceId`
- `SaleStatusHistoryId`

これらは通常のリクエスト・レスポンスには含めない。DB 内部の履歴追跡、外部キー、売上登録時の採用履歴保存には引き続き使用する。

### 維持する API

- 商品、得意先、得意先別商品単価、売上の collection API
- 売上一覧、売上詳細、売上取消 API

DTO 項目と一部の一覧取得ルールは新契約へ変更する。

### 廃止・置換する API

- 商品・得意先の `/versions` は `/changes` へ置換する。
- 商品・得意先の `/preview` は `GET /{id}?asOf=` へ置換する。
- 得意先別商品単価の `/history` と `/versions` は `/changes` へ統合する。
- 税率の collection POST と `/preview` は、税区分単位の changes API と `GET /{taxCategory}?asOf=` へ置換する。
- 売上の `preview-customer`、`preview-product`、`preview-sales-line` は廃止し、得意先の指定日時点参照と `line-preview` へ置換する。

外部利用者や本番運用がない学習リポジトリのため、旧 API は互換併存させず、タスク 025、026 で即時置換する。

### 関連仕様の更新

- `specs/product-master.md`
- `specs/customer-master.md`
- `specs/unit-prices.md`
- `specs/tax-rates.md`
- `specs/sales-entry.md`
- `specs/sales-correction.md`
- `specs/frontend-architecture.md`

画面と API では「履歴追加」ではなく「指定日からの情報変更」「変更履歴」と表現し、内部実装では履歴レコード追加を維持する二層構造を明記した。

### 調査とレビュー

- Cursor CLI の plan/ask モードで、現行 API、DTO、テスト、仕様の依存関係と推奨契約を調査した。
- Cursor CLI の implement モードで仕様文書の初稿を作成した。
- メインエージェントが差分をレビューし、永続化されていない `changedAt` を商品・得意先・税率の変更履歴 DTO に含めないことを確認した。
- 複合情報で意味が曖昧になるため、`line-preview` には単一の `effectiveFrom` を返さないこととした。
- `line-preview` の項目を `productName`、`taxRate`、`accountingCategory` に統一した。

### 確認結果

- `git diff --check`: 成功
- タスク番号と前提関係: 024 の後に 025、026、027、028、029、030 の順で実施できることを確認した。
- 旧 API 名は、廃止説明と変更前後対応表の旧契約欄にだけ残っていることを確認した。
- 内部履歴 ID は、DB 保存の説明または通常 API へ公開しない説明にだけ残っていることを確認した。
- 文書変更のみのため、`dotnet test` とフロントエンドテストは実行していない。
