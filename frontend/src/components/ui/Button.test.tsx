import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { createRef } from "react";
import userEvent from "@testing-library/user-event";
import { Button } from "./Button";

describe("Button", () => {
  it("renders_children", () => {
    render(<Button>Envoyer</Button>);
    expect(screen.getByRole("button", { name: /envoyer/i })).toBeInTheDocument();
  });

  it("applies_btn_coral_class_by_default", () => {
    render(<Button>Envoyer</Button>);
    const btn = screen.getByRole("button");
    expect(btn.className).toContain("btn");
    expect(btn.className).toContain("btn-coral");
  });

  it("applies_btn_sky_outline_variant", () => {
    render(<Button variant="sky-outline">Secondaire</Button>);
    const btn = screen.getByRole("button");
    expect(btn.className).toContain("btn-sky-outline");
    expect(btn.className).not.toContain("btn-coral");
  });

  it("applies_btn_ghost_variant", () => {
    render(<Button variant="ghost">Annuler</Button>);
    const btn = screen.getByRole("button");
    expect(btn.className).toContain("btn-ghost");
  });

  it("applies_btn_lg_size_class", () => {
    render(<Button size="lg">Grand bouton</Button>);
    expect(screen.getByRole("button").className).toContain("btn-lg");
  });

  it("does_not_apply_btn_lg_for_md_size", () => {
    render(<Button size="md">Moyen</Button>);
    expect(screen.getByRole("button").className).not.toContain("btn-lg");
  });

  it("merges_custom_className", () => {
    render(<Button className="w-full">Large</Button>);
    expect(screen.getByRole("button").className).toContain("w-full");
  });

  it("forwards_disabled_prop", () => {
    render(<Button disabled>Désactivé</Button>);
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("forwards_type_prop", () => {
    render(<Button type="submit">Soumettre</Button>);
    expect(screen.getByRole("button")).toHaveAttribute("type", "submit");
  });

  it("calls_onClick_when_clicked", async () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Clic</Button>);
    await userEvent.click(screen.getByRole("button"));
    expect(handleClick).toHaveBeenCalledOnce();
  });

  it("does_not_call_onClick_when_disabled", async () => {
    const handleClick = vi.fn();
    render(
      <Button disabled onClick={handleClick}>
        Désactivé
      </Button>
    );
    await userEvent.click(screen.getByRole("button"));
    expect(handleClick).not.toHaveBeenCalled();
  });

  it("forwards_ref_to_button_element", () => {
    const ref = createRef<HTMLButtonElement>();
    render(<Button ref={ref}>Ref test</Button>);
    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
  });
});
