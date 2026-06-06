import { expect, test } from "@playwright/test";

const customers = [
  {
    customerId: 1,
    customerCode: "C-1001",
    customerVersionId: 11,
    name: "青山商事",
    address: "東京都港区北青山1-1-1",
    phoneNumber: "03-1111-2222",
    validFrom: "2026-06-01T00:00:00",
  },
];

const secondCustomer = {
  customerId: 2,
  customerCode: "C-2001",
  customerVersionId: 21,
  name: "渋谷産業",
  address: "東京都渋谷区渋谷2-2-2",
  phoneNumber: "03-3333-4444",
  validFrom: "2026-06-02T00:00:00",
};

const versions = [
  customers[0],
  {
    ...customers[0],
    customerVersionId: 10,
    name: "旧青山商事",
    address: "東京都港区南青山1-1-1",
    validFrom: "2026-05-01T00:00:00",
  },
];

test("得意先マスタ画面で一覧、詳細、履歴、指定日プレビューを確認できる", async ({ page }) => {
  await page.route((url) => url.pathname === "/api/customers", async (route) => {
    await route.fulfill({ json: customers });
  });
  await page.route("**/api/customers/1/versions", async (route) => {
    await route.fulfill({ json: versions });
  });
  await page.route("**/api/customers/1/preview?**", async (route) => {
    await route.fulfill({ json: versions[1] });
  });

  await page.goto("/customers");

  await expect(page.getByRole("heading", { name: "得意先マスタ" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "C-1001" })).toBeVisible();
  await expect(page.getByText("青山商事").first()).toBeVisible();
  await expect(page.getByRole("cell", { name: "旧青山商事" })).toBeVisible();
  await expect(page.getByRole("link", { name: "得意先別商品単価でこの得意先を確認" }))
    .toHaveAttribute("href", "/customer-product-prices?customerId=1");

  const previewRegion = page.getByRole("region", { name: "指定日プレビュー" });
  await previewRegion.getByLabel("対象日").fill("2026-05-15");
  await previewRegion.getByRole("button", { name: "プレビュー" }).click();
  await expect(previewRegion.getByText("旧青山商事")).toBeVisible();
});

test("得意先検索、登録、履歴追加後に一覧と履歴を更新できる", async ({ page }) => {
  let currentCustomers = [...customers];
  let currentVersions = [...versions];
  const requestedUrls: string[] = [];

  await page.route((url) => url.pathname === "/api/customers", async (route) => {
    requestedUrls.push(route.request().url());

    if (route.request().method() === "POST") {
      const created = {
        customerId: 2,
        customerCode: "C-2001",
        customerVersionId: 20,
        name: "渋谷産業",
        address: "東京都渋谷区渋谷2-2-2",
        phoneNumber: "03-3333-4444",
        validFrom: "2026-06-05T00:00:00",
      };
      currentCustomers = [...currentCustomers, created];
      await route.fulfill({ status: 201, json: created });
      return;
    }

    const url = new URL(route.request().url());
    const customerCode = url.searchParams.get("customerCode") ?? "";
    const name = url.searchParams.get("name") ?? "";
    await route.fulfill({
      json: currentCustomers.filter(
        (customer) =>
          customer.customerCode.includes(customerCode)
          && customer.name.includes(name),
      ),
    });
  });

  await page.route("**/api/customers/1/versions", async (route) => {
    if (route.request().method() === "POST") {
      const added = {
        ...customers[0],
        customerVersionId: 12,
        address: "東京都港区赤坂1-1-1",
        phoneNumber: "03-5555-6666",
        validFrom: "2026-06-10T00:00:00",
      };
      currentCustomers = [added, ...currentCustomers.slice(1)];
      currentVersions = [added, ...currentVersions];
      await route.fulfill({ status: 201, json: added });
      return;
    }

    await route.fulfill({ json: currentVersions });
  });

  await page.route("**/api/customers/1/preview?**", async (route) => {
    await route.fulfill({ json: currentVersions[0] });
  });
  await page.route("**/api/customers/2/versions", async (route) => {
    await route.fulfill({ json: [currentCustomers[1]] });
  });
  await page.route("**/api/customers/2/preview?**", async (route) => {
    await route.fulfill({ json: currentCustomers[1] });
  });

  await page.goto("/customers");

  await page.getByLabel("得意先コード").first().fill("C-1001");
  await page.getByLabel("得意先名").first().fill("青山");
  await page.getByRole("button", { name: "検索" }).first().click();
  expect(requestedUrls.some((url) => url.includes("customerCode=C-1001") && url.includes("name=%E9%9D%92%E5%B1%B1")))
    .toBe(true);

  const createRegion = page.getByRole("region", { name: "得意先新規登録" });
  await createRegion.getByLabel("得意先コード").fill("C-2001");
  await createRegion.getByLabel("得意先名").fill("渋谷産業");
  await createRegion.getByLabel("住所").fill("東京都渋谷区渋谷2-2-2");
  await createRegion.getByLabel("電話番号").fill("03-3333-4444");
  await createRegion.getByLabel("適用開始日").fill("2026-06-05");
  await createRegion.getByRole("button", { name: "登録" }).click();

  await expect(page.getByText("得意先を登録し、一覧を更新しました。")).toBeVisible();
  await expect(page.getByLabel("得意先コード").first()).toHaveValue("");
  await expect(page.getByLabel("得意先名").first()).toHaveValue("");
  await expect(page.getByRole("cell", { name: "C-2001" })).toBeVisible();
  await expect(page.getByRole("region", { name: "選択中の得意先" }).getByText("渋谷産業")).toBeVisible();

  await page.getByRole("cell", { name: "C-1001" }).click();
  const versionRegion = page.getByRole("region", { name: "得意先履歴追加" });
  await versionRegion.getByLabel("住所").fill("東京都港区赤坂1-1-1");
  await versionRegion.getByLabel("電話番号").fill("03-5555-6666");
  await versionRegion.getByLabel("適用開始日").fill("2026-06-10");
  await versionRegion.getByRole("button", { name: "履歴追加" }).click();

  await expect(page.getByText("得意先履歴を追加し、一覧と履歴を更新しました。")).toBeVisible();
  await expect(page.getByText("03-5555-6666").first()).toBeVisible();
});

