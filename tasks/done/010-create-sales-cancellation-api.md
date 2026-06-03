# 010 売上取消 API を作成する

## 目的

登録済み売上に入力間違いがあった場合に、元売上を直接更新せず、取消取引を追加して訂正履歴を残せるようにする。

売上は過去の取引証跡として扱い、訂正は取消と再登録で表現する。

## 背景

`009-create-sales-entry-api.md` で売上登録、一覧、詳細 API を作成した。

次の段階として、登録済み売上の入力間違いに対応するため、イミュータブルモデルに沿った取消 API と状態管理を追加する。

## 前提タスク

- `009-create-sales-entry-api.md`

## 対象仕様

- `specs/sales-correction.md`
- `specs/sales-entry.md`
- `specs/overview.md`

## 実装内容

- 売上状態履歴テーブルを追加する。
  - `SaleStatusHistories`
  - `SaleId`
  - `Status`
  - `Reason`
  - `ChangedAt`
  - `ChangedBy`
- 売上訂正関係テーブルを追加する。
  - `SaleCorrections`
  - `OriginalSaleId`
  - `CorrectionSaleId`
  - `CorrectionType`
  - `Reason`
  - `CreatedAt`
  - `CreatedBy`
- EF Core のエンティティ、マッピング、マイグレーションを追加する。
- 売上登録時は `SaleStatusHistories` に `Active` の状態履歴を追加する。
- 売上取消 API を作成する。
  - `POST /api/sales/{saleId}/cancel`
  - 取消理由を受け取ること。
  - 取消対象の元売上に `Canceled` の状態履歴を追加すること。
  - 元売上と逆符号の取消売上と取消明細を追加すること。
  - 取消売上には `Active` の状態履歴を追加すること。
  - 元売上と取消売上の関係を `SaleCorrections` に保存すること。
  - 取消処理はトランザクションで実行すること。
- 売上一覧 API を拡張する。
  - 最新状態を `SaleStatusHistories` から導出すること。
  - 初期表示では最新状態が有効な通常売上を返すこと。
  - クエリで取消済み売上や取消売上を含められること。
  - 売上状態、状態変更日時、訂正種別、元売上 ID を返すこと。
- 売上詳細 API を拡張する。
  - 最新状態、状態履歴、訂正種別、元売上 ID、訂正理由、実行者を返すこと。
- 入力 DTO とレスポンス DTO を追加・拡張する。
- 入力バリデーションを実装する。
  - 取消理由は必須。
  - 取消理由は前後空白を除いた後に空文字を許可しない。
- 認可要件を設定する。
  - 売上取消 API は `MasterMaintainer` を要求する。
  - 参照系 API は引き続き `AuthenticatedUser` を要求する。
- API の正常系、異常系テストを追加する。
- 認証ヘッダーなし、ロール不足、必要ロールありの認可テストを追加する。
- 必要に応じて `.http` ファイルに手動確認用リクエストを追加する。

## 想定エンドポイント

- `POST /api/sales/{saleId}/cancel`
  - 売上を取り消す。

リクエスト例:

```json
{
  "reason": "数量を誤って登録したため"
}
```

既存 API の拡張:

- `GET /api/sales`
  - 有効売上のみ、取消済み含む、取消売上含む、をクエリで切り替えられるようにする。
- `GET /api/sales/{saleId}`
  - 取消状態と訂正関連情報を返す。

## 注意点

- 元売上ヘッダーと明細金額や数量は直接更新しない。
- 元売上の現在状態は `Sales` のカラムではなく、`SaleStatusHistories` の最新行から導出する。
- 取消売上を追加する場合は、元売上の登録時点で保存済みの単価、税率、税額、金額を逆符号にする。
- 取消時にマスタ履歴や税率を再取得しない。
- 取消売上は新しい取引証跡であり、元売上との関係は `SaleCorrections` で表現する。
- 既に取消済みの売上は再度取り消せない。
- 取消売上自体は取り消せない。
- 取消理由、取消日時、取消実行者を残す。
- SQLite で動作確認できても Oracle 互換を保証した扱いにはしない。
- 状態履歴と訂正関係の enum 表現、文字列長、インデックス、外部キーは Oracle 上でも確認する。

## 確認内容

- `dotnet test backend/SalesSystem.slnx` が成功する。
- 売上登録時に `Active` の状態履歴が追加される。
- 登録済み売上を取り消せる。
- 取消後、元売上に `Canceled` の状態履歴が追加される。
- 取消理由、取消日時、取消実行者が状態履歴に保存される。
- 取消売上が追加され、元売上との関係が `SaleCorrections` に保存される。
- 取消売上の数量、明細金額、税額、合計金額が元売上と逆符号になる。
- 取消時にマスタ履歴や税率を再取得しない。
- 既に取消済みの売上は再度取り消せない。
- 取消売上自体は取り消せない。
- 取消理由が空の場合は登録エラーになる。
- 売上一覧で有効売上だけを取得できる。
- 売上一覧で取消済み売上と取消売上を含めて確認できる。
- 売上詳細で取消状態と訂正関連情報を確認できる。
- 認証なしでは売上取消 API にアクセスできない。
- `MasterMaintainer` ロールなしでは売上取消 API にアクセスできない。

