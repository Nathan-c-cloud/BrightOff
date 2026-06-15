/**
 * Tests unitaires — OnboardingPage
 *
 * Couvre :
 *   - Rendu initial : zone de drop visible
 *   - Upload d'un PDF → POST /cvs/upload appelé avec le bon FormData
 *   - Après upload réussi → polling démarre (useCvPolling appelé avec cvId)
 *   - Status "ready" → router.push("/profile")
 *   - Erreur upload 413 → message d'erreur affiché
 *   - Session expirée (sessionStatus loading) → spinner affiché
 *
 * Mocks :
 *   - next-auth/react : useSession
 *   - next/navigation : useRouter
 *   - @/lib/api-cvs   : uploadCv (via vi.mock)
 *   - @/hooks/useCvPolling : permet de contrôler les callbacks
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { ApiCvsError } from "@/lib/api-cvs";

// ---------------------------------------------------------------------------
// Mocks — déclarés avant les imports (hoisting)
// ---------------------------------------------------------------------------

const mockRouterPush = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockRouterPush }),
}));

// Contrôle de useSession via une ref mutable
const mockUseSession = vi.hoisted(() =>
  vi.fn().mockReturnValue({
    data: {
      user: { name: "Alice", email: "alice@example.com" },
      backendToken: "mock-token",
    },
    status: "authenticated",
  })
);
vi.mock("next-auth/react", () => ({
  useSession: mockUseSession,
  signOut: vi.fn(),
}));

// Mock uploadCv — contrôlable par test
const mockUploadCv = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api-cvs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-cvs")>();
  return {
    ...actual,
    uploadCv: mockUploadCv,
  };
});

// Mock useCvPolling — on capture les callbacks pour les déclencher manuellement
type PollingOptions = {
  cvId: string | null;
  accessToken: string | null;
  onReady: (cv: unknown) => void;
  onFailed: () => void;
  onTimeout: () => void;
  onError: (err: unknown) => void;
};

let capturedPollingOptions: PollingOptions | null = null;
const mockUseCvPolling = vi.hoisted(() =>
  vi.fn((opts: PollingOptions) => {
    capturedPollingOptions = opts;
  })
);
vi.mock("@/hooks/useCvPolling", () => ({
  useCvPolling: mockUseCvPolling,
}));

// Mock NavApp pour éviter les dépendances profondes
vi.mock("@/components/ui", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/ui")>();
  return {
    ...actual,
    NavApp: () => <nav data-testid="nav-app" />,
  };
});

// ---------------------------------------------------------------------------
// Import du composant APRÈS les mocks
// ---------------------------------------------------------------------------

import OnboardingPage from "./page";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePdfFile(): File {
  return new File([new Uint8Array(1024)], "cv.pdf", {
    type: "application/pdf",
  });
}

function renderPage() {
  capturedPollingOptions = null;
  return render(<OnboardingPage />);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  capturedPollingOptions = null;

  // Session authentifiée par défaut
  mockUseSession.mockReturnValue({
    data: {
      user: { name: "Alice", email: "alice@example.com" },
      backendToken: "mock-token",
    },
    status: "authenticated",
  });
});

describe("OnboardingPage", () => {
  // -------------------------------------------------------------------------
  // Rendu initial
  // -------------------------------------------------------------------------

  it("renders_dropzone_in_idle_state", () => {
    renderPage();
    expect(screen.getByText(/glisse ton CV ici/i)).toBeInTheDocument();
  });

  it("renders_page_title", () => {
    renderPage();
    expect(
      screen.getByRole("heading", { name: /importe ton CV/i })
    ).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // Session en chargement → spinner
  // -------------------------------------------------------------------------

  it("renders_loading_state_while_session_is_loading", () => {
    mockUseSession.mockReturnValueOnce({
      data: null,
      status: "loading",
    });

    renderPage();

    // En état loading, la page ne rend pas le DropZone
    expect(screen.queryByText(/glisse ton CV ici/i)).not.toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // Upload réussi → polling démarre avec le bon cvId
  // -------------------------------------------------------------------------

  it("calls_uploadCv_with_file_and_token_after_file_selection", async () => {
    mockUploadCv.mockResolvedValueOnce({
      id: "cv-uuid-returned",
      filename: "cv.pdf",
      status: "parsing",
      uploaded_at: new Date().toISOString(),
    });

    renderPage();

    const input = document.getElementById("cv-file-input") as HTMLInputElement;
    const file = makePdfFile();

    Object.defineProperty(input, "files", {
      value: [file],
      configurable: true,
    });
    fireEvent.change(input);

    await waitFor(() => {
      expect(mockUploadCv).toHaveBeenCalledOnce();
    });

    // Vérifier les args : file + accessToken + callback progress
    const [calledFile, calledToken] = mockUploadCv.mock.calls[0];
    expect(calledFile).toBe(file);
    expect(calledToken).toBe("mock-token");
  });

  it("starts_polling_with_returned_cv_id_after_successful_upload", async () => {
    mockUploadCv.mockResolvedValueOnce({
      id: "cv-uuid-returned",
      filename: "cv.pdf",
      status: "parsing",
      uploaded_at: new Date().toISOString(),
    });

    renderPage();

    const input = document.getElementById("cv-file-input") as HTMLInputElement;
    Object.defineProperty(input, "files", {
      value: [makePdfFile()],
      configurable: true,
    });
    fireEvent.change(input);

    await waitFor(() => {
      expect(capturedPollingOptions?.cvId).toBe("cv-uuid-returned");
    });
  });

  // -------------------------------------------------------------------------
  // Status "ready" → redirect /profile
  // -------------------------------------------------------------------------

  it("redirects_to_profile_when_polling_onReady_is_called", async () => {
    mockUploadCv.mockResolvedValueOnce({
      id: "cv-uuid-returned",
      filename: "cv.pdf",
      status: "parsing",
      uploaded_at: new Date().toISOString(),
    });

    renderPage();

    const input = document.getElementById("cv-file-input") as HTMLInputElement;
    Object.defineProperty(input, "files", {
      value: [makePdfFile()],
      configurable: true,
    });
    fireEvent.change(input);

    // Attendre que le polling soit configuré
    await waitFor(() => {
      expect(capturedPollingOptions).not.toBeNull();
    });

    // Déclencher onReady manuellement (simuler le polling)
    capturedPollingOptions!.onReady({
      id: "cv-uuid-returned",
      parsing_status: "ready",
    });

    await waitFor(() => {
      expect(mockRouterPush).toHaveBeenCalledWith("/profile");
    });
  });

  // -------------------------------------------------------------------------
  // Erreur upload 413
  // -------------------------------------------------------------------------

  it("shows_error_message_when_upload_returns_413", async () => {
    mockUploadCv.mockRejectedValueOnce(
      new ApiCvsError("File too large", 413)
    );

    renderPage();

    const input = document.getElementById("cv-file-input") as HTMLInputElement;
    Object.defineProperty(input, "files", {
      value: [makePdfFile()],
      configurable: true,
    });
    fireEvent.change(input);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/5 MB/i);
    });
  });

  // -------------------------------------------------------------------------
  // Erreur parsing (onFailed du polling)
  // -------------------------------------------------------------------------

  it("shows_error_message_when_polling_calls_onFailed", async () => {
    mockUploadCv.mockResolvedValueOnce({
      id: "cv-uuid-returned",
      filename: "cv.pdf",
      status: "parsing",
      uploaded_at: new Date().toISOString(),
    });

    renderPage();

    const input = document.getElementById("cv-file-input") as HTMLInputElement;
    Object.defineProperty(input, "files", {
      value: [makePdfFile()],
      configurable: true,
    });
    fireEvent.change(input);

    await waitFor(() => {
      expect(capturedPollingOptions).not.toBeNull();
    });

    capturedPollingOptions!.onFailed();

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/analyse.*échoué/i);
    });
  });
});
