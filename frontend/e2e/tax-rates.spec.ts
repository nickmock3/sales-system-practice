import { expect, test } from "@playwright/test";

const taxRates = [
  {
    taxCategory: "STANDARD",
    taxCategoryName: "標準税率",
    accountingCategory: "TAXABLE_STANDARD",
    rate: 0.1,
    effectiveFrom: "2026-06-01",
  },
  {
    taxCategory: "REDUCED",
    taxCategoryName: "軽減税率",
    accountingCategory: "TAXABLE_REDUCED",
    rate: 0.08,
    effectiveFrom: "2026-06-01",
  },
  {
    taxCategory: "OLD_STANDARD",
    taxCategoryName: "旧標準税率",
    accountingCategory: "TAXABLE_OLD_STANDARD",
    rate: 0.08,
    effectiveFrom: "2026-06-01",
  },
];

const standardChanges = [
  {
    taxCategory: "STANDARD",
    taxCategoryName: "標準税率",
    accountingCategory: "TAXABLE_STANDARD",
    rate: 0.1,
    effectiveFrom: "2026-06-01",
  },
  {
    taxCategory: "STANDARD",
    taxCategoryName: "標準税率",
    accountingCategory: "TAXABLE_STANDARD",
    rate: 0.07,
    effectiveFrom: "2026-05-01",
  },
];

const pastStandardSummary = {
  taxCategory: "STANDARD",
  taxCategoryName: "標準税率",
  accountingCategory: "TAXABLE_STANDARD",
  rate: 0.07,
  effectiveFrom: "2026-05-01",
};

