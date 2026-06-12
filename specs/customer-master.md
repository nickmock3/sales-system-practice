# 得意先マスタ仕様

## 目的

売上登録で選択する得意先を管理する。

得意先情報の変更は既存行の更新ではなく、新しい得意先履歴の追加として扱う。

画面と API では「履歴追加」ではなく「指定日からの得意先情報変更」「変更履歴」として表現する。内部実装では引き続き `CustomerVersions` への履歴レコード追加で表現する。API 契約の詳細は `specs/api-contracts.md` を参照する。

## 画面機能

- 得意先一覧表示
- 得意先検索
- 得意先コード、得意先名での絞り込み
- 得意先新規登録
- 指定日からの得意先情報変更
- 変更履歴一覧
- 指定日時点の得意先情報参照
- 入力バリデーション表示

## 一覧表示項目

- 得意先コード
- 現在の得意先名
- 住所
- 電話番号
- 適用開始日（`effectiveFrom`）

## 主な項目

- 得意先コード
- 得意先名
- 住所
- 電話番号
- 適用開始日（`effectiveFrom`）

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
- 得意先ごとの商品単価は得意先履歴ではなく、`specs/unit-prices.md` で定義する得意先別単価として別管理する。
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

## API

`specs/api-contracts.md` の得意先 API に従う。

- `GET /api/customers` — 業務日時点の得意先一覧
- `POST /api/customers` — 得意先新規登録
- `GET /api/customers/{customerId}?asOf=` — 指定日時点の得意先情報
- `GET /api/customers/{customerId}/changes` — 変更履歴一覧
- `POST /api/customers/{customerId}/changes` — 指定日からの得意先情報変更

通常レスポンスには `CustomerVersionId` を含めない。DB 内部では `CustomerVersions.Id` を保持し、売上登録時の `CustomerVersionId` 保存にも使う。

売上入力時の得意先確認は `GET /api/customers/{customerId}?asOf={salesDate}` で行う。

## テスト観点

- 得意先を登録できる。
- 指定日から得意先情報を変更できる。
- 指定日以前で一番新しい得意先履歴を取得できる。
- 同じ `CustomerId` と `ValidFrom` の履歴を重複登録できない。
- 初回 `ValidFrom` より前の日付では得意先履歴が取得できない。
