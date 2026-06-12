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
];

const secondCustomer = {
  customerId: 2,
  customerCode: "C-2001",
  name: "渋谷産業",
  address: "東京都渋谷区渋谷2-2-2",
  phoneNumber: "03-3333-4444",
  effectiveFrom: "2026-06-02",
};

const pastCustomerSummary = {
  customerId: 1,
  customerCode: "C-1001",
  name: "旧青山商事",
  address: "東京都港区南青山1-1-1",
  phoneNumber: "03-1111-2222",
  effectiveFrom: "2026-05-01",
};

const changes = [
  {
    effectiveFrom: "2026-06-01",
    name: "青山商事",
    address: "東京都港区北青山1-1-1",
    phoneNumber: "03-1111-2222",
  },
  {
    effectiveFrom: "2026-05-01",
    name: "旧青山商事",
    address: "東京都港区南青山1-1-1",
    phoneNumber: "03-1111-2222",
  },
];

test("得意先マスタ画面で一覧、詳細、変更履歴、指定日参照を確認できる", async ({ page }) => {
  await page.route((url) => url.pathname === "/api/customers", async (route) => {
    await route.fulfill({ json: customers });
  });
  await page.route("**/api/customers/1/changes", async (route) => {
    await route.fulfill({ json: changes });
  });
  await page.route("**/api/customers/1?asOf=**", async (route) => {
    await route.fulfill({ json: pastCustomerSummary });
  });

  await page.goto("/customers");

  await expect(page.getByRole("heading", { name: "得意先マスタ" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "C-1001" })).toBeVisible();
  await expect(page.getByText("青山商事").first()).toBeVisible();
  await expect(
    page.getByRole("region", { name: "変更履歴" }).getByRole("cell", {
      name: "旧青山商事",
    }),
  ).toBeVisible();
  await expect(page.getByText("履歴ID")).not.toBeVisible();
  await expect(page.getByText("customerVersionId")).not.toBeVisible();
  await expect(page.getByText("得意先ID")).not.toBeVisible();
  await expect(page.getByRole("link", { name: "得意先別商品単価でこの得意先を確認" }))
    .toHaveAttribute("href", "/customer-product-prices?customerId=1");

  const asOfRegion = page.getByRole("region", { name: "指定日時点の得意先情報" });
  await asOfRegion.getByLabel("参照日").fill("2026-05-15");
  await asOfRegion.getByRole("button", { name: "参照" }).click();
  await expect(asOfRegion.getByText("旧青山商事")).toBeVisible();
});

