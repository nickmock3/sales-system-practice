import { expect, test } from "@playwright/test";

const products = [
  {
    productId: 1,
    productCode: "P-1001",
    name: "標準デスク",
    unit: "台",
    standardUnitPrice: 48000,
    taxCategory: "STANDARD",
    isDiscontinued: false,
    effectiveFrom: "2026-06-01",
  },
];

const pastProductSummary = {
  productId: 1,
  productCode: "P-1001",
  name: "旧標準デスク",
  unit: "台",
  standardUnitPrice: 45000,
  taxCategory: "STANDARD",
  isDiscontinued: false,
  effectiveFrom: "2026-05-01",
};

const changes = [
  {
    effectiveFrom: "2026-06-01",
    name: "標準デスク",
    unit: "台",
    standardUnitPrice: 48000,
    taxCategory: "STANDARD",
    isDiscontinued: false,
  },
  {
    effectiveFrom: "2026-05-01",
    name: "旧標準デスク",
    unit: "台",
    standardUnitPrice: 45000,
    taxCategory: "STANDARD",
    isDiscontinued: false,
  },
];

test("商品マスタ画面で一覧、詳細、変更履歴、指定日参照を確認できる", async ({ page }) => {
  await page.route("**/api/products", async (route) => {
    await route.fulfill({ json: products });
  });
  await page.route("**/api/products/1/changes", async (route) => {
    await route.fulfill({ json: changes });
  });
  await page.route("**/api/products/1?asOf=**", async (route) => {
    await route.fulfill({ json: pastProductSummary });
  });

  await page.goto("/products");

  await expect(page.getByRole("heading", { name: "商品マスタ" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "P-1001" })).toBeVisible();
  await expect(page.getByText("標準デスク").first()).toBeVisible();
  await expect(page.getByText("48,000 円").first()).toBeVisible();
  await expect(
    page.getByRole("region", { name: "変更履歴" }).getByRole("cell", {
      name: "旧標準デスク",
    }),
  ).toBeVisible();
  await expect(page.getByText("履歴ID")).not.toBeVisible();
  await expect(page.getByText("productVersionId")).not.toBeVisible();
  await expect(page.getByRole("link", { name: "得意先別商品単価でこの商品を確認" }))
    .toHaveAttribute("href", "/customer-product-prices?productId=1");

  const asOfRegion = page.getByRole("region", { name: "指定日時点の商品情報" });
  await asOfRegion.getByLabel("参照日").fill("2026-05-15");
  await asOfRegion.getByRole("button", { name: "参照" }).click();
  await expect(asOfRegion.getByText("旧標準デスク")).toBeVisible();
});

