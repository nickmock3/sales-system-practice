import { describe, expect, it } from "vitest";
import {
  buildProductChangeKey,
  classifyProductChange,
  findCurrentEffectiveFrom,
  getBusinessDate,
  normalizeEffectiveDate,
} from "./_change-status";
import type { ProductChange } from "./_types";

const sampleChange = (
  overrides: Partial<ProductChange> = {},
): ProductChange => ({
  effectiveFrom: "2026-06-01",
  name: "標準デスク",
  unit: "台",
  standardUnitPrice: 48000,
  taxCategory: "STANDARD",
  isDiscontinued: false,
  ...overrides,
});

describe("getBusinessDate", () => {
  // JST の日付境界で業務日を安定して返す
  it("JST の日付境界で業務日を返す", () => {
    expect(getBusinessDate(new Date("2026-06-11T14:59:59Z"))).toBe("2026-06-11");
    expect(getBusinessDate(new Date("2026-06-11T15:00:00Z"))).toBe("2026-06-12");
  });
});

describe("normalizeEffectiveDate", () => {
  // ISO 日時文字列から業務日比較用の yyyy-MM-dd を取り出す
  it("日時文字列から日付部分だけを取り出す", () => {
    expect(normalizeEffectiveDate("2026-06-01T00:00:00")).toBe("2026-06-01");
  });
});

describe("findCurrentEffectiveFrom", () => {
  // 業務日以前で一番新しい変更の適用開始日を返す
  it("業務日以前で一番新しい変更の適用開始日を返す", () => {
    const changes = [
      sampleChange({ effectiveFrom: "2026-06-10", name: "将来版" }),
      sampleChange({ effectiveFrom: "2026-06-01", name: "現行版" }),
      sampleChange({ effectiveFrom: "2026-05-01", name: "旧版" }),
    ];

    expect(findCurrentEffectiveFrom(changes, "2026-06-05")).toBe("2026-06-01");
  });
});

describe("classifyProductChange", () => {
  // 業務日と比較して変更の適用状態を分類する
  it("業務日と比較して変更の適用状態を分類する", () => {
    const currentEffectiveFrom = "2026-06-01";
    const changes = [
      sampleChange({ effectiveFrom: "2026-06-10" }),
      sampleChange({ effectiveFrom: "2026-06-01" }),
      sampleChange({ effectiveFrom: "2026-05-01" }),
    ];

    expect(
      classifyProductChange(changes[0], "2026-06-05", currentEffectiveFrom),
    ).toBe("future");
    expect(
      classifyProductChange(changes[1], "2026-06-05", currentEffectiveFrom),
    ).toBe("current");
    expect(
      classifyProductChange(changes[2], "2026-06-05", currentEffectiveFrom),
    ).toBe("past");
  });
});

describe("buildProductChangeKey", () => {
  // 履歴行 ID なしで一覧行を安定して識別できる
  it("履歴行 ID なしで一覧行を安定して識別できる", () => {
    const change = sampleChange();
    expect(buildProductChangeKey(change)).toBe(
      "2026-06-01|標準デスク|台|48000|STANDARD|false",
    );
  });
});
