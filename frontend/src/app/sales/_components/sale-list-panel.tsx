import { LoaderCircle, RefreshCw, Search } from "lucide-react";
import type { CustomerSummary } from "@/app/customers/_types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils/cn";
import { formatSaleCorrectionSummary } from "../_list-state";
import {
  formatDate,
  formatDateTime,
  formatMoney,
  saleStatusLabels,
  type SaleListItem,
} from "../_types";

type SaleListPanelProps = {
  readonly sales: readonly SaleListItem[];
  readonly selectedSaleId: number | undefined;
  readonly isLoading: boolean;
  readonly salesDateFrom: string;
  readonly salesDateTo: string;
  readonly customerId: string;
  readonly customerCode: string;
  readonly includeCanceled: boolean;
  readonly includeCorrections: boolean;
  readonly customerOptions: readonly CustomerSummary[];
  readonly loadingCustomerOptions: boolean;
  readonly onSalesDateFromChange: (value: string) => void;
  readonly onSalesDateToChange: (value: string) => void;
  readonly onCustomerIdChange: (value: string) => void;
  readonly onCustomerCodeChange: (value: string) => void;
  readonly onIncludeCanceledChange: (value: boolean) => void;
  readonly onIncludeCorrectionsChange: (value: boolean) => void;
  readonly onSearch: () => void;
  readonly onReload: () => void;
  readonly onSelectSale: (saleId: number) => void;
};

export function SaleListPanel({
  sales,
  selectedSaleId,
  isLoading,
  salesDateFrom,
  salesDateTo,
  customerId,
  customerCode,
  includeCanceled,
  includeCorrections,
  customerOptions,
  loadingCustomerOptions,
  onSalesDateFromChange,
  onSalesDateToChange,
  onCustomerIdChange,
  onCustomerCodeChange,
  onIncludeCanceledChange,
  onIncludeCorrectionsChange,
  onSearch,
  onReload,
  onSelectSale,
}: SaleListPanelProps) {
  return (
    <section className="surface result-surface" aria-labelledby="sales-list-heading">
      <div
        className="search-bar search-bar-embedded"
        aria-labelledby="sales-search-heading"
      >
        <div className="search-bar-heading">
          <h2 id="sales-search-heading">売上検索</h2>
        </div>
        <div className="search-bar-fields">
          <label className="search-field">
            <span>売上日 From</span>
            <Input
              className="h-8 text-xs"
              onChange={(event) => onSalesDateFromChange(event.target.value)}
              type="date"
              value={salesDateFrom}
            />
          </label>
          <label className="search-field">
            <span>売上日 To</span>
            <Input
              className="h-8 text-xs"
              onChange={(event) => onSalesDateToChange(event.target.value)}
              type="date"
              value={salesDateTo}
            />
          </label>
          <label className="search-field">
            <span>得意先</span>
            <select
              aria-label="得意先"
              className="ui-input h-8 rounded-md border border-slate-300 bg-white px-3 text-xs"
              disabled={loadingCustomerOptions}
              onChange={(event) => onCustomerIdChange(event.target.value)}
              value={customerId}
            >
              <option value="">すべて</option>
              {customerOptions.map((customer) => (
                <option key={customer.customerId} value={customer.customerId}>
                  {customer.customerCode} / {customer.name}
                </option>
              ))}
            </select>
          </label>
          <label className="search-field">
            <span>得意先コード</span>
            <Input
              className="h-8 text-xs"
              onChange={(event) => onCustomerCodeChange(event.target.value)}
              value={customerCode}
            />
          </label>
          <label className="search-field search-field-checkbox">
            <span>取消済を含める</span>
            <input
              checked={includeCanceled}
              onChange={(event) => onIncludeCanceledChange(event.target.checked)}
              type="checkbox"
            />
          </label>
          <label className="search-field search-field-checkbox">
            <span>訂正売上を含める</span>
            <input
              checked={includeCorrections}
              onChange={(event) =>
                onIncludeCorrectionsChange(event.target.checked)
              }
              type="checkbox"
            />
          </label>
          <div className="search-actions">
            <Button className="h-8 px-2 text-xs" onClick={onSearch} type="button">
              <Search aria-hidden="true" className="size-4" />
              検索
            </Button>
            <Button
              className="h-8 px-2 text-xs"
              onClick={onReload}
              type="button"
              variant="secondary"
            >
              <RefreshCw aria-hidden="true" className="size-4" />
              再読込
            </Button>
          </div>
        </div>
      </div>

      <div className="result-heading">
        <div>
          <h2 id="sales-list-heading">売上一覧</h2>
          <p>行を選択すると右側に売上詳細を表示します。</p>
        </div>
        <Badge tone="neutral">{sales.length} 件</Badge>
      </div>

      {sales.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="data-table text-left">
            <thead>
              <tr>
                <th>売上番号</th>
                <th>売上日</th>
                <th>得意先コード</th>
                <th>得意先名</th>
                <th className="text-right">合計金額</th>
                <th>最新状態</th>
                <th>登録日時</th>
                <th>訂正関連</th>
              </tr>
            </thead>
            <tbody>
              {sales.map((sale) => (
                <tr
                  className={cn(
                    "cursor-pointer hover:bg-slate-50",
                    selectedSaleId === sale.saleId && "data-table-row-selected",
                  )}
                  key={sale.saleId}
                  onClick={() => onSelectSale(sale.saleId)}
                >
                  <td className="font-mono text-slate-700">{sale.saleId}</td>
                  <td>{formatDate(sale.salesDate)}</td>
                  <td className="font-mono text-slate-700">{sale.customerCode}</td>
                  <td className="font-semibold">{sale.customerName}</td>
                  <td className="text-right font-mono">
                    {formatMoney(sale.totalAmount)}
                  </td>
                  <td>{saleStatusLabels[sale.status]}</td>
                  <td>{formatDateTime(sale.createdAt)}</td>
                  <td>{formatSaleCorrectionSummary(sale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {isLoading ? (
        <p className="mt-4 flex items-center gap-2 text-sm font-semibold text-slate-600">
          <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
          読み込み中
        </p>
      ) : null}

      {!isLoading && sales.length === 0 ? (
        <div className="result-empty-state">
          <p>該当データなし</p>
          <span>検索条件を変更するか、新しい売上を登録してください。</span>
        </div>
      ) : null}
    </section>
  );
}
