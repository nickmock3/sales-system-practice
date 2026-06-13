import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createSale,
  fetchSale,
  fetchSales,
  fetchSalesLinePreview,
} from "./_api";

const saleListItem = {
  saleId: 10,
  salesDate: "2026-04-15",
  customerId: 1,
  customerCode: "C001",
  customerName: "青山商事",
  totalAmount: 313.5,
  createdAt: "2026-04-15T02:30:00Z",
  status: "Active" as const,
  statusChangedAt: "2026-04-15T02:30:00Z",
  correctionType: null,
  originalSaleId: null,
  correctionSaleId: null,
  correctionReason: null,
};

const saleDetail = {
  saleDetailId: 20,
  productId: 2,
  productCode: "P002",
  productName: "ボールペン",
  unit: "本",
  taxCategory: "STANDARD" as const,
  taxCategoryName: "標準税率",
  accountingCategory: "TAXABLE_STANDARD" as const,
  quantity: 3,
  unitPrice: 95,
  unitPriceSource: "CUSTOMER_PRODUCT_PRICE" as const,
  isManualUnitPrice: false,
  autoUnitPrice: 95,
  manualUnitPriceReason: null,
  taxRate: 0.1,
  taxAmount: 28.5,
  amount: 285,
};

const saleResponse = {
  ...saleListItem,
  correctionCreatedBy: null,
  statusHistories: [
    {
      status: "Active" as const,
      reason: "売上登録",
      changedAt: "2026-04-15T02:30:00Z",
      changedBy: "admin1",
    },
  ],
  details: [saleDetail],
};

const linePreview = {
  productId: 2,
  productCode: "P002",
  productName: "ボールペン",
  unit: "本",
  autoUnitPrice: 95,
  unitPriceSource: "CUSTOMER_PRODUCT_PRICE" as const,
  taxCategory: "STANDARD" as const,
  taxCategoryName: "標準税率",
  accountingCategory: "TAXABLE_STANDARD" as const,
  taxRate: 0.1,
  isDiscontinued: false,
};

describe("sales api", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  // 売上一覧は検索条件をクエリに付与する
  it("fetchSales は検索条件をクエリに付与する", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify([saleListItem])));
    globalThis.fetch = fetchMock as typeof fetch;

    const result = await fetchSales({
      salesDateFrom: "2026-04-01",
      salesDateTo: "2026-04-30",
      customerId: 1,
      customerCode: "C001",
      includeCanceled: true,
      includeCorrections: true,
    });

    expect(result).toEqual([saleListItem]);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain(
      "salesDateFrom=2026-04-01",
    );
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain(
      "salesDateTo=2026-04-30",
    );
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("customerId=1");
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("customerCode=C001");
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("includeCanceled=true");
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain(
      "includeCorrections=true",
    );
  });

  // 売上詳細 API のレスポンスを検証する
  it("fetchSale は詳細レスポンスを返す", async () => {
    globalThis.fetch = vi.fn(async () => new Response(JSON.stringify(saleResponse))) as typeof fetch;

    const result = await fetchSale(10);

    expect(result.saleId).toBe(10);
    expect(result.details[0]?.productName).toBe("ボールペン");
  });

  // 明細入力補助 API のクエリを組み立てる
  it("fetchSalesLinePreview は line-preview を呼び出す", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(linePreview)));
    globalThis.fetch = fetchMock as typeof fetch;

    const result = await fetchSalesLinePreview("2026-04-15", 1, 2);

    expect(result.autoUnitPrice).toBe(95);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain(
      "/api/sales/line-preview?salesDate=2026-04-15&customerId=1&productId=2",
    );
  });

  // 売上登録 API にリクエスト body を送る
  it("createSale は POST body を送る", async () => {
    const fetchMock = vi.fn(async (_input, init) => {
      expect(init?.method).toBe("POST");
      expect(JSON.parse(String(init?.body))).toEqual({
        salesDate: "2026-04-15",
        customerId: 1,
        lines: [
          {
            productId: 2,
            quantity: 3,
            unitPrice: 95,
            manualUnitPriceReason: null,
          },
        ],
      });

      return new Response(JSON.stringify(saleResponse), { status: 201 });
    });
    globalThis.fetch = fetchMock as typeof fetch;

    const result = await createSale({
      salesDate: "2026-04-15",
      customerId: 1,
      lines: [
        {
          productId: 2,
          quantity: 3,
          unitPrice: 95,
          manualUnitPriceReason: null,
        },
      ],
    });

    expect(result.totalAmount).toBe(313.5);
  });
});
