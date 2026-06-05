import { expect, test } from "@playwright/test";

test("トップページで業務画面への入口を確認できる", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "販売管理システム" })).toBeVisible();
  await expect(page.getByRole("button", { name: "管理者" })).toBeVisible();
  await expect(page.getByRole("link", { name: "商品マスタ" })).toHaveAttribute(
    "href",
    "/products",
  );
  await expect(page.getByRole("link", { name: "UI カタログ" })).toHaveAttribute(
    "href",
    "/ui-catalog",
  );
});
