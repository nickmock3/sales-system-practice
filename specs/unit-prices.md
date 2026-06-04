# 得意先別単価仕様

## 目的

商品標準単価を基本単価としつつ、得意先ごとの取引条件に応じた例外単価を管理する。

売上入力時には、売上日、得意先、商品をもとに採用単価を決定し、登録済み売上には登録時点で採用した単価情報を保存する。

## 方針

まずは得意先別・商品別の単価を扱う。

得意先ランク別単価は、ランクマスタ、得意先履歴、ランク別単価、得意先別単価との優先順位が増えるため、この段階では導入しない。得意先別単価の運用で不足が見えた段階の後続課題とする。

## 画面機能

- 得意先別単価一覧表示
- 得意先、商品での絞り込み
- 得意先別単価新規登録
- 得意先別単価履歴追加
- 得意先別単価履歴一覧
- 指定日での得意先別単価プレビュー
- 入力バリデーション表示

## 一覧表示項目

- 得意先コード
- 得意先名
- 商品コード
- 商品名
- 単価
- 適用開始日

## 主な項目

- 得意先
- 商品
- 単価
- 適用開始日

## データ

```text
CustomerProductPrices
- Id
- CustomerId
- ProductId
- UnitPrice
- ValidFrom
- CreatedAt
```

`CustomerProductPrices` は得意先別・商品別の例外単価を表す。

商品標準単価は引き続き `ProductVersions.StandardUnitPrice` に保持する。標準単価の変更は商品履歴の追加で表現し、得意先別単価の変更は `CustomerProductPrices` の追加で表現する。

## 業務ルール

- 得意先別単価は、得意先と商品の組み合わせに対する例外単価として扱う。
- 得意先別単価は商品マスタ履歴とは別テーブルで管理する。
- 得意先別単価の変更は既存行の更新ではなく、新しい単価履歴の追加として扱う。
- `CustomerProductPrices` は原則更新しない。
- 得意先別単価は `ValidFrom` のみを持ち、`ValidTo` は持たない。
- 同じ `CustomerId`、`ProductId`、`ValidFrom` の得意先別単価を重複登録できない。
- 指定日時点の得意先別単価は、指定日以前で一番新しい得意先別単価を使う。
- 初回 `ValidFrom` より前の日付では、適用できる得意先別単価が存在しないものとして扱う。
- 得意先別単価が存在しない場合は、売上日時点の商品標準単価へフォールバックする。
- 登録済み売上の単価は、得意先別単価や商品標準単価が後で変わっても変えない。

## 単価採用ルール

売上入力時の採用単価は、以下の優先順位で決定する。

1. 売上日以前で一番新しい得意先別商品単価
2. 売上日以前で一番新しい商品履歴の標準単価

得意先別商品単価が存在する場合は、その単価を採用する。

得意先別商品単価が存在しない場合は、商品標準単価を採用する。この場合も、売上日時点で適用できる商品履歴が存在しない場合は単価を決定できない。

## 採用単価の保存方針

売上明細には、登録時点で採用した単価と、その根拠を保存する。

得意先別商品単価は `CustomerProductPrices` を nullable FK で参照する。商品標準単価の根拠は、売上明細に必ず保存する `ProductVersionId` を使う。

`UnitPriceSourceId` のように参照先が複数テーブルに分かれるポリモーフィック ID は使わない。DB の外部キー制約で参照整合性を確認できるように、参照先ごとに列を分ける。

```text
SaleDetails
- UnitPrice
- ProductVersionId
- CustomerProductPriceId nullable
- IsManualUnitPrice
- AutoUnitPrice
- ManualUnitPriceReason nullable
```

| 項目 | 意味 |
| --- | --- |
| `UnitPrice` | 登録時点で最終的に採用した単価 |
| `ProductVersionId` | 売上日時点の商品履歴。商品標準単価の根拠にも使う |
| `CustomerProductPriceId` | 得意先別商品単価を自動採用した場合の根拠。商品標準単価の場合は `null` |
| `IsManualUnitPrice` | 自動取得した単価を手入力で変更したか |
| `AutoUnitPrice` | 売上日、得意先、商品から自動取得した単価。手入力変更なしの場合は `UnitPrice` と同じ |
| `ManualUnitPriceReason` | 手入力変更理由。現段階では任意 |

