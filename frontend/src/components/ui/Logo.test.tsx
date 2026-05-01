/**
 * Tests unitaires — Logo
 *
 * next/image est mocké car Vitest/jsdom ne supporte pas l'optimisation d'image Next.js.
 * On vérifie le comportement du composant (src, alt, taille) sans la pipeline d'optimisation.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Logo } from "./Logo";

// Mock next/image — rendu simplifié en <img> avec les props transmis
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

describe("Logo", () => {
  // ---------------------------------------------------------------------------
  // Mode standard (PNG via next/image)
  // ---------------------------------------------------------------------------

  it("renders_img_with_alt_brightoff_in_standard_mode", () => {
    render(<Logo />);
    expect(screen.getByAltText("BrightOff")).toBeInTheDocument();
  });

  it("renders_img_element_in_standard_mode", () => {
    render(<Logo />);
    expect(screen.getByRole("img")).toBeInTheDocument();
  });

  it("uses_logo_png_src_in_standard_mode", () => {
    render(<Logo />);
    expect(screen.getByAltText("BrightOff")).toHaveAttribute("src", "/logo.png");
  });

  it("applies_default_size_140px_in_standard_mode", () => {
    render(<Logo />);
    const img = screen.getByAltText("BrightOff") as HTMLImageElement;
    expect(img.style.width).toBe("140px");
  });

  it("applies_custom_size_in_standard_mode", () => {
    render(<Logo size={200} />);
    const img = screen.getByAltText("BrightOff") as HTMLImageElement;
    expect(img.style.width).toBe("200px");
  });

  it("sets_height_auto_to_preserve_ratio", () => {
    render(<Logo />);
    const img = screen.getByAltText("BrightOff") as HTMLImageElement;
    expect(img.style.height).toBe("auto");
  });

  // ---------------------------------------------------------------------------
  // Mode white (SVG inline)
  // ---------------------------------------------------------------------------

  it("renders_svg_element_in_white_mode", () => {
    render(<Logo variant="white" />);
    const svg = document.querySelector("svg");
    expect(svg).toBeInTheDocument();
  });

  it("svg_has_brightoff_aria_label_in_white_mode", () => {
    render(<Logo variant="white" />);
    expect(screen.getByRole("img", { name: /brightoff/i })).toBeInTheDocument();
  });

  it("svg_contains_brightoff_text_in_white_mode", () => {
    render(<Logo variant="white" />);
    expect(screen.getByText("BrightOff")).toBeInTheDocument();
  });

  it("svg_text_is_white_in_white_mode", () => {
    render(<Logo variant="white" />);
    const text = document.querySelector("svg text");
    expect(text).toHaveAttribute("fill", "white");
  });

  it("svg_width_matches_size_prop_in_white_mode", () => {
    render(<Logo variant="white" size={120} />);
    const svg = document.querySelector("svg");
    expect(svg).toHaveAttribute("width", "120");
  });

  it("svg_uses_default_size_140_in_white_mode", () => {
    render(<Logo variant="white" />);
    const svg = document.querySelector("svg");
    expect(svg).toHaveAttribute("width", "140");
  });
});
