import { describe, expect, it } from "vitest";
import {
  applySalesLinePreview,
  createEmptySaleLineDraft,
  isManualUnitPrice,
  markSaleLinesStale,
  toCreateSaleRequestFromDrafts,
  updateSaleLineDraft,
} from "./_line-state";
import type { SalesLinePreview } from "./_types";

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

describe("markSaleLinesStale", () => {
  // 売上日や得意先変更時にプレビュー済み明細を stale にする
  it("商品選択済みの明細を stale にする", () => {
    const line = applySalesLinePreview(createEmptySaleLineDraft(), preview);
    const [staleLine] = markSaleLinesStale([line]);

    expect(staleLine?.previewStale).toBe(true);
  });
});

describe("applySalesLinePreview", () => {
  // プレビュー結果で自動取得単価を反映する
  it("自動取得単価を明細へ反映する", () => {
    const line = applySalesLinePreview(createEmptySaleLineDraft(), preview);

    expect(line.productId).toBe("2");
    expect(line.unitPrice).toBe("95");
    expect(line.preview).toEqual(preview);
    expect(line.previewStale).toBe(false);
  });
});

describe("updateSaleLineDraft", () => {
  // 商品変更時はプレビューを破棄して stale にする
  it("商品変更時にプレビューを破棄する", () => {
    const line = applySalesLinePreview(createEmptySaleLineDraft(), preview);
    const nextLine = updateSaleLineDraft(line, { productId: "3" });

    expect(nextLine.preview).toBeNull();
    expect(nextLine.previewStale).toBe(true);
    expect(nextLine.unitPrice).toBe("");
  });
});

describe("isManualUnitPrice", () => {
  // 自動取得単価と入力単価が異なる場合は手入力と判定する
  it("入力単価が自動取得単価と異なる場合は true", () => {
    const line = {
      ...applySalesLinePreview(createEmptySaleLineDraft(), preview),
      unitPrice: "100",
    };

    expect(isManualUnitPrice(line)).toBe(true);
  });

  // 自動取得単価のままなら手入力ではない
  it("自動取得単価のままなら false", () => {
    const line = applySalesLinePreview(createEmptySaleLineDraft(), preview);

    expect(isManualUnitPrice(line)).toBe(false);
  });
});

describe("toCreateSaleRequestFromDrafts", () => {
  // 手入力変更理由は手入力時だけ送信する
  it("手入力時だけ変更理由を送る", () => {
    const manualLine = {
      ...applySalesLinePreview(createEmptySaleLineDraft(), preview),
      quantity: "3",
      unitPrice: "100",
      manualUnitPriceReason: "特別値引",
    };

    const request = toCreateSaleRequestFromDrafts(
      { salesDate: "2026-04-15", customerId: "1" },
      [manualLine],
    );

    expect(request.lines[0]).toEqual({
      productId: 2,
      quantity: 3,
      unitPrice: 100,
      manualUnitPriceReason: "特別値引",
    });
  });

  // 自動取得単価の場合は変更理由を null にする
  it("自動取得単価の場合は変更理由を null にする", () => {
    const line = {
      ...applySalesLinePreview(createEmptySaleLineDraft(), preview),
      quantity: "3",
    };

    const request = toCreateSaleRequestFromDrafts(
      { salesDate: "2026-04-15", customerId: "1" },
      [line],
    );

    expect(request.lines[0]?.manualUnitPriceReason).toBeNull();
  });
});
