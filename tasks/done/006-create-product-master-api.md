# 006 商品マスタ API を作成する

## 目的

商品マスタの一覧取得、新規登録、履歴追加、履歴参照、指定日プレビューを行う Web API を作成する。

商品マスタは売上登録時に採用する商品履歴と標準単価の元になるため、履歴管理ルールを API で明確に扱えるようにする。

## 背景

`004-create-backend-tables.md` で `Products` と `ProductVersions` のテーブル定義、制約、マイグレーションは作成済みである。

`005-create-dummy-auth-layer.md` でダミー認証認可層を追加したうえで、`specs/product-master.md` に基づき、画面や売上入力から利用できる商品マスタ API を作成する。

## 対象仕様

- `specs/product-master.md`
- `specs/overview.md`

## 実装内容

- `Features/Products` 配下に商品マスタ API の実装を追加する。
- `Program.cs` から商品マスタ API のエンドポイントを登録する。
- 商品マスタ API に認可要件を設定する。
  - 参照系 API は認証済みユーザーを要求する。
  - 登録・履歴追加 API は `MasterMaintainer` ロールを要求する。
- 商品一覧 API を作成する。
  - 商品コード、商品名で絞り込めること。
  - 販売中、販売停止で絞り込めること。
  - 現在日付時点で有効な商品履歴を一覧に表示すること。
- 商品新規登録 API を作成する。
  - `Products` を追加すること。
  - 初回の `ProductVersions` を同時に追加すること。
  - `CreatedAt` はアプリケーション側で UTC 現在日時を設定すること。
- 商品履歴追加 API を作成する。
  - 既存の `ProductVersions` は更新せず、新しい履歴を追加すること。
  - 同じ `ProductId` と `ValidFrom` の履歴を重複登録できないこと。
- 商品履歴一覧 API を作成する。
  - 指定した商品の履歴を `ValidFrom` 降順で取得できること。
- 指定日プレビュー API を作成する。
  - 指定日以前で一番新しい商品履歴を返すこと。
  - 初回 `ValidFrom` より前の日付では、適用できる履歴がないことを表現すること。
- 入力 DTO とレスポンス DTO を定義する。
- 入力バリデーションを実装する。
  - 商品コードは必須、最大 30 文字。
  - 商品名は必須、最大 100 文字。
  - 単位は必須、最大 20 文字。
  - 標準単価は 0 以上、小数 2 桁まで。
  - 税区分は必須、最大 30 文字。
  - `ValidFrom` は必須。
- API の正常系、異常系テストを追加する。
- 認証ヘッダーなし、ロール不足、必要ロールありの認可テストを追加する。
- 必要に応じて `.http` ファイルに手動確認用リクエストを追加する。

## 想定エンドポイント

- `GET /api/products`
  - 商品一覧を取得する。
  - クエリ例: `productCode`, `name`, `isDiscontinued`
- `POST /api/products`
  - 商品を新規登録する。
- `GET /api/products/{productId}/versions`
  - 商品履歴一覧を取得する。
- `POST /api/products/{productId}/versions`
  - 商品履歴を追加する。
- `GET /api/products/{productId}/preview?targetDate=yyyy-MM-dd`
  - 指定日時点で有効な商品履歴を取得する。

## 注意点

- マスタ変更は既存行の更新ではなく、履歴レコードの追加で表現する。
- `ProductVersions` に `ValidTo` は追加しない。
- 指定日適用履歴は `ValidFrom <= targetDate` の中で `ValidFrom` が最大の履歴とする。
- 一覧取得でも、画面表示用の現在履歴を同じ考え方で取得する。
- SQLite では `LIMIT 1` で表現できるが、実装では Oracle 対応を見据えて EF Core の LINQ で履歴取得を表現する。
- 日付比較は業務上日付部分のみを有効とするため、時刻混入時の扱いを実装またはテストで明確にする。
- DB の一意制約違反に依存しすぎず、API として分かりやすいエラーを返す。
- ただし競合登録に備えて DB 制約違反も適切にエラー化する。

## 確認内容

