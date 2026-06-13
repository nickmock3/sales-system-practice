import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchCustomerProductPricePreviewComposed } from "./_api";

const previewCustomerProductPrice = {
  customerId: 1,
  customerCode: "C-1001",
  customerName: "青山商事",
  productId: 2,
  productCode: "P-2001",
  productName: "ボールペン",
  unit: "本",
  autoUnitPrice: 95,
  unitPriceSource: "CUSTOMER_PRODUCT_PRICE" as const,
  standardUnitPrice: 100,
  asOf: "2026-04-15",
};

const previewProductStandard = {
  ...previewCustomerProductPrice,
  autoUnitPrice: 100,
  unitPriceSource: "PRODUCT_STANDARD" as const,
};

const productAsOf = {
  productId: 2,
  productCode: "P-2001",
  name: "ボールペン",
  unit: "本",
  standardUnitPrice: 100,
  taxCategory: "STANDARD" as const,
  isDiscontinued: false,
  effectiveFrom: "2026-04-01",
};

const customerProductPriceAsOf = {
  customerId: 1,
  customerCode: "C-1001",
  customerName: "青山商事",
  productId: 2,
  productCode: "P-2001",
  productName: "ボールペン",
  unitPrice: 95,
  effectiveFrom: "2026-03-01",
  createdAt: "2026-03-01T00:00:00Z",
};

describe("fetchCustomerProductPricePreviewComposed", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  // CUSTOMER_PRODUCT_PRICE の場合は preview に加えて商品と得意先別単価の asOf を合成する
  it("CUSTOMER_PRODUCT_PRICE の適用開始日を合成する", async () => {
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes("/preview?")) {
        return new Response(JSON.stringify(previewCustomerProductPrice));
      }

      if (url.includes("/api/products/2?asOf=")) {
        return new Response(JSON.stringify(productAsOf));
      }

      if (url.includes("/api/customer-product-prices/1/2?asOf=")) {
        return new Response(JSON.stringify(customerProductPriceAsOf));
      }

      return new Response("not found", { status: 404 });
    }) as typeof fetch;

    const result = await fetchCustomerProductPricePreviewComposed(
      1,
      2,
      "2026-04-15",
    );

    expect(result.customerProductPriceEffectiveFrom).toBe("2026-03-01");
    expect(result.productEffectiveFrom).toBe("2026-04-01");
    expect(result.unitPriceSource).toBe("CUSTOMER_PRODUCT_PRICE");
  });

  // PRODUCT_STANDARD の場合は得意先別単価の適用開始日を null にする
  it("PRODUCT_STANDARD では得意先別単価の適用開始日を null にする", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes("/preview?")) {
        return new Response(JSON.stringify(previewProductStandard));
      }

      if (url.includes("/api/products/2?asOf=")) {
        return new Response(JSON.stringify(productAsOf));
      }

      return new Response("not found", { status: 404 });
    });
    globalThis.fetch = fetchMock as typeof fetch;

    const result = await fetchCustomerProductPricePreviewComposed(
      1,
      2,
      "2026-04-15",
    );

    expect(result.customerProductPriceEffectiveFrom).toBeNull();
    expect(result.productEffectiveFrom).toBe("2026-04-01");
    expect(
      fetchMock.mock.calls.some(([url]) =>
        String(url).includes("/api/customer-product-prices/1/2?asOf="),
      ),
    ).toBe(false);
  });
});
