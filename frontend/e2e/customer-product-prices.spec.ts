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

const priceList = [
  {
    customerId: 1,
    customerCode: "C-1001",
    customerName: "青山商事",
    productId: 1,
    productCode: "P-1001",
    productName: "コピー用紙 A4",
    unitPrice: 1100,
    effectiveFrom: "2026-06-01",
    createdAt: "2026-06-01T00:00:00Z",
  },
  {
    customerId: 1,
    customerCode: "C-1001",
    customerName: "青山商事",
    productId: 2,
    productCode: "P-2001",
    productName: "ボールペン",
    unitPrice: 95,
    effectiveFrom: "2026-06-01",
    createdAt: "2026-06-01T00:00:00Z",
  },
];

const penChanges = [
  {
    unitPrice: 95,
    effectiveFrom: "2026-06-01",
    createdAt: "2026-06-01T00:00:00Z",
  },
  {
    unitPrice: 100,
    effectiveFrom: "2026-05-01",
    createdAt: "2026-05-01T00:00:00Z",
  },
];

const previewCustomerProductPrice = {
  customerId: 1,
  customerCode: "C-1001",
  customerName: "青山商事",
  productId: 2,
  productCode: "P-2001",
  productName: "ボールペン",
  unit: "本",
  autoUnitPrice: 95,
  unitPriceSource: "CUSTOMER_PRODUCT_PRICE",
  standardUnitPrice: 100,
  asOf: "2026-04-15",
};

const previewProductStandard = {
  ...previewCustomerProductPrice,
  autoUnitPrice: 100,
  unitPriceSource: "PRODUCT_STANDARD",
};

