# 税率仕様

## 目的

商品に設定された税区分と売上日をもとに、売上明細へ適用する税率を決定する。

税率は商品マスタとは別に管理する。

## データ

```text
TaxRates
- Id
- TaxCategory
- Rate
- ValidFrom
```

## 業務ルール

- 商品履歴の `TaxCategory` から税区分を決める。
- 売上日以前で一番新しい `TaxRates` を取得する。
- 売上明細には適用した税率と税額を保存する。
- 税率変更は既存レコードの更新ではなく、`TaxRates` の追加で表現する。
- 初回 `ValidFrom` より前の日付では、適用できる税率が存在しないものとして扱う。

## 適用税率取得

```sql
select *
from TaxRates
where TaxCategory = @taxCategory
  and ValidFrom <= @salesDate
order by ValidFrom desc
limit 1;
```

## テスト観点

- 売上日以前で一番新しい税率を取得できる。
- 税区分ごとに税率を取得できる。
- 初回 `ValidFrom` より前の日付では税率が取得できない。
- 税率変更後も、登録済み売上明細の税率と税額は変わらない。

