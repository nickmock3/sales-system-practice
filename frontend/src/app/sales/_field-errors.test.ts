import { describe, expect, it } from "vitest";
import { toSaleFormFieldName } from "./_field-errors";

describe("toSaleFormFieldName", () => {
  // API の PascalCase エラーをフォームの camelCase へ紐付ける
  it("SalesDate を salesDate へ変換する", () => {
    expect(toSaleFormFieldName("SalesDate")).toBe("salesDate");
  });

  // 明細行の ValidationProblem キーを lines 配下へ変換する
  it("Lines[n].Field を lines.n.field へ変換する", () => {
    expect(toSaleFormFieldName("Lines[0].Quantity")).toBe("lines.0.quantity");
    expect(toSaleFormFieldName("Lines[1].ManualUnitPriceReason")).toBe(
      "lines.1.manualUnitPriceReason",
    );
  });
});
