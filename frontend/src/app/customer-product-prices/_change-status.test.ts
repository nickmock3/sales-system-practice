import { describe, expect, it } from "vitest";
import {
  buildCustomerProductPriceChangeKey,
  classifyCustomerProductPriceChange,
  findCurrentEffectiveFrom,
} from "./_change-status";
import type { CustomerProductPriceChange } from "./_types";

const sampleChange = (
  overrides: Partial<CustomerProductPriceChange> = {},
): CustomerProductPriceChange => ({
  unitPrice: 95,
  effectiveFrom: "2026-06-01",
  createdAt: "2026-06-01T00:00:00Z",
  ...overrides,
});

describe("findCurrentEffectiveFrom", () => {
  // 業務日以前で一番新しい変更の適用開始日を返す
  it("業務日以前で一番新しい変更の適用開始日を返す", () => {
    const changes = [
      sampleChange({ effectiveFrom: "2026-06-10", unitPrice: 90 }),
      sampleChange({ effectiveFrom: "2026-06-01", unitPrice: 95 }),
      sampleChange({ effectiveFrom: "2026-05-01", unitPrice: 100 }),
    ];

    expect(findCurrentEffectiveFrom(changes, "2026-06-05")).toBe("2026-06-01");
  });
});

describe("classifyCustomerProductPriceChange", () => {
  // 業務日と比較して変更の適用状態を分類する
  it("業務日と比較して変更の適用状態を分類する", () => {
    const currentEffectiveFrom = "2026-06-01";
    const changes = [
      sampleChange({ effectiveFrom: "2026-06-10" }),
      sampleChange({ effectiveFrom: "2026-06-01" }),
      sampleChange({ effectiveFrom: "2026-05-01" }),
    ];

    expect(
      classifyCustomerProductPriceChange(
        changes[0],
        "2026-06-05",
        currentEffectiveFrom,
      ),
    ).toBe("future");
    expect(
      classifyCustomerProductPriceChange(
        changes[1],
        "2026-06-05",
        currentEffectiveFrom,
      ),
    ).toBe("current");
    expect(
      classifyCustomerProductPriceChange(
        changes[2],
        "2026-06-05",
        currentEffectiveFrom,
      ),
    ).toBe("past");
  });
});

describe("buildCustomerProductPriceChangeKey", () => {
  // 履歴行 ID なしで一覧行を安定して識別できる
  it("履歴行 ID なしで一覧行を安定して識別できる", () => {
    const change = sampleChange();
    expect(buildCustomerProductPriceChangeKey(change)).toBe(
      "2026-06-01|95|2026-06-01T00:00:00Z",
    );
  });
});
