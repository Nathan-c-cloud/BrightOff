/**
 * Tests unitaires — EducationSection
 *
 * Couvre :
 *   - Render : cartes avec diplome bold, ecole, plage de dates calculee, duree calculee
 *   - Etat vide : message "Aucune formation ajoutée."
 *   - Presence icone edit par carte
 *   - Clic icone edit → onEdit(item) appele avec le bon item
 *   - Clic "+ Ajouter une formation" → onAdd appele
 *   - Plusieurs formations : toutes affichees
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EducationSection } from "./EducationSection";
import type { Education } from "@/lib/api-profile";

// ---------------------------------------------------------------------------
// Factories helpers
// ---------------------------------------------------------------------------

function makeEducation(overrides?: Partial<Education>): Education {
  return {
    id: "ed1",
    school: "ESIGELEC",
    degree: "Ingenieur",
    field: "Informatique",
    start_date: "2020-09-01",
    end_date: "2023-06-30",
    ...overrides,
  };
}

function defaultProps(overrides?: Partial<Parameters<typeof EducationSection>[0]>) {
  return {
    educations: [makeEducation()],
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

describe("EducationSection", () => {
  // -------------------------------------------------------------------------
  // Render — etat vide
  // -------------------------------------------------------------------------

  it("renders_empty_message_when_no_educations", () => {
    render(<EducationSection {...defaultProps({ educations: [] })} />);
    expect(screen.getByText(/aucune formation ajoutée/i)).toBeInTheDocument();
  });

  it("still_renders_add_button_when_no_educations", () => {
    render(<EducationSection {...defaultProps({ educations: [] })} />);
    expect(
      screen.getByRole("button", { name: /\+ ajouter une formation/i })
    ).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // Render — carte formation
  // -------------------------------------------------------------------------

  it("renders_degree_in_bold", () => {
    render(<EducationSection {...defaultProps()} />);
    const boldEl = screen.getByText("Ingenieur");
    expect(boldEl.tagName).toBe("B");
  });

  it("renders_school_name", () => {
    render(<EducationSection {...defaultProps()} />);
    expect(screen.getByText(/esigelec/i)).toBeInTheDocument();
  });

  it("renders_field_when_present", () => {
    render(<EducationSection {...defaultProps()} />);
    expect(screen.getByText(/informatique/i)).toBeInTheDocument();
  });

  it("does_not_render_field_separator_when_field_is_null", () => {
    render(
      <EducationSection
        {...defaultProps({ educations: [makeEducation({ field: null })] })}
      />
    );
    // Le champ "Informatique" n'apparait pas quand field est null
    expect(screen.queryByText(/informatique/i)).not.toBeInTheDocument();
  });

  it("renders_formatted_date_range", () => {
    // start: 2020-09-01 → sept. 2020, end: 2023-06-30 → juin 2023
    render(<EducationSection {...defaultProps()} />);
    expect(screen.getByText(/sept\. 2020/i)).toBeInTheDocument();
    expect(screen.getByText(/juin 2023/i)).toBeInTheDocument();
  });

  it("renders_calculated_duration", () => {
    // 2020-09-01 → 2023-06-30 : 2 ans 9 mois
    render(<EducationSection {...defaultProps()} />);
    expect(screen.getByText(/2 ans 9 mois/i)).toBeInTheDocument();
  });

  it("renders_en_cours_when_end_date_is_null", () => {
    render(
      <EducationSection
        {...defaultProps({
          educations: [makeEducation({ end_date: null })],
        })}
      />
    );
    // "en cours" est rendu dans un seul <p> : "ESIGELEC · sept. 2020 — en cours · en cours"
    expect(screen.getAllByText(/en cours/i)).toHaveLength(1);
  });

  // -------------------------------------------------------------------------
  // Icone edit
  // -------------------------------------------------------------------------

  it("renders_edit_button_for_each_education_card", () => {
    const educations = [
      makeEducation({ id: "ed1", degree: "Master" }),
      makeEducation({ id: "ed2", degree: "Licence" }),
    ];
    render(<EducationSection {...defaultProps({ educations })} />);
    const editButtons = screen.getAllByRole("button", { name: /modifier la formation/i });
    expect(editButtons).toHaveLength(2);
  });

  it("calls_onEdit_with_correct_item_when_edit_button_clicked", async () => {
    const onEdit = vi.fn();
    const education = makeEducation();
    const user = userEvent.setup();
    render(<EducationSection {...defaultProps({ educations: [education], onEdit })} />);

    await user.click(screen.getByRole("button", { name: /modifier la formation ingenieur/i }));
    expect(onEdit).toHaveBeenCalledOnce();
    expect(onEdit).toHaveBeenCalledWith(education);
  });

  it("calls_correct_onEdit_for_each_card_when_multiple_educations", async () => {
    const onEdit = vi.fn();
    const ed1 = makeEducation({ id: "ed1", degree: "Master" });
    const ed2 = makeEducation({ id: "ed2", degree: "Licence" });
    const user = userEvent.setup();
    render(<EducationSection {...defaultProps({ educations: [ed1, ed2], onEdit })} />);

    await user.click(screen.getByRole("button", { name: /modifier la formation licence/i }));
    expect(onEdit).toHaveBeenCalledWith(ed2);
  });

  // -------------------------------------------------------------------------
  // Bouton "+ Ajouter une formation"
  // -------------------------------------------------------------------------

  it("calls_onAdd_when_add_button_is_clicked", async () => {
    const onAdd = vi.fn();
    const user = userEvent.setup();
    render(<EducationSection {...defaultProps({ onAdd })} />);

    await user.click(screen.getByRole("button", { name: /\+ ajouter une formation/i }));
    expect(onAdd).toHaveBeenCalledOnce();
  });

  // -------------------------------------------------------------------------
  // Section heading
  // -------------------------------------------------------------------------

  it("renders_formation_heading", () => {
    render(<EducationSection {...defaultProps()} />);
    expect(screen.getByRole("heading", { name: "Formation" })).toBeInTheDocument();
  });
});
