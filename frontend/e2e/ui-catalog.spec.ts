import { expect, test } from "@playwright/test";

test("UI カタログで共通 UI の表示パターンを確認できる", async ({ page }) => {
  await page.goto("/ui-catalog");

  await expect(page.getByRole("heading", { name: "UI カタログ" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Tables" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Forms" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Feedback" })).toBeVisible();
  await expect(page.getByRole("button", { name: "登録" })).toBeVisible();
  await expect(page.getByText("標準単価は 0 円以上で入力してください。")).toBeVisible();
  await expect(page.getByText("通信できません")).toBeVisible();
  await expect(page.getByText("読み込み中")).toBeVisible();
  await expect(page.getByText("該当データなし")).toBeVisible();
  await expect(page.getByText("認証が必要な API ではエラーを表示します。")).toBeVisible();
});
