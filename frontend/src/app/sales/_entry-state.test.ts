import { describe, expect, it } from "vitest";
import { saleEntryFormSchema } from "./_schemas";
import {
  applySalesLinePreview,
  createEmptySaleLineDraft,
} from "./_line-state";
import type { SalesLinePreview } from "./_types";
import {
  bumpLinePreviewRequestIds,
  canApplyLinePreviewResponse,
  createEmptySaleLineEntry,
  getSaleFormValidationBlockReason,
  getSaleSubmitBlockReason,
  isCustomerAsOfReady,
  mapZodErrorsToFieldMap,
  markSaleLineEntriesStale,
  toSaleEntryFormValues,
  type CustomerAsOfState,
  type SaleSubmitDependencies,
} from "./_entry-state";

const preview: SalesLinePreview = {
  productId: 2,
  productCode: "P002",
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

const readyCustomerAsOf = (
  overrides: Partial<CustomerAsOfState> = {},
): CustomerAsOfState => ({
  loading: false,
  errorMessage: "",
  item: {
    customerId: 1,
    salesDate: "2026-04-15",
  },
  ...overrides,
});

const submitDependencies = (
  overrides: Partial<SaleSubmitDependencies> = {},
): SaleSubmitDependencies => ({
  customerAsOf: readyCustomerAsOf(),
  ...overrides,
});

const readyLine = () => ({
  ...applySalesLinePreview(createEmptySaleLineEntry(), preview),
  quantity: "3",
  previewError: "",
  loadingPreview: false,
});

describe("markSaleLineEntriesStale", () => {
  // 売上日変更時にプレビューエラーをクリアして stale にする
  it("プレビュー済み明細を stale にし previewError をクリアする", () => {
    const line = {
      ...applySalesLinePreview(createEmptySaleLineEntry(), preview),
      previewError: "古いエラー",
      loadingPreview: true,
    };
    const [staleLine] = markSaleLineEntriesStale([line]);

    expect(staleLine?.previewStale).toBe(true);
    expect(staleLine?.previewError).toBe("");
    expect(staleLine?.loadingPreview).toBe(false);
  });
});

describe("bumpLinePreviewRequestIds", () => {
  // ヘッダー変更時に進行中 preview を無効化する
  it("全明細の requestId を進めて古い応答を無効化する", () => {
    const next = bumpLinePreviewRequestIds(
      { lineA: 1, lineB: 3 },
      ["lineA", "lineB"],
    );

    expect(next).toEqual({ lineA: 2, lineB: 4 });
  });
});

describe("canApplyLinePreviewResponse", () => {
  // 変更前 context の応答は適用しない
  it("売上日が変わった応答は適用しない", () => {
    const line = applySalesLinePreview(createEmptySaleLineEntry(), preview);

    expect(
      canApplyLinePreviewResponse(
        {
          salesDate: "2026-04-01",
          customerId: 1,
          productId: 2,
          requestId: 1,
        },
        1,
        { salesDate: "2026-04-15", customerId: "1" },
        line,
      ),
    ).toBe(false);
  });

  // invalidate 後の古い requestId は適用しない
  it("invalidate 後の古い requestId は適用しない", () => {
    const line = applySalesLinePreview(createEmptySaleLineEntry(), preview);

    expect(
      canApplyLinePreviewResponse(
        {
          salesDate: "2026-04-15",
          customerId: 1,
          productId: 2,
          requestId: 1,
        },
        2,
        { salesDate: "2026-04-15", customerId: "1" },
        line,
      ),
    ).toBe(false);
  });

  // 最新 context と requestId が一致する応答だけ適用する
  it("最新 context と requestId が一致する応答だけ適用する", () => {
    const line = applySalesLinePreview(createEmptySaleLineEntry(), preview);

    expect(
      canApplyLinePreviewResponse(
        {
          salesDate: "2026-04-15",
          customerId: 1,
          productId: 2,
          requestId: 2,
        },
        2,
        { salesDate: "2026-04-15", customerId: "1" },
        line,
      ),
    ).toBe(true);
  });
});

describe("isCustomerAsOfReady", () => {
  // 取得中は未確認扱い
  it("取得中は未確認扱い", () => {
    expect(
      isCustomerAsOfReady(
        { salesDate: "2026-04-15", customerId: "1" },
        readyCustomerAsOf({ loading: true }),
      ),
    ).toBe(false);
  });

  // 現在 header と一致する取得成功だけ true
  it("現在 header と一致する取得成功だけ true", () => {
    expect(
      isCustomerAsOfReady(
        { salesDate: "2026-04-15", customerId: "1" },
        readyCustomerAsOf(),
      ),
    ).toBe(true);
    expect(
      isCustomerAsOfReady(
        { salesDate: "2026-04-16", customerId: "1" },
        readyCustomerAsOf(),
      ),
    ).toBe(false);
  });
});

describe("getSaleFormValidationBlockReason", () => {
  // 必須入力不足は登録前に理由を返す
  it("数量未入力は登録前に理由を返す", () => {
    const line = applySalesLinePreview(createEmptySaleLineEntry(), preview);

    expect(
      getSaleFormValidationBlockReason(
        { salesDate: "2026-04-15", customerId: "1" },
        [line],
      ),
    ).toContain("数量");
  });
});

describe("getSaleSubmitBlockReason", () => {
  // 一般ユーザーは登録不可
  it("一般ユーザーには理由を返す", () => {
    expect(
      getSaleSubmitBlockReason(
        "user",
        { salesDate: "2026-04-15", customerId: "1" },
        [createEmptySaleLineEntry()],
        submitDependencies(),
      ),
    ).toContain("管理者のみ");
  });

  // 得意先確認未取得では登録不可
  it("得意先確認未取得では登録不可", () => {
    expect(
      getSaleSubmitBlockReason(
        "admin",
        { salesDate: "2026-04-15", customerId: "1" },
        [readyLine()],
        submitDependencies({
          customerAsOf: readyCustomerAsOf({ item: undefined }),
        }),
      ),
    ).toContain("得意先を確認できていません");
  });

  // 得意先確認取得中は登録不可
  it("得意先確認取得中は登録不可", () => {
    expect(
      getSaleSubmitBlockReason(
        "admin",
        { salesDate: "2026-04-15", customerId: "1" },
        [readyLine()],
        submitDependencies({
          customerAsOf: readyCustomerAsOf({ loading: true }),
        }),
      ),
    ).toContain("取得中");
  });

  // stale 明細があると登録不可
  it("stale 明細があると登録不可", () => {
    const line = applySalesLinePreview(createEmptySaleLineEntry(), preview);
    const [staleLine] = markSaleLineEntriesStale([line]);

    expect(
      getSaleSubmitBlockReason(
        "admin",
        { salesDate: "2026-04-15", customerId: "1" },
        staleLine ? [{ ...staleLine, quantity: "3" }] : [],
        submitDependencies(),
      ),
    ).toContain("再取得が必要");
  });

  // 販売停止商品を含むと登録不可
  it("販売停止商品を含むと登録不可", () => {
    const line = {
      ...applySalesLinePreview(createEmptySaleLineEntry(), {
        ...preview,
        isDiscontinued: true,
      }),
      quantity: "3",
      previewError: "",
      loadingPreview: false,
    };

    expect(
      getSaleSubmitBlockReason(
        "admin",
        { salesDate: "2026-04-15", customerId: "1" },
        [line],
        submitDependencies(),
      ),
    ).toContain("販売停止");
  });
});

describe("mapZodErrorsToFieldMap", () => {
  // zod エラーをフォームフィールド名へ変換する
  it("明細行のバリデーションエラーを lines 配下へ変換する", () => {
    const values = toSaleEntryFormValues(
      { salesDate: "", customerId: "" },
      [createEmptySaleLineEntry()],
    );
    const parsed = saleEntryFormSchema.safeParse(values);

    if (!parsed.success) {
      const fieldErrors = mapZodErrorsToFieldMap(parsed.error);
      expect(fieldErrors.salesDate).toBeTruthy();
      expect(fieldErrors["lines.0.productId"]).toBeTruthy();
    } else {
      throw new Error("バリデーションエラーが発生しませんでした。");
    }
  });
});

describe("toSaleEntryFormValues", () => {
  // 画面状態から zod 検証用の値を組み立てる
  it("ヘッダーと明細 draft からフォーム値を組み立てる", () => {
    const line = {
      ...applySalesLinePreview(createEmptySaleLineDraft(), preview),
      quantity: "2",
      previewError: "",
      loadingPreview: false,
    };
    const values = toSaleEntryFormValues(
      { salesDate: "2026-04-15", customerId: "1" },
      [line],
    );

    expect(values.lines[0]?.productId).toBe("2");
    expect(values.lines[0]?.quantity).toBe("2");
  });
});