## 完了時の記録

タスク完了時には、以下をこのファイルに追記してから `tasks/done/` に移動する。

- 追加・変更したエンドポイント
- 追加した DB テーブルとマイグレーション
- 設定した認可要件
- 主な DTO とバリデーション
- 取消ロジックの実装方針
- 一覧・詳細での最新状態導出と訂正関係表示方針
- 実行した確認コマンド
- Oracle 対応で後続確認が必要な点

## 完了記録

### 追加・変更したエンドポイント

- `POST /api/sales/{saleId}/cancel` を追加した。
- `GET /api/sales` に `includeCanceled` と `includeCorrections` クエリを追加した。
- `GET /api/sales` と `GET /api/sales/{saleId}` のレスポンスに最新状態、状態変更日時、訂正関係情報を追加した。
- 取消済み元売上側でも、訂正種別、取消売上 ID、訂正理由を返すようにした。

### 追加した DB テーブルとマイグレーション

- `SALE_STATUS_HISTORIES` を追加した。
  - `SALE_ID`, `STATUS`, `REASON`, `CHANGED_AT`, `CHANGED_BY`
- `SALE_CORRECTIONS` を追加した。
  - `ORIGINAL_SALE_ID`, `CORRECTION_SALE_ID`, `CORRECTION_TYPE`, `REASON`, `CREATED_AT`, `CREATED_BY`
- マイグレーション `20260603010000_AddSaleCancellation` を追加した。
- 既存 `SALES` にはマイグレーション時に `Active` の初期状態履歴を追加する。

### 設定した認可要件

- 売上取消 API は `MasterMaintainer` ポリシーを要求する。
- 売上一覧、売上詳細、プレビュー系 API は従来通り `AuthenticatedUser` ポリシーを要求する。

### 主な DTO とバリデーション

- `CancelSaleRequest` を追加し、取消理由を受け取るようにした。
- `SaleListItemResponse` に `Status`, `StatusChangedAt`, `CorrectionType`, `OriginalSaleId`, `CorrectionReason` を追加した。
- `SaleListItemResponse` に `CorrectionSaleId` を追加した。
- `SaleResponse` に最新状態、状態履歴、訂正種別、元売上 ID、取消売上 ID、訂正理由、実行者を追加した。
- 取消理由は必須とし、前後空白を除いた後に空文字の場合はバリデーションエラーにする。
- 取消理由は 300 文字以内に制限した。

### 取消ロジックの実装方針

- 取消処理はトランザクション内で実行する。
- 元売上ヘッダーと明細は更新せず、元売上には `Canceled` の状態履歴だけを追加する。
- 取消売上は元売上の保存済み `CustomerVersionId`, `ProductVersionId`, `UnitPrice`, `TaxRate` をそのまま使い、数量、明細金額、税額、合計金額だけを逆符号で保存する。
- 取消時に商品マスタ、得意先マスタ、税率は再取得しない。
- 取消売上には `Active` の状態履歴を追加する。
- 元売上と取消売上の関係は `SALE_CORRECTIONS` に `CorrectionType = Cancellation` で保存する。
- 既に取消済みの売上と取消売上自体は取り消せないようにした。
- `ORIGINAL_SALE_ID` と `CORRECTION_TYPE` の一意制約で、同じ元売上に同じ訂正種別を二重登録できないようにした。

### 一覧・詳細での最新状態導出と訂正関係表示方針

- 現在状態は `SALE_STATUS_HISTORIES` の `ChangedAt`, `Id` 降順の最新行から導出する。
- 一覧の初期表示は、最新状態が `Active` で、かつ `SALE_CORRECTIONS.CORRECTION_SALE_ID` に存在しない通常売上だけを返す。
- `includeCanceled=true` で取消済み元売上を含める。
- `includeCorrections=true` で取消売上を含める。
- 詳細は状態履歴を古い順に返し、取消売上の場合は元売上 ID と訂正情報を返す。
- 詳細は取消済み元売上の場合も取消売上 ID と訂正情報を返す。

### 実行した確認コマンド

- `dotnet build backend/SalesSystem.slnx`
- `dotnet test backend/SalesSystem.slnx`
  - 61 件成功。

### Oracle 対応で後続確認が必要な点

- `STATUS` と `CORRECTION_TYPE` は enum を文字列変換して保存しているため、Oracle provider で列型・長さが想定通りになるか確認する。
- `SALE_STATUS_HISTORIES` の最新状態取得で使う `ChangedAt`, `Id` 降順の並びと索引が Oracle 上でも実行計画上問題ないか確認する。
- `SALE_CORRECTIONS.CORRECTION_SALE_ID` の一意索引、2 本の自己参照外部キー、`DeleteBehavior.Restrict` が Oracle マイグレーションで意図通り生成されるか確認する。
- `SALE_CORRECTIONS.ORIGINAL_SALE_ID + CORRECTION_TYPE` の一意索引が Oracle マイグレーションで意図通り生成されるか確認する。