得意先別商品単価を自動採用した場合は `CustomerProductPriceId` に `CustomerProductPrices.Id` を保存する。

商品標準単価を自動採用した場合は `CustomerProductPriceId` を `null` にし、`ProductVersionId` が標準単価の根拠を表す。

手入力で単価変更しない場合は `IsManualUnitPrice` を `false` にし、`UnitPrice` と `AutoUnitPrice` に同じ自動取得単価を保存する。

手入力で単価変更した場合は `IsManualUnitPrice` を `true` にし、`UnitPrice` には手入力後の単価、`AutoUnitPrice` には変更前に自動取得した単価を保存する。`CustomerProductPriceId` は変更前の自動採用元を表すため、得意先別商品単価が自動採用元だった場合は値を保持し、商品標準単価が自動採用元だった場合は `null` のままにする。

現段階では、手入力変更理由は必須にはしない。ただし、内部統制や承認フローが必要になった場合に備え、後続課題として `ManualUnitPriceReason` の必須化や承認状態を追加できる余地を残す。

## 売上明細への保存

売上は過去の取引記録として扱うため、売上明細には登録時点の `UnitPrice` を必ず保存する。

加えて、後から「なぜその単価になったか」を確認できるように、`ProductVersionId`、`CustomerProductPriceId`、`IsManualUnitPrice`、`AutoUnitPrice`、`ManualUnitPriceReason` を保存する方針とする。

得意先別単価や商品標準単価が後で変更されても、登録済み売上明細の単価情報と採用根拠は変更しない。

## 適用単価取得

得意先別商品単価:

```sql
select *
from CustomerProductPrices
where CustomerId = @customerId
  and ProductId = @productId
  and ValidFrom <= @salesDate
order by ValidFrom desc
fetch first 1 rows only;
```

SQLite で確認する場合は `limit 1` に読み替える。

商品標準単価:

```sql
select *
from ProductVersions
where ProductId = @productId
  and ValidFrom <= @salesDate
order by ValidFrom desc
fetch first 1 rows only;
```

SQLite で確認する場合は `limit 1` に読み替える。

## API 方針

得意先別単価 API は、後続タスクで以下を実装する。

- 得意先別単価一覧取得
- 得意先別単価新規登録
- 得意先別単価履歴追加
- 指定日での得意先別単価プレビュー

売上入力補助 API と売上登録 API は、単価決定ロジックを共通化する。

売上入力補助 API は、売上日、得意先 ID、商品 ID を受け取り、商品履歴、税区分、税率、自動取得単価、得意先別商品単価 ID を返す。

## バリデーション

- 得意先 ID は存在する `Customers.Id` であること。
- 商品 ID は存在する `Products.Id` であること。
- 単価は 0 以上、小数第2位までであること。
- 適用開始日は必須であること。
- 同じ得意先、商品、適用開始日の単価履歴は登録できないこと。

## テスト観点

- 得意先別単価を登録できる。
- 得意先別単価履歴を追加できる。
- 同じ得意先、商品、適用開始日の単価履歴を重複登録できない。
- 売上日以前で一番新しい得意先別単価を取得できる。
- 得意先別単価がある場合、その単価が採用される。
- 得意先別単価がない場合、商品標準単価が採用される。
- 初回 `ValidFrom` より前の日付では得意先別単価が取得できず、商品標準単価へフォールバックする。
- 商品標準単価も取得できない場合、採用単価を決定できない。
- 売上登録時に採用単価、得意先別商品単価 ID、手入力変更有無、自動取得単価が保存される。
- 登録済み売上の単価は、得意先別単価や商品標準単価の変更後も変わらない。
- 売上入力補助 API と売上登録 API の採用単価が一致する。

## 後続課題

- 得意先別商品単価 API を実装する。
- 売上入力補助 API を、得意先別単価を考慮する形に見直す。
- 売上登録 API の単価決定ロジックを共通化する。
- 売上明細に得意先別商品単価 ID、手入力変更有無、自動取得単価を保存する。
- 手入力単価の変更理由や承認フローが必要か検討する。
- 得意先ランク別単価が必要か、得意先別単価の運用後に判断する。
