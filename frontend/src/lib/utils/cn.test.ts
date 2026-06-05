import { describe, expect, it } from "vitest";
import { cn } from "./cn";

describe("cn", () => {
  it("条件付きクラスを結合し、Tailwind の競合クラスは後勝ちにする", () => {
    expect(cn("px-2 py-1", false && "hidden", "px-4")).toBe("py-1 px-4");
  });
});
