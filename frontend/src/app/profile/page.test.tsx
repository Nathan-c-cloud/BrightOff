/**
 * Tests unitaires — Page /profile
 *
 * Couvre :
 *   - Rendu avec profil existant → champs pré-remplis
 *   - Clic "Enregistrer" → updateMyProfile appelé avec les bonnes données
 *   - Toast succès affiché après save OK
 *   - Erreurs de validation 422 → toast error affiché
 *   - Chargement → indicateur de chargement affiché
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// ---------------------------------------------------------------------------
// Mocks des modules externes avant import de la page
// ---------------------------------------------------------------------------

// next-auth/react
const mockSession = {
  user: { name: "Test User", email: "test@example.com" },
  backendToken: "fake-token-abc",
};

vi.mock("next-auth/react", () => ({
  useSession: vi.fn(() => ({ data: mockSession, status: "authenticated" })),
  signOut: vi.fn(),
}));

// next/navigation
vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({ push: vi.fn() })),
  usePathname: vi.fn(() => "/profile"),
}));

// api-profile
vi.mock("@/lib/api-profile", () => ({
  getMyProfile: vi.fn(),
  updateMyProfile: vi.fn(),
  ApiProfileError: class ApiProfileError extends Error {
    constructor(
      message: string,
      public readonly status: number,
      public readonly issues?: unknown[]
    ) {
      super(message);
      this.name = "ApiProfileError";
    }
  },
}));

// NavApp — composant complexe avec usePathname, on le stub
vi.mock("@/components/ui/NavApp", () => ({
  NavApp: ({ userName }: { userName: string }) => (
    <nav aria-label="navigation">{userName}</nav>
  ),
}));

// ---------------------------------------------------------------------------
// Imports après mocks
// ---------------------------------------------------------------------------

import ProfilePage from "./page";
import * as apiProfile from "@/lib/api-profile";
import type { ProfileData } from "@/lib/api-profile";

const mockGetMyProfile = vi.mocked(apiProfile.getMyProfile);
const mockUpdateMyProfile = vi.mocked(apiProfile.updateMyProfile);

// ---------------------------------------------------------------------------
// Données de test
// ---------------------------------------------------------------------------

const MOCK_PROFILE: ProfileData = {
  id: "profile-uuid-123",
  title: "Développeur Fullstack",
  summary: "Passionné par le cloud.",
  years_of_experience: 3,
  skills: [
    { id: "s1", name: "Python", category: "tech", level: 4 },
    { id: "s2", name: "React", category: "tech", level: 3 },
  ],
  experiences: [
    {
      id: "e1",
      company: "Startup SAS",
      position: "Lead Dev",
      start_date: "2022-01-01",
      end_date: "2024-06-30",
      description: null,
    },
  ],
  educations: [
    {
      id: "ed1",
      school: "EPITECH",
      degree: "Expert IT",
      field: "Informatique",
      start_date: "2017-09-01",
      end_date: "2022-06-30",
    },
  ],
  languages: [{ id: "l1", name: "Français", level: "Natif" }],
  updated_at: "2026-06-15T10:00:00Z",
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ProfilePage — chargement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("affiche_indicateur_de_chargement_pendant_le_fetch", () => {
    // getMyProfile ne résout jamais (pendant le test)
    mockGetMyProfile.mockReturnValue(new Promise(() => {}));

    render(<ProfilePage />);

    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("pre_remplit_les_champs_apres_chargement_du_profil", async () => {
    mockGetMyProfile.mockResolvedValue(MOCK_PROFILE);

    render(<ProfilePage />);

    // Attendre que le chargement se termine
    await waitFor(() => {
      expect(
        screen.getByDisplayValue("Développeur Fullstack")
      ).toBeInTheDocument();
    });

    expect(screen.getByDisplayValue("Passionné par le cloud.")).toBeInTheDocument();
    expect(screen.getByLabelText(/Années d'expérience/i)).toHaveValue(3);
  });

  it("affiche_les_skills_pre_remplies", async () => {
    mockGetMyProfile.mockResolvedValue(MOCK_PROFILE);

    render(<ProfilePage />);

    await waitFor(() => {
      expect(screen.getByDisplayValue("Python")).toBeInTheDocument();
    });

    expect(screen.getByDisplayValue("React")).toBeInTheDocument();
  });
});

describe("ProfilePage — soumission du formulaire", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetMyProfile.mockResolvedValue(MOCK_PROFILE);
  });

  it("appelle_updateMyProfile_au_clic_sur_enregistrer", async () => {
    mockUpdateMyProfile.mockResolvedValue(MOCK_PROFILE);

    render(<ProfilePage />);

    // Attendre que le formulaire soit chargé
    await waitFor(() => {
      expect(screen.getByDisplayValue("Développeur Fullstack")).toBeInTheDocument();
    });

    const saveButton = screen.getByRole("button", { name: /enregistrer/i });
    await userEvent.click(saveButton);

    await waitFor(() => {
      expect(mockUpdateMyProfile).toHaveBeenCalledOnce();
    });

    const [token, payload] = mockUpdateMyProfile.mock.calls[0] as [
      string,
      unknown
    ];
    expect(token).toBe("fake-token-abc");
    expect(payload).toMatchObject({
      title: "Développeur Fullstack",
      summary: "Passionné par le cloud.",
      years_of_experience: 3,
    });
  });

  it("affiche_toast_succes_apres_save_ok", async () => {
    mockUpdateMyProfile.mockResolvedValue(MOCK_PROFILE);

    render(<ProfilePage />);

    await waitFor(() => {
      expect(screen.getByDisplayValue("Développeur Fullstack")).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole("button", { name: /enregistrer/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/enregistré/i);
    });
  });

  it("affiche_toast_erreur_en_cas_d_erreur_reseau", async () => {
    const { ApiProfileError } = await import("@/lib/api-profile");
    mockUpdateMyProfile.mockRejectedValue(new ApiProfileError("Erreur réseau", 0));

    render(<ProfilePage />);

    await waitFor(() => {
      expect(screen.getByDisplayValue("Développeur Fullstack")).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole("button", { name: /enregistrer/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
  });

  it("affiche_toast_erreur_sur_422_backend", async () => {
    const { ApiProfileError } = await import("@/lib/api-profile");
    const err = new ApiProfileError("Données invalides", 422, [
      { loc: ["body", "skills", 0, "level"], msg: "Input should be <= 5", type: "less_than_equal" },
    ]);
    mockUpdateMyProfile.mockRejectedValue(err);

    render(<ProfilePage />);

    await waitFor(() => {
      expect(screen.getByDisplayValue("Développeur Fullstack")).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole("button", { name: /enregistrer/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/invalides/i);
    });
  });
});

describe("ProfilePage — état 404 profil inexistant", () => {
  it("ne_bloque_pas_le_rendu_si_profil_absent", async () => {
    const { ApiProfileError } = await import("@/lib/api-profile");
    mockGetMyProfile.mockRejectedValue(new ApiProfileError("Profile not found", 404));

    render(<ProfilePage />);

    // La page se charge sans profil — le formulaire vide est affiché
    await waitFor(() => {
      // L'indicateur de chargement disparaît
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });
  });
});
