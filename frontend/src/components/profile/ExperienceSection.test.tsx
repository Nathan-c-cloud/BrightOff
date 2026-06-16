/**
 * Tests unitaires — ExperienceSection
 *
 * Couvre :
 *   - Render : cartes avec poste bold, entreprise, plage de dates calculee, duree calculee
 *   - Etat vide : message "Aucune experience ajoutee."
 *   - Presence icone edit par carte
 *   - Clic icone edit → onEdit(item) appele avec le bon item
 *   - Clic "+ Ajouter une experience" → onAdd appele
 *   - Plusieurs experiences : toutes affichees
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ExperienceSection } from "./ExperienceSection";
import type { Experience } from "@/lib/api-profile";

// ---------------------------------------------------------------------------
// Factories helpers
// ---------------------------------------------------------------------------

function makeExperience(overrides?: Partial<Experience>): Experience {
  return {
    id: "exp1",
    company: "Acme Corp",
    position: "Developpeur Fullstack",
    start_date: "2022-01-01",
    end_date: "2024-06-01",
    description: "Missions diverses",
    ...overrides,
  };
}

function defaultProps(overrides?: Partial<Parameters<typeof ExperienceSection>[0]>) {
  return {
    experiences: [makeExperience()],
    onEdit: vi.fn(),
    onAdd: vi.fn(),
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

describe("ExperienceSection", () => {
  // -------------------------------------------------------------------------
  // Render — etat vide
  // -------------------------------------------------------------------------

  it("renders_empty_message_when_no_experiences", () => {
    render(<ExperienceSection {...defaultProps({ experiences: [] })} />);
    expect(screen.getByText(/aucune experience ajoutee/i)).toBeInTheDocument();
  });

  it("still_renders_add_button_when_no_experiences", () => {
    render(<ExperienceSection {...defaultProps({ experiences: [] })} />);
    expect(
      screen.getByRole("button", { name: /\+ ajouter une experience/i })
    ).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // Render — carte experience
  // -------------------------------------------------------------------------

  it("renders_position_in_bold", () => {
    render(<ExperienceSection {...defaultProps()} />);
    const boldEl = screen.getByText("Developpeur Fullstack");
    expect(boldEl.tagName).toBe("B");
  });

  it("renders_company_name", () => {
    render(<ExperienceSection {...defaultProps()} />);
    expect(screen.getByText(/acme corp/i)).toBeInTheDocument();
  });

  it("renders_formatted_date_range", () => {
    // start: 2022-01-01 → jan. 2022, end: 2024-06-01 → juin 2024
    render(<ExperienceSection {...defaultProps()} />);
    expect(screen.getByText(/jan\. 2022/i)).toBeInTheDocument();
    expect(screen.getByText(/juin 2024/i)).toBeInTheDocument();
  });

  it("renders_calculated_duration", () => {
    // 2022-01-01 → 2024-06-01 = 2 ans 5 mois
    render(<ExperienceSection {...defaultProps()} />);
    expect(screen.getByText(/2 ans 5 mois/i)).toBeInTheDocument();
  });

  it("renders_en_cours_when_end_date_is_null", () => {
    render(
      <ExperienceSection
        {...defaultProps({
          experiences: [makeExperience({ end_date: null })],
        })}
      />
    );
    // "en cours" est rendu dans un seul <p> : "Acme Corp · jan. 2022 — en cours · en cours"
    expect(screen.getAllByText(/en cours/i)).toHaveLength(1);
  });

  // -------------------------------------------------------------------------
  // Icone edit
  // -------------------------------------------------------------------------

  it("renders_edit_button_for_each_experience_card", () => {
    const experiences = [
      makeExperience({ id: "exp1", position: "Dev Frontend" }),
      makeExperience({ id: "exp2", position: "Dev Backend" }),
    ];
    render(<ExperienceSection {...defaultProps({ experiences })} />);
    const editButtons = screen.getAllByRole("button", { name: /modifier l.experience/i });
    expect(editButtons).toHaveLength(2);
  });

  it("calls_onEdit_with_correct_item_when_edit_button_clicked", async () => {
    const onEdit = vi.fn();
    const experience = makeExperience();
    const user = userEvent.setup();
    render(<ExperienceSection {...defaultProps({ experiences: [experience], onEdit })} />);

    await user.click(
      screen.getByRole("button", { name: /modifier l.experience developpeur fullstack/i })
    );
    expect(onEdit).toHaveBeenCalledOnce();
    expect(onEdit).toHaveBeenCalledWith(experience);
  });

  it("calls_correct_onEdit_for_each_card_when_multiple_experiences", async () => {
    const onEdit = vi.fn();
    const exp1 = makeExperience({ id: "exp1", position: "Dev Frontend" });
    const exp2 = makeExperience({ id: "exp2", position: "Dev Backend" });
    const user = userEvent.setup();
    render(<ExperienceSection {...defaultProps({ experiences: [exp1, exp2], onEdit })} />);

    await user.click(
      screen.getByRole("button", { name: /modifier l.experience dev backend/i })
    );
    expect(onEdit).toHaveBeenCalledWith(exp2);
  });

  // -------------------------------------------------------------------------
  // Bouton "+ Ajouter une experience"
  // -------------------------------------------------------------------------

  it("calls_onAdd_when_add_button_is_clicked", async () => {
    const onAdd = vi.fn();
    const user = userEvent.setup();
    render(<ExperienceSection {...defaultProps({ onAdd })} />);

    await user.click(screen.getByRole("button", { name: /\+ ajouter une experience/i }));
    expect(onAdd).toHaveBeenCalledOnce();
  });

  // -------------------------------------------------------------------------
  // Section heading
  // -------------------------------------------------------------------------

  it("renders_experience_heading", () => {
    render(<ExperienceSection {...defaultProps()} />);
    expect(screen.getByRole("heading", { name: "Experience" })).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // Plusieurs cartes
  // -------------------------------------------------------------------------

  it("renders_all_experiences_when_multiple", () => {
    const experiences = [
      makeExperience({ id: "exp1", position: "Dev Frontend" }),
      makeExperience({ id: "exp2", position: "Dev Backend" }),
      makeExperience({ id: "exp3", position: "Lead Dev" }),
    ];
    render(<ExperienceSection {...defaultProps({ experiences })} />);
    expect(screen.getByText("Dev Frontend")).toBeInTheDocument();
    expect(screen.getByText("Dev Backend")).toBeInTheDocument();
    expect(screen.getByText("Lead Dev")).toBeInTheDocument();
  });
});
