import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Field } from "./Field";

describe("Field", () => {
  it("renders_label_text", () => {
    render(
      <Field label="Email">
        <input id="email" />
      </Field>
    );
    expect(screen.getByText("Email")).toBeInTheDocument();
  });

  it("renders_children_inside_label", () => {
    render(
      <Field label="Email">
        <input id="email" placeholder="email" />
      </Field>
    );
    expect(screen.getByPlaceholderText("email")).toBeInTheDocument();
  });

  it("renders_as_label_element_with_field_class", () => {
    const { container } = render(
      <Field label="Email">
        <input id="email" />
      </Field>
    );
    const label = container.firstChild as HTMLElement;
    expect(label.tagName).toBe("LABEL");
    expect(label.className).toContain("field");
  });

  it("sets_htmlFor_on_label_element", () => {
    const { container } = render(
      <Field label="Email" htmlFor="email">
        <input id="email" />
      </Field>
    );
    const label = container.firstChild as HTMLElement;
    expect(label).toHaveAttribute("for", "email");
  });

  it("renders_error_message_when_provided", () => {
    render(
      <Field label="Email" error="Champ requis">
        <input id="email" />
      </Field>
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Champ requis");
  });

  it("does_not_render_error_by_default", () => {
    render(
      <Field label="Email">
        <input id="email" />
      </Field>
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("renders_helper_text_when_no_error", () => {
    render(
      <Field label="Email" helperText="Votre email professionnel">
        <input id="email" />
      </Field>
    );
    expect(screen.getByText("Votre email professionnel")).toBeInTheDocument();
  });

  it("does_not_render_helper_when_error_is_provided", () => {
    render(
      <Field label="Email" error="Erreur" helperText="Aide">
        <input id="email" />
      </Field>
    );
    // L'erreur prend le dessus — l'aide ne s'affiche pas
    expect(screen.queryByText("Aide")).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Erreur");
  });

  it("error_span_has_text_error_class", () => {
    render(
      <Field label="Email" error="Requis">
        <input id="email" />
      </Field>
    );
    const errorSpan = screen.getByRole("alert");
    expect(errorSpan.className).toContain("text-error");
  });
});
