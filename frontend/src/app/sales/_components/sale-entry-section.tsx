"use client";

import { LoaderCircle, Plus, RefreshCw, Save } from "lucide-react";
import type { CustomerSummary } from "@/app/customers/_types";
import type { ProductSummary } from "@/app/products/_types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils/cn";
import { calculateSaleTotals } from "../_amounts";
import {
  collectLineAmountInputs,
  type SaleLineEntryState,
} from "../_entry-state";
import { formatDate, formatMoney } from "../_types";
import { FieldError } from "./field-error";
import { SaleLineRow } from "./sale-line-row";

type SaleHeaderState = {
  readonly salesDate: string;
  readonly customerId: string;
};

type SaleEntrySectionProps = {
  readonly header: SaleHeaderState;
  readonly lines: readonly SaleLineEntryState[];
  readonly customerOptions: readonly CustomerSummary[];
  readonly productOptions: readonly ProductSummary[];
  readonly loadingMasterOptions: boolean;
  readonly loadingCustomerAsOf: boolean;
  readonly customerAsOfItem?: CustomerSummary;
  readonly fieldErrors: Record<string, string>;
  readonly submitBlockReason: string | null;
  readonly isSubmitting: boolean;
  readonly onSalesDateChange: (salesDate: string) => void;
  readonly onCustomerChange: (customerId: string) => void;
  readonly onReloadCustomerAsOf: () => void;
  readonly onAddLine: () => void;
  readonly onProductChange: (clientLineId: string, productId: string) => void;
  readonly onQuantityChange: (clientLineId: string, value: string) => void;
  readonly onUnitPriceChange: (clientLineId: string, value: string) => void;
  readonly onManualReasonChange: (clientLineId: string, value: string) => void;
  readonly onRefreshPreview: (clientLineId: string) => void;
  readonly onRemoveLine: (clientLineId: string) => void;
  readonly onSubmit: () => void;
};

