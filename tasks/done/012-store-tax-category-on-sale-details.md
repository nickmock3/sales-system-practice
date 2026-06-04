# 012 売上明細に採用税区分を保存する

## 目的

売上登録時に採用した税率値だけでなく、税区分を売上明細に保存する。

軽減税率 8% と旧標準税率 8% のように税率値が同じでも会計集計上は別扱いになるケースに対応する。

## 背景

現在の `SaleDetails` は `TaxRate` と `TaxAmount` を保存しているが、採用した税区分を保存していない。

このままでは、登録後に会計資料を作成するとき、同じ税率値の税区分を区別できない。

## 前提タスク

- `011-redesign-tax-rate-master.md`

## 対象仕様

- `specs/sales-entry.md`
- `specs/tax-rates.md`

## 実装内容

- `specs/sales-entry.md` に、売上明細へ採用税区分を保存するルールを追記する。
- `SaleDetail` エンティティに採用税区分を表す項目を追加する。
- 税率マスタの履歴 ID を保存するか、税区分コードと税区分名を保存するかを設計で決める。
- 売上登録処理で、明細ごとに採用した税区分情報を保存する。
- 売上一覧・売上詳細 API のレスポンスで、明細の税区分を確認できるようにする。
- 取消売上を作成するとき、元明細の税区分情報を引き継ぐ。
- 必要なマイグレーションを追加する。
- 売上 API テストを更新する。

## 業務ルール

- 売上は過去の取引記録として扱うため、登録時点で採用した税区分情報を後から変えない。
- 税率マスタの表示名や区分名が後で変わっても、登録済み売上明細の税区分表示・集計が壊れない保存方法を選ぶ。
- 税額計算は引き続き明細単位で行う。

## テスト観点

- 売上登録時に税率値と税区分が保存される。
- 軽減税率 8% と旧標準税率 8% を別税区分として保存できる。
- 売上詳細で登録時点の税区分を確認できる。
- 税率マスタ変更後も登録済み売上明細の税率値、税区分、税額が変わらない。
- 売上取消時に税区分情報が取消明細へ引き継がれる。

## 完了時の記録

タスク完了時には、以下をこのファイルに追記してから `tasks/done/` に移動する。

- 更新した仕様
- 追加した売上明細カラム
- 採用税区分の保存方針
- 変更した API レスポンス
- 実行した確認コマンド
- Oracle 対応で後続確認が必要な点

## 完了記録

### 更新した仕様

- `specs/sales-entry.md` に、売上明細へ採用税区分を保存するルールを追記した。
- 登録時点の税率履歴を追跡する `TaxRateId` と、表示・会計集計用の税区分スナップショットを保存する方針を明記した。

### 追加した売上明細カラム

- `TAX_RATE_ID`
- `TAX_CATEGORY`
- `TAX_CATEGORY_NAME`
- `ACCOUNTING_CATEGORY`

### 採用税区分の保存方針

- 売上登録時に採用した `TaxRates.Id` を `SaleDetails.TaxRateId` に保存する。
- 税率マスタの名称や会計分類が後で変わっても登録済み売上の表示・集計が壊れないように、`TaxCategory`、`TaxCategoryName`、`AccountingCategory` も売上明細へスナップショット保存する。
- 取消売上の明細は、元明細の採用税率履歴 ID と税区分スナップショットを引き継ぐ。

### 変更した API レスポンス

- 売上詳細 API の明細レスポンスに以下を追加した。
  - `taxRateId`
  - `taxCategory`
  - `taxCategoryName`
  - `accountingCategory`

### 実行した確認コマンド

```bash
dotnet ef migrations add StoreTaxCategoryOnSaleDetails --project backend/src/SalesSystem.Api/SalesSystem.Api.csproj --startup-project backend/src/SalesSystem.Api/SalesSystem.Api.csproj --output-dir Persistence/Migrations
dotnet test backend/SalesSystem.slnx
```

確認結果:

- `dotnet test backend/SalesSystem.slnx`: 成功。73 件合格。

### Oracle 対応で後続確認が必要な点

- 追加マイグレーションの既存データバックフィル SQL は SQLite の `LIMIT 1` を使っているため、Oracle 適用時は `FETCH FIRST 1 ROWS ONLY` または Oracle 向けの同等 SQL に置き換えて確認する。
- `SALE_DETAILS.TAX_RATE_ID` の外部キー、文字列カラム長、decimal 精度が Oracle provider で意図どおり生成されることを確認する。
