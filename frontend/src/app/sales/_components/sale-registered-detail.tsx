import { Badge } from "@/components/ui/badge";
import {
  accountingCategoryLabels,
  formatDate,
  formatDateTime,
  formatMoney,
  formatRatePercent,
  saleCorrectionTypeLabels,
  saleStatusLabels,
  taxCategoryLabels,
  unitPriceSourceLabels,
  type SaleResponse,
} from "../_types";

type SaleRegisteredDetailProps = {
  readonly sale: SaleResponse;
};

export function SaleRegisteredDetail({ sale }: SaleRegisteredDetailProps) {
  return (
    <div className="grid gap-4">
      <dl className="selected-summary-list">
        <dt>売上番号</dt>
        <dd className="font-mono">{sale.saleId}</dd>
        <dt>売上日</dt>
        <dd>{formatDate(sale.salesDate)}</dd>
        <dt>得意先コード</dt>
        <dd className="font-mono">{sale.customerCode}</dd>
        <dt>得意先名</dt>
        <dd>{sale.customerName}</dd>
        <dt>合計金額</dt>
        <dd>{formatMoney(sale.totalAmount)}</dd>
        <dt>状態</dt>
        <dd>
          <Badge tone={sale.status === "Active" ? "success" : "neutral"}>
            {saleStatusLabels[sale.status]}
          </Badge>
        </dd>
        <dt>登録日時</dt>
        <dd>{formatDateTime(sale.createdAt)}</dd>
        {sale.correctionType ? (
          <>
            <dt>訂正種別</dt>
            <dd>{saleCorrectionTypeLabels[sale.correctionType]}</dd>
          </>
        ) : null}
        {sale.correctionReason ? (
          <>
            <dt>訂正理由</dt>
            <dd>{sale.correctionReason}</dd>
          </>
        ) : null}
      </dl>

      <div>
        <h3 className="text-sm font-bold text-slate-800">登録明細</h3>
        <div className="mt-3 overflow-x-auto">
          <table className="data-table text-left">
            <thead>
              <tr>
                <th>商品コード</th>
                <th>商品名</th>
                <th>単位</th>
                <th className="text-right">数量</th>
                <th className="text-right">単価</th>
                <th>単価根拠</th>
                <th>手入力</th>
                <th>税区分</th>
                <th className="text-right">税率</th>
                <th className="text-right">金額</th>
                <th className="text-right">税額</th>
              </tr>
            </thead>
            <tbody>
              {sale.details.map((detail) => (
                <tr key={detail.saleDetailId}>
                  <td className="font-mono text-slate-700">{detail.productCode}</td>
                  <td className="font-semibold">{detail.productName}</td>
                  <td>{detail.unit}</td>
                  <td className="text-right font-mono">{detail.quantity}</td>
                  <td className="text-right font-mono">
                    {formatMoney(detail.unitPrice)}
                  </td>
                  <td>{unitPriceSourceLabels[detail.unitPriceSource]}</td>
                  <td>
                    {detail.isManualUnitPrice ? (
                      <span>
                        あり
                        {detail.manualUnitPriceReason
                          ? ` (${detail.manualUnitPriceReason})`
                          : ""}
                      </span>
                    ) : (
                      "なし"
                    )}
                  </td>
                  <td>
                    {detail.taxCategoryName} (
                    {taxCategoryLabels[detail.taxCategory]} /{" "}
                    {accountingCategoryLabels[detail.accountingCategory]})
                  </td>
                  <td className="text-right font-mono">
                    {formatRatePercent(detail.taxRate)}
                  </td>
                  <td className="text-right font-mono">
                    {formatMoney(detail.amount)}
                  </td>
                  <td className="text-right font-mono">
                    {formatMoney(detail.taxAmount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-bold text-slate-800">状態履歴</h3>
        <div className="mt-3 overflow-x-auto">
          <table className="data-table text-left">
            <thead>
              <tr>
                <th>状態</th>
                <th>理由</th>
                <th>変更日時</th>
                <th>変更者</th>
              </tr>
            </thead>
            <tbody>
              {sale.statusHistories.map((history, index) => (
                <tr key={`${history.changedAt}-${index}`}>
                  <td>{saleStatusLabels[history.status]}</td>
                  <td>{history.reason}</td>
                  <td>{formatDateTime(history.changedAt)}</td>
                  <td className="font-mono">{history.changedBy}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
