import { LoaderCircle, RefreshCw, Trash2 } from "lucide-react";
import type { ProductSummary } from "@/app/products/_types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils/cn";
import {
  calculateSaleLineAmounts,
  type SaleLineAmounts,
} from "../_amounts";
import {
  getLineFieldError,
  isLineManualUnitPrice,
  type SaleLineEntryState,
} from "../_entry-state";
import {
  formatMoney,
  formatRatePercent,
  taxCategoryLabels,
  unitPriceSourceLabels,
} from "../_types";
import { FieldError } from "./field-error";

type SaleLineRowProps = {
  readonly fieldErrors: Record<string, string>;
  readonly index: number;
  readonly line: SaleLineEntryState;
  readonly loadingMasterOptions: boolean;
  readonly onManualReasonChange: (value: string) => void;
  readonly onProductChange: (productId: string) => void;
  readonly onQuantityChange: (value: string) => void;
  readonly onRefreshPreview: () => void;
  readonly onRemove: () => void;
  readonly onUnitPriceChange: (value: string) => void;
  readonly productOptions: readonly ProductSummary[];
  readonly removable: boolean;
};

export function SaleLineRow({
  fieldErrors,
  index,
  line,
  loadingMasterOptions,
  onManualReasonChange,
  onProductChange,
  onQuantityChange,
  onRefreshPreview,
  onRemove,
  onUnitPriceChange,
  productOptions,
  removable,
}: SaleLineRowProps) {
  const preview = line.preview;
  const manualUnitPrice = isLineManualUnitPrice(line);
  const amounts: SaleLineAmounts | null =
    preview && line.quantity && line.unitPrice
      ? calculateSaleLineAmounts({
          quantity: Number(line.quantity),
          unitPrice: Number(line.unitPrice),
          taxRate: preview.taxRate,
        })
      : null;

  const productError = getLineFieldError(fieldErrors, index, "productId");
  const quantityError = getLineFieldError(fieldErrors, index, "quantity");
  const unitPriceError = getLineFieldError(fieldErrors, index, "unitPrice");
  const reasonError = getLineFieldError(
    fieldErrors,
    index,
    "manualUnitPriceReason",
  );

  return (
    <article
      className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
      data-testid={`sale-line-${index}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-bold text-slate-800">明細 {index + 1}</h3>
          {line.previewStale ? (
            <Badge tone="warning">再取得が必要</Badge>
          ) : null}
          {line.previewError ? <Badge tone="danger">プレビューエラー</Badge> : null}
          {preview?.isDiscontinued ? (
            <Badge tone="danger">販売停止</Badge>
          ) : null}
          {manualUnitPrice ? <Badge tone="info">手入力単価</Badge> : null}
        </div>
        <div className="flex items-center gap-2">
          <Button
            disabled={!line.productId || line.loadingPreview}
            onClick={onRefreshPreview}
            type="button"
            variant="secondary"
          >
            {line.loadingPreview ? (
              <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
            ) : (
              <RefreshCw aria-hidden="true" className="size-4" />
            )}
            再取得
          </Button>
          <Button
            disabled={!removable}
            onClick={onRemove}
            type="button"
            variant="ghost"
          >
            <Trash2 aria-hidden="true" className="size-4" />
            削除
          </Button>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <label className="grid gap-1.5 text-sm font-semibold">
          商品
          <select
            className={cn(
              "ui-input h-10 rounded-md border bg-white px-3 text-sm",
              productError ? "border-red-500" : "border-slate-300",
            )}
            disabled={loadingMasterOptions}
            onChange={(event) => onProductChange(event.target.value)}
            value={line.productId}
          >
            <option value="">選択してください</option>
            {productOptions.map((product) => (
              <option key={product.productId} value={product.productId}>
                {product.productCode} / {product.name}
              </option>
            ))}
          </select>
          <FieldError message={productError} />
        </label>

        <label className="grid gap-1.5 text-sm font-semibold">
          数量
          <Input
            hasError={Boolean(quantityError)}
            inputMode="decimal"
            onChange={(event) => onQuantityChange(event.target.value)}
            value={line.quantity}
          />
          <FieldError message={quantityError} />
        </label>

        <label className="grid gap-1.5 text-sm font-semibold">
          入力単価
          <Input
            hasError={Boolean(unitPriceError)}
            inputMode="decimal"
            onChange={(event) => onUnitPriceChange(event.target.value)}
            value={line.unitPrice}
          />
          <FieldError message={unitPriceError} />
        </label>

        <label className="grid gap-1.5 text-sm font-semibold">
          手入力変更理由
          <Input
            disabled={!manualUnitPrice}
            hasError={Boolean(reasonError)}
            onChange={(event) => onManualReasonChange(event.target.value)}
            placeholder={manualUnitPrice ? "任意で入力" : "自動単価のため不要"}
            value={line.manualUnitPriceReason}
          />
          <FieldError message={reasonError} />
        </label>
      </div>

      {line.previewError ? (
        <p className="mt-3 text-sm font-semibold text-red-700">
          {line.previewError}
        </p>
      ) : null}

      {preview ? (
        <dl className="selected-summary-list mt-4">
          <dt>商品コード</dt>
          <dd className="font-mono">{preview.productCode}</dd>
          <dt>商品名</dt>
          <dd>{preview.productName}</dd>
          <dt>単位</dt>
          <dd>{preview.unit}</dd>
          <dt>自動取得単価</dt>
          <dd>{formatMoney(preview.autoUnitPrice)}</dd>
          <dt>単価根拠</dt>
          <dd>{unitPriceSourceLabels[preview.unitPriceSource]}</dd>
          <dt>税区分</dt>
          <dd>
            {preview.taxCategoryName} ({taxCategoryLabels[preview.taxCategory]})
          </dd>
          <dt>税率</dt>
          <dd>{formatRatePercent(preview.taxRate)}</dd>
          <dt>手入力変更有無</dt>
          <dd>{manualUnitPrice ? "あり" : "なし"}</dd>
          {amounts ? (
            <>
              <dt>明細金額</dt>
              <dd>{formatMoney(amounts.amount)}</dd>
              <dt>税額</dt>
              <dd>{formatMoney(amounts.taxAmount)}</dd>
              <dt>税込金額</dt>
              <dd>{formatMoney(amounts.totalWithTax)}</dd>
            </>
          ) : null}
        </dl>
      ) : (
        <div className="selected-empty mt-4">
          <p>プレビュー未取得</p>
          <span>商品を選択するか、再取得ボタンで単価と税率を確認します。</span>
        </div>
      )}
    </article>
  );
}
