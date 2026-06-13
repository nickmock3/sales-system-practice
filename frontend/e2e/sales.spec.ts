import { expect, test } from "@playwright/test";

const customers = [
  {
    customerId: 1,
    customerCode: "C-1001",
    name: "青山商事",
    address: "東京都港区北青山1-1-1",
    phoneNumber: "03-1111-2222",
    effectiveFrom: "2026-06-01",
  },
  {
    customerId: 2,
    customerCode: "C-2001",
    name: "渋谷産業",
    address: "東京都渋谷区渋谷2-2-2",
    phoneNumber: "03-3333-4444",
    effectiveFrom: "2026-06-02",
  },
];

const products = [
  {
    productId: 1,
    productCode: "P-1001",
    name: "コピー用紙 A4",
    unit: "箱",
    standardUnitPrice: 1200,
    taxCategory: "STANDARD",
    isDiscontinued: false,
    effectiveFrom: "2026-06-01",
  },
  {
    productId: 2,
    productCode: "P-2001",
    name: "ボールペン",
    unit: "本",
    standardUnitPrice: 100,
    taxCategory: "STANDARD",
    isDiscontinued: false,
    effectiveFrom: "2026-06-01",
  },
];

const previewCustomerProductPrice = {
  productId: 2,
  productCode: "P-2001",
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

const previewProductStandard = {
  ...previewCustomerProductPrice,
  autoUnitPrice: 100,
  unitPriceSource: "PRODUCT_STANDARD",
};

const saleDetailBase = {
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
};

const createSaleDetail = (
  saleId: number,
  overrides: {
    readonly customerId?: number;
    readonly unitPrice?: number;
    readonly unitPriceSource?: "CUSTOMER_PRODUCT_PRICE" | "PRODUCT_STANDARD";
    readonly isManualUnitPrice?: boolean;
    readonly manualUnitPriceReason?: string | null;
    readonly autoUnitPrice?: number;
  } = {},
) => ({
  ...saleDetailBase,
  saleId,
  customerId: overrides.customerId ?? 1,
  customerCode: overrides.customerId === 2 ? "C-2001" : "C-1001",
  customerName: overrides.customerId === 2 ? "渋谷産業" : "青山商事",
  details: [
    {
      saleDetailId: saleId * 10,
      productId: 2,
      productCode: "P-2001",
      productName: "ボールペン",
      unit: "本",
      taxCategory: "STANDARD",
      taxCategoryName: "標準税率",
      accountingCategory: "TAXABLE_STANDARD",
      quantity: 3,
      unitPrice: overrides.unitPrice ?? 95,
      unitPriceSource: overrides.unitPriceSource ?? "CUSTOMER_PRODUCT_PRICE",
      isManualUnitPrice: overrides.isManualUnitPrice ?? false,
      autoUnitPrice: overrides.autoUnitPrice ?? 95,
      manualUnitPriceReason: overrides.manualUnitPriceReason ?? null,
      taxRate: 0.1,
      taxAmount: 28.5,
      amount: 285,
    },
  ],
});

const createSaleListItem = (saleId: number, customerId = 1) => ({
  saleId,
  salesDate: "2026-04-15",
  customerId,
  customerCode: customerId === 1 ? "C-1001" : "C-2001",
  customerName: customerId === 1 ? "青山商事" : "渋谷産業",
  totalAmount: 313.5,
  createdAt: "2026-04-15T02:30:00Z",
  status: "Active",
  statusChangedAt: "2026-04-15T02:30:00Z",
  correctionType: null,
  originalSaleId: null,
  correctionSaleId: null,
  correctionReason: null,
});

type SalesRouteOptions = {
  readonly initialSales?: ReturnType<typeof createSaleListItem>[];
  readonly linePreview?: typeof previewCustomerProductPrice;
  readonly failList?: boolean;
  readonly failDetail?: boolean;
};

const setupSalesRoutes = async (
  page: import("@playwright/test").Page,
  options: SalesRouteOptions = {},
) => {
  let currentSales = options.initialSales ?? [createSaleListItem(10)];
  let nextSaleId = 11;
  const saleDetails = new Map<number, ReturnType<typeof createSaleDetail>>(
    currentSales.map((sale) => [
      sale.saleId,
      createSaleDetail(sale.saleId, { customerId: sale.customerId }),
    ]),
  );

  await page.route("**/api/customers", async (route) => {
    await route.fulfill({ json: customers });
  });
  await page.route("**/api/products", async (route) => {
    await route.fulfill({ json: products });
  });
  await page.route("**/api/customers/1?asOf=**", async (route) => {
    await route.fulfill({ json: customers[0] });
  });
  await page.route("**/api/customers/2?asOf=**", async (route) => {
    await route.fulfill({ json: customers[1] });
  });
  await page.route("**/api/sales/line-preview**", async (route) => {
    await route.fulfill({
      json: options.linePreview ?? previewCustomerProductPrice,
    });
  });
  await page.route((url) => url.pathname === "/api/sales", async (route) => {
    if (options.failList && route.request().method() === "GET") {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ message: "売上一覧の取得に失敗しました。" }),
      });
      return;
    }

    if (route.request().method() === "POST") {
      const body = route.request().postDataJSON() as {
        lines: Array<{
          unitPrice: number;
          manualUnitPriceReason: string | null;
        }>;
      };
      const line = body.lines[0];
      const preview = options.linePreview ?? previewCustomerProductPrice;
      const isManual = line.unitPrice !== preview.autoUnitPrice;
      const saleId = nextSaleId;
      nextSaleId += 1;

      const detail = createSaleDetail(saleId, {
        unitPrice: line.unitPrice,
        unitPriceSource: preview.unitPriceSource as
          | "CUSTOMER_PRODUCT_PRICE"
          | "PRODUCT_STANDARD",
        isManualUnitPrice: isManual,
        manualUnitPriceReason: line.manualUnitPriceReason,
        autoUnitPrice: preview.autoUnitPrice,
      });
      saleDetails.set(saleId, detail);
      currentSales = [createSaleListItem(saleId), ...currentSales];

      await route.fulfill({ status: 201, json: detail });
      return;
    }

    const url = new URL(route.request().url());
    const customerId = url.searchParams.get("customerId");
    const customerCode = url.searchParams.get("customerCode") ?? "";

    await route.fulfill({
      json: currentSales.filter((sale) => {
        const matchesCustomerId =
          customerId === null || String(sale.customerId) === customerId;
        const matchesCustomerCode =
          customerCode.length === 0 || sale.customerCode.includes(customerCode);
        return matchesCustomerId && matchesCustomerCode;
      }),
    });
  });
  await page.route(
    (url) => /^\/api\/sales\/\d+$/.test(url.pathname),
    async (route) => {
    if (options.failDetail) {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ message: "売上詳細の取得に失敗しました。" }),
      });
      return;
    }

    const saleId = Number(route.request().url().split("/").pop());
    const detail = saleDetails.get(saleId) ?? createSaleDetail(saleId);
    await route.fulfill({ json: detail });
    },
  );

  return {
    getCurrentSales: () => currentSales,
  };
};

