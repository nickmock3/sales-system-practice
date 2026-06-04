# 商品マスタ仕様

## 目的

法人向け事務用品販売で扱う商品を管理する。

商品情報の変更は既存行の更新ではなく、新しい商品履歴の追加として扱う。

## 画面機能

- 商品一覧表示
- 商品検索
- 商品コード、商品名での絞り込み
- 販売中、販売停止での絞り込み
- 商品新規登録
- 商品履歴追加
- 商品履歴一覧
- 指定日での商品情報プレビュー
- 販売停止登録
- 入力バリデーション表示

## 一覧表示項目

- 商品コード
- 現在の商品名
- 単位
- 現在の標準単価
- 税区分
- 販売状態
- 適用開始日

## 主な項目

- 商品コード
- 商品名
- 単位
- 標準単価
- 税区分
- 販売停止フラグ
- 適用開始日

## データ

```text
Products
- Id
- ProductCode
- CreatedAt

ProductVersions
- Id
- ProductId
- Name
- Unit
- StandardUnitPrice
- TaxCategory
- IsDiscontinued
- ValidFrom
```

## 業務ルール

- 商品の同一性は `Products` で表す。
- 変更される商品属性は `ProductVersions` に持たせる。
- 商品名、単位、標準単価、税区分、販売停止フラグの変更は履歴追加で表現する。
- `ProductVersions` は原則更新しない。
- 同じ `ProductId` と `ValidFrom` の商品履歴を重複登録できない。
- 指定日時点の商品情報は、指定日以前で一番新しい商品履歴を使う。
- 商品一覧の「現在の商品情報」は、アプリケーション側で解決した JST の業務日付以前で一番新しい商品履歴を使う。
- 初回 `ValidFrom` より前の日付では、適用できる商品履歴が存在しないものとして扱う。
- 税区分は `specs/tax-rates.md` で定義した `TaxCategory` のみ指定できる。

## 適用履歴取得

```sql
select *
from ProductVersions
where ProductId = @productId
  and ValidFrom <= @targetDate
order by ValidFrom desc
limit 1;
```

## テスト観点

- 商品を登録できる。
- 商品履歴を追加できる。
- 定義されていない税区分の商品履歴は登録できない。
- 指定日以前で一番新しい商品履歴を取得できる。
- 同じ `ProductId` と `ValidFrom` の履歴を重複登録できない。
- 初回 `ValidFrom` より前の日付では商品履歴が取得できない。
