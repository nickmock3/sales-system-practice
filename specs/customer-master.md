# 得意先マスタ仕様

## 目的

売上登録で選択する得意先を管理する。

得意先情報の変更は既存行の更新ではなく、新しい得意先履歴の追加として扱う。

## 画面機能

- 得意先一覧表示
- 得意先検索
- 得意先コード、得意先名での絞り込み
- 得意先新規登録
- 得意先履歴追加
- 得意先履歴一覧
- 指定日での得意先情報プレビュー
- 入力バリデーション表示

## 一覧表示項目

- 得意先コード
- 現在の得意先名
- 住所
- 電話番号
- 適用開始日

## 主な項目

- 得意先コード
- 得意先名
- 住所
- 電話番号
- 適用開始日

## データ

```text
Customers
- Id
- CustomerCode
- CreatedAt

CustomerVersions
- Id
- CustomerId
- Name
- Address
- PhoneNumber
- ValidFrom
```

## 業務ルール

- 得意先の同一性は `Customers` で表す。
- 変更される得意先属性は `CustomerVersions` に持たせる。
- 得意先名、住所、電話番号の変更は履歴追加で表現する。
- `CustomerVersions` は原則更新しない。
- 同じ `CustomerId` と `ValidFrom` の得意先履歴を重複登録できない。
- 指定日時点の得意先情報は、指定日以前で一番新しい得意先履歴を使う。
- 初回 `ValidFrom` より前の日付では、適用できる得意先履歴が存在しないものとして扱う。

## 適用履歴取得

```sql
select *
from CustomerVersions
where CustomerId = @customerId
  and ValidFrom <= @targetDate
order by ValidFrom desc
limit 1;
```

## テスト観点

- 得意先を登録できる。
- 得意先履歴を追加できる。
- 指定日以前で一番新しい得意先履歴を取得できる。
- 同じ `CustomerId` と `ValidFrom` の履歴を重複登録できない。
- 初回 `ValidFrom` より前の日付では得意先履歴が取得できない。