test("税率マスタ画面で一覧、履歴、指定日参照を確認できる", async ({ page }) => {
  await page.route("**/api/tax-rates", async (route) => {
    await route.fulfill({ json: taxRates });
  });
  await page.route("**/api/tax-rates/STANDARD/changes", async (route) => {
    await route.fulfill({ json: standardChanges });
  });
  await page.route("**/api/tax-rates/REDUCED/changes", async (route) => {
    await route.fulfill({ json: [taxRates[1]] });
  });
  await page.route("**/api/tax-rates/OLD_STANDARD/changes", async (route) => {
    await route.fulfill({ json: [taxRates[2]] });
  });
  await page.route("**/api/tax-rates/STANDARD?asOf=**", async (route) => {
    await route.fulfill({ json: pastStandardSummary });
  });
  await page.route("**/api/tax-rates/REDUCED?asOf=**", async (route) => {
    await route.fulfill({ json: taxRates[1] });
  });
  await page.route("**/api/tax-rates/OLD_STANDARD?asOf=**", async (route) => {
    await route.fulfill({ json: taxRates[2] });
  });

  await page.goto("/tax-rates");

  await expect(page.getByRole("heading", { name: "税率マスタ" })).toBeVisible();
  await expect(
    page.getByRole("cell", { name: "STANDARD", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("10%").first()).toBeVisible();
  await expect(page.getByRole("cell", { name: "REDUCED" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "OLD_STANDARD" })).toBeVisible();
  await expect(page.getByText("TaxRateId")).not.toBeVisible();

  await page.getByRole("cell", { name: "STANDARD", exact: true }).click();
  await expect(
    page.getByRole("region", { name: "変更履歴" }).getByRole("cell", {
      name: "7%",
    }),
  ).toBeVisible();

  const asOfRegion = page.getByRole("region", { name: "指定日時点の税率" });
  await asOfRegion.getByLabel("参照日").fill("2026-05-15");
  await asOfRegion.getByRole("button", { name: "参照" }).click();
  await expect(asOfRegion.getByText("7%")).toBeVisible();
});

test("税率の初回登録と変更後に一覧と変更履歴を更新できる", async ({ page }) => {
  let currentTaxRates = [...taxRates];
  let currentStandardChanges = [...standardChanges];

  await page.route("**/api/tax-rates", async (route) => {
    if (route.request().method() === "POST") {
      await route.continue();
      return;
    }

    await route.fulfill({ json: currentTaxRates });
  });
  await page.route("**/api/tax-rates/NON_TAXABLE/changes", async (route) => {
    if (route.request().method() === "POST") {
      const created = {
        taxCategory: "NON_TAXABLE",
        taxCategoryName: "非課税",
        accountingCategory: "NON_TAXABLE",
        rate: 0,
        effectiveFrom: "2026-06-05",
      };
      currentTaxRates = [...currentTaxRates, created];
      await route.fulfill({ status: 200, json: created });
      return;
    }

    await route.fulfill({
      json: [
        {
          taxCategory: "NON_TAXABLE",
          taxCategoryName: "非課税",
          accountingCategory: "NON_TAXABLE",
          rate: 0,
          effectiveFrom: "2026-06-05",
        },
      ],
    });
  });
  await page.route("**/api/tax-rates/STANDARD/changes", async (route) => {
    if (route.request().method() === "POST") {
      const changed = {
        ...taxRates[0],
        rate: 0.11,
        effectiveFrom: "2026-06-10",
      };
      currentTaxRates = currentTaxRates.map((item) =>
        item.taxCategory === "STANDARD" ? changed : item,
      );
      currentStandardChanges = [changed, ...currentStandardChanges];
      await route.fulfill({ status: 200, json: changed });
      return;
    }

    await route.fulfill({ json: currentStandardChanges });
  });
  await page.route("**/api/tax-rates/REDUCED/changes", async (route) => {
    await route.fulfill({ json: [taxRates[1]] });
  });
  await page.route("**/api/tax-rates/OLD_STANDARD/changes", async (route) => {
    await route.fulfill({ json: [taxRates[2]] });
  });
  await page.route("**/api/tax-rates/STANDARD?asOf=**", async (route) => {
    await route.fulfill({
      json: currentTaxRates.find((item) => item.taxCategory === "STANDARD"),
    });
  });
  await page.route("**/api/tax-rates/REDUCED?asOf=**", async (route) => {
    await route.fulfill({ json: taxRates[1] });
  });
  await page.route("**/api/tax-rates/OLD_STANDARD?asOf=**", async (route) => {
    await route.fulfill({ json: taxRates[2] });
  });
  await page.route("**/api/tax-rates/NON_TAXABLE?asOf=**", async (route) => {
    await route.fulfill({
      json: currentTaxRates.find((item) => item.taxCategory === "NON_TAXABLE"),
    });
  });

  await page.goto("/tax-rates");

  const createRegion = page.getByRole("region", { name: "税率初回登録" });
  await createRegion.getByLabel("税区分").selectOption("NON_TAXABLE");
  await createRegion.getByLabel("適用開始日").fill("2026-06-05");
  await createRegion.getByRole("button", { name: "登録", exact: true }).click();

  await expect(page.getByText("税率を登録し、一覧を更新しました。")).toBeVisible();
  await expect(page.getByRole("cell", { name: "NON_TAXABLE" })).toBeVisible();

  await page.getByRole("cell", { name: "STANDARD", exact: true }).click();
  const changeRegion = page.getByRole("region", { name: "税率変更" });
  await changeRegion.getByLabel("税率 (%)").fill("11");
  await changeRegion.getByLabel("適用開始日").fill("2026-06-10");
  await changeRegion.getByRole("button", { name: "変更を登録" }).click();

  await expect(page.getByText("税率を変更し、一覧と変更履歴を更新しました。")).toBeVisible();
  await expect(page.getByText("11%").first()).toBeVisible();
});

test("同じ税率値でも軽減税率と旧標準税率を区別して表示できる", async ({ page }) => {
  await page.route("**/api/tax-rates", async (route) => {
    await route.fulfill({ json: taxRates });
  });
  await page.route("**/api/tax-rates/*/changes", async (route) => {
    const taxCategory = route
      .request()
      .url()
      .match(/tax-rates\/([^/]+)\/changes/)?.[1];
    const item = taxRates.find((rate) => rate.taxCategory === taxCategory);
    await route.fulfill({ json: item ? [item] : [] });
  });
  await page.route("**/api/tax-rates/*?asOf=**", async (route) => {
    const taxCategory = route.request().url().match(/tax-rates\/([^?]+)/)?.[1];
    const item = taxRates.find((rate) => rate.taxCategory === taxCategory);
    await route.fulfill({ json: item });
  });

  await page.goto("/tax-rates");

  await expect(page.getByRole("cell", { name: "軽減税率" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "旧標準税率" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "8%" }).first()).toBeVisible();
  await expect(page.getByRole("cell", { name: "8%" }).nth(1)).toBeVisible();
});

test("指定日参照のAPIエラーを表示できる", async ({ page }) => {
  await page.route("**/api/tax-rates", async (route) => {
    await route.fulfill({ json: taxRates });
  });
  await page.route("**/api/tax-rates/*/changes", async (route) => {
    const taxCategory = route
      .request()
      .url()
      .match(/tax-rates\/([^/]+)\/changes/)?.[1];
    const item = taxRates.find((rate) => rate.taxCategory === taxCategory);
    await route.fulfill({ json: item ? [item] : [] });
  });
  await page.route("**/api/tax-rates/STANDARD?asOf=**", async (route) => {
    await route.fulfill({
      status: 404,
      json: { message: "指定日時点で利用できる税率情報がありません。" },
    });
  });
  await page.route("**/api/tax-rates/REDUCED?asOf=**", async (route) => {
    await route.fulfill({ json: taxRates[1] });
  });
  await page.route("**/api/tax-rates/OLD_STANDARD?asOf=**", async (route) => {
    await route.fulfill({ json: taxRates[2] });
  });

  await page.goto("/tax-rates");
  const asOfRegion = page.getByRole("region", { name: "指定日時点の税率" });
  await asOfRegion.getByLabel("参照日").fill("2026-04-01");
  await asOfRegion.getByRole("button", { name: "参照" }).click();

  await expect(
    page.getByText("指定日時点で利用できる税率情報がありません。"),
  ).toBeVisible();
});

test("古い変更履歴のAPI応答が後から返っても表示しない", async ({ page }) => {
  const reducedChanges = [taxRates[1]];
  let resolveStandardChanges: (() => void) | undefined;

  await page.route("**/api/tax-rates", async (route) => {
    await route.fulfill({ json: taxRates });
  });
  await page.route("**/api/tax-rates/STANDARD/changes", async (route) => {
    await new Promise<void>((resolve) => {
      resolveStandardChanges = resolve;
    });
    await route.fulfill({ json: standardChanges });
  });
  await page.route("**/api/tax-rates/REDUCED/changes", async (route) => {
    await route.fulfill({ json: reducedChanges });
  });
  await page.route("**/api/tax-rates/OLD_STANDARD/changes", async (route) => {
    await route.fulfill({ json: [taxRates[2]] });
  });
  await page.route("**/api/tax-rates/STANDARD?asOf=**", async (route) => {
    await route.fulfill({ json: taxRates[0] });
  });
  await page.route("**/api/tax-rates/REDUCED?asOf=**", async (route) => {
    await route.fulfill({ json: taxRates[1] });
  });
  await page.route("**/api/tax-rates/OLD_STANDARD?asOf=**", async (route) => {
    await route.fulfill({ json: taxRates[2] });
  });

  await page.goto("/tax-rates");
  await expect.poll(() => Boolean(resolveStandardChanges)).toBe(true);

  await page.getByRole("cell", { name: "REDUCED" }).click();
  await expect(page.getByRole("cell", { name: "軽減税率" }).first()).toBeVisible();

  resolveStandardChanges?.();

  const historyRegion = page.getByRole("region", { name: "変更履歴" });
  await expect(historyRegion.getByRole("cell", { name: "7%" })).not.toBeVisible();
  await expect(historyRegion.getByRole("cell", { name: "軽減税率" })).toBeVisible();
});

test("古い指定日参照のAPI応答が後から返っても表示しない", async ({ page }) => {
  let releaseOldAsOf: (() => void) | undefined;

  await page.route("**/api/tax-rates", async (route) => {
    await route.fulfill({ json: taxRates });
  });
  await page.route("**/api/tax-rates/*/changes", async (route) => {
    const taxCategory = route
      .request()
      .url()
      .match(/tax-rates\/([^/]+)\/changes/)?.[1];
    const item = taxRates.find((rate) => rate.taxCategory === taxCategory);
    await route.fulfill({ json: item ? [item] : [] });
  });
  await page.route("**/api/tax-rates/STANDARD?asOf=**", async (route) => {
    await new Promise<void>((resolve) => {
      releaseOldAsOf = resolve;
    });
    await route.fulfill({ json: taxRates[0] });
  });
  await page.route("**/api/tax-rates/REDUCED?asOf=**", async (route) => {
    await route.fulfill({ json: taxRates[1] });
  });
  await page.route("**/api/tax-rates/OLD_STANDARD?asOf=**", async (route) => {
    await route.fulfill({ json: taxRates[2] });
  });

  await page.goto("/tax-rates");
  await expect.poll(() => Boolean(releaseOldAsOf)).toBe(true);

  await page.getByRole("cell", { name: "REDUCED" }).click();
  releaseOldAsOf?.();

  const asOfRegion = page.getByRole("region", { name: "指定日時点の税率" });
  await expect(asOfRegion.getByText("軽減税率")).toBeVisible();
  await expect(asOfRegion.getByText("標準税率")).not.toBeVisible();
});

test("税率変更後の一覧再読込に失敗しても変更履歴と指定日参照を更新する", async ({
  page,
}) => {
  let failReload = false;
  const changed = {
    ...taxRates[0],
    rate: 0.11,
    effectiveFrom: "2026-06-10",
  };
  const updatedChanges = [changed, ...standardChanges];

  await page.route("**/api/tax-rates", async (route) => {
    if (failReload) {
      await route.fulfill({
        status: 500,
        json: { message: "一覧の再読込に失敗しました。" },
      });
      return;
    }

    await route.fulfill({ json: taxRates });
  });
  await page.route("**/api/tax-rates/STANDARD/changes", async (route) => {
    if (route.request().method() === "POST") {
      failReload = true;
      await route.fulfill({ status: 200, json: changed });
      return;
    }

    await route.fulfill({ json: failReload ? updatedChanges : standardChanges });
  });
  await page.route("**/api/tax-rates/REDUCED/changes", async (route) => {
    await route.fulfill({ json: [taxRates[1]] });
  });
  await page.route("**/api/tax-rates/OLD_STANDARD/changes", async (route) => {
    await route.fulfill({ json: [taxRates[2]] });
  });
  await page.route("**/api/tax-rates/STANDARD?asOf=**", async (route) => {
    await route.fulfill({ json: failReload ? changed : taxRates[0] });
  });
  await page.route("**/api/tax-rates/REDUCED?asOf=**", async (route) => {
    await route.fulfill({ json: taxRates[1] });
  });
  await page.route("**/api/tax-rates/OLD_STANDARD?asOf=**", async (route) => {
    await route.fulfill({ json: taxRates[2] });
  });

  await page.goto("/tax-rates");
  const changeRegion = page.getByRole("region", { name: "税率変更" });
  await changeRegion.getByLabel("税率 (%)").fill("11");
  await changeRegion.getByLabel("適用開始日").fill("2026-06-10");
  await changeRegion.getByRole("button", { name: "変更を登録" }).click();

  await expect(
    page.getByText("税率を変更しました。一覧の再読込に失敗しました。"),
  ).toBeVisible();
  await expect(page.getByText("一覧の再読込に失敗しました。", { exact: true })).toBeVisible();
  await expect(page.getByRole("cell", { name: "11%" })).toBeVisible();
  await expect(page.getByLabel("指定日時点の税率").getByText("11%")).toBeVisible();
});