test("指定日プレビューのAPIエラーを表示できる", async ({ page }) => {
  await page.route((url) => url.pathname === "/api/customers", async (route) => {
    await route.fulfill({ json: customers });
  });
  await page.route("**/api/customers/1/versions", async (route) => {
    await route.fulfill({ json: versions });
  });
  await page.route("**/api/customers/1/preview?**", async (route) => {
    await route.fulfill({
      status: 404,
      json: { message: "対象日に適用できる得意先履歴がありません。" },
    });
  });

  await page.goto("/customers");
  const previewRegion = page.getByRole("region", { name: "指定日プレビュー" });
  await previewRegion.getByLabel("対象日").fill("2026-04-01");
  await previewRegion.getByRole("button", { name: "プレビュー" }).click();

  await expect(page.getByText("対象日に適用できる得意先履歴がありません。")).toBeVisible();
});

test("検索結果が0件になったら古い履歴とプレビューを消す", async ({ page }) => {
  let shouldReturnEmpty = false;

  await page.route((url) => url.pathname === "/api/customers", async (route) => {
    await route.fulfill({ json: shouldReturnEmpty ? [] : customers });
  });
  await page.route("**/api/customers/1/versions", async (route) => {
    await route.fulfill({ json: versions });
  });
  await page.route("**/api/customers/1/preview?**", async (route) => {
    await route.fulfill({ json: versions[0] });
  });

  await page.goto("/customers");
  await expect(page.getByRole("cell", { name: "旧青山商事" })).toBeVisible();
  await expect(page.getByLabel("指定日プレビュー").getByText("青山商事")).toBeVisible();

  shouldReturnEmpty = true;
  await page.getByLabel("得意先コード").first().fill("NO-MATCH");
  await page.getByRole("button", { name: "検索" }).first().click();

  await expect(page.getByText("該当データなし")).toBeVisible();
  await expect(page.getByText("履歴データなし")).toBeVisible();
  await expect(page.getByText("旧青山商事")).not.toBeVisible();
  await expect(page.getByLabel("指定日プレビュー").getByText("プレビューなし")).toBeVisible();
});

test("別の得意先を選択した直後に古い履歴とプレビューを消す", async ({ page }) => {
  let releaseVersions: (() => void) | undefined;
  let releasePreview: (() => void) | undefined;

  await page.route((url) => url.pathname === "/api/customers", async (route) => {
    await route.fulfill({ json: [...customers, secondCustomer] });
  });
  await page.route("**/api/customers/1/versions", async (route) => {
    await route.fulfill({ json: versions });
  });
  await page.route("**/api/customers/1/preview?**", async (route) => {
    await route.fulfill({ json: versions[0] });
  });
  await page.route("**/api/customers/2/versions", async (route) => {
    await new Promise<void>((resolve) => {
      releaseVersions = resolve;
    });
    await route.fulfill({ json: [secondCustomer] });
  });
  await page.route("**/api/customers/2/preview?**", async (route) => {
    await new Promise<void>((resolve) => {
      releasePreview = resolve;
    });
    await route.fulfill({ json: secondCustomer });
  });

  await page.goto("/customers");
  await expect(page.getByRole("cell", { name: "旧青山商事" })).toBeVisible();
  await expect(page.getByLabel("指定日プレビュー").getByText("青山商事")).toBeVisible();

  await page.getByRole("cell", { name: "C-2001" }).click();

  await expect(page.getByText("旧青山商事")).not.toBeVisible();
  await expect(page.getByText("履歴を読み込み中")).toBeVisible();
  await expect(page.getByLabel("指定日プレビュー").getByText("プレビューなし")).toBeVisible();
  releaseVersions?.();
  releasePreview?.();
  await expect(
    page.getByLabel("得意先履歴", { exact: true }).getByRole("cell", {
      name: "渋谷産業",
    }),
  ).toBeVisible();
});

