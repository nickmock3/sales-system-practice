import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Input } from "./input";

describe("Input", () => {
  it("入力エラー状態では aria-invalid を付与する", () => {
    render(<Input aria-label="標準単価" hasError />);

    expect(screen.getByLabelText("標準単価")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
  });
});
