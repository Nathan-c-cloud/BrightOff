/**
 * Tests unitaires — NavPublic
 *
 * next/image est mocké car le composant Logo utilise next/image en mode standard.
 * next/link est laissé réel — il renvoie un <a> dans le contexte jsdom (pas de router needed
 * pour les composants statiques en App Router).
 */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { NavPublic } from "./NavPublic";

// Mock next/image (utilisé par Logo en mode standard)
import { vi } from "vitest";
vi.mock("next/image", () => ({
  default: ({
    src,
    alt,
    width,
    height,
    style,
    ...rest
  }: {
    src: string;
    alt: string;
    width?: number;
    height?: number;
    style?: React.CSSProperties;
    [key: string]: unknown;
  }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} width={width} height={height} style={style} {...rest} />
  ),
}));

describe("NavPublic", () => {
  it("renders_logo", () => {
    render(<NavPublic />);
    expect(screen.getByAltText("BrightOff")).toBeInTheDocument();
  });

  it("logo_links_to_home", () => {
    render(<NavPublic />);
    const logoLink = screen.getByRole("link", { name: /retour à l'accueil/i });
    expect(logoLink).toHaveAttribute("href", "/");
  });

  it("renders_connexion_link_with_default_href", () => {
    render(<NavPublic />);
    const connexionLink = screen.getByRole("link", { name: "Connexion" });
    expect(connexionLink).toBeInTheDocument();
    expect(connexionLink).toHaveAttribute("href", "/login");
  });

  it("renders_register_link_with_default_href", () => {
    render(<NavPublic />);
    const registerLink = screen.getByRole("link", { name: /s'inscrire/i });
    expect(registerLink).toBeInTheDocument();
    expect(registerLink).toHaveAttribute("href", "/register");
  });

  it("custom_loginHref_overrides_default", () => {
    render(<NavPublic loginHref="/auth/login" />);
    expect(screen.getByRole("link", { name: "Connexion" })).toHaveAttribute(
      "href",
      "/auth/login"
    );
  });

  it("custom_registerHref_overrides_default", () => {
    render(<NavPublic registerHref="/auth/register" />);
    expect(screen.getByRole("link", { name: /s'inscrire/i })).toHaveAttribute(
      "href",
      "/auth/register"
    );
  });

  it("renders_as_header_element", () => {
    const { container } = render(<NavPublic />);
    expect(container.querySelector("header")).toBeInTheDocument();
  });

  it("connexion_link_has_ghost_btn_classes", () => {
    render(<NavPublic />);
    const link = screen.getByRole("link", { name: "Connexion" });
    expect(link.className).toContain("btn");
    expect(link.className).toContain("btn-ghost");
  });

  it("register_link_has_coral_btn_classes", () => {
    render(<NavPublic />);
    const link = screen.getByRole("link", { name: /s'inscrire/i });
    expect(link.className).toContain("btn");
    expect(link.className).toContain("btn-coral");
  });
});
