import { describe, expect, it } from "vitest";
import { buildSaleSearchParams, formatSaleCorrectionSummary } from "./_list-state";
import type { SaleListItem } from "./_types";

describe("buildSaleSearchParams", () => {
  // 空の検索条件は undefined として扱う
  it("空の検索条件は undefined として扱う", () => {
    expect(
      buildSaleSearchParams("", "", "", "", false, false),
    ).toEqual({});
  });

  // 売上日範囲と得意先条件を query 用パラメータに変換する
  it("売上日範囲と得意先条件を query 用パラメータに変換する", () => {
    expect(
      buildSaleSearchParams(
        "2026-04-01",
        "2026-04-30",
        "1",
        " C001 ",
        true,
        true,
      ),
    ).toEqual({
      salesDateFrom: "2026-04-01",
      salesDateTo: "2026-04-30",
      customerId: 1,
      customerCode: "C001",
      includeCanceled: true,
      includeCorrections: true,
    });
  });

  // 無効な得意先 ID は付与しない
  it("無効な得意先 ID は付与しない", () => {
    expect(
      buildSaleSearchParams(
        "2026-04-01",
        "2026-04-30",
        "abc",
        "",
        false,
        false,
      ),
    ).toEqual({
      salesDateFrom: "2026-04-01",
      salesDateTo: "2026-04-30",
    });
  });
});

describe("formatSaleCorrectionSummary", () => {
  const baseItem: SaleListItem = {
    saleId: 1,
    salesDate: "2026-04-15",
    customerId: 1,
    customerCode: "C001",
    customerName: "青山商事",
    totalAmount: 100,
    createdAt: "2026-04-15T02:30:00Z",
    status: "Active",
    statusChangedAt: "2026-04-15T02:30:00Z",
    correctionType: null,
    originalSaleId: null,
    correctionSaleId: null,
    correctionReason: null,
  };

  // 訂正がない売上はダッシュを返す
  it("訂正がない売上はダッシュを返す", () => {
    expect(formatSaleCorrectionSummary(baseItem)).toBe("—");
  });

  // 訂正種別と理由を表示用に整形する
  it("訂正種別と理由を表示用に整形する", () => {
    expect(
      formatSaleCorrectionSummary({
        ...baseItem,
        correctionType: "Cancellation",
        correctionReason: "入力ミス",
      }),
    ).toBe("取消（入力ミス）");
  });
});
