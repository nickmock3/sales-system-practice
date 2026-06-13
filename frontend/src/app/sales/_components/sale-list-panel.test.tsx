import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { CustomerSummary } from "@/app/customers/_types";
import type { SaleListItem } from "../_types";
import { SaleListPanel } from "./sale-list-panel";

const customers: CustomerSummary[] = [
  {
    customerId: 1,
    customerCode: "C-1001",
    name: "青山商事",
    address: "東京都港区",
    phoneNumber: "03-1111-2222",
    effectiveFrom: "2026-06-01",
  },
];

const sales: SaleListItem[] = [
  {
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
  },
];

const defaultProps = {
  sales,
  selectedSaleId: undefined as number | undefined,
  isLoading: false,
  salesDateFrom: "",
  salesDateTo: "",
  customerId: "",
  customerCode: "",
  includeCanceled: false,
  includeCorrections: false,
  customerOptions: customers,
  loadingCustomerOptions: false,
  onSalesDateFromChange: vi.fn(),
  onSalesDateToChange: vi.fn(),
  onCustomerIdChange: vi.fn(),
  onCustomerCodeChange: vi.fn(),
  onIncludeCanceledChange: vi.fn(),
  onIncludeCorrectionsChange: vi.fn(),
  onSearch: vi.fn(),
  onReload: vi.fn(),
  onSelectSale: vi.fn(),
};

describe("SaleListPanel", () => {
  // 売上一覧の検索条件とテーブル行を表示する
  it("売上一覧の検索条件とテーブル行を表示する", () => {
    render(<SaleListPanel {...defaultProps} />);

    expect(screen.getByRole("heading", { name: "売上検索" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "売上一覧" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "10" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "青山商事" })).toBeInTheDocument();
  });

  // 該当データがない場合は空状態を表示する
  it("該当データがない場合は空状態を表示する", () => {
    render(<SaleListPanel {...defaultProps} sales={[]} />);

    expect(screen.getByText("該当データなし")).toBeInTheDocument();
  });

  // 行選択で onSelectSale を呼び出す
  it("行選択で onSelectSale を呼び出す", async () => {
    const user = userEvent.setup();
    const onSelectSale = vi.fn();

    render(<SaleListPanel {...defaultProps} onSelectSale={onSelectSale} />);

    await user.click(screen.getByRole("cell", { name: "10" }));

    expect(onSelectSale).toHaveBeenCalledWith(10);
  });

  // 検索ボタンで onSearch を呼び出す
  it("検索ボタンで onSearch を呼び出す", async () => {
    const user = userEvent.setup();
    const onSearch = vi.fn();

    render(<SaleListPanel {...defaultProps} onSearch={onSearch} />);

    await user.click(screen.getByRole("button", { name: "検索" }));

    expect(onSearch).toHaveBeenCalledTimes(1);
  });
});
