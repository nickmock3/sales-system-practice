import { describe, expect, it } from "vitest";
import {
  parseCombinationKey,
  parsePositiveIntParam,
  toCombinationKey,
} from "./_selection";

describe("toCombinationKey", () => {
  // 得意先 ID と商品 ID から一覧選択キーを生成する
  it("得意先 ID と商品 ID から選択キーを生成する", () => {
    expect(toCombinationKey(1, 2)).toBe("1:2");
  });
});

describe("parseCombinationKey", () => {
  // 不正な選択キーは undefined を返す
  it("不正な選択キーを拒否する", () => {
    expect(parseCombinationKey("1:2")).toEqual({
      customerId: 1,
      productId: 2,
    });
    expect(parseCombinationKey("0:2")).toBeUndefined();
    expect(parseCombinationKey("abc:2")).toBeUndefined();
  });
});

describe("parsePositiveIntParam", () => {
  // URL 検索パラメータから正の整数 ID のみを受け付ける
  it("正の整数 ID のみを受け付ける", () => {
    expect(parsePositiveIntParam("1")).toBe(1);
    expect(parsePositiveIntParam("0")).toBeUndefined();
    expect(parsePositiveIntParam("-1")).toBeUndefined();
    expect(parsePositiveIntParam("abc")).toBeUndefined();
    expect(parsePositiveIntParam(null)).toBeUndefined();
  });
});
