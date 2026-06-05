import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Button } from "./button";

describe("Button", () => {
  it("業務操作用ボタンとしてラベルと種別を指定して表示できる", () => {
    render(<Button type="submit">登録</Button>);

    expect(screen.getByRole("button", { name: "登録" })).toHaveAttribute(
      "type",
      "submit",
    );
  });
});
