import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { SaleResponse } from "../_types";
import { SaleDetailPanel } from "./sale-detail-panel";

const sale: SaleResponse = {
  saleId: 10,
  salesDate: "2026-04-15",
  customerId: 1,
  customerCode: "C-1001",
  customerName: "青山商事",
  totalAmount: 313.5,
  createdAt: "2026-04-15T02:30:00Z",
  status: "Active",
  statusChangedAt: "2026-04-15T02:30:00Z",
  correctionType: null,
  originalSaleId: null,
  correctionSaleId: null,
  correctionReason: null,
  correctionCreatedBy: null,
  statusHistories: [
    {
      status: "Active",
      reason: "売上登録",
      changedAt: "2026-04-15T02:30:00Z",
      changedBy: "admin1",
    },
  ],
  details: [
    {
      saleDetailId: 20,
      productId: 2,
      productCode: "P-2001",
      productName: "ボールペン",
      unit: "本",
      taxCategory: "STANDARD",
      taxCategoryName: "標準税率",
      accountingCategory: "TAXABLE_STANDARD",
      quantity: 3,
      unitPrice: 95,
      unitPriceSource: "CUSTOMER_PRODUCT_PRICE",
      isManualUnitPrice: false,
      autoUnitPrice: 95,
      manualUnitPriceReason: null,
      taxRate: 0.1,
      taxAmount: 28.5,
      amount: 285,
    },
  ],
};

describe("SaleDetailPanel", () => {
  // 売上詳細を表示する
  it("売上詳細を表示する", () => {
    render(
      <SaleDetailPanel
        errorMessage=""
        isLoading={false}
        sale={sale}
      />,
    );

    expect(screen.getByRole("heading", { name: "売上詳細" })).toBeInTheDocument();
    expect(screen.getByText("ボールペン")).toBeInTheDocument();
    expect(screen.getByText("得意先別商品単価")).toBeInTheDocument();
  });

  // 読み込み中はローディング表示を出す
  it("読み込み中はローディング表示を出す", () => {
    render(
      <SaleDetailPanel
        errorMessage=""
        isLoading
        sale={null}
      />,
    );

    expect(screen.getByText("詳細を読み込み中")).toBeInTheDocument();
  });

  // API エラーは role=alert で表示する
  it("API エラーは role=alert で表示する", () => {
    render(
      <SaleDetailPanel
        errorMessage="売上詳細の取得に失敗しました。"
        isLoading={false}
        sale={null}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "売上詳細の取得に失敗しました。",
    );
  });

  // 未選択時は空状態を表示する
  it("未選択時は空状態を表示する", () => {
    render(
      <SaleDetailPanel
        errorMessage=""
        isLoading={false}
        sale={null}
      />,
    );

    expect(screen.getByText("売上未選択")).toBeInTheDocument();
  });
});
