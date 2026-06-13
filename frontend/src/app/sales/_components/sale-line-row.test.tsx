import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { applySalesLinePreview, createEmptySaleLineDraft } from "../_line-state";
import type { SalesLinePreview } from "../_types";
import { SaleLineRow } from "./sale-line-row";

const preview: SalesLinePreview = {
  productId: 2,
  productCode: "P002",
  productName: "ボールペン",
  unit: "本",
  autoUnitPrice: 95,
  unitPriceSource: "CUSTOMER_PRODUCT_PRICE",
  taxCategory: "STANDARD",
  taxCategoryName: "標準税率",
  accountingCategory: "TAXABLE_STANDARD",
  taxRate: 0.1,
  isDiscontinued: false,
};

describe("SaleLineRow", () => {
  // 手入力単価の場合はバッジと理由入力を有効化する
  it("手入力単価の場合は手入力バッジを表示する", () => {
    const line = {
      ...applySalesLinePreview(createEmptySaleLineDraft(), preview),
      quantity: "2",
      unitPrice: "100",
      previewError: "",
      loadingPreview: false,
    };

    render(
      <SaleLineRow
        fieldErrors={{}}
        index={0}
        line={line}
        loadingMasterOptions={false}
        onManualReasonChange={vi.fn()}
        onProductChange={vi.fn()}
        onQuantityChange={vi.fn()}
        onRefreshPreview={vi.fn()}
        onRemove={vi.fn()}
        onUnitPriceChange={vi.fn()}
        productOptions={[
          {
            productId: 2,
            productCode: "P002",
            name: "ボールペン",
            unit: "本",
            standardUnitPrice: 90,
            taxCategory: "STANDARD",
            isDiscontinued: false,
            effectiveFrom: "2026-01-01",
          },
        ]}
        removable
      />,
    );

    expect(screen.getByText("手入力単価")).toBeInTheDocument();
    expect(screen.getByLabelText("手入力変更理由")).toBeEnabled();
    expect(screen.getByText("あり")).toBeInTheDocument();
  });

  // stale 状態では再取得が必要バッジを表示する
  it("stale 状態では再取得バッジを表示する", () => {
    const line = {
      ...applySalesLinePreview(createEmptySaleLineDraft(), preview),
      previewStale: true,
      previewError: "",
      loadingPreview: false,
    };

    render(
      <SaleLineRow
        fieldErrors={{}}
        index={0}
        line={line}
        loadingMasterOptions={false}
        onManualReasonChange={vi.fn()}
        onProductChange={vi.fn()}
        onQuantityChange={vi.fn()}
        onRefreshPreview={vi.fn()}
        onRemove={vi.fn()}
        onUnitPriceChange={vi.fn()}
        productOptions={[]}
        removable={false}
      />,
    );

    expect(screen.getByText("再取得が必要")).toBeInTheDocument();
  });
});
