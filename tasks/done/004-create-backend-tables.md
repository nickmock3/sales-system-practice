# 004 バックエンドのテーブル定義を作成する

## 目的

販売管理システムで使う主要データを EF Core のエンティティとして定義し、SQLite ローカルDBでテーブルを作成できるようにする。

対象は、商品マスタ、得意先マスタ、税率、売上、売上明細とする。

## 背景

現在はバックエンド基盤と `AppDbContext` まで作成済みだが、業務データを保存するテーブル定義はまだない。

`specs/` には各機能のデータ構造と業務ルールが整理されているため、次の実装ステップとして EF Core のエンティティ、制約、インデックス、マイグレーションを作成する。

## 対象仕様

- `specs/product-master.md`
- `specs/customer-master.md`
- `specs/tax-rates.md`
- `specs/sales-entry.md`

## 実装内容

- 以下のエンティティを作成する。
  - `Product`
  - `ProductVersion`
  - `Customer`
  - `CustomerVersion`
  - `TaxRate`
  - `Sale`
  - `SaleDetail`
- `AppDbContext` に `DbSet` を追加する。
- EF Core の設定で主キー、外部キー、必須項目、最大文字数を定義する。
- 物理DB上のテーブル名、カラム名、インデックス名、制約名は `UPPER_SNAKE_CASE` で明示する。
- 以下の一意制約を定義する。
  - `PRODUCTS.PRODUCT_CODE`
  - `PRODUCT_VERSIONS.PRODUCT_ID, VALID_FROM`
  - `CUSTOMERS.CUSTOMER_CODE`
  - `CUSTOMER_VERSIONS.CUSTOMER_ID, VALID_FROM`
  - `TAX_RATES.TAX_CATEGORY, VALID_FROM`
- 履歴取得で使う列にインデックスを定義する。
  - `PRODUCT_VERSIONS.PRODUCT_ID, VALID_FROM`
  - `CUSTOMER_VERSIONS.CUSTOMER_ID, VALID_FROM`
  - `TAX_RATES.TAX_CATEGORY, VALID_FROM`
  - `SALES.SALES_DATE`
- 金額、数量、税率には `specs/sales-entry.md` の保存精度に従い、Oracle でも扱いやすい `decimal` 精度を明示する。
- ID は C# の `long` として定義する。
- 日付・日時は C# の `DateTime` として定義する。
- `SalesDate` と `ValidFrom` は `DateTime` で保持し、業務上は日付部分のみを有効とする。
- 税区分は `string` で保持し、アプリケーション側の定数で管理する。
- `CreatedAt` はアプリケーション側で UTC 現在日時を設定する。
- SQLite 用の初回マイグレーションを作成する。
- ローカル SQLite DB にマイグレーションを適用できることを確認する。

## 注意点

- マスタ変更は既存行の更新ではなく、履歴レコードの追加で表現する。
- 履歴テーブルには `ValidTo` を持たせない。
- マスタ、履歴、売上は物理削除しない。
- 外部キーの削除動作は `Restrict` を基本とする。
- 売上には登録時点で採用した `CustomerVersionId` を保存する。
- 売上明細には登録時点で採用した `ProductVersionId`、単価、税率、税額、金額を保存する。
- 金額計算の丸めタイミングと丸め方法は `specs/sales-entry.md` に従う。
- SQLite で動作確認できても Oracle 互換を保証した扱いにはしない。
- Oracle 対応を見据え、DB 固有 SQL に依存しない EF Core 設定を優先する。
- Oracle の引用符付き識別子に依存しないよう、物理DB名は大文字の `UPPER_SNAKE_CASE` で統一する。

## 確認内容

- `dotnet test` が成功する。
- マイグレーションを作成できる。
- SQLite ローカルDBへマイグレーションを適用できる。
- 同一商品コードを重複登録できないことをテストで確認する。
- 同じ `ProductId` と `ValidFrom` の商品履歴を重複登録できないことをテストで確認する。
- 同一得意先コードを重複登録できないことをテストで確認する。
- 同じ `CustomerId` と `ValidFrom` の得意先履歴を重複登録できないことをテストで確認する。
- 同じ `TaxCategory` と `ValidFrom` の税率を重複登録できないことをテストで確認する。

## 完了時の記録

タスク完了時には、以下をこのファイルに追記してから `tasks/done/` に移動する。

- 実装したエンティティと主な制約
- 作成したマイグレーション名
- 実行した確認コマンド
- Oracle 対応で後続確認が必要な点

## 完了記録

### 実装したエンティティと主な制約

- `Product`
  - テーブル: `PRODUCTS`
  - 主キー: `PK_PRODUCTS`
  - 一意制約: `UX_PRODUCTS_PRODUCT_CODE` (`PRODUCT_CODE`)
- `ProductVersion`
  - テーブル: `PRODUCT_VERSIONS`
  - 主キー: `PK_PRODUCT_VERSIONS`
  - 代替キー: `AK_PRODUCT_VERSIONS_ID_PRODUCT_ID` (`ID`, `PRODUCT_ID`)
  - 外部キー: `FK_PRODUCT_VERSIONS_PRODUCTS`
  - 一意制約: `UX_PRODUCT_VERSIONS_PRODUCT_ID_VALID_FROM` (`PRODUCT_ID`, `VALID_FROM`)
- `Customer`
  - テーブル: `CUSTOMERS`
  - 主キー: `PK_CUSTOMERS`
  - 一意制約: `UX_CUSTOMERS_CUSTOMER_CODE` (`CUSTOMER_CODE`)