const productAsOf = {
  productId: 2,
  productCode: "P-2001",
  name: "ボールペン",
  unit: "本",
  standardUnitPrice: 100,
  taxCategory: "STANDARD",
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

const customerProductPriceListUrl =
  /\/api\/customer-product-prices(?:\?.*)?$/;

const setupCommonRoutes = async (
  page: import("@playwright/test").Page,
  options: {
    readonly prices?: typeof priceList;
    readonly penChangesData?: typeof penChanges;
  } = {},
) => {
  const currentPrices = options.prices ?? priceList;
  const currentPenChanges = options.penChangesData ?? penChanges;

  await page.route("**/api/customers", async (route) => {
    await route.fulfill({ json: customers });
  });
  await page.route("**/api/products", async (route) => {
    await route.fulfill({ json: products });
  });
  await page.route(customerProductPriceListUrl, async (route) => {
    if (route.request().method() === "POST") {
      await route.continue();
      return;
    }

    const url = new URL(route.request().url());
    const customerId = url.searchParams.get("customerId");
    const productId = url.searchParams.get("productId");
    const customerCode = url.searchParams.get("customerCode") ?? "";
    const productCode = url.searchParams.get("productCode") ?? "";

    await route.fulfill({
      json: currentPrices.filter((price) => {
        const matchesCustomerId =
          customerId === null || String(price.customerId) === customerId;
        const matchesProductId =
          productId === null || String(price.productId) === productId;
        const matchesCustomerCode =
          customerCode.length === 0
          || price.customerCode.includes(customerCode);
        const matchesProductCode =
          productCode.length === 0 || price.productCode.includes(productCode);
        return (
          matchesCustomerId
          && matchesProductId
          && matchesCustomerCode
          && matchesProductCode
        );
      }),
    });
  });
  await page.route("**/api/customer-product-prices/1/2/changes", async (route) => {
    if (route.request().method() === "POST") {
      await route.continue();
      return;
    }

    await route.fulfill({ json: currentPenChanges });
  });
  await page.route("**/api/customer-product-prices/1/1/changes", async (route) => {
    await route.fulfill({
      json: [
        {
          unitPrice: 1100,
          effectiveFrom: "2026-06-01",
          createdAt: "2026-06-01T00:00:00Z",
        },
      ],
    });
  });
};

test("得意先別商品単価画面で一覧、絞り込み、ディープリンクを確認できる", async ({
  page,
}) => {
  const requestedUrls: string[] = [];

  await setupCommonRoutes(page);

  await page.route(customerProductPriceListUrl, async (route) => {
    requestedUrls.push(route.request().url());
    const url = new URL(route.request().url());
    const customerId = url.searchParams.get("customerId");
    const productId = url.searchParams.get("productId");
    const productCode = url.searchParams.get("productCode") ?? "";

    await route.fulfill({
      json: priceList.filter((price) => {
        const matchesCustomerId =
          customerId === null || String(price.customerId) === customerId;
        const matchesProductId =
          productId === null || String(price.productId) === productId;
        const matchesProductCode =
          productCode.length === 0 || price.productCode.includes(productCode);
        return matchesCustomerId && matchesProductId && matchesProductCode;
      }),
    });
  });

  await page.goto("/customer-product-prices?customerId=1&productId=2");

  await expect(
    page.getByRole("heading", {
      name: "得意先別商品単価",
      exact: true,
    }),
  ).toBeVisible();
  const listRegion = page.getByRole("region", {
    name: "得意先別商品単価一覧",
  });
  await expect(listRegion.getByRole("cell", { name: "C-1001" })).toBeVisible();
  await expect(listRegion.getByRole("cell", { name: "P-2001" })).toBeVisible();
  await expect(page.getByText("CustomerProductPriceId")).not.toBeVisible();
  await expect(page.getByText("95").first()).toBeVisible();
  await expect(page.getByText("ボールペン").first()).toBeVisible();

  await page.getByLabel("商品 ID").fill("");
  await page.getByLabel("商品コード").fill("P-1001");
  await page.getByRole("button", { name: "検索" }).click();
  await expect(page.getByRole("cell", { name: "P-1001" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "P-2001" })).not.toBeVisible();
  expect(
    requestedUrls.some((url) => url.includes("customerId=1")),
  ).toBe(true);
});

test("初回登録と既存組み合わせの単価変更後に一覧と履歴を更新できる", async ({
  page,
}) => {
  let currentPrices = [...priceList];
  let currentPenChanges = [...penChanges];

  await setupCommonRoutes(page, {
    prices: currentPrices,
    penChangesData: currentPenChanges,
  });

  await page.route(customerProductPriceListUrl, async (route) => {
    if (route.request().method() === "POST") {
      const created = {
        customerId: 2,
        customerCode: "C-2001",
        customerName: "渋谷産業",
        productId: 2,
        productCode: "P-2001",
        productName: "ボールペン",
        unitPrice: 88,
        effectiveFrom: "2026-06-05",
        createdAt: "2026-06-05T00:00:00Z",
      };
      currentPrices = [...currentPrices, created];
      await route.fulfill({ status: 201, json: created });
      return;
    }

    await route.fulfill({ json: currentPrices });
  });

  await page.route("**/api/customer-product-prices/1/2/changes", async (route) => {
    if (route.request().method() === "POST") {
      const changed = {
        customerId: 1,
        customerCode: "C-1001",
        customerName: "青山商事",
        productId: 2,
        productCode: "P-2001",
        productName: "ボールペン",
        unitPrice: 90,
        effectiveFrom: "2026-06-10",
        createdAt: "2026-06-10T00:00:00Z",
      };
      currentPrices = currentPrices.map((price) =>
        price.customerId === 1 && price.productId === 2 ? changed : price,
      );
      currentPenChanges = [
        {
          unitPrice: 90,
          effectiveFrom: "2026-06-10",
          createdAt: "2026-06-10T00:00:00Z",
        },
        ...currentPenChanges,
      ];
      await route.fulfill({ status: 200, json: changed });
      return;
    }

    await route.fulfill({ json: currentPenChanges });
  });

  await page.goto("/customer-product-prices");

  const createRegion = page.getByRole("region", { name: "初回登録" });
  await createRegion.getByLabel("得意先").selectOption("2");
  await createRegion.getByLabel("商品").selectOption("2");
  await createRegion.getByLabel("単価").fill("88");
  await createRegion.getByLabel("適用開始日").fill("2026-06-05");
  await createRegion.getByRole("button", { name: "登録", exact: true }).click();

  await expect(
    page.getByText("得意先別商品単価を登録し、一覧を更新しました。"),
  ).toBeVisible();
  await expect(page.getByRole("cell", { name: "C-2001" })).toBeVisible();

  await page.getByRole("cell", { name: "P-2001" }).first().click();
  const changeRegion = page.getByRole("region", { name: "単価変更" });
  await changeRegion.getByLabel("単価").fill("90");
  await changeRegion.getByLabel("適用開始日").fill("2026-06-10");
  await changeRegion.getByRole("button", { name: "変更を登録" }).click();

  await expect(
    page.getByText("得意先別商品単価を変更し、一覧と変更履歴を更新しました。"),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "変更履歴" }).getByRole("cell", {
      name: "90",
    }),
  ).toBeVisible();
});