test("商品登録と情報変更後に一覧と変更履歴を更新できる", async ({ page }) => {
  let currentProducts = [...products];
  let currentChanges = [...changes];

  await page.route("**/api/products", async (route) => {
    if (route.request().method() === "POST") {
      const created = {
        productId: 2,
        productCode: "P-2001",
        name: "会議チェア",
        unit: "脚",
        standardUnitPrice: 12000,
        taxCategory: "STANDARD",
        isDiscontinued: false,
        effectiveFrom: "2026-06-05",
      };
      currentProducts = [...currentProducts, created];
      await route.fulfill({ status: 201, json: created });
      return;
    }

    await route.fulfill({ json: currentProducts });
  });

  await page.route("**/api/products/1/changes", async (route) => {
    if (route.request().method() === "POST") {
      const changed = {
        ...products[0],
        standardUnitPrice: 50000,
        effectiveFrom: "2026-06-10",
      };
      currentProducts = [changed, ...currentProducts.slice(1)];
      currentChanges = [
        {
          effectiveFrom: "2026-06-10",
          name: "標準デスク",
          unit: "台",
          standardUnitPrice: 50000,
          taxCategory: "STANDARD",
          isDiscontinued: false,
        },
        ...currentChanges,
      ];
      await route.fulfill({ status: 200, json: changed });
      return;
    }

    await route.fulfill({ json: currentChanges });
  });

  await page.route("**/api/products/2/changes", async (route) => {
    await route.fulfill({
      json: [
        {
          effectiveFrom: "2026-06-05",
          name: "会議チェア",
          unit: "脚",
          standardUnitPrice: 12000,
          taxCategory: "STANDARD",
          isDiscontinued: false,
        },
      ],
    });
  });
  await page.route("**/api/products/1?asOf=**", async (route) => {
    await route.fulfill({ json: currentProducts[0] });
  });
  await page.route("**/api/products/2?asOf=**", async (route) => {
    await route.fulfill({ json: currentProducts[1] });
  });

  await page.goto("/products");

  const createRegion = page.getByRole("region", { name: "商品新規登録" });
  await createRegion.getByLabel("商品コード").fill("P-2001");
  await createRegion.getByLabel("商品名").fill("会議チェア");
  await createRegion.getByLabel("単位").fill("脚");
  await createRegion.getByLabel("標準単価").fill("12000");
  await createRegion.getByRole("button", { name: "登録", exact: true }).click();

  await expect(page.getByText("商品を登録し、一覧を更新しました。")).toBeVisible();
  await expect(page.getByRole("cell", { name: "P-2001" })).toBeVisible();

  await page.getByRole("cell", { name: "P-1001" }).click();
  const changeRegion = page.getByRole("region", { name: "商品情報変更" });
  await changeRegion.getByLabel("標準単価").fill("50000");
  await changeRegion.getByLabel("適用開始日").fill("2026-06-10");
  await changeRegion.getByRole("button", { name: "変更を登録" }).click();

  await expect(page.getByText("商品情報を変更し、一覧と変更履歴を更新しました。")).toBeVisible();
  await expect(page.getByText("50,000 円").first()).toBeVisible();
});

test("指定日参照のAPIエラーを表示できる", async ({ page }) => {
  await page.route("**/api/products", async (route) => {
    await route.fulfill({ json: products });
  });
  await page.route("**/api/products/1/changes", async (route) => {
    await route.fulfill({ json: changes });
  });
  await page.route("**/api/products/1?asOf=**", async (route) => {
    await route.fulfill({
      status: 404,
      json: { message: "指定日時点で利用できる商品情報がありません。" },
    });
  });

  await page.goto("/products");
  const asOfRegion = page.getByRole("region", { name: "指定日時点の商品情報" });
  await asOfRegion.getByLabel("参照日").fill("2026-04-01");
  await asOfRegion.getByRole("button", { name: "参照" }).click();

  await expect(page.getByText("指定日時点で利用できる商品情報がありません。")).toBeVisible();
});

test("古い変更履歴のAPI応答が後から返っても表示しない", async ({ page }) => {
  const secondProduct = {
    productId: 2,
    productCode: "P-2001",
    name: "会議チェア",
    unit: "脚",
    standardUnitPrice: 12000,
    taxCategory: "STANDARD",
    isDiscontinued: false,
    effectiveFrom: "2026-06-05",
  };
  let resolveFirstChanges: (() => void) | undefined;

  await page.route("**/api/products", async (route) => {
    await route.fulfill({ json: [...products, secondProduct] });
  });
  await page.route("**/api/products/1/changes", async (route) => {
    await new Promise<void>((resolve) => {
      resolveFirstChanges = resolve;
    });
    await route.fulfill({ json: changes });
  });
  await page.route("**/api/products/2/changes", async (route) => {
    await route.fulfill({
      json: [
        {
          effectiveFrom: "2026-06-05",
          name: "会議チェア 現行",
          unit: "脚",
          standardUnitPrice: 12000,
          taxCategory: "STANDARD",
          isDiscontinued: false,
        },
      ],
    });
  });
  await page.route("**/api/products/1?asOf=**", async (route) => {
    await route.fulfill({ json: products[0] });
  });
  await page.route("**/api/products/2?asOf=**", async (route) => {
    await route.fulfill({ json: secondProduct });
  });

  await page.goto("/products");
  await expect.poll(() => Boolean(resolveFirstChanges)).toBe(true);

  await page.getByRole("cell", { name: "P-2001" }).click();
  await expect(page.getByText("会議チェア 現行")).toBeVisible();

  resolveFirstChanges?.();

  await expect(page.getByText("旧標準デスク")).not.toBeVisible();
  await expect(page.getByText("会議チェア 現行")).toBeVisible();
});

