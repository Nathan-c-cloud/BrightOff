import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Input } from "./Input";

describe("Input", () => {
  it("renders_input_element", () => {
    render(<Input placeholder="Entrez votre email" />);
    expect(screen.getByPlaceholderText("Entrez votre email")).toBeInTheDocument();
  });

  it("applies_input_class", () => {
    render(<Input />);
    const el = document.querySelector("input");
    expect(el?.className).toContain("input");
  });

  it("does_not_apply_border_error_by_default", () => {
    render(<Input />);
    const input = document.querySelector("input")!;
    expect(input).not.toHaveClass("input-error");
    expect(input).not.toHaveAttribute("aria-invalid", "true");
  });

  it("applies_input_error_class_when_error_is_true", () => {
    render(<Input error={true} />);
    const el = document.querySelector("input");
    expect(el?.className).toContain("input-error");
  });

  it("sets_aria_invalid_when_error_is_true", () => {
    render(<Input error={true} />);
    expect(document.querySelector("input")).toHaveAttribute("aria-invalid", "true");
  });

  it("does_not_set_aria_invalid_by_default", () => {
    render(<Input />);
    expect(document.querySelector("input")).not.toHaveAttribute("aria-invalid");
  });

  it("merges_custom_className", () => {
    render(<Input className="mt-2" />);
    expect(document.querySelector("input")?.className).toContain("mt-2");
  });

  it("forwards_disabled_prop", () => {
    render(<Input disabled />);
    expect(document.querySelector("input")).toBeDisabled();
  });

  it("forwards_type_prop", () => {
    render(<Input type="password" />);
    expect(document.querySelector("input")).toHaveAttribute("type", "password");
  });

  it("calls_onChange_on_user_input", async () => {
    const handleChange = vi.fn();
    render(<Input onChange={handleChange} />);
    await userEvent.type(document.querySelector("input")!, "a");
    expect(handleChange).toHaveBeenCalled();
  });
});