test("同じ適用開始日の重複登録エラーを表示できる", async ({ page }) => {
  await setupCommonRoutes(page);

  await page.route("**/api/customer-product-prices/1/2/changes", async (route) => {
    if (route.request().method() === "POST") {
      await route.fulfill({
        status: 409,
        json: { message: "同じ適用開始日の単価情報は既に登録されています。" },
      });
      return;
    }

    await route.fulfill({ json: penChanges });
  });

  await page.goto("/customer-product-prices");
  await page.getByRole("cell", { name: "P-2001" }).first().click();

  const changeRegion = page.getByRole("region", { name: "単価変更" });
  await changeRegion.getByLabel("単価").fill("92");
  await changeRegion.getByLabel("適用開始日").fill("2026-06-01");
  await changeRegion.getByRole("button", { name: "変更を登録" }).click();

  await expect(
    page.getByText("同じ適用開始日の単価情報は既に登録されています。"),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "得意先別商品単価",
      exact: true,
    }),
  ).toBeVisible();
});

test("変更履歴が適用開始日の新しい順で表示される", async ({ page }) => {
  await setupCommonRoutes(page);

  await page.goto("/customer-product-prices?customerId=1&productId=2");

  const historyRegion = page.getByRole("region", { name: "変更履歴" });
  await expect(
    historyRegion.getByRole("cell", { name: "95", exact: true }),
  ).toBeVisible();
  await expect(
    historyRegion.getByRole("cell", { name: "100", exact: true }),
  ).toBeVisible();
  await expect(historyRegion.getByText("C-1001").first()).toBeVisible();
  await expect(historyRegion.getByText("ボールペン").first()).toBeVisible();
});

test("指定日プレビューで得意先別商品単価を表示できる", async ({ page }) => {
  await setupCommonRoutes(page);

  await page.route("**/api/customer-product-prices/preview?**", async (route) => {
    await route.fulfill({ json: previewCustomerProductPrice });
  });
  await page.route("**/api/products/2?asOf=**", async (route) => {
    await route.fulfill({ json: productAsOf });
  });
  await page.route("**/api/customer-product-prices/1/2?asOf=**", async (route) => {
    await route.fulfill({ json: customerProductPriceAsOf });
  });

  await page.goto("/customer-product-prices?customerId=1&productId=2");

  const previewRegion = page.getByRole("region", {
    name: "指定日時点の自動取得単価",
  });
  await previewRegion.getByLabel("参照日").fill("2026-04-15");
  await previewRegion.getByRole("button", { name: "参照" }).click();

  await expect(
    previewRegion.getByText("得意先別商品単価", { exact: true }),
  ).toBeVisible();
  await expect(previewRegion.getByText("95").first()).toBeVisible();
  await expect(previewRegion.getByText("2026/03/01")).toBeVisible();
  await expect(previewRegion.getByText("2026/04/01")).toBeVisible();
});

test("指定日プレビューで商品標準単価へのフォールバックを表示できる", async ({
  page,
}) => {
  await setupCommonRoutes(page);

  await page.route("**/api/customer-product-prices/preview?**", async (route) => {
    await route.fulfill({ json: previewProductStandard });
  });
  await page.route("**/api/products/2?asOf=**", async (route) => {
    await route.fulfill({ json: productAsOf });
  });

  await page.goto("/customer-product-prices?customerId=1&productId=2");

  const previewRegion = page.getByRole("region", {
    name: "指定日時点の自動取得単価",
  });
  await previewRegion.getByLabel("参照日").fill("2026-04-15");
  await previewRegion.getByRole("button", { name: "参照" }).click();

  await expect(
    previewRegion.getByText("商品標準単価（フォールバック）"),
  ).toBeVisible();
  await expect(previewRegion.getByText("—")).toBeVisible();
  await expect(previewRegion.getByText("100").first()).toBeVisible();
});

test("一覧 API エラー後も画面を操作できる", async ({ page }) => {
  await page.route("**/api/customers", async (route) => {
    await route.fulfill({ json: customers });
  });
  await page.route("**/api/products", async (route) => {
    await route.fulfill({ json: products });
  });
  await page.route(customerProductPriceListUrl, async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 500,
        json: { message: "一覧取得に失敗しました。" },
      });
      return;
    }

    await route.continue();
  });

  await page.goto("/customer-product-prices");

  await expect(page.getByText("一覧取得に失敗しました。")).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "得意先別商品単価",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByRole("region", { name: "初回登録" })).toBeVisible();
});
