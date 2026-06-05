import { expect, test } from "@playwright/test";

const products = [
  {
    productId: 1,
    productCode: "P-1001",
    productVersionId: 11,
    name: "標準デスク",
    unit: "台",
    standardUnitPrice: 48000,
    taxCategory: "STANDARD",
    isDiscontinued: false,
    validFrom: "2026-06-01T00:00:00",
  },
];

const versions = [
  products[0],
  {
    ...products[0],
    productVersionId: 10,
    name: "旧標準デスク",
    standardUnitPrice: 45000,
    validFrom: "2026-05-01T00:00:00",
  },
];

test("商品マスタ画面で一覧、詳細、履歴を確認できる", async ({ page }) => {
  await page.route("**/api/products", async (route) => {
    await route.fulfill({ json: products });
  });
  await page.route("**/api/products/1/versions", async (route) => {
    await route.fulfill({ json: versions });
  });

  await page.goto("/products");

  await expect(page.getByRole("heading", { name: "商品マスタ" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "P-1001" })).toBeVisible();
  await expect(page.getByText("標準デスク").first()).toBeVisible();
  await expect(page.getByText("48,000 円").first()).toBeVisible();
  await expect(page.getByText("旧標準デスク")).toBeVisible();
  await expect(page.getByRole("link", { name: "得意先別商品単価でこの商品を確認" }))
    .toHaveAttribute("href", "/customer-product-prices?productId=1");
});

test("商品登録と履歴追加後に一覧と履歴を更新できる", async ({ page }) => {
  let currentProducts = [...products];
  let currentVersions = [...versions];

  await page.route("**/api/products", async (route) => {
    if (route.request().method() === "POST") {
      const created = {
        productId: 2,
        productCode: "P-2001",
        productVersionId: 20,
        name: "会議チェア",
        unit: "脚",
        standardUnitPrice: 12000,
        taxCategory: "STANDARD",
        isDiscontinued: false,
        validFrom: "2026-06-05T00:00:00",
      };
      currentProducts = [...currentProducts, created];
      await route.fulfill({ status: 201, json: created });
      return;
    }

    await route.fulfill({ json: currentProducts });
  });

  await page.route("**/api/products/1/versions", async (route) => {
    if (route.request().method() === "POST") {
      const added = {
        ...products[0],
        productVersionId: 12,
        standardUnitPrice: 50000,
        validFrom: "2026-06-10T00:00:00",
      };
      currentProducts = [added, ...currentProducts.slice(1)];
      currentVersions = [added, ...currentVersions];
      await route.fulfill({ status: 201, json: added });
      return;
    }

    await route.fulfill({ json: currentVersions });
  });

  await page.route("**/api/products/2/versions", async (route) => {
    await route.fulfill({ json: [currentProducts[1]] });
  });

  await page.goto("/products");

  const createRegion = page.getByRole("region", { name: "商品新規登録" });
  await createRegion.getByLabel("商品コード").fill("P-2001");
  await createRegion.getByLabel("商品名").fill("会議チェア");
  await createRegion.getByLabel("単位").fill("脚");
  await createRegion.getByLabel("標準単価").fill("12000");
  await page.getByRole("button", { name: "登録" }).click();

  await expect(page.getByText("商品を登録し、一覧を更新しました。")).toBeVisible();
  await expect(page.getByRole("cell", { name: "P-2001" })).toBeVisible();

  await page.getByRole("cell", { name: "P-1001" }).click();
  const versionRegion = page.getByRole("region", { name: "商品履歴追加" });
  await versionRegion.getByLabel("標準単価").fill("50000");
  await versionRegion.getByLabel("適用開始日").fill("2026-06-10");
  await versionRegion.getByRole("button", { name: "履歴追加" }).click();

  await expect(page.getByText("商品履歴を追加し、一覧と履歴を更新しました。")).toBeVisible();
  await expect(page.getByText("50,000 円").first()).toBeVisible();
});