const entrySection = (page: import("@playwright/test").Page) =>
  page.locator('section[aria-labelledby="entry-heading"]');

const fillEntryHeader = async (
  page: import("@playwright/test").Page,
  customerId = "1",
) => {
  const entry = entrySection(page);
  await entry.getByLabel("売上日").fill("2026-04-15");
  await entry.getByLabel("得意先", { exact: true }).selectOption(customerId);
};

const selectProductAndQuantity = async (
  page: import("@playwright/test").Page,
  productId = "2",
  quantity = "3",
) => {
  const line = page.getByTestId("sale-line-0");
  await line.locator("select").selectOption(productId);
  await expect(line.getByText("得意先別商品単価")).toBeVisible();
  await line.getByLabel("数量").fill(quantity);
};

test("得意先別商品単価で売上登録し詳細を確認できる", async ({ page }) => {
  await setupSalesRoutes(page);
  await page.goto("/sales");

  await expect(
    page.getByRole("heading", { name: "売上", exact: true }),
  ).toBeVisible();
  await fillEntryHeader(page);
  await selectProductAndQuantity(page);
  await entrySection(page).getByRole("button", { name: "売上を登録" }).click();

  await expect(page.getByText("売上 11 を登録しました。")).toBeVisible();
  const detailPanel = page.locator('section[aria-labelledby="sales-detail-heading"]');
  await expect(detailPanel.getByText("得意先別商品単価")).toBeVisible();
  await expect(detailPanel.getByText("ボールペン")).toBeVisible();
  await expect(
    page.getByRole("cell", { name: "11", exact: true }),
  ).toBeVisible();
});

