# 税率仕様

## 目的

商品に設定された税区分と売上日をもとに、売上明細へ適用する税率を決定する。

税率は商品マスタとは別に管理する。

## データ

```text
TaxRates
- Id
- TaxCategory
- TaxCategoryName
- AccountingCategory
- Rate
- ValidFrom
```

### 税区分

税区分は商品履歴から参照される業務コードとして扱う。
税率値が同じでも税区分コードが異なれば別レコードとして登録し、会計集計でも別区分として扱う。

| TaxCategory | TaxCategoryName | AccountingCategory | Rate |
| --- | --- | --- | --- |
| `STANDARD` | 標準税率 | `TAXABLE_STANDARD` | 0 より大きい税率 |
| `REDUCED` | 軽減税率 | `TAXABLE_REDUCED` | 0 より大きい税率 |
| `NON_TAXABLE` | 非課税 | `NON_TAXABLE` | `0.0000` |
| `TAX_EXEMPT` | 免税 | `TAX_EXEMPT` | `0.0000` |
| `OLD_STANDARD` | 旧標準税率 | `TAXABLE_OLD_STANDARD` | 0 より大きい税率 |

`TaxCategoryName` と `AccountingCategory` は、税区分コードに対応する名称を保存する。
将来、名称や会計分類の見直しが発生した場合も、過去の税率履歴を直接更新せず、新しい扱いが必要な税区分または履歴追加として判断する。

## 業務ルール

- 商品履歴の `TaxCategory` から税区分を決める。
- 売上日以前で一番新しい `TaxRates` を取得する。
- 売上明細には適用した税率と税額を保存する。
- 税率変更は既存レコードの更新ではなく、`TaxRates` の追加で表現する。
- 初回 `ValidFrom` より前の日付では、適用できる税率が存在しないものとして扱う。
- 同じ税率値でも `TaxCategory` が異なれば同一視しない。
- 非課税と免税の税率値は `0.0000` として扱う。
- 旧標準税率は標準税率の単なる過去履歴ではなく、会計集計上区別するため `OLD_STANDARD` として明示的に扱う。

## 適用税率取得

```sql
select *
from TaxRates
where TaxCategory = @taxCategory
  and ValidFrom <= @salesDate
order by ValidFrom desc
fetch first 1 rows only;
```

SQLite で確認する場合は `limit 1` に読み替える。

## テスト観点

- 売上日以前で一番新しい税率を取得できる。
- 税区分ごとに税率を取得できる。
- 初回 `ValidFrom` より前の日付では税率が取得できない。
- 税率変更後も、登録済み売上明細の税率と税額は変わらない。
- 標準税率、軽減税率、非課税、免税、旧標準税率を登録できる。
- 同じ税率値でも、軽減税率 8% と旧標準税率 8% を別レコードとして登録できる。