test("検索で選択得意先が自動変更されたら古い履歴とプレビューを消す", async ({ page }) => {
  let shouldReturnSecondOnly = false;
  let releaseVersions: (() => void) | undefined;
  let releasePreview: (() => void) | undefined;

  await page.route((url) => url.pathname === "/api/customers", async (route) => {
    await route.fulfill({
      json: shouldReturnSecondOnly ? [secondCustomer] : customers,
    });
  });
  await page.route("**/api/customers/1/versions", async (route) => {
    await route.fulfill({ json: versions });
  });
  await page.route("**/api/customers/1/preview?**", async (route) => {
    await route.fulfill({ json: versions[0] });
  });
  await page.route("**/api/customers/2/versions", async (route) => {
    await new Promise<void>((resolve) => {
      releaseVersions = resolve;
    });
    await route.fulfill({ json: [secondCustomer] });
  });
  await page.route("**/api/customers/2/preview?**", async (route) => {
    await new Promise<void>((resolve) => {
      releasePreview = resolve;
    });
    await route.fulfill({ json: secondCustomer });
  });

  await page.goto("/customers");
  await expect(page.getByRole("cell", { name: "旧青山商事" })).toBeVisible();
  await expect(page.getByLabel("指定日プレビュー").getByText("青山商事")).toBeVisible();

  shouldReturnSecondOnly = true;
  await page.getByLabel("得意先コード").first().fill("C-2001");
  await page.getByRole("button", { name: "検索" }).first().click();

  await expect(page.getByRole("cell", { name: "C-2001" })).toBeVisible();
  await expect(page.getByText("旧青山商事")).not.toBeVisible();
  await expect(page.getByText("履歴を読み込み中")).toBeVisible();
  await expect(page.getByLabel("指定日プレビュー").getByText("プレビューなし")).toBeVisible();
  releaseVersions?.();
  releasePreview?.();
  await expect(page.getByRole("cell", { name: "渋谷産業" })).toBeVisible();
});

test("古い履歴とプレビューのAPI応答が後から返っても表示しない", async ({ page }) => {
  let releaseOldVersions: (() => void) | undefined;
  let releaseOldPreview: (() => void) | undefined;

  await page.route((url) => url.pathname === "/api/customers", async (route) => {
    await route.fulfill({ json: [...customers, secondCustomer] });
  });
  await page.route("**/api/customers/1/versions", async (route) => {
    await new Promise<void>((resolve) => {
      releaseOldVersions = resolve;
    });
    await route.fulfill({ json: versions });
  });
  await page.route("**/api/customers/1/preview?**", async (route) => {
    await new Promise<void>((resolve) => {
      releaseOldPreview = resolve;
    });
    await route.fulfill({ json: versions[0] });
  });
  await page.route("**/api/customers/2/versions", async (route) => {
    await route.fulfill({ json: [secondCustomer] });
  });
  await page.route("**/api/customers/2/preview?**", async (route) => {
    await route.fulfill({ json: secondCustomer });
  });

  await page.goto("/customers");
  await expect(page.getByRole("cell", { name: "C-2001" })).toBeVisible();
  await expect.poll(() => Boolean(releaseOldVersions && releaseOldPreview))
    .toBe(true);

  await page.getByRole("cell", { name: "C-2001" }).click();
  releaseOldVersions?.();
  releaseOldPreview?.();

  await expect(page.getByRole("cell", { name: "渋谷産業" })).toBeVisible();
  await expect(page.getByText("旧青山商事")).not.toBeVisible();
  await expect(page.getByLabel("指定日プレビュー").getByText("青山商事")).not.toBeVisible();
});