test("古い指定日参照のAPI応答が後から返っても表示しない", async ({ page }) => {
  const secondProduct = {
    productId: 2,
    productCode: "P-2001",
    name: "会議チェア",
    unit: "脚",
    standardUnitPrice: 12000,
    taxCategory: "STANDARD",
    isDiscontinued: false,
    effectiveFrom: "2026-06-05",
  };
  let releaseOldAsOf: (() => void) | undefined;

  await page.route("**/api/products", async (route) => {
    await route.fulfill({ json: [...products, secondProduct] });
  });
  await page.route("**/api/products/1/changes", async (route) => {
    await route.fulfill({ json: changes });
  });
  await page.route("**/api/products/1?asOf=**", async (route) => {
    await new Promise<void>((resolve) => {
      releaseOldAsOf = resolve;
    });
    await route.fulfill({ json: products[0] });
  });
  await page.route("**/api/products/2/changes", async (route) => {
    await route.fulfill({
      json: [
        {
          effectiveFrom: "2026-06-05",
          name: "会議チェア",
          unit: "脚",
          standardUnitPrice: 12000,
          taxCategory: "STANDARD",
          isDiscontinued: false,
        },
      ],
    });
  });
  await page.route("**/api/products/2?asOf=**", async (route) => {
    await route.fulfill({ json: secondProduct });
  });

  await page.goto("/products");
  await expect.poll(() => Boolean(releaseOldAsOf)).toBe(true);

  await page.getByRole("cell", { name: "P-2001" }).click();
  releaseOldAsOf?.();

  const asOfRegion = page.getByRole("region", { name: "指定日時点の商品情報" });
  await expect(asOfRegion.getByText("会議チェア")).toBeVisible();
  await expect(asOfRegion.getByText("標準デスク")).not.toBeVisible();
});

test("情報変更後の一覧再読込に失敗しても変更履歴と指定日参照を更新する", async ({ page }) => {
  let failReload = false;
  const changed = {
    ...products[0],
    standardUnitPrice: 50000,
    effectiveFrom: "2026-06-10",
  };
  const updatedChanges = [
    {
      effectiveFrom: "2026-06-10",
      name: "標準デスク",
      unit: "台",
      standardUnitPrice: 50000,
      taxCategory: "STANDARD",
      isDiscontinued: false,
    },
    ...changes,
  ];

  await page.route("**/api/products", async (route) => {
    if (failReload) {
      await route.fulfill({
        status: 500,
        json: { message: "一覧の再読込に失敗しました。" },
      });
      return;
    }

    await route.fulfill({ json: products });
  });
  await page.route("**/api/products/1/changes", async (route) => {
    if (route.request().method() === "POST") {
      failReload = true;
      await route.fulfill({ status: 200, json: changed });
      return;
    }

    await route.fulfill({ json: failReload ? updatedChanges : changes });
  });
  await page.route("**/api/products/1?asOf=**", async (route) => {
    await route.fulfill({ json: failReload ? changed : products[0] });
  });

  await page.goto("/products");
  const changeRegion = page.getByRole("region", { name: "商品情報変更" });
  await changeRegion.getByLabel("標準単価").fill("50000");
  await changeRegion.getByLabel("適用開始日").fill("2026-06-10");
  await changeRegion.getByRole("button", { name: "変更を登録" }).click();

  await expect(page.getByText("商品情報を変更しました。一覧の再読込に失敗しました。")).toBeVisible();
  await expect(page.getByText("一覧の再読込に失敗しました。", { exact: true })).toBeVisible();
  await expect(page.getByRole("cell", { name: "50,000 円" })).toBeVisible();
  await expect(page.getByLabel("指定日時点の商品情報").getByText("50,000 円")).toBeVisible();
});