test("得意先検索、登録、情報変更後に一覧と変更履歴を更新できる", async ({ page }) => {
  let currentCustomers = [...customers];
  let currentChanges = [...changes];
  const requestedUrls: string[] = [];

  await page.route((url) => url.pathname === "/api/customers", async (route) => {
    requestedUrls.push(route.request().url());

    if (route.request().method() === "POST") {
      const created = {
        customerId: 2,
        customerCode: "C-2001",
        name: "渋谷産業",
        address: "東京都渋谷区渋谷2-2-2",
        phoneNumber: "03-3333-4444",
        effectiveFrom: "2026-06-05",
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

  await page.route("**/api/customers/1/changes", async (route) => {
    if (route.request().method() === "POST") {
      const changed = {
        ...customers[0],
        address: "東京都港区赤坂1-1-1",
        phoneNumber: "03-5555-6666",
        effectiveFrom: "2026-06-10",
      };
      currentCustomers = [changed, ...currentCustomers.slice(1)];
      currentChanges = [
        {
          effectiveFrom: "2026-06-10",
          name: "青山商事",
          address: "東京都港区赤坂1-1-1",
          phoneNumber: "03-5555-6666",
        },
        ...currentChanges,
      ];
      await route.fulfill({ status: 200, json: changed });
      return;
    }

    await route.fulfill({ json: currentChanges });
  });

  await page.route("**/api/customers/1?asOf=**", async (route) => {
    await route.fulfill({ json: currentCustomers[0] });
  });
  await page.route("**/api/customers/2/changes", async (route) => {
    await route.fulfill({
      json: [
        {
          effectiveFrom: "2026-06-05",
          name: "渋谷産業",
          address: "東京都渋谷区渋谷2-2-2",
          phoneNumber: "03-3333-4444",
        },
      ],
    });
  });
  await page.route("**/api/customers/2?asOf=**", async (route) => {
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
  const changeRegion = page.getByRole("region", { name: "得意先情報変更" });
  await changeRegion.getByLabel("住所").fill("東京都港区赤坂1-1-1");
  await changeRegion.getByLabel("電話番号").fill("03-5555-6666");
  await changeRegion.getByLabel("適用開始日").fill("2026-06-10");
  await changeRegion.getByRole("button", { name: "変更を登録" }).click();

  await expect(page.getByText("得意先情報を変更し、一覧と変更履歴を更新しました。")).toBeVisible();
  await expect(page.getByText("03-5555-6666").first()).toBeVisible();
});

test("指定日参照のAPIエラーを表示できる", async ({ page }) => {
  await page.route((url) => url.pathname === "/api/customers", async (route) => {
    await route.fulfill({ json: customers });
  });
  await page.route("**/api/customers/1/changes", async (route) => {
    await route.fulfill({ json: changes });
  });
  await page.route("**/api/customers/1?asOf=**", async (route) => {
    await route.fulfill({
      status: 404,
      json: { message: "指定日時点で利用できる得意先情報がありません。" },
    });
  });

  await page.goto("/customers");
  const asOfRegion = page.getByRole("region", { name: "指定日時点の得意先情報" });
  await asOfRegion.getByLabel("参照日").fill("2026-04-01");
  await asOfRegion.getByRole("button", { name: "参照" }).click();

  await expect(page.getByText("指定日時点で利用できる得意先情報がありません。")).toBeVisible();
});

test("検索結果が0件になったら古い変更履歴と指定日参照を消す", async ({ page }) => {
  let shouldReturnEmpty = false;

  await page.route((url) => url.pathname === "/api/customers", async (route) => {
    await route.fulfill({ json: shouldReturnEmpty ? [] : customers });
  });
  await page.route("**/api/customers/1/changes", async (route) => {
    await route.fulfill({ json: changes });
  });
  await page.route("**/api/customers/1?asOf=**", async (route) => {
    await route.fulfill({ json: customers[0] });
  });

  await page.goto("/customers");
  await expect(page.getByRole("cell", { name: "旧青山商事" })).toBeVisible();
  await expect(page.getByLabel("指定日時点の得意先情報").getByText("青山商事")).toBeVisible();

  shouldReturnEmpty = true;
  await page.getByLabel("得意先コード").first().fill("NO-MATCH");
  await page.getByRole("button", { name: "検索" }).first().click();

  await expect(page.getByText("該当データなし")).toBeVisible();
  await expect(page.getByText("変更履歴なし")).toBeVisible();
  await expect(page.getByText("旧青山商事")).not.toBeVisible();
  await expect(page.getByLabel("指定日時点の得意先情報").getByText("参照結果なし")).toBeVisible();
});

test("別の得意先を選択した直後に古い変更履歴と指定日参照を消す", async ({ page }) => {
  let releaseChanges: (() => void) | undefined;
  let releaseAsOf: (() => void) | undefined;

  await page.route((url) => url.pathname === "/api/customers", async (route) => {
    await route.fulfill({ json: [...customers, secondCustomer] });
  });
  await page.route("**/api/customers/1/changes", async (route) => {
    await route.fulfill({ json: changes });
  });
  await page.route("**/api/customers/1?asOf=**", async (route) => {
    await route.fulfill({ json: customers[0] });
  });
  await page.route("**/api/customers/2/changes", async (route) => {
    await new Promise<void>((resolve) => {
      releaseChanges = resolve;
    });
    await route.fulfill({
      json: [
        {
          effectiveFrom: "2026-06-02",
          name: "渋谷産業",
          address: "東京都渋谷区渋谷2-2-2",
          phoneNumber: "03-3333-4444",
        },
      ],
    });
  });
  await page.route("**/api/customers/2?asOf=**", async (route) => {
    await new Promise<void>((resolve) => {
      releaseAsOf = resolve;
    });
    await route.fulfill({ json: secondCustomer });
  });

  await page.goto("/customers");
  await expect(page.getByRole("cell", { name: "旧青山商事" })).toBeVisible();
  await expect(page.getByLabel("指定日時点の得意先情報").getByText("青山商事")).toBeVisible();

  await page.getByRole("cell", { name: "C-2001" }).click();

  await expect(page.getByText("旧青山商事")).not.toBeVisible();
  await expect(page.getByText("変更履歴を読み込み中")).toBeVisible();
  await expect(page.getByLabel("指定日時点の得意先情報").getByText("参照結果なし")).toBeVisible();
  releaseChanges?.();
  releaseAsOf?.();
  await expect(
    page.getByRole("region", { name: "変更履歴" }).getByRole("cell", {
      name: "渋谷産業",
    }),
  ).toBeVisible();
});

test("検索で選択得意先が自動変更されたら古い変更履歴と指定日参照を消す", async ({ page }) => {
  let shouldReturnSecondOnly = false;
  let releaseChanges: (() => void) | undefined;
  let releaseAsOf: (() => void) | undefined;

  await page.route((url) => url.pathname === "/api/customers", async (route) => {
    await route.fulfill({
      json: shouldReturnSecondOnly ? [secondCustomer] : customers,
    });
  });
  await page.route("**/api/customers/1/changes", async (route) => {
    await route.fulfill({ json: changes });
  });
  await page.route("**/api/customers/1?asOf=**", async (route) => {
    await route.fulfill({ json: customers[0] });
  });
  await page.route("**/api/customers/2/changes", async (route) => {
    await new Promise<void>((resolve) => {
      releaseChanges = resolve;
    });
    await route.fulfill({
      json: [
        {
          effectiveFrom: "2026-06-02",
          name: "渋谷産業",
          address: "東京都渋谷区渋谷2-2-2",
          phoneNumber: "03-3333-4444",
        },
      ],
    });
  });
  await page.route("**/api/customers/2?asOf=**", async (route) => {
    await new Promise<void>((resolve) => {
      releaseAsOf = resolve;
    });
    await route.fulfill({ json: secondCustomer });
  });

  await page.goto("/customers");
  await expect(page.getByRole("cell", { name: "旧青山商事" })).toBeVisible();
  await expect(page.getByLabel("指定日時点の得意先情報").getByText("青山商事")).toBeVisible();

  shouldReturnSecondOnly = true;
  await page.getByLabel("得意先コード").first().fill("C-2001");
  await page.getByRole("button", { name: "検索" }).first().click();

  await expect(page.getByRole("cell", { name: "C-2001" })).toBeVisible();
  await expect(page.getByText("旧青山商事")).not.toBeVisible();
  await expect(page.getByText("変更履歴を読み込み中")).toBeVisible();
  await expect(page.getByLabel("指定日時点の得意先情報").getByText("参照結果なし")).toBeVisible();
  releaseChanges?.();
  releaseAsOf?.();
  await expect(
    page.getByRole("region", { name: "変更履歴" }).getByRole("cell", {
      name: "渋谷産業",
    }),
  ).toBeVisible();
});

test("古い変更履歴と指定日参照のAPI応答が後から返っても表示しない", async ({ page }) => {
  let releaseOldChanges: (() => void) | undefined;
  let releaseOldAsOf: (() => void) | undefined;

  await page.route((url) => url.pathname === "/api/customers", async (route) => {
    await route.fulfill({ json: [...customers, secondCustomer] });
  });
  await page.route("**/api/customers/1/changes", async (route) => {
    await new Promise<void>((resolve) => {
      releaseOldChanges = resolve;
    });
    await route.fulfill({ json: changes });
  });
  await page.route("**/api/customers/1?asOf=**", async (route) => {
    await new Promise<void>((resolve) => {
      releaseOldAsOf = resolve;
    });
    await route.fulfill({ json: customers[0] });
  });
  await page.route("**/api/customers/2/changes", async (route) => {
    await route.fulfill({
      json: [
        {
          effectiveFrom: "2026-06-02",
          name: "渋谷産業",
          address: "東京都渋谷区渋谷2-2-2",
          phoneNumber: "03-3333-4444",
        },
      ],
    });
  });
  await page.route("**/api/customers/2?asOf=**", async (route) => {
    await route.fulfill({ json: secondCustomer });
  });

  await page.goto("/customers");
  await expect(page.getByRole("cell", { name: "C-2001" })).toBeVisible();
  await expect.poll(() => Boolean(releaseOldChanges && releaseOldAsOf))
    .toBe(true);

  await page.getByRole("cell", { name: "C-2001" }).click();
  releaseOldChanges?.();
  releaseOldAsOf?.();

  await expect(
    page.getByRole("region", { name: "変更履歴" }).getByRole("cell", {
      name: "渋谷産業",
    }),
  ).toBeVisible();
  await expect(page.getByText("旧青山商事")).not.toBeVisible();
  await expect(page.getByLabel("指定日時点の得意先情報").getByText("青山商事")).not.toBeVisible();
});

test("未来日適用の新規得意先は現在一覧へ補完しない", async ({ page }) => {
  let currentCustomers = [...customers];

  await page.route((url) => url.pathname === "/api/customers", async (route) => {
    if (route.request().method() === "POST") {
      const created = {
        ...secondCustomer,
        effectiveFrom: "2999-01-01",
      };
      currentCustomers = [...currentCustomers, created];
      await route.fulfill({ status: 201, json: created });
      return;
    }

    await route.fulfill({
      json: currentCustomers.filter((customer) => customer.effectiveFrom <= "2026-06-06"),
    });
  });
  await page.route("**/api/customers/1/changes", async (route) => {
    await route.fulfill({ json: changes });
  });
  await page.route("**/api/customers/1?asOf=**", async (route) => {
    await route.fulfill({ json: customers[0] });
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
  await page.route("**/api/customers/1/changes", async (route) => {
    await route.fulfill({ json: changes });
  });
  await page.route("**/api/customers/1?asOf=**", async (route) => {
    await route.fulfill({ json: customers[0] });
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

test("情報変更後の一覧再読込に失敗しても変更履歴と指定日参照を更新する", async ({ page }) => {
  let failReload = false;
  const changed = {
    ...customers[0],
    address: "東京都港区赤坂1-1-1",
    phoneNumber: "03-5555-6666",
    effectiveFrom: "2026-06-10",
  };
  const updatedChanges = [
    {
      effectiveFrom: "2026-06-10",
      name: "青山商事",
      address: "東京都港区赤坂1-1-1",
      phoneNumber: "03-5555-6666",
    },
    ...changes,
  ];

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
  await page.route("**/api/customers/1/changes", async (route) => {
    if (route.request().method() === "POST") {
      failReload = true;
      await route.fulfill({ status: 200, json: changed });
      return;
    }

    await route.fulfill({ json: failReload ? updatedChanges : changes });
  });
  await page.route("**/api/customers/1?asOf=**", async (route) => {
    await route.fulfill({ json: failReload ? changed : customers[0] });
  });

  await page.goto("/customers");
  const changeRegion = page.getByRole("region", { name: "得意先情報変更" });
  await changeRegion.getByLabel("住所").fill("東京都港区赤坂1-1-1");
  await changeRegion.getByLabel("電話番号").fill("03-5555-6666");
  await changeRegion.getByLabel("適用開始日").fill("2026-06-10");
  await changeRegion.getByRole("button", { name: "変更を登録" }).click();

  await expect(page.getByText("得意先情報を変更しました。一覧の再読込に失敗しました。")).toBeVisible();
  await expect(page.getByText("一覧の再読込に失敗しました。", { exact: true })).toBeVisible();
  await expect(page.getByRole("cell", { name: "03-5555-6666" })).toBeVisible();
  await expect(page.getByLabel("指定日時点の得意先情報").getByText("03-5555-6666")).toBeVisible();
});