- `CustomerVersion`
  - テーブル: `CUSTOMER_VERSIONS`
  - 主キー: `PK_CUSTOMER_VERSIONS`
  - 代替キー: `AK_CUSTOMER_VERSIONS_ID_CUSTOMER_ID` (`ID`, `CUSTOMER_ID`)
  - 外部キー: `FK_CUSTOMER_VERSIONS_CUSTOMERS`
  - 一意制約: `UX_CUSTOMER_VERSIONS_CUSTOMER_ID_VALID_FROM` (`CUSTOMER_ID`, `VALID_FROM`)
- `TaxRate`
  - テーブル: `TAX_RATES`
  - 主キー: `PK_TAX_RATES`
  - 一意制約: `UX_TAX_RATES_TAX_CATEGORY_VALID_FROM` (`TAX_CATEGORY`, `VALID_FROM`)
- `Sale`
  - テーブル: `SALES`
  - 主キー: `PK_SALES`
  - 外部キー: `FK_SALES_CUSTOMERS`, `FK_SALES_CUSTOMER_VERSIONS`
  - `FK_SALES_CUSTOMER_VERSIONS` は (`CUSTOMER_VERSION_ID`, `CUSTOMER_ID`) から `CUSTOMER_VERSIONS` (`ID`, `CUSTOMER_ID`) を参照し、売上の得意先と採用履歴の得意先が一致することをDBで保証する。
  - インデックス: `IX_SALES_SALES_DATE`
- `SaleDetail`
  - テーブル: `SALE_DETAILS`
  - 主キー: `PK_SALE_DETAILS`
  - 外部キー: `FK_SALE_DETAILS_SALES`, `FK_SALE_DETAILS_PRODUCTS`, `FK_SALE_DETAILS_PRODUCT_VERSIONS`
  - `FK_SALE_DETAILS_PRODUCT_VERSIONS` は (`PRODUCT_VERSION_ID`, `PRODUCT_ID`) から `PRODUCT_VERSIONS` (`ID`, `PRODUCT_ID`) を参照し、明細の商品と採用履歴の商品が一致することをDBで保証する。

金額、数量、税率は以下の精度を指定した。

- `Quantity`: `decimal(18, 3)`
- `UnitPrice`: `decimal(18, 2)`
- `Amount`: `decimal(18, 2)`
- `TaxAmount`: `decimal(18, 2)`
- `TotalAmount`: `decimal(18, 2)`
- `TaxRate` / `TaxRates.Rate`: `decimal(5, 4)`

### 作成したマイグレーション名

- `20260601072221_InitialCreate`

### 実行した確認コマンド

- `dotnet test backend/SalesSystem.slnx`
- `/tmp/sales-system-dotnet-tools/dotnet-ef migrations add InitialCreate --project backend/src/SalesSystem.Api/SalesSystem.Api.csproj --startup-project backend/src/SalesSystem.Api/SalesSystem.Api.csproj --output-dir Persistence/Migrations`
- `/tmp/sales-system-dotnet-tools/dotnet-ef database update --project backend/src/SalesSystem.Api/SalesSystem.Api.csproj --startup-project backend/src/SalesSystem.Api/SalesSystem.Api.csproj`
- `/tmp/sales-system-dotnet-tools/dotnet-ef migrations has-pending-model-changes --project backend/src/SalesSystem.Api/SalesSystem.Api.csproj --startup-project backend/src/SalesSystem.Api/SalesSystem.Api.csproj`

### `/health` とマイグレーション運用に関する判断

マイグレーション導入後は、`/health` で `EnsureCreatedAsync()` を呼ばない方針とした。

`EnsureCreatedAsync()` はマイグレーション履歴を作らず、現在のモデルから直接テーブルを作成する。そのため、空のローカルDBへ最初に `/health` がアクセスした場合、その後の `dotnet ef database update` と整合しないDBになる可能性がある。

`/health` はDBスキーマ作成を行わず、`CanConnectAsync()` による接続確認のみを行う。DBスキーマ作成と更新は EF Core マイグレーションで管理する。

### Oracle 対応で後続確認が必要な点

- Oracle provider でマイグレーション SQL を生成し、`decimal` 精度、`DateTime` の型、真偽値の型が想定どおりになることを確認する。
- Oracle 上で一意制約、外部キー、`VALID_FROM` を使った履歴取得クエリ、`SALES_DATE` 検索の実行計画を確認する。
- SQLite の成功は Oracle 互換を保証しないため、Oracle 接続環境を用意した後に `database update` 相当の適用確認を行う。

### 設定クラス分割に関する判断

EF Core のテーブル、カラム、制約、インデックス設定は `IEntityTypeConfiguration<T>` でエンティティごとに分割できるが、現時点では `AppDbContext.OnModelCreating` に集約したままとする。

理由は以下のとおり。

- 現在は7エンティティであり、1ファイルでテーブル定義の全体像を追いやすい。
- 学習用リポジトリとして、EF Core の設定内容が `AppDbContext.cs` にまとまっている方が理解しやすい。
- AI がコードを読む場合も、`rg` などで必要なテーブル名、カラム名、制約名を抜き出せるため、現時点ではファイルの長さ自体は大きな問題になりにくい。
- 早期に分割すると、設定の所在が増えて文脈確認の手間が増える。

ただし、今後 `AppDbContext.cs` が大きくなりすぎる、複数人作業でコンフリクトが増える、または一部エンティティの設定だけ複雑化する場合は、`Persistence/Configurations/` に `ProductConfiguration` などの `IEntityTypeConfiguration<T>` 実装を切り出す。
