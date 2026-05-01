import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Avatar } from "./Avatar";

describe("Avatar", () => {
  it("renders_initials", () => {
    render(<Avatar initials="TM" />);
    expect(screen.getByText("TM")).toBeInTheDocument();
  });

  it("applies_avatar_class_for_md_size_default", () => {
    const { container } = render(<Avatar initials="TM" />);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain("avatar");
    expect(el.className).not.toContain("avatar-sm");
    expect(el.className).not.toContain("avatar-lg");
  });

  it("applies_avatar_sm_class_for_sm_size", () => {
    const { container } = render(<Avatar initials="TM" size="sm" />);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain("avatar-sm");
  });

  it("applies_avatar_lg_class_for_lg_size", () => {
    const { container } = render(<Avatar initials="TM" size="lg" />);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain("avatar-lg");
  });

  it("has_img_role_for_accessibility", () => {
    render(<Avatar initials="AB" />);
    expect(screen.getByRole("img")).toBeInTheDocument();
  });

  it("has_aria_label_containing_initials", () => {
    render(<Avatar initials="JD" />);
    expect(screen.getByRole("img")).toHaveAttribute("aria-label", "Avatar JD");
  });

  it("renders_as_span_element", () => {
    const { container } = render(<Avatar initials="TM" />);
    expect(container.firstChild?.nodeName).toBe("SPAN");
  });
});
