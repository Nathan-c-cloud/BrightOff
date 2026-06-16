/**
 * Tests unitaires — ProfileFormModal
 *
 * Couvre :
 *   - Education mode create : modale visible avec titre "Ajouter une formation", champs vides
 *   - Education mode edit : champs préremplis depuis initialData
 *   - Experience mode create : titre "Ajouter une expérience", champs specifiques (entreprise, poste...)
 *   - Experience mode edit : champs préremplis
 *   - Validation : champs requis manquants → onSave non appele
 *   - Submit valid → onSave appele avec payload correct
 *   - Bouton Supprimer present en mode edit et absent en mode create
 *   - Clic Supprimer → onDelete appele
 *   - Escape → onClose appele
 *   - Clic backdrop → onClose appele
 *   - Clic dans la modale → onClose NON appele
 *   - Focus trap : verifiable via getFocusableElements (liste non vide)
 *
 * Note : ProfileFormModal utilise createPortal → rendu dans document.body.
 * jsdom supporte createPortal, mais les elements sont hors de container.
 * On utilise screen.* (qui cherche dans document.body) plutot que within(container).
 *
 * Note focus trap : la restauration du focus a la fermeture n'est pas testee
 * car jsdom ne gere pas le focus natif entre montages/demontages de composants
 * de facon fiable.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProfileFormModal } from "./ProfileFormModal";
import type { EducationPayload, ExperiencePayload } from "@/lib/api-profile";

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Factories helpers
// ---------------------------------------------------------------------------

function defaultEducationCreateProps(overrides?: object) {
  return {
    type: "education" as const,
    mode: "create" as const,
    onSave: vi.fn().mockResolvedValue(undefined),
    onClose: vi.fn(),
    saving: false,
    ...overrides,
  };
}

function defaultEducationEditProps(initialData?: Partial<EducationPayload>, overrides?: object) {
  return {
    type: "education" as const,
    mode: "edit" as const,
    initialData: {
      school: "ESIGELEC",
      degree: "Ingenieur Informatique",
      field: "Informatique",
      start_date: "2020-09-01",
      end_date: "2023-06-30",
      ...initialData,
    },
    onSave: vi.fn().mockResolvedValue(undefined),
    onDelete: vi.fn().mockResolvedValue(undefined),
    onClose: vi.fn(),
    saving: false,
    ...overrides,
  };
}

function defaultExperienceCreateProps(overrides?: object) {
  return {
    type: "experience" as const,
    mode: "create" as const,
    onSave: vi.fn().mockResolvedValue(undefined),
    onClose: vi.fn(),
    saving: false,
    ...overrides,
  };
}

function defaultExperienceEditProps(initialData?: Partial<ExperiencePayload>, overrides?: object) {
  return {
    type: "experience" as const,
    mode: "edit" as const,
    initialData: {
      company: "Acme Corp",
      position: "Dev Fullstack",
      start_date: "2022-01-01",
      end_date: "2024-06-01",
      description: "Missions diverses",
      ...initialData,
    },
    onSave: vi.fn().mockResolvedValue(undefined),
    onDelete: vi.fn().mockResolvedValue(undefined),
    onClose: vi.fn(),
    saving: false,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Education — mode create
// ---------------------------------------------------------------------------

describe("ProfileFormModal — education create", () => {
  it("renders_modal_with_title_ajouter_une_formation", () => {
    render(<ProfileFormModal {...defaultEducationCreateProps()} />);
    expect(
      screen.getByRole("heading", { name: "Ajouter une formation" })
    ).toBeInTheDocument();
  });

  it("renders_modal_with_role_dialog", () => {
    render(<ProfileFormModal {...defaultEducationCreateProps()} />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("renders_empty_school_input", () => {
    render(<ProfileFormModal {...defaultEducationCreateProps()} />);
    const input = screen.getByPlaceholderText(/epitech/i);
    expect(input).toHaveValue("");
  });

  it("renders_empty_degree_input", () => {
    render(<ProfileFormModal {...defaultEducationCreateProps()} />);
    const input = screen.getByPlaceholderText(/master/i);
    expect(input).toHaveValue("");
  });

  it("renders_enregistrer_button", () => {
    render(<ProfileFormModal {...defaultEducationCreateProps()} />);
    expect(screen.getByRole("button", { name: "Enregistrer" })).toBeInTheDocument();
  });

  it("renders_annuler_button", () => {
    render(<ProfileFormModal {...defaultEducationCreateProps()} />);
    expect(screen.getByRole("button", { name: "Annuler" })).toBeInTheDocument();
  });

  it("does_not_render_supprimer_button_in_create_mode", () => {
    render(<ProfileFormModal {...defaultEducationCreateProps()} />);
    expect(screen.queryByRole("button", { name: /supprimer/i })).not.toBeInTheDocument();
  });

  it("does_not_call_onSave_when_required_fields_are_missing", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<ProfileFormModal {...defaultEducationCreateProps({ onSave })} />);

    // Soumettre sans rien remplir
    await user.click(screen.getByRole("button", { name: "Enregistrer" }));
    expect(onSave).not.toHaveBeenCalled();
  });

  it("shows_validation_errors_when_required_fields_are_missing", async () => {
    const user = userEvent.setup();
    render(<ProfileFormModal {...defaultEducationCreateProps()} />);

    await user.click(screen.getByRole("button", { name: "Enregistrer" }));
    expect(screen.getByText(/ecole est requise/i)).toBeInTheDocument();
  });

  it("calls_onSave_with_correct_payload_when_form_is_valid", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<ProfileFormModal {...defaultEducationCreateProps({ onSave })} />);

    await user.type(screen.getByPlaceholderText(/epitech/i), "ESIGELEC");
    await user.type(screen.getByPlaceholderText(/master/i), "Ingenieur");

    // Remplir la date de debut (input type=date)
    const dateInputs = screen.getAllByDisplayValue("");
    // Le premier date input est "Date de debut"
    fireEvent.change(dateInputs.find((i) => i.getAttribute("type") === "date")!, {
      target: { value: "2020-09-01" },
    });

    await user.click(screen.getByRole("button", { name: "Enregistrer" }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledOnce();
    });
    const payload = onSave.mock.calls[0][0] as EducationPayload;
    expect(payload.school).toBe("ESIGELEC");
    expect(payload.degree).toBe("Ingenieur");
    expect(payload.start_date).toBe("2020-09-01");
  });

  it("closes_modal_when_annuler_is_clicked", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<ProfileFormModal {...defaultEducationCreateProps({ onClose })} />);

    await user.click(screen.getByRole("button", { name: "Annuler" }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// Education — mode edit
// ---------------------------------------------------------------------------

describe("ProfileFormModal — education edit", () => {
  it("renders_modal_with_title_modifier_la_formation", () => {
    render(<ProfileFormModal {...defaultEducationEditProps()} />);
    expect(
      screen.getByRole("heading", { name: "Modifier la formation" })
    ).toBeInTheDocument();
  });

  it("pre_fills_school_field", () => {
    render(<ProfileFormModal {...defaultEducationEditProps()} />);
    expect(screen.getByDisplayValue("ESIGELEC")).toBeInTheDocument();
  });

  it("pre_fills_degree_field", () => {
    render(<ProfileFormModal {...defaultEducationEditProps()} />);
    expect(screen.getByDisplayValue("Ingenieur Informatique")).toBeInTheDocument();
  });

  it("pre_fills_field_domain", () => {
    render(<ProfileFormModal {...defaultEducationEditProps()} />);
    expect(screen.getByDisplayValue("Informatique")).toBeInTheDocument();
  });

  it("pre_fills_start_date", () => {
    render(<ProfileFormModal {...defaultEducationEditProps()} />);
    expect(screen.getByDisplayValue("2020-09-01")).toBeInTheDocument();
  });

  it("renders_supprimer_button_in_edit_mode", () => {
    render(<ProfileFormModal {...defaultEducationEditProps()} />);
    expect(screen.getByRole("button", { name: /supprimer/i })).toBeInTheDocument();
  });

  it("calls_onDelete_when_supprimer_is_clicked", async () => {
    const onDelete = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<ProfileFormModal {...defaultEducationEditProps(undefined, { onDelete })} />);

    await user.click(screen.getByRole("button", { name: /supprimer/i }));
    expect(onDelete).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// Experience — mode create
// ---------------------------------------------------------------------------

describe("ProfileFormModal — experience create", () => {
  it("renders_modal_with_title_ajouter_une_experience", () => {
    render(<ProfileFormModal {...defaultExperienceCreateProps()} />);
    expect(
      screen.getByRole("heading", { name: "Ajouter une expérience" })
    ).toBeInTheDocument();
  });

  it("renders_company_input", () => {
    render(<ProfileFormModal {...defaultExperienceCreateProps()} />);
    expect(screen.getByPlaceholderText(/startup sas/i)).toBeInTheDocument();
  });

  it("renders_position_input", () => {
    render(<ProfileFormModal {...defaultExperienceCreateProps()} />);
    expect(screen.getByPlaceholderText(/developpeur fullstack/i)).toBeInTheDocument();
  });

  it("renders_description_textarea", () => {
    render(<ProfileFormModal {...defaultExperienceCreateProps()} />);
    expect(screen.getByPlaceholderText(/missions, technologies/i)).toBeInTheDocument();
  });

  it("does_not_render_supprimer_button_in_create_mode", () => {
    render(<ProfileFormModal {...defaultExperienceCreateProps()} />);
    expect(screen.queryByRole("button", { name: /supprimer/i })).not.toBeInTheDocument();
  });

  it("does_not_call_onSave_when_company_is_missing", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<ProfileFormModal {...defaultExperienceCreateProps({ onSave })} />);

    await user.type(screen.getByPlaceholderText(/developpeur fullstack/i), "Dev");
    await user.click(screen.getByRole("button", { name: "Enregistrer" }));
    expect(onSave).not.toHaveBeenCalled();
  });

  it("calls_onSave_with_correct_experience_payload_when_form_is_valid", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<ProfileFormModal {...defaultExperienceCreateProps({ onSave })} />);

    await user.type(screen.getByPlaceholderText(/startup sas/i), "Acme Corp");
    await user.type(screen.getByPlaceholderText(/developpeur fullstack/i), "Dev Frontend");

    // Remplir date de debut
    const [startInput] = screen
      .getAllByDisplayValue("")
      .filter((i) => i.getAttribute("type") === "date");
    fireEvent.change(startInput, { target: { value: "2022-01-01" } });

    await user.click(screen.getByRole("button", { name: "Enregistrer" }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledOnce();
    });
    const payload = onSave.mock.calls[0][0] as ExperiencePayload;
    expect(payload.company).toBe("Acme Corp");
    expect(payload.position).toBe("Dev Frontend");
    expect(payload.start_date).toBe("2022-01-01");
  });
});

// ---------------------------------------------------------------------------
// Experience — mode edit
// ---------------------------------------------------------------------------

describe("ProfileFormModal — experience edit", () => {
  it("renders_modal_with_title_modifier_experience", () => {
    render(<ProfileFormModal {...defaultExperienceEditProps()} />);
    expect(
      screen.getByRole("heading", { name: "Modifier l'expérience" })
    ).toBeInTheDocument();
  });

  it("pre_fills_company_field", () => {
    render(<ProfileFormModal {...defaultExperienceEditProps()} />);
    expect(screen.getByDisplayValue("Acme Corp")).toBeInTheDocument();
  });

  it("pre_fills_position_field", () => {
    render(<ProfileFormModal {...defaultExperienceEditProps()} />);
    expect(screen.getByDisplayValue("Dev Fullstack")).toBeInTheDocument();
  });

  it("pre_fills_description_field", () => {
    render(<ProfileFormModal {...defaultExperienceEditProps()} />);
    expect(screen.getByDisplayValue("Missions diverses")).toBeInTheDocument();
  });

  it("renders_supprimer_button_in_edit_mode", () => {
    render(<ProfileFormModal {...defaultExperienceEditProps()} />);
    expect(screen.getByRole("button", { name: /supprimer/i })).toBeInTheDocument();
  });

  it("calls_onDelete_when_supprimer_is_clicked", async () => {
    const onDelete = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<ProfileFormModal {...defaultExperienceEditProps(undefined, { onDelete })} />);

    await user.click(screen.getByRole("button", { name: /supprimer/i }));
    expect(onDelete).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// Interactions modale generiques (Escape, backdrop, clic interne)
// ---------------------------------------------------------------------------

describe("ProfileFormModal — interactions generiques", () => {
  it("calls_onClose_when_escape_key_is_pressed", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<ProfileFormModal {...defaultEducationCreateProps({ onClose })} />);

    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("calls_onClose_when_backdrop_overlay_is_clicked", async () => {
    const onClose = vi.fn();
    render(<ProfileFormModal {...defaultEducationCreateProps({ onClose })} />);

    const overlay = document.querySelector(".modal-overlay") as HTMLElement;
    expect(overlay).not.toBeNull();
    fireEvent.click(overlay);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("does_not_call_onClose_when_click_is_inside_modal_box", async () => {
    const onClose = vi.fn();
    render(<ProfileFormModal {...defaultEducationCreateProps({ onClose })} />);

    const modalBox = document.querySelector(".modal-box") as HTMLElement;
    expect(modalBox).not.toBeNull();
    fireEvent.click(modalBox);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("modal_has_aria_modal_true", () => {
    render(<ProfileFormModal {...defaultEducationCreateProps()} />);
    expect(screen.getByRole("dialog")).toHaveAttribute("aria-modal", "true");
  });

  it("modal_has_aria_labelledby_pointing_to_title", () => {
    render(<ProfileFormModal {...defaultEducationCreateProps()} />);
    const dialog = screen.getByRole("dialog");
    const labelledby = dialog.getAttribute("aria-labelledby");
    expect(labelledby).toBeTruthy();
    const titleEl = document.getElementById(labelledby!);
    expect(titleEl).not.toBeNull();
    expect(titleEl!.textContent).toMatch(/ajouter une formation/i);
  });

  it("focus_trap_elements_are_present_in_modal", () => {
    // Verifie que des elements focusables existent dans la modale.
    // Le comportement Tab/Shift+Tab circulaire est implemente via keydown sur document
    // et n'est pas simulable de facon fiable en jsdom.
    // Ce test verifie le contrat minimal : au moins les boutons Enregistrer et Annuler
    // sont focusables, ce qui garantit que le focus trap a des cibles valides.
    render(<ProfileFormModal {...defaultEducationCreateProps()} />);
    const dialog = screen.getByRole("dialog");
    const focusableButtons = Array.from(
      dialog.querySelectorAll<HTMLElement>("button:not([disabled])")
    );
    expect(focusableButtons.length).toBeGreaterThanOrEqual(2);
  });

  it("enregistrer_button_is_disabled_when_saving_is_true", () => {
    render(<ProfileFormModal {...defaultEducationCreateProps({ saving: true })} />);
    expect(screen.getByRole("button", { name: /enregistrement/i })).toBeDisabled();
  });

  it("annuler_button_is_disabled_when_saving_is_true", () => {
    render(<ProfileFormModal {...defaultEducationCreateProps({ saving: true })} />);
    expect(screen.getByRole("button", { name: "Annuler" })).toBeDisabled();
  });
});
