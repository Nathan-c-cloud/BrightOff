/**
 * Tests d'integration — ProfilePage (/app/profile/page.tsx)
 *
 * Couvre :
 *   - Loading : spinner visible pendant le chargement
 *   - Etat 404 : message CTA + bouton "Uploader mon CV" → router.push("/onboarding")
 *   - Render normal : sections visibles (ProfileSide, SkillsSection, LanguagesSection,
 *     EducationSection, ExperienceSection)
 *   - Optimistic update skill add : chip apparait immediatement
 *   - Rollback skill add : chip disparait si PUT echoue + toast erreur
 *   - Optimistic update langue add : chip langue apparait immediatement
 *   - Rollback langue add : chip disparait si PUT echoue + toast erreur
 *   - Bouton "Mettre à jour mon CV" → router.push("/onboarding")
 *   - Bouton "Uploader mon CV" (etat 404) → router.push("/onboarding")
 *   - Modale education : ouverte par "+ Ajouter une formation", fermee apres save
 *
 * Ordre des sections dans profile-main (S3-16 follow-up) :
 *   Expérience → Formation → Langues → Soft skills → Hard skills
 * Ordre des boutons "+ Ajouter" dans le DOM :
 *   [0] "+ Ajouter une expérience" | [1] "+ Ajouter une formation" |
 *   [2] "+ Ajouter" Langues | [3] "+ Ajouter" Soft | [4] "+ Ajouter" Hard
 *   - Modale education edit : ouverte par clic icone edit
 *
 * Mocks :
 *   - next-auth/react : useSession
 *   - next/navigation : useRouter, usePathname
 *   - @/lib/api-profile : getMyProfile, updateMyProfile
 *   - @/components/ui/NavApp : simplifie (evite les dependances next/link, next/image)
 *   - @/components/Toast : simplifie (passe les props, evite les timeouts internes)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApiProfileError } from "@/lib/api-profile";
import type { ProfileData } from "@/lib/api-profile";

// ---------------------------------------------------------------------------
// Mocks — declares avant les imports (hoisting Vitest)
// ---------------------------------------------------------------------------

const mockRouterPush = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockRouterPush }),
  usePathname: () => "/profile",
}));

const mockUseSession = vi.hoisted(() =>
  vi.fn().mockReturnValue({
    data: {
      user: { name: "Alice Martin", email: "alice@example.com" },
      backendToken: "mock-token",
    },
    status: "authenticated",
  })
);
vi.mock("next-auth/react", () => ({
  useSession: mockUseSession,
  signOut: vi.fn(),
}));

const mockGetMyProfile = vi.hoisted(() => vi.fn());
const mockUpdateMyProfile = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api-profile", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-profile")>();
  return {
    ...actual,
    getMyProfile: mockGetMyProfile,
    updateMyProfile: mockUpdateMyProfile,
  };
});

// Mock NavApp pour eviter les dependances profondes (next/image, next/link)
vi.mock("@/components/ui/NavApp", () => ({
  NavApp: () => <nav data-testid="nav-app" />,
}));

// Mock Toast pour controler son affichage en tests
// (evite les timeouts d'auto-fermeture)
vi.mock("@/components/Toast", () => ({
  Toast: ({
    message,
    variant,
    onClose,
  }: {
    message: string;
    variant: string;
    onClose: () => void;
  }) => (
    <div role="alert" data-variant={variant}>
      {message}
      <button onClick={onClose}>Fermer</button>
    </div>
  ),
}));

// ---------------------------------------------------------------------------
// Import du composant APRES les mocks
// ---------------------------------------------------------------------------

import ProfilePage from "./page";

// ---------------------------------------------------------------------------
// Factories helpers
// ---------------------------------------------------------------------------

function makeProfileData(overrides?: Partial<ProfileData>): ProfileData {
  return {
    id: "profile-1",
    title: "Developpeur Fullstack",
    summary: null,
    skills: [
      { id: "s1", name: "React", category: "technique", level: null },
      { id: "s2", name: "Travail en equipe", category: "soft_skill", level: null },
    ],
    experiences: [
      {
        id: "exp1",
        company: "Acme Corp",
        position: "Dev Fullstack",
        start_date: "2022-01-01",
        end_date: "2024-06-01",
        description: null,
      },
    ],
    educations: [
      {
        id: "ed1",
        school: "ESIGELEC",
        degree: "Ingenieur",
        field: "Informatique",
        start_date: "2020-09-01",
        end_date: "2023-06-30",
      },
    ],
    languages: [
      { id: "l1", name: "Anglais", level: "B2" },
    ],
    updated_at: "2024-06-01T00:00:00Z",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();

  // Session authentifiee par defaut
  mockUseSession.mockReturnValue({
    data: {
      user: { name: "Alice Martin", email: "alice@example.com" },
      backendToken: "mock-token",
    },
    status: "authenticated",
  });
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ProfilePage", () => {
  // -------------------------------------------------------------------------
  // Etat de chargement
  // -------------------------------------------------------------------------

  it("renders_loading_spinner_while_fetching_profile", async () => {
    // getMyProfile ne se resout jamais pendant ce test
    mockGetMyProfile.mockReturnValue(new Promise(() => {}));
    render(<ProfilePage />);

    // Le spinner est un role="status"
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByText(/chargement du profil/i)).toBeInTheDocument();
  });

  it("does_not_render_profile_sections_during_loading", () => {
    mockGetMyProfile.mockReturnValue(new Promise(() => {}));
    render(<ProfilePage />);

    expect(screen.queryByRole("heading", { name: /hard skills/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /formation/i })).not.toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // Etat 404 — pas de profil
  // -------------------------------------------------------------------------

  it("renders_no_profile_cta_when_getMyProfile_returns_404", async () => {
    mockGetMyProfile.mockRejectedValueOnce(new ApiProfileError("Not found", 404));
    render(<ProfilePage />);

    await waitFor(() => {
      expect(
        screen.getByText(/vous n.avez pas encore de profil/i)
      ).toBeInTheDocument();
    });
  });

  it("renders_upload_button_in_404_state", async () => {
    mockGetMyProfile.mockRejectedValueOnce(new ApiProfileError("Not found", 404));
    render(<ProfilePage />);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /uploader mon cv/i })
      ).toBeInTheDocument();
    });
  });

  it("navigates_to_onboarding_when_upload_cta_clicked_in_404_state", async () => {
    const user = userEvent.setup();
    mockGetMyProfile.mockRejectedValueOnce(new ApiProfileError("Not found", 404));
    render(<ProfilePage />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /uploader mon cv/i })).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: /uploader mon cv/i }));
    expect(mockRouterPush).toHaveBeenCalledWith("/onboarding");
  });

  // -------------------------------------------------------------------------
  // Render normal
  // -------------------------------------------------------------------------

  it("renders_hard_skills_section_after_successful_load", async () => {
    mockGetMyProfile.mockResolvedValueOnce(makeProfileData());
    render(<ProfilePage />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Hard skills" })).toBeInTheDocument();
    });
  });

  it("renders_soft_skills_section_after_successful_load", async () => {
    mockGetMyProfile.mockResolvedValueOnce(makeProfileData());
    render(<ProfilePage />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Soft skills" })).toBeInTheDocument();
    });
  });

  it("renders_languages_section_after_successful_load", async () => {
    mockGetMyProfile.mockResolvedValueOnce(makeProfileData());
    render(<ProfilePage />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Langues" })).toBeInTheDocument();
    });
  });

  it("renders_education_section_after_successful_load", async () => {
    mockGetMyProfile.mockResolvedValueOnce(makeProfileData());
    render(<ProfilePage />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Formation" })).toBeInTheDocument();
    });
  });

  it("renders_experience_section_after_successful_load", async () => {
    mockGetMyProfile.mockResolvedValueOnce(makeProfileData());
    render(<ProfilePage />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Expérience" })).toBeInTheDocument();
    });
  });

  it("renders_skills_chips_from_profile_data", async () => {
    mockGetMyProfile.mockResolvedValueOnce(makeProfileData());
    render(<ProfilePage />);

    await waitFor(() => {
      expect(screen.getByText("React")).toBeInTheDocument();
      expect(screen.getByText("Travail en equipe")).toBeInTheDocument();
    });
  });

  it("renders_language_chip_with_level", async () => {
    mockGetMyProfile.mockResolvedValueOnce(makeProfileData());
    render(<ProfilePage />);

    await waitFor(() => {
      expect(screen.getByText(/anglais \(b2\)/i)).toBeInTheDocument();
    });
  });

  it("renders_education_card", async () => {
    mockGetMyProfile.mockResolvedValueOnce(makeProfileData());
    render(<ProfilePage />);

    await waitFor(() => {
      expect(screen.getByText("Ingenieur")).toBeInTheDocument();
      expect(screen.getByText(/esigelec/i)).toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // Bouton "Mettre à jour mon CV"
  // -------------------------------------------------------------------------

  it("navigates_to_onboarding_when_mettre_a_jour_cv_is_clicked", async () => {
    const user = userEvent.setup();
    mockGetMyProfile.mockResolvedValueOnce(makeProfileData());
    render(<ProfilePage />);

    await waitFor(() => {
      // Deux boutons "Mettre à jour mon CV" existent : aside (ProfileSide) + bas de main
      expect(screen.getAllByRole("button", { name: /mettre à jour mon cv/i })).toHaveLength(2);
    });

    // Il peut y avoir plusieurs boutons (ProfileSide + main) — on prend le premier visible
    const buttons = screen.getAllByRole("button", { name: /mettre à jour mon cv/i });
    await user.click(buttons[0]);
    expect(mockRouterPush).toHaveBeenCalledWith("/onboarding");
  });

  // -------------------------------------------------------------------------
  // Optimistic update — ajout skill
  // -------------------------------------------------------------------------

  it("shows_new_skill_chip_immediately_before_put_resolves", async () => {
    let resolvePut!: (value: ProfileData) => void;
    const putPromise = new Promise<ProfileData>((resolve) => {
      resolvePut = resolve;
    });

    mockGetMyProfile.mockResolvedValueOnce(makeProfileData());
    mockUpdateMyProfile.mockReturnValueOnce(putPromise);

    const user = userEvent.setup();
    render(<ProfilePage />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Hard skills" })).toBeInTheDocument();
    });

    // Cliquer "+ Ajouter" dans la section hard
    // Ordre dans le DOM : experience [0], formation [1], langues [2], soft [3], hard [4]
    const addButtons = screen.getAllByRole("button", { name: /\+ ajouter/i });
    await user.click(addButtons[4]);

    const input = screen.getByPlaceholderText(/ajouter/i);
    await user.type(input, "TypeScript");
    await user.keyboard("{Enter}");

    // La chip doit apparaitre immediatement (optimistic), avant que le PUT se resolve
    expect(screen.getByText("TypeScript")).toBeInTheDocument();

    // Resoudre le PUT pour ne pas laisser la promesse en attente
    const updatedProfile = makeProfileData();
    updatedProfile.skills.push({ id: "s3", name: "TypeScript", category: "technique", level: null });
    resolvePut(updatedProfile);
  });

  it("removes_skill_chip_and_shows_error_toast_when_put_fails", async () => {
    mockGetMyProfile.mockResolvedValueOnce(makeProfileData());
    mockUpdateMyProfile.mockRejectedValueOnce(new ApiProfileError("Server error", 500));

    const user = userEvent.setup();
    render(<ProfilePage />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Hard skills" })).toBeInTheDocument();
    });

    // Ajouter une skill
    // Ordre dans le DOM : experience [0], formation [1], langues [2], soft [3], hard [4]
    const addButtons = screen.getAllByRole("button", { name: /\+ ajouter/i });
    await user.click(addButtons[4]);
    const input = screen.getByPlaceholderText(/ajouter/i);
    await user.type(input, "Vue");
    await user.keyboard("{Enter}");

    // Attendre que le PUT echoue et le rollback soit effectue
    await waitFor(() => {
      expect(screen.queryByText("Vue")).not.toBeInTheDocument();
    });

    // Toast d'erreur doit etre visible
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/impossible de sauvegarder/i);
    });
  });

  // -------------------------------------------------------------------------
  // Optimistic update — ajout langue
  // -------------------------------------------------------------------------

  it("shows_new_language_chip_immediately_before_put_resolves", async () => {
    let resolvePut!: (value: ProfileData) => void;
    const putPromise = new Promise<ProfileData>((resolve) => {
      resolvePut = resolve;
    });

    mockGetMyProfile.mockResolvedValueOnce(makeProfileData());
    mockUpdateMyProfile.mockReturnValueOnce(putPromise);

    const user = userEvent.setup();
    render(<ProfilePage />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Langues" })).toBeInTheDocument();
    });

    // Cliquer "+ Ajouter" dans la section Langues
    // Ordre dans le DOM : experience [0], formation [1], langues [2], soft [3], hard [4]
    const allAddButtons = screen.getAllByRole("button", { name: /\+ ajouter/i });
    await user.click(allAddButtons[2]);

    const input = screen.getByPlaceholderText(/langue/i);
    await user.type(input, "Japonais");
    await user.keyboard("{Enter}");

    // La chip doit apparaitre immediatement
    expect(screen.getByText(/japonais/i)).toBeInTheDocument();

    // Resoudre le PUT
    const updatedProfile = makeProfileData();
    updatedProfile.languages.push({ id: "l2", name: "Japonais", level: "B1" });
    resolvePut(updatedProfile);
  });

  it("removes_language_chip_and_shows_error_toast_when_put_fails", async () => {
    mockGetMyProfile.mockResolvedValueOnce(makeProfileData());
    mockUpdateMyProfile.mockRejectedValueOnce(new ApiProfileError("Server error", 500));

    const user = userEvent.setup();
    render(<ProfilePage />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Langues" })).toBeInTheDocument();
    });

    // Ordre dans le DOM : experience [0], formation [1], langues [2], soft [3], hard [4]
    const allAddButtons = screen.getAllByRole("button", { name: /\+ ajouter/i });
    await user.click(allAddButtons[2]);

    const input = screen.getByPlaceholderText(/langue/i);
    await user.type(input, "Arabe");
    await user.keyboard("{Enter}");

    await waitFor(() => {
      expect(screen.queryByText(/arabe/i)).not.toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/impossible de sauvegarder/i);
    });
  });

  // -------------------------------------------------------------------------
  // Modale Education — create
  // -------------------------------------------------------------------------

  it("opens_education_modal_in_create_mode_when_add_formation_clicked", async () => {
    const user = userEvent.setup();
    mockGetMyProfile.mockResolvedValueOnce(makeProfileData());
    render(<ProfilePage />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /\+ ajouter une formation/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /\+ ajouter une formation/i }));

    expect(
      screen.getByRole("heading", { name: "Ajouter une formation" })
    ).toBeInTheDocument();
  });

  it("closes_education_modal_after_successful_save", async () => {
    const user = userEvent.setup();
    const initialProfile = makeProfileData();
    mockGetMyProfile.mockResolvedValueOnce(initialProfile);

    const updatedProfile = makeProfileData();
    updatedProfile.educations.push({
      id: "ed2",
      school: "EPITECH",
      degree: "Expert IT",
      field: null,
      start_date: "2018-09-01",
      end_date: "2021-06-30",
    });
    mockUpdateMyProfile.mockResolvedValueOnce(updatedProfile);

    render(<ProfilePage />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /\+ ajouter une formation/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /\+ ajouter une formation/i }));

    // Remplir les champs requis
    await user.type(screen.getByPlaceholderText(/epitech/i), "EPITECH");
    await user.type(screen.getByPlaceholderText(/master/i), "Expert IT");

    // La modale est rendue via createPortal dans document.body — utiliser getByLabelText
    const dateInput = screen.getByLabelText(/date de debut/i);
    fireEvent.change(dateInput, { target: { value: "2018-09-01" } });

    await user.click(screen.getByRole("button", { name: "Enregistrer" }));

    await waitFor(() => {
      expect(
        screen.queryByRole("heading", { name: "Ajouter une formation" })
      ).not.toBeInTheDocument();
    });
  });

  it("shows_new_education_in_list_after_save", async () => {
    const user = userEvent.setup();
    const initialProfile = makeProfileData();
    mockGetMyProfile.mockResolvedValueOnce(initialProfile);

    const updatedProfile = makeProfileData();
    updatedProfile.educations.push({
      id: "ed2",
      school: "EPITECH",
      degree: "Expert IT",
      field: null,
      start_date: "2018-09-01",
      end_date: "2021-06-30",
    });
    mockUpdateMyProfile.mockResolvedValueOnce(updatedProfile);

    render(<ProfilePage />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /\+ ajouter une formation/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /\+ ajouter une formation/i }));

    await user.type(screen.getByPlaceholderText(/epitech/i), "EPITECH");
    await user.type(screen.getByPlaceholderText(/master/i), "Expert IT");

    // La modale est rendue via createPortal dans document.body — utiliser getByLabelText
    const dateInput = screen.getByLabelText(/date de debut/i);
    fireEvent.change(dateInput, { target: { value: "2018-09-01" } });

    await user.click(screen.getByRole("button", { name: "Enregistrer" }));

    await waitFor(() => {
      expect(screen.getByText("Expert IT")).toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // Modale Education — edit
  // -------------------------------------------------------------------------

  it("opens_education_modal_in_edit_mode_with_prefilled_data_when_edit_clicked", async () => {
    const user = userEvent.setup();
    mockGetMyProfile.mockResolvedValueOnce(makeProfileData());
    render(<ProfilePage />);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /modifier la formation ingenieur/i })
      ).toBeInTheDocument();
    });

    await user.click(
      screen.getByRole("button", { name: /modifier la formation ingenieur/i })
    );

    expect(
      screen.getByRole("heading", { name: "Modifier la formation" })
    ).toBeInTheDocument();
    expect(screen.getByDisplayValue("ESIGELEC")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Ingenieur")).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // Flag mutating — serialisation (documentation)
  // -------------------------------------------------------------------------

  // TODO: Le flag `mutating` (ref interne) empeche les appels PUT concurrents.
  // Ce comportement n'est pas directement observable en tests jsdom car il
  // necessite deux clics quasi-simultanees et l'inspection de l'etat d'un ref.
  // Une approche serait d'ajouter un data-testid="saving" sur le composant,
  // ou d'espionner updateMyProfile pour verifier qu'il n'est appele qu'une fois
  // meme apres 2 clics rapides. A implementer si le comportement devient critique.
});
