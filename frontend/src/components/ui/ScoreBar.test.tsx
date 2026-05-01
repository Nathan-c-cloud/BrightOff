import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ScoreBar } from "./ScoreBar";

describe("ScoreBar", () => {
  it("applies_correct_width_to_fill_element", () => {
    const { container } = render(<ScoreBar score={50} />);
    const fill = container.querySelector(".bar > i") as HTMLElement;
    expect(fill.style.width).toBe("50%");
  });

  it("clamps_score_below_zero_to_zero", () => {
    const { container } = render(<ScoreBar score={-20} />);
    const fill = container.querySelector(".bar > i") as HTMLElement;
    expect(fill.style.width).toBe("0%");
  });

  it("clamps_score_above_100_to_100", () => {
    const { container } = render(<ScoreBar score={150} />);
    const fill = container.querySelector(".bar > i") as HTMLElement;
    expect(fill.style.width).toBe("100%");
  });

  it("renders_label_above_bar_when_provided", () => {
    render(<ScoreBar score={70} label="Compétences techniques" />);
    expect(screen.getByText("Compétences techniques")).toBeInTheDocument();
  });

  it("does_not_render_label_when_not_provided", () => {
    const { container } = render(<ScoreBar score={70} />);
    // Seul le wrapper progressbar et la barre elle-même — pas de div label
    const textNodes = container.querySelectorAll("div > div:first-child");
    // Vérifie qu'il n'y a pas de texte de label superflu
    textNodes.forEach((node) => {
      expect(node.className).not.toContain("label");
    });
  });

  it("renders_numeric_value_when_showValue_true", () => {
    render(<ScoreBar score={78} showValue />);
    expect(screen.getByText("78%")).toBeInTheDocument();
  });

  it("does_not_render_numeric_value_when_showValue_false", () => {
    render(<ScoreBar score={78} />);
    expect(screen.queryByText("78%")).not.toBeInTheDocument();
  });

  it("has_role_progressbar", () => {
    render(<ScoreBar score={60} />);
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });

  it("has_aria_valuenow_matching_clamped_score", () => {
    render(<ScoreBar score={60} />);
    expect(screen.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "60"
    );
  });

  it("has_aria_valuemin_of_zero", () => {
    render(<ScoreBar score={60} />);
    expect(screen.getByRole("progressbar")).toHaveAttribute(
      "aria-valuemin",
      "0"
    );
  });

  it("has_aria_valuemax_of_100", () => {
    render(<ScoreBar score={60} />);
    expect(screen.getByRole("progressbar")).toHaveAttribute(
      "aria-valuemax",
      "100"
    );
  });

  it("aria_valuenow_reflects_clamped_value_for_out_of_range_score", () => {
    render(<ScoreBar score={200} />);
    expect(screen.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "100"
    );
  });
});
