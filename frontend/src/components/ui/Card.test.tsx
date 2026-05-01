import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Card } from "./Card";

describe("Card", () => {
  it("renders_children", () => {
    render(<Card>Contenu de la carte</Card>);
    expect(screen.getByText("Contenu de la carte")).toBeInTheDocument();
  });

  it("applies_card_class", () => {
    render(<Card>Contenu</Card>);
    // Le div wrapper doit contenir la classe .card
    expect(screen.getByText("Contenu").className).toContain("card");
  });

  it("applies_card_class_directly_on_element", () => {
    const { container } = render(<Card>Contenu</Card>);
    const div = container.firstChild as HTMLElement;
    expect(div.className).toContain("card");
  });

  it("merges_custom_className_with_card", () => {
    const { container } = render(<Card className="p-6">Contenu</Card>);
    const div = container.firstChild as HTMLElement;
    expect(div.className).toContain("card");
    expect(div.className).toContain("p-6");
  });

  it("renders_as_div_element", () => {
    const { container } = render(<Card>Contenu</Card>);
    expect(container.firstChild?.nodeName).toBe("DIV");
  });

  it("renders_complex_children", () => {
    render(
      <Card>
        <h2>Titre</h2>
        <p>Description</p>
      </Card>
    );
    expect(screen.getByText("Titre")).toBeInTheDocument();
    expect(screen.getByText("Description")).toBeInTheDocument();
  });
});