export function SaleEntrySection({
  header,
  lines,
  customerOptions,
  productOptions,
  loadingMasterOptions,
  loadingCustomerAsOf,
  customerAsOfItem,
  fieldErrors,
  submitBlockReason,
  isSubmitting,
  onSalesDateChange,
  onCustomerChange,
  onReloadCustomerAsOf,
  onAddLine,
  onProductChange,
  onQuantityChange,
  onUnitPriceChange,
  onManualReasonChange,
  onRefreshPreview,
  onRemoveLine,
  onSubmit,
}: SaleEntrySectionProps) {
  const totals = calculateSaleTotals(collectLineAmountInputs(lines));

  return (
    <section className="surface section-pad" aria-labelledby="entry-heading">
      <div className="section-heading">
        <h2 id="entry-heading">売上入力</h2>
        <p>売上日・得意先・明細を入力し、プレビューと金額を確認して登録します。</p>
      </div>

      <form
        className="grid gap-6"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1.5 text-sm font-semibold">
            売上日
            <Input
              hasError={Boolean(fieldErrors.salesDate)}
              onChange={(event) => onSalesDateChange(event.target.value)}
              type="date"
              value={header.salesDate}
            />
            <FieldError message={fieldErrors.salesDate} />
          </label>

          <label className="grid gap-1.5 text-sm font-semibold">
            得意先
            <select
              aria-label="得意先"
              className={cn(
                "ui-input h-10 rounded-md border bg-white px-3 text-sm",
                fieldErrors.customerId ? "border-red-500" : "border-slate-300",
              )}
              disabled={loadingMasterOptions}
              onChange={(event) => onCustomerChange(event.target.value)}
              value={header.customerId}
            >
              <option value="">選択してください</option>
              {customerOptions.map((customer) => (
                <option key={customer.customerId} value={customer.customerId}>
                  {customer.customerCode} / {customer.name}
                </option>
              ))}
            </select>
            <FieldError message={fieldErrors.customerId} />
          </label>
        </div>

        <section
          aria-labelledby="customer-asof-heading"
          className="rounded-lg border border-slate-200 bg-slate-50 p-4"
        >
          <div className="flex items-center justify-between gap-3">
            <h3
              className="text-sm font-bold text-slate-800"
              id="customer-asof-heading"
            >
              対象日時点の得意先
            </h3>
            <Button
              disabled={!header.customerId || loadingCustomerAsOf}
              onClick={onReloadCustomerAsOf}
              type="button"
              variant="secondary"
            >
              {loadingCustomerAsOf ? (
                <LoaderCircle
                  aria-hidden="true"
                  className="size-4 animate-spin"
                />
              ) : (
                <RefreshCw aria-hidden="true" className="size-4" />
              )}
              再取得
            </Button>
          </div>
          {customerAsOfItem ? (
            <dl className="selected-summary-list mt-3">
              <dt>対象日</dt>
              <dd>{formatDate(header.salesDate)}</dd>
              <dt>得意先コード</dt>
              <dd className="font-mono">{customerAsOfItem.customerCode}</dd>
              <dt>得意先名</dt>
              <dd>{customerAsOfItem.name}</dd>
              <dt>住所</dt>
              <dd>{customerAsOfItem.address}</dd>
            </dl>
          ) : (
            <div className="selected-empty mt-3">
              <p>得意先情報なし</p>
              <span>
                売上日と得意先を指定すると、その日時点の情報を表示します。
              </span>
            </div>
          )}
        </section>

        <div className="grid gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-800">明細</h3>
              <p className="text-xs font-medium text-slate-500">
                商品選択時にプレビューを取得します。売上日・得意先変更後は再取得が必要です。
              </p>
            </div>
            <Button onClick={onAddLine} type="button" variant="secondary">
              <Plus aria-hidden="true" className="size-4" />
              明細を追加
            </Button>
          </div>

          <div className="grid gap-4">
            {lines.map((line, index) => (
              <SaleLineRow
                fieldErrors={fieldErrors}
                index={index}
                key={line.clientLineId}
                line={line}
                loadingMasterOptions={loadingMasterOptions}
                onManualReasonChange={(value) =>
                  onManualReasonChange(line.clientLineId, value)
                }
                onProductChange={(productId) =>
                  onProductChange(line.clientLineId, productId)
                }
                onQuantityChange={(value) =>
                  onQuantityChange(line.clientLineId, value)
                }
                onRefreshPreview={() => onRefreshPreview(line.clientLineId)}
                onRemove={() => onRemoveLine(line.clientLineId)}
                onUnitPriceChange={(value) =>
                  onUnitPriceChange(line.clientLineId, value)
                }
                productOptions={productOptions}
                removable={lines.length > 1}
              />
            ))}
          </div>
        </div>

        <section
          aria-labelledby="totals-heading"
          className="rounded-lg border border-slate-200 bg-slate-50 p-4"
        >
          <h3 className="text-sm font-bold text-slate-800" id="totals-heading">
            伝票合計
          </h3>
          <dl className="selected-summary-list mt-3">
            <dt>明細金額合計</dt>
            <dd>{formatMoney(totals.amountTotal)}</dd>
            <dt>税額合計</dt>
            <dd>{formatMoney(totals.taxAmountTotal)}</dd>
            <dt>合計金額</dt>
            <dd className="text-base font-bold text-slate-900">
              {formatMoney(totals.totalAmount)}
            </dd>
          </dl>
        </section>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            disabled={
              isSubmitting
              || Boolean(submitBlockReason)
              || lines.some((line) => line.loadingPreview)
            }
            type="submit"
          >
            {isSubmitting ? (
              <LoaderCircle
                aria-hidden="true"
                className="size-4 animate-spin"
              />
            ) : (
              <Save aria-hidden="true" className="size-4" />
            )}
            売上を登録
          </Button>
          {submitBlockReason ? (
            <p className="text-sm font-medium text-slate-600">
              {submitBlockReason}
            </p>
          ) : null}
        </div>
      </form>
    </section>
  );
}
