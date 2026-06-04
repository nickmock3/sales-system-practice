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
