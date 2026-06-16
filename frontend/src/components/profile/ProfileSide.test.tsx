/**
 * Tests unitaires — ProfileSide
 *
 * Couvre :
 *   - Render : nom complet, email, bouton "Mettre a jour mon CV"
 *   - Avatar : initiales calculees depuis prenom + nom
 *   - Clic bouton → callback onReupload appele
 *   - Cas prenom ou nom vide : initiales et nom complet corrects
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProfileSide } from "./ProfileSide";

// ---------------------------------------------------------------------------
// Props par defaut
// ---------------------------------------------------------------------------

function defaultProps(overrides?: Partial<Parameters<typeof ProfileSide>[0]>) {
  return {
    firstName: "Alice",
    lastName: "Martin",
    email: "alice@example.com",
    onReupload: vi.fn(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ProfileSide", () => {
  // -------------------------------------------------------------------------
  // Render — elements de base
  // -------------------------------------------------------------------------

  it("renders_full_name", () => {
    render(<ProfileSide {...defaultProps()} />);
    expect(screen.getByText("Alice Martin")).toBeInTheDocument();
  });

  it("renders_email", () => {
    render(<ProfileSide {...defaultProps()} />);
    expect(screen.getByText("alice@example.com")).toBeInTheDocument();
  });

  it("renders_reupload_button", () => {
    render(<ProfileSide {...defaultProps()} />);
    expect(
      screen.getByRole("button", { name: /mettre a jour mon cv/i })
    ).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // Avatar — initiales
  // -------------------------------------------------------------------------

  it("renders_correct_initials_in_avatar", () => {
    render(<ProfileSide {...defaultProps()} />);
    // Les initiales "AM" (Alice Martin) doivent etre dans le DOM
    expect(screen.getByText("AM")).toBeInTheDocument();
  });

  it("renders_two_chars_from_first_name_when_last_name_is_empty", () => {
    render(<ProfileSide {...defaultProps({ lastName: "" })} />);
    expect(screen.getByText("AL")).toBeInTheDocument();
  });

  it("renders_two_chars_from_last_name_when_first_name_is_empty", () => {
    render(<ProfileSide {...defaultProps({ firstName: "" })} />);
    expect(screen.getByText("MA")).toBeInTheDocument();
  });

  it("renders_email_initial_when_both_names_are_empty", () => {
    render(
      <ProfileSide
        {...defaultProps({ firstName: "", lastName: "", email: "nathan@example.com" })}
      />
    );
    // Fallback email : premiere lettre majuscule
    expect(screen.getByText("N")).toBeInTheDocument();
  });

  it("renders_question_mark_when_names_and_email_are_empty", () => {
    render(
      <ProfileSide
        {...defaultProps({ firstName: "", lastName: "", email: "" })}
      />
    );
    expect(screen.getByText("?")).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // Nom complet quand un champ est vide
  // -------------------------------------------------------------------------

  it("renders_only_first_name_when_last_name_is_empty", () => {
    render(<ProfileSide {...defaultProps({ lastName: "" })} />);
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Alice");
  });

  it("renders_only_last_name_when_first_name_is_empty", () => {
    render(<ProfileSide {...defaultProps({ firstName: "" })} />);
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Martin");
  });

  // -------------------------------------------------------------------------
  // Interaction — clic bouton reupload
  // -------------------------------------------------------------------------

  it("calls_onReupload_when_button_is_clicked", async () => {
    const onReupload = vi.fn();
    const user = userEvent.setup();
    render(<ProfileSide {...defaultProps({ onReupload })} />);
    await user.click(screen.getByRole("button", { name: /mettre a jour mon cv/i }));
    expect(onReupload).toHaveBeenCalledOnce();
  });

  it("does_not_call_onReupload_when_button_is_not_clicked", () => {
    const onReupload = vi.fn();
    render(<ProfileSide {...defaultProps({ onReupload })} />);
    expect(onReupload).not.toHaveBeenCalled();
  });
});
