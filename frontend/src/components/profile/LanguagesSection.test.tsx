/**
 * Tests unitaires — LanguagesSection
 *
 * Couvre :
 *   - Render : chips langue avec niveau (ex : "Anglais (B2)")
 *   - Clic X → onRemove(languageId) appele
 *   - Clic "+ Ajouter" → mini-form apparait (input nom + select niveau)
 *   - Liste des niveaux du select : A1, A2, B1, B2, C1, C2, Bilingue, Natif (8 options)
 *   - Enter sur input nom → onAdd({ name, level }) appele
 *   - Escape → form se ferme sans appel
 *   - Blur sur input vide → form se ferme sans appel
 *   - Blur sur input non vide → onAdd appele
 *   - Changement de select → niveau pris en compte dans l'appel onAdd
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LanguagesSection } from "./LanguagesSection";
import type { Language } from "@/lib/api-profile";

// ---------------------------------------------------------------------------
// Factories helpers
// ---------------------------------------------------------------------------

function makeLanguage(id: string, name: string, level: string): Language {
  return { id, name, level };
}

function defaultProps(overrides?: Partial<Parameters<typeof LanguagesSection>[0]>) {
  return {
    languages: [
      makeLanguage("l1", "Anglais", "B2"),
      makeLanguage("l2", "Espagnol", "A2"),
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

describe("LanguagesSection", () => {
  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  it("renders_section_title_langues", () => {
    render(<LanguagesSection {...defaultProps()} />);
    expect(screen.getByRole("heading", { name: "Langues" })).toBeInTheDocument();
  });

  it("renders_language_chips_with_level", () => {
    render(<LanguagesSection {...defaultProps()} />);
    // La chip affiche "Nom (Niveau)"
    expect(screen.getByText(/anglais \(b2\)/i)).toBeInTheDocument();
    expect(screen.getByText(/espagnol \(a2\)/i)).toBeInTheDocument();
  });

  it("renders_remove_button_for_each_language", () => {
    render(<LanguagesSection {...defaultProps()} />);
    const removeButtons = screen.getAllByRole("button", { name: /retirer/i });
    expect(removeButtons).toHaveLength(2);
  });

  it("renders_add_button_initially", () => {
    render(<LanguagesSection {...defaultProps()} />);
    expect(screen.getByRole("button", { name: /\+ ajouter/i })).toBeInTheDocument();
  });

  it("renders_empty_state_when_no_languages", () => {
    render(<LanguagesSection {...defaultProps({ languages: [] })} />);
    // Pas de chips, juste le bouton ajouter
    expect(screen.queryAllByRole("button", { name: /retirer/i })).toHaveLength(0);
    expect(screen.getByRole("button", { name: /\+ ajouter/i })).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // Clic X → onRemove
  // -------------------------------------------------------------------------

  it("calls_onRemove_with_language_id_when_x_button_clicked", async () => {
    const onRemove = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<LanguagesSection {...defaultProps({ onRemove })} />);

    await user.click(screen.getByRole("button", { name: "Retirer Anglais" }));
    expect(onRemove).toHaveBeenCalledOnce();
    expect(onRemove).toHaveBeenCalledWith("l1");
  });

  // -------------------------------------------------------------------------
  // Clic "+ Ajouter" → mini-form
  // -------------------------------------------------------------------------

  it("shows_name_input_and_level_select_when_add_button_clicked", async () => {
    const user = userEvent.setup();
    render(<LanguagesSection {...defaultProps()} />);

    await user.click(screen.getByRole("button", { name: /\+ ajouter/i }));
    expect(screen.getByPlaceholderText(/langue/i)).toBeInTheDocument();
    expect(screen.getByRole("combobox")).toBeInTheDocument();
  });

  it("hides_add_button_when_form_is_open", async () => {
    const user = userEvent.setup();
    render(<LanguagesSection {...defaultProps()} />);

    await user.click(screen.getByRole("button", { name: /\+ ajouter/i }));
    expect(screen.queryByRole("button", { name: /\+ ajouter/i })).not.toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // Niveaux du select
  // -------------------------------------------------------------------------

  it("renders_all_8_level_options_in_select", async () => {
    const user = userEvent.setup();
    render(<LanguagesSection {...defaultProps()} />);
    await user.click(screen.getByRole("button", { name: /\+ ajouter/i }));

    const select = screen.getByRole("combobox");
    const options = Array.from(select.querySelectorAll("option"));
    const optionValues = options.map((o) => o.value);

    expect(optionValues).toContain("A1");
    expect(optionValues).toContain("A2");
    expect(optionValues).toContain("B1");
    expect(optionValues).toContain("B2");
    expect(optionValues).toContain("C1");
    expect(optionValues).toContain("C2");
    expect(optionValues).toContain("Bilingue");
    expect(optionValues).toContain("Natif");
    expect(options).toHaveLength(8);
  });

  // -------------------------------------------------------------------------
  // Enter → onAdd appele
  // -------------------------------------------------------------------------

  it("calls_onAdd_with_name_and_default_level_on_enter", async () => {
    const onAdd = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<LanguagesSection {...defaultProps({ onAdd })} />);

    await user.click(screen.getByRole("button", { name: /\+ ajouter/i }));
    const input = screen.getByPlaceholderText(/langue/i);
    await user.type(input, "Français");
    await user.keyboard("{Enter}");

    expect(onAdd).toHaveBeenCalledOnce();
    // Le niveau par defaut est B1
    expect(onAdd).toHaveBeenCalledWith("Français", "B1");
  });

  it("calls_onAdd_with_selected_level_when_level_is_changed", async () => {
    const onAdd = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<LanguagesSection {...defaultProps({ onAdd })} />);

    await user.click(screen.getByRole("button", { name: /\+ ajouter/i }));

    // Taper le nom d'abord (le focus reste sur l'input), puis changer le select via fireEvent
    // pour ne pas declencher de blur qui fermerait le mini-form.
    const input = screen.getByPlaceholderText(/langue/i);
    await user.type(input, "Allemand");
    const select = screen.getByRole("combobox");
    fireEvent.change(select, { target: { value: "C1" } });
    await user.keyboard("{Enter}");

    expect(onAdd).toHaveBeenCalledWith("Allemand", "C1");
  });

  it("closes_form_after_submit_on_enter", async () => {
    const onAdd = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<LanguagesSection {...defaultProps({ onAdd })} />);

    await user.click(screen.getByRole("button", { name: /\+ ajouter/i }));
    await user.type(screen.getByPlaceholderText(/langue/i), "Italien");
    await user.keyboard("{Enter}");

    await waitFor(() => {
      expect(screen.queryByPlaceholderText(/langue/i)).not.toBeInTheDocument();
    });
  });

  it("does_not_call_onAdd_when_enter_on_empty_input", async () => {
    const onAdd = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<LanguagesSection {...defaultProps({ onAdd })} />);

    await user.click(screen.getByRole("button", { name: /\+ ajouter/i }));
    await user.keyboard("{Enter}");

    expect(onAdd).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Escape → fermeture sans onAdd
  // -------------------------------------------------------------------------

  it("closes_form_on_escape_without_calling_onAdd", async () => {
    const onAdd = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<LanguagesSection {...defaultProps({ onAdd })} />);

    await user.click(screen.getByRole("button", { name: /\+ ajouter/i }));
    const input = screen.getByPlaceholderText(/langue/i);
    await user.type(input, "Portugais");
    await user.keyboard("{Escape}");

    await waitFor(() => {
      expect(screen.queryByPlaceholderText(/langue/i)).not.toBeInTheDocument();
    });
    expect(onAdd).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Blur
  // -------------------------------------------------------------------------

  it("calls_onAdd_on_blur_when_input_has_value", async () => {
    const onAdd = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<LanguagesSection {...defaultProps({ onAdd })} />);

    await user.click(screen.getByRole("button", { name: /\+ ajouter/i }));
    const input = screen.getByPlaceholderText(/langue/i);
    await user.type(input, "Chinois");
    fireEvent.blur(input);

    await waitFor(() => {
      expect(onAdd).toHaveBeenCalledWith("Chinois", "B1");
    });
  });

  it("closes_form_on_blur_without_calling_onAdd_when_input_is_empty", async () => {
    const onAdd = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<LanguagesSection {...defaultProps({ onAdd })} />);

    await user.click(screen.getByRole("button", { name: /\+ ajouter/i }));
    const input = screen.getByPlaceholderText(/langue/i);
    fireEvent.blur(input);

    await waitFor(() => {
      expect(screen.queryByPlaceholderText(/langue/i)).not.toBeInTheDocument();
    });
    expect(onAdd).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Mode saving
  // -------------------------------------------------------------------------

  it("disables_remove_buttons_when_saving_is_true", () => {
    render(<LanguagesSection {...defaultProps({ saving: true })} />);
    const removeButtons = screen.getAllByRole("button", { name: /retirer/i });
    removeButtons.forEach((btn) => expect(btn).toBeDisabled());
  });

  it("disables_add_button_when_saving_is_true", () => {
    render(<LanguagesSection {...defaultProps({ saving: true })} />);
    expect(screen.getByRole("button", { name: /\+ ajouter/i })).toBeDisabled();
  });
});