test("商品標準単価フォールバックをプレビューと詳細で確認できる", async ({
  page,
}) => {
  await setupSalesRoutes(page, { linePreview: previewProductStandard });
  await page.goto("/sales");

  await fillEntryHeader(page);
  const line = page.getByTestId("sale-line-0");
  await line.locator("select").selectOption("2");
  await expect(
    line.getByText("商品標準単価（フォールバック）"),
  ).toBeVisible();

  await line.getByLabel("数量").fill("3");
  await entrySection(page).getByRole("button", { name: "売上を登録" }).click();

  const detailPanel = page.locator('section[aria-labelledby="sales-detail-heading"]');
  await expect(
    detailPanel.getByText("商品標準単価（フォールバック）"),
  ).toBeVisible();
});

test("手入力単価の変更理由を登録詳細に反映できる", async ({ page }) => {
  await setupSalesRoutes(page);
  await page.goto("/sales");

  await fillEntryHeader(page);
  const line = page.getByTestId("sale-line-0");
  await line.locator("select").selectOption("2");
  await line.getByLabel("数量").fill("3");
  await line.getByLabel("入力単価").fill("120");
  await line.getByLabel("手入力変更理由").fill("特別値引");
  await entrySection(page).getByRole("button", { name: "売上を登録" }).click();

  const detailPanel = page.locator('section[aria-labelledby="sales-detail-heading"]');
  await expect(detailPanel.getByText("あり (特別値引)")).toBeVisible();
});

test("売上一覧の絞り込み後に詳細を表示できる", async ({ page }) => {
  await setupSalesRoutes(page, {
    initialSales: [createSaleListItem(10, 1), createSaleListItem(20, 2)],
  });
  await page.goto("/sales");

  const listSection = page.locator('section[aria-labelledby="sales-list-heading"]');
  await listSection.getByLabel("得意先", { exact: true }).selectOption("2");
  await listSection.getByRole("button", { name: "検索" }).click();

  await expect(
    listSection.getByRole("cell", { name: "20", exact: true }),
  ).toBeVisible();
  await expect(
    listSection.getByRole("cell", { name: "10", exact: true }),
  ).not.toBeVisible();

  await listSection.getByRole("cell", { name: "20", exact: true }).click();

  const detailPanel = page.locator('section[aria-labelledby="sales-detail-heading"]');
  await expect(detailPanel.getByText("渋谷産業")).toBeVisible();
  await expect(detailPanel.getByText("20", { exact: true })).toBeVisible();
});

test("売上 API エラーを画面に表示できる", async ({ page }) => {
  await setupSalesRoutes(page, { failList: true });
  await page.goto("/sales");

  await expect(
    page.getByRole("alert").filter({ hasText: "売上一覧の取得に失敗しました。" }),
  ).toBeVisible();
});

test("売上詳細 API エラーを画面に表示できる", async ({ page }) => {
  await setupSalesRoutes(page, { failDetail: true });
  await page.goto("/sales");

  await page
    .locator('section[aria-labelledby="sales-list-heading"]')
    .getByRole("cell", { name: "10", exact: true })
    .click();

  await expect(
    page
      .locator('section[aria-labelledby="sales-detail-heading"]')
      .getByRole("alert"),
  ).toContainText("売上詳細の取得に失敗しました。");
});

test("売上画面に内部履歴 ID を表示しない", async ({ page }) => {
  await setupSalesRoutes(page);
  await page.goto("/sales");

  await expect(page.getByText("customerVersionId")).not.toBeVisible();
  await expect(page.getByText("productVersionId")).not.toBeVisible();
  await expect(page.getByText("履歴ID")).not.toBeVisible();
});