- `dotnet test backend/SalesSystem.slnx` が成功する。
- 商品を新規登録できる。
- 商品コード重複時にエラーになる。
- 商品履歴を追加できる。
- 同じ `ProductId` と `ValidFrom` の商品履歴を重複登録できない。
- 商品一覧で現在有効な履歴の内容が取得できる。
- 商品一覧で商品コード、商品名、販売状態の絞り込みができる。
- 指定日プレビューで、指定日以前の最新履歴が取得できる。
- 初回 `ValidFrom` より前の指定日では、適用履歴なしとして扱われる。
- 履歴取得クエリが Oracle でも成立する LINQ になっていることをコードレビューで確認する。
- 認証なしでは商品マスタ API にアクセスできない。
- `MasterMaintainer` ロールなしでは登録・履歴追加 API にアクセスできない。

## 完了時の記録

タスク完了時には、以下をこのファイルに追記してから `tasks/done/` に移動する。

- 追加したエンドポイント
- 設定した認可要件
- 主な DTO とバリデーション
- 履歴取得ロジックの実装方針
- 実行した確認コマンド
- Oracle 対応で後続確認が必要な点

## 完了記録

完了日: 2026-06-01

### 追加したエンドポイント

- `GET /api/products`
  - JST の業務日付時点で有効な商品履歴を商品ごとに1件取得する。
  - `productCode`, `name`, `isDiscontinued` で絞り込みできる。
- `POST /api/products`
  - `Products` と初回 `ProductVersions` を同時に登録する。
  - `CreatedAt` はアプリケーション側で UTC 現在日時を設定する。
- `GET /api/products/{productId}/versions`
  - 商品履歴を `ValidFrom` 降順で取得する。
- `POST /api/products/{productId}/versions`
  - 既存履歴を更新せず、新しい商品履歴を追加する。
- `GET /api/products/{productId}/preview?targetDate=yyyy-MM-dd`
  - 指定日以前で一番新しい商品履歴を取得する。
  - 初回 `ValidFrom` より前の日付では `404 Not Found` を返す。

### 設定した認可要件

- 参照系 API は `AuthenticatedUser` ポリシーを要求する。
- 登録・履歴追加 API は `MasterMaintainer` ポリシーを要求する。

### 主な DTO とバリデーション

- 入力 DTO
  - `CreateProductRequest`
  - `CreateProductVersionRequest`
- レスポンス DTO
  - `ProductListItemResponse`
  - `ProductResponse`
  - `ProductVersionResponse`
- バリデーション
  - 商品コード: 必須、最大30文字。
  - 商品名: 必須、最大100文字。
  - 単位: 必須、最大20文字。
  - 標準単価: 0以上、小数2桁まで。
  - 税区分: 必須、最大30文字。
  - `ValidFrom`: 必須。
  - `ValidFrom` は日付比較の業務ルールに合わせて `.Date` に正規化して保存する。
- `CreatedAt` は UTC 日時として保存し、一覧の「現在日付」は `IBusinessClock` で JST の業務日付として解決する。

### 履歴取得ロジックの実装方針

- 適用履歴は EF Core LINQ で `ValidFrom <= targetDate.Date`、`OrderByDescending(ValidFrom)`、`ThenByDescending(Id)`、`FirstOrDefaultAsync` により取得する。
- 一覧取得では `ProductVersions` を `ProductId` で集計し、JST 業務日付以前の最大 `ValidFrom` を求めてから `Products` と `ProductVersions` に join する。
- Oracle provider での変換を見据え、一覧取得の最新履歴選択は相関サブクエリの `Take(1)` ではなく `GroupBy`、`Max`、`Join` で表現する。
- DB 固有 SQL は使わず、Oracle provider でも変換可能な LINQ で表現した。
- 同じ `ProductId` と `ValidFrom` の重複は事前チェックで `409 Conflict` を返し、競合登録に備えて `DbUpdateException` も `409 Conflict` に変換する。

### 実行した確認コマンド

```bash
dotnet test backend/SalesSystem.slnx
```

結果:

- 成功
- 合格: 24
- 失敗: 0

### Oracle 対応で後続確認が必要な点

- 商品一覧の「商品ごとに最新履歴1件を選ぶ」LINQ が Oracle provider で期待通りの SQL に変換されること。
- `DateTime.Date` 正規化後の `ValidFrom <= targetDate` 比較が Oracle の日付型で意図通り動くこと。
- `Contains` による商品コード・商品名検索の SQL 変換と大文字小文字・照合順序の扱い。
- 一意制約違反時の `DbUpdateException` 詳細は provider ごとに異なるため、必要なら Oracle の例外コード単位でエラー判定を精緻化すること。