test("未来日適用の新規得意先は現在一覧へ補完しない", async ({ page }) => {
  let currentCustomers = [...customers];

  await page.route((url) => url.pathname === "/api/customers", async (route) => {
    if (route.request().method() === "POST") {
      const created = {
        ...secondCustomer,
        validFrom: "2999-01-01T00:00:00",
      };
      currentCustomers = [...currentCustomers, created];
      await route.fulfill({ status: 201, json: created });
      return;
    }

    await route.fulfill({
      json: currentCustomers.filter((customer) => customer.validFrom <= "2026-06-06T00:00:00"),
    });
  });
  await page.route("**/api/customers/1/versions", async (route) => {
    await route.fulfill({ json: versions });
  });
  await page.route("**/api/customers/1/preview?**", async (route) => {
    await route.fulfill({ json: versions[0] });
  });

  await page.goto("/customers");

  const createRegion = page.getByRole("region", { name: "得意先新規登録" });
  await createRegion.getByLabel("得意先コード").fill("C-2001");
  await createRegion.getByLabel("得意先名").fill("渋谷産業");
  await createRegion.getByLabel("住所").fill("東京都渋谷区渋谷2-2-2");
  await createRegion.getByLabel("電話番号").fill("03-3333-4444");
  await createRegion.getByLabel("適用開始日").fill("2999-01-01");
  await createRegion.getByRole("button", { name: "登録" }).click();

  await expect(page.getByText("得意先を登録し、一覧を更新しました。")).toBeVisible();
  await expect(page.getByRole("cell", { name: "C-2001" })).not.toBeVisible();
  await expect(page.getByRole("region", { name: "選択中の得意先" }).getByText("青山商事")).toBeVisible();
});

test("新規登録後の一覧再読込に失敗したら得意先を補完表示しない", async ({ page }) => {
  let failReload = false;

  await page.route((url) => url.pathname === "/api/customers", async (route) => {
    if (route.request().method() === "POST") {
      failReload = true;
      await route.fulfill({ status: 201, json: secondCustomer });
      return;
    }

    if (failReload) {
      await route.fulfill({
        status: 500,
        json: { message: "一覧の再読込に失敗しました。" },
      });
      return;
    }

    await route.fulfill({ json: customers });
  });
  await page.route("**/api/customers/1/versions", async (route) => {
    await route.fulfill({ json: versions });
  });
  await page.route("**/api/customers/1/preview?**", async (route) => {
    await route.fulfill({ json: versions[0] });
  });

  await page.goto("/customers");

  const createRegion = page.getByRole("region", { name: "得意先新規登録" });
  await createRegion.getByLabel("得意先コード").fill("C-2001");
  await createRegion.getByLabel("得意先名").fill("渋谷産業");
  await createRegion.getByLabel("住所").fill("東京都渋谷区渋谷2-2-2");
  await createRegion.getByLabel("電話番号").fill("03-3333-4444");
  await createRegion.getByLabel("適用開始日").fill("2026-06-02");
  await createRegion.getByRole("button", { name: "登録" }).click();

  await expect(page.getByText("得意先を登録しました。一覧の再読込に失敗しました。")).toBeVisible();
  await expect(page.getByText("一覧の再読込に失敗しました。", { exact: true })).toBeVisible();
  await expect(page.getByRole("cell", { name: "C-2001" })).not.toBeVisible();
  await expect(page.getByRole("region", { name: "選択中の得意先" }).getByText("未選択")).toBeVisible();
});

test("履歴追加後の一覧再読込に失敗しても履歴とプレビューを更新する", async ({ page }) => {
  let failReload = false;
  const added = {
    ...customers[0],
    customerVersionId: 12,
    address: "東京都港区赤坂1-1-1",
    phoneNumber: "03-5555-6666",
    validFrom: "2026-06-10T00:00:00",
  };

  await page.route((url) => url.pathname === "/api/customers", async (route) => {
    if (failReload) {
      await route.fulfill({
        status: 500,
        json: { message: "一覧の再読込に失敗しました。" },
      });
      return;
    }

    await route.fulfill({ json: customers });
  });
  await page.route("**/api/customers/1/versions", async (route) => {
    if (route.request().method() === "POST") {
      failReload = true;
      await route.fulfill({ status: 201, json: added });
      return;
    }

    await route.fulfill({ json: failReload ? [added, ...versions] : versions });
  });
  await page.route("**/api/customers/1/preview?**", async (route) => {
    await route.fulfill({ json: failReload ? added : versions[0] });
  });

  await page.goto("/customers");
  const versionRegion = page.getByRole("region", { name: "得意先履歴追加" });
  await versionRegion.getByLabel("住所").fill("東京都港区赤坂1-1-1");
  await versionRegion.getByLabel("電話番号").fill("03-5555-6666");
  await versionRegion.getByLabel("適用開始日").fill("2026-06-10");
  await versionRegion.getByRole("button", { name: "履歴追加" }).click();

  await expect(page.getByText("得意先履歴を追加しました。一覧の再読込に失敗しました。")).toBeVisible();
  await expect(page.getByText("一覧の再読込に失敗しました。", { exact: true })).toBeVisible();
  await expect(page.getByRole("cell", { name: "03-5555-6666" })).toBeVisible();
  await expect(page.getByLabel("指定日プレビュー").getByText("03-5555-6666")).toBeVisible();
});
