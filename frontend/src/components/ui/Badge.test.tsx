import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Badge } from "./Badge";

describe("Badge", () => {
  it("renders_children_text", () => {
    render(<Badge variant="skill">React</Badge>);
    expect(screen.getByText("React")).toBeInTheDocument();
  });

  it("applies_badge_and_badge_skill_classes", () => {
    render(<Badge variant="skill">React</Badge>);
    const el = screen.getByText("React");
    expect(el.className).toContain("badge");
    expect(el.className).toContain("badge-skill");
  });

  it("applies_badge_mint_class", () => {
    render(<Badge variant="mint">Acquis</Badge>);
    const el = screen.getByText("Acquis");
    expect(el.className).toContain("badge-mint");
  });

  it("applies_badge_coral_dark_class", () => {
    render(<Badge variant="coral-dark">Manquant</Badge>);
    const el = screen.getByText("Manquant");
    expect(el.className).toContain("badge-coral-dark");
  });

  it("applies_badge_peach_dark_class", () => {
    render(<Badge variant="peach-dark">Recommandé</Badge>);
    const el = screen.getByText("Recommandé");
    expect(el.className).toContain("badge-peach-dark");
  });

  it("renders_as_span_element", () => {
    render(<Badge variant="skill">TypeScript</Badge>);
    expect(screen.getByText("TypeScript").tagName).toBe("SPAN");
  });

  it("defaults_to_skill_variant_when_omitted", () => {
    render(<Badge>Default</Badge>);
    const el = screen.getByText("Default");
    expect(el.className).toContain("badge");
    expect(el.className).toContain("badge-skill");
  });
});
