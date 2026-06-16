/**
 * Tests unitaires — SkillsSection
 *
 * Couvre :
 *   - Render : chips correpondant aux skills filtrees par section
 *   - Titre "Hard skills" ou "Soft skills" selon prop section
 *   - Clic X d'une chip → onRemove(skillId) appele
 *   - Clic "+ Ajouter" → input apparait
 *   - Tape nom + Enter → onAdd(name, category) appele, input se ferme
 *   - Escape sur input → input se ferme sans appeler onAdd
 *   - Blur sur input avec valeur → onAdd appele
 *   - Blur sur input vide → input se ferme SANS appeler onAdd
 *   - Race condition ignoreNextBlur : clic X alors qu'input actif → seul onRemove appele
 *   - Mode saving : boutons desactives
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SkillsSection } from "./SkillsSection";
import type { Skill } from "@/lib/api-profile";

// ---------------------------------------------------------------------------
// Factories helpers
// ---------------------------------------------------------------------------

function makeSkill(
  id: string,
  name: string,
  category: "technique" | "outil" | "soft_skill" = "technique"
): Skill {
  return { id, name, category, level: null };
}

function defaultProps(
  section: "hard" | "soft" = "hard",
  overrides?: Partial<Parameters<typeof SkillsSection>[0]>
) {
  return {
    section,
    skills: [
      makeSkill("s1", "React", "technique"),
      makeSkill("s2", "Node.js", "technique"),
      makeSkill("s3", "Travail en equipe", "soft_skill"),
    ],
    onAdd: vi.fn().mockResolvedValue(undefined),
    onRemove: vi.fn().mockResolvedValue(undefined),
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

describe("SkillsSection — section hard", () => {
  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  it("renders_hard_skills_title", () => {
    render(<SkillsSection {...defaultProps("hard")} />);
    expect(screen.getByRole("heading", { name: "Hard skills" })).toBeInTheDocument();
  });

  it("renders_only_hard_skill_chips", () => {
    render(<SkillsSection {...defaultProps("hard")} />);
    expect(screen.getByText("React")).toBeInTheDocument();
    expect(screen.getByText("Node.js")).toBeInTheDocument();
    // La skill soft ne doit pas apparaitre dans la section hard
    expect(screen.queryByText("Travail en equipe")).not.toBeInTheDocument();
  });

  it("renders_correct_number_of_chips_for_hard_section", () => {
    render(<SkillsSection {...defaultProps("hard")} />);
    // 2 hard skills → 2 boutons de suppression (aria-label "Retirer ...")
    const removeButtons = screen.getAllByRole("button", { name: /retirer/i });
    expect(removeButtons).toHaveLength(2);
  });

  it("renders_add_button_initially", () => {
    render(<SkillsSection {...defaultProps("hard")} />);
    expect(screen.getByRole("button", { name: /\+ ajouter/i })).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // Clic X → onRemove
  // -------------------------------------------------------------------------

  it("calls_onRemove_with_skill_id_when_x_button_clicked", async () => {
    const onRemove = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<SkillsSection {...defaultProps("hard", { onRemove })} />);

    await user.click(screen.getByRole("button", { name: "Retirer React" }));
    expect(onRemove).toHaveBeenCalledOnce();
    expect(onRemove).toHaveBeenCalledWith("s1");
  });

  // -------------------------------------------------------------------------
  // Clic "+ Ajouter" → input apparait
  // -------------------------------------------------------------------------

  it("shows_input_when_add_button_is_clicked", async () => {
    const user = userEvent.setup();
    render(<SkillsSection {...defaultProps("hard")} />);
    await user.click(screen.getByRole("button", { name: /\+ ajouter/i }));
    expect(screen.getByPlaceholderText(/ajouter/i)).toBeInTheDocument();
  });

  it("hides_add_button_when_input_is_visible", async () => {
    const user = userEvent.setup();
    render(<SkillsSection {...defaultProps("hard")} />);
    await user.click(screen.getByRole("button", { name: /\+ ajouter/i }));
    expect(screen.queryByRole("button", { name: /\+ ajouter/i })).not.toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // Enter → onAdd appele
  // -------------------------------------------------------------------------

  it("calls_onAdd_with_trimmed_name_and_technique_category_on_enter", async () => {
    const onAdd = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<SkillsSection {...defaultProps("hard", { onAdd })} />);

    await user.click(screen.getByRole("button", { name: /\+ ajouter/i }));
    const input = screen.getByPlaceholderText(/ajouter/i);
    await user.type(input, "TypeScript");
    await user.keyboard("{Enter}");

    expect(onAdd).toHaveBeenCalledOnce();
    expect(onAdd).toHaveBeenCalledWith("TypeScript", "technique");
  });

  it("closes_input_after_enter", async () => {
    const onAdd = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<SkillsSection {...defaultProps("hard", { onAdd })} />);

    await user.click(screen.getByRole("button", { name: /\+ ajouter/i }));
    const input = screen.getByPlaceholderText(/ajouter/i);
    await user.type(input, "TypeScript");
    await user.keyboard("{Enter}");

    await waitFor(() => {
      expect(screen.queryByPlaceholderText(/ajouter/i)).not.toBeInTheDocument();
    });
  });

  it("does_not_call_onAdd_when_enter_is_pressed_on_empty_input", async () => {
    const onAdd = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<SkillsSection {...defaultProps("hard", { onAdd })} />);

    await user.click(screen.getByRole("button", { name: /\+ ajouter/i }));
    await user.keyboard("{Enter}");

    expect(onAdd).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Escape → fermeture sans onAdd
  // -------------------------------------------------------------------------

  it("closes_input_on_escape_without_calling_onAdd", async () => {
    const onAdd = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<SkillsSection {...defaultProps("hard", { onAdd })} />);

    await user.click(screen.getByRole("button", { name: /\+ ajouter/i }));
    const input = screen.getByPlaceholderText(/ajouter/i);
    await user.type(input, "React Native");
    await user.keyboard("{Escape}");

    await waitFor(() => {
      expect(screen.queryByPlaceholderText(/ajouter/i)).not.toBeInTheDocument();
    });
    expect(onAdd).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Blur avec valeur → onAdd appele
  // -------------------------------------------------------------------------

  it("calls_onAdd_on_blur_when_input_has_value", async () => {
    const onAdd = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<SkillsSection {...defaultProps("hard", { onAdd })} />);

    await user.click(screen.getByRole("button", { name: /\+ ajouter/i }));
    const input = screen.getByPlaceholderText(/ajouter/i);
    await user.type(input, "Vue");
    fireEvent.blur(input);

    await waitFor(() => {
      expect(onAdd).toHaveBeenCalledWith("Vue", "technique");
    });
  });

  // -------------------------------------------------------------------------
  // Blur sur input vide → fermeture SANS onAdd
  // -------------------------------------------------------------------------

  it("closes_input_on_blur_without_calling_onAdd_when_input_is_empty", async () => {
    const onAdd = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<SkillsSection {...defaultProps("hard", { onAdd })} />);

    await user.click(screen.getByRole("button", { name: /\+ ajouter/i }));
    const input = screen.getByPlaceholderText(/ajouter/i);
    fireEvent.blur(input);

    await waitFor(() => {
      expect(screen.queryByPlaceholderText(/ajouter/i)).not.toBeInTheDocument();
    });
    expect(onAdd).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Race condition ignoreNextBlur
  // -------------------------------------------------------------------------

  it("does_not_call_onAdd_when_x_button_is_mousedown_while_input_is_active", async () => {
    const onAdd = vi.fn().mockResolvedValue(undefined);
    const onRemove = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<SkillsSection {...defaultProps("hard", { onAdd, onRemove })} />);

    // Ouvrir l'input et taper une valeur
    await user.click(screen.getByRole("button", { name: /\+ ajouter/i }));
    const input = screen.getByPlaceholderText(/ajouter/i);
    await user.type(input, "SomeSkill");

    // Simuler mousedown sur le bouton X (comme le ferait un vrai navigateur)
    // puis blur sur l'input (declenchee normalement avant le click)
    const removeButton = screen.getByRole("button", { name: "Retirer React" });
    fireEvent.mouseDown(removeButton);
    fireEvent.blur(input);

    // Le flag ignoreNextBlur doit empecher onAdd d'etre appele
    expect(onAdd).not.toHaveBeenCalled();
  });
});

describe("SkillsSection — section soft", () => {
  it("renders_soft_skills_title", () => {
    render(<SkillsSection {...defaultProps("soft")} />);
    expect(screen.getByRole("heading", { name: "Soft skills" })).toBeInTheDocument();
  });

  it("renders_only_soft_skill_chips", () => {
    render(<SkillsSection {...defaultProps("soft")} />);
    expect(screen.getByText("Travail en equipe")).toBeInTheDocument();
    expect(screen.queryByText("React")).not.toBeInTheDocument();
    expect(screen.queryByText("Node.js")).not.toBeInTheDocument();
  });

  it("calls_onAdd_with_soft_skill_category_on_enter", async () => {
    const onAdd = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<SkillsSection {...defaultProps("soft", { onAdd })} />);

    await user.click(screen.getByRole("button", { name: /\+ ajouter/i }));
    const input = screen.getByPlaceholderText(/ajouter/i);
    await user.type(input, "Creativite");
    await user.keyboard("{Enter}");

    expect(onAdd).toHaveBeenCalledWith("Creativite", "soft_skill");
  });
});

describe("SkillsSection — mode saving", () => {
  it("disables_remove_buttons_when_saving_is_true", () => {
    render(<SkillsSection {...defaultProps("hard", { saving: true })} />);
    const removeButtons = screen.getAllByRole("button", { name: /retirer/i });
    removeButtons.forEach((btn) => expect(btn).toBeDisabled());
  });

  it("disables_add_button_when_saving_is_true", () => {
    render(<SkillsSection {...defaultProps("hard", { saving: true })} />);
    expect(screen.getByRole("button", { name: /\+ ajouter/i })).toBeDisabled();
  });
});
