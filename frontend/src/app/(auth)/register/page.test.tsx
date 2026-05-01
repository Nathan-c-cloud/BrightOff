/**
 * Tests unitaires — RegisterPage
 *
 * Dépendances mockées :
 *   - @/lib/api-auth  : registerUser (appelé par RegisterPage depuis la refacto)
 *   - next-auth/react : signIn (connexion automatique post-inscription)
 *   - next/navigation : useRouter (router.push après inscription réussie)
 *   - next/link      : rendu simplifié (balise <a>)
 *
 * Pattern : Arrange → Act → Assert dans chaque test.
 * Un test = un comportement précis.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApiAuthError } from "@/lib/api-auth";

// ---------------------------------------------------------------------------
// Mocks de modules
// ---------------------------------------------------------------------------

const mockRegisterUser = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api-auth", () => ({
  registerUser: mockRegisterUser,
  // Re-export de la classe pour que les imports dans le composant fonctionnent
  ApiAuthError: class ApiAuthError extends Error {
    status: number;
    code?: string;
    constructor(message: string, status: number, code?: string) {
      super(message);
      this.name = "ApiAuthError";
      this.status = status;
      this.code = code;
    }
  },
}));

const mockSignIn = vi.hoisted(() => vi.fn());
vi.mock("next-auth/react", () => ({
  signIn: mockSignIn,
}));

const mockRouterPush = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockRouterPush,
    replace: vi.fn(),
  }),
  useSearchParams: () => ({
    get: vi.fn().mockReturnValue(null),
  }),
}));

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

// ---------------------------------------------------------------------------
// Import du composant APRÈS les mocks
// ---------------------------------------------------------------------------
import RegisterPage from "./page";

// ---------------------------------------------------------------------------
// Suite de tests
// ---------------------------------------------------------------------------

describe("RegisterPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // Rendu initial
  // -------------------------------------------------------------------------

  it("renders_email_input", () => {
    render(<RegisterPage />);
    expect(screen.getByLabelText(/^email$/i)).toBeInTheDocument();
  });

  it("renders_password_input", () => {
    render(<RegisterPage />);
    // Sélection par label exact "Mot de passe" (pas "Confirmer le mot de passe")
    expect(screen.getByLabelText(/^mot de passe$/i)).toBeInTheDocument();
  });

  it("renders_confirm_password_input", () => {
    render(<RegisterPage />);
    expect(
      screen.getByLabelText(/confirmer le mot de passe/i)
    ).toBeInTheDocument();
  });

  it("renders_submit_button_with_label", () => {
    render(<RegisterPage />);
    expect(
      screen.getByRole("button", { name: /s'inscrire/i })
    ).toBeInTheDocument();
  });

  it("renders_no_error_message_on_initial_load", () => {
    render(<RegisterPage />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // Validation client — mot de passe trop court
  // -------------------------------------------------------------------------

  it("displays_error_when_password_is_shorter_than_10_chars_and_does_not_call_registerUser", async () => {
    render(<RegisterPage />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/^email$/i), "alice@example.com");
    await user.type(screen.getByLabelText(/^mot de passe$/i), "court");
    await user.type(
      screen.getByLabelText(/confirmer le mot de passe/i),
      "court"
    );
    await user.click(screen.getByRole("button", { name: /s'inscrire/i }));

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Le mot de passe doit contenir au moins 10 caractères."
    );
    // registerUser ne doit pas être appelé si la validation client bloque
    expect(mockRegisterUser).not.toHaveBeenCalled();
  });

  it("displays_error_when_password_is_exactly_9_chars_and_does_not_call_registerUser", async () => {
    render(<RegisterPage />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/^email$/i), "alice@example.com");
    // 9 caractères exactement — doit être rejeté (seuil est 10)
    await user.type(screen.getByLabelText(/^mot de passe$/i), "neufchars");
    await user.type(
      screen.getByLabelText(/confirmer le mot de passe/i),
      "neufchars"
    );
    await user.click(screen.getByRole("button", { name: /s'inscrire/i }));

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Le mot de passe doit contenir au moins 10 caractères."
    );
    expect(mockRegisterUser).not.toHaveBeenCalled();
  });

  it("does_not_display_error_when_password_is_exactly_10_chars", async () => {
    mockRegisterUser.mockResolvedValueOnce({
      access_token: "tok",
      refresh_token: "ref",
      token_type: "bearer",
      expires_in: 1800,
    });
    mockSignIn.mockResolvedValueOnce({ error: null, url: "/dashboard" });

    render(<RegisterPage />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/^email$/i), "alice@example.com");
    // 10 caractères exactement — doit être accepté
    await user.type(screen.getByLabelText(/^mot de passe$/i), "dixcaracts");
    await user.type(
      screen.getByLabelText(/confirmer le mot de passe/i),
      "dixcaracts"
    );
    await user.click(screen.getByRole("button", { name: /s'inscrire/i }));

    await waitFor(() => {
      expect(mockRegisterUser).toHaveBeenCalledOnce();
      expect(mockRegisterUser).toHaveBeenCalledWith("alice@example.com", "dixcaracts");
    });
  });

  // -------------------------------------------------------------------------
  // Validation client — mots de passe non identiques
  // -------------------------------------------------------------------------

  it("displays_error_when_passwords_do_not_match_and_does_not_call_registerUser", async () => {
    render(<RegisterPage />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/^email$/i), "alice@example.com");
    await user.type(screen.getByLabelText(/^mot de passe$/i), "motdepasse1");
    await user.type(
      screen.getByLabelText(/confirmer le mot de passe/i),
      "motdepasse2"
    );
    await user.click(screen.getByRole("button", { name: /s'inscrire/i }));

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Les mots de passe ne correspondent pas."
    );
    expect(mockRegisterUser).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Soumission valide — inscription réussie + signIn auto
  // -------------------------------------------------------------------------

  it("calls_registerUser_with_correct_payload_on_valid_submit", async () => {
    mockRegisterUser.mockResolvedValueOnce({
      access_token: "tok",
      refresh_token: "ref",
      token_type: "bearer",
      expires_in: 1800,
    });
    mockSignIn.mockResolvedValueOnce({ error: null, url: "/dashboard" });

    render(<RegisterPage />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/^email$/i), "alice@example.com");
    await user.type(screen.getByLabelText(/^mot de passe$/i), "motdepasse1");
    await user.type(
      screen.getByLabelText(/confirmer le mot de passe/i),
      "motdepasse1"
    );
    await user.click(screen.getByRole("button", { name: /s'inscrire/i }));

    await waitFor(() => {
      expect(mockRegisterUser).toHaveBeenCalledOnce();
      expect(mockRegisterUser).toHaveBeenCalledWith("alice@example.com", "motdepasse1");
    });
  });

  it("calls_signIn_credentials_after_successful_registration", async () => {
    mockRegisterUser.mockResolvedValueOnce({
      access_token: "tok",
      refresh_token: "ref",
      token_type: "bearer",
      expires_in: 1800,
    });
    mockSignIn.mockResolvedValueOnce({ error: null, url: "/dashboard" });

    render(<RegisterPage />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/^email$/i), "alice@example.com");
    await user.type(screen.getByLabelText(/^mot de passe$/i), "motdepasse1");
    await user.type(
      screen.getByLabelText(/confirmer le mot de passe/i),
      "motdepasse1"
    );
    await user.click(screen.getByRole("button", { name: /s'inscrire/i }));

    await waitFor(() => {
      expect(mockSignIn).toHaveBeenCalledOnce();
      expect(mockSignIn).toHaveBeenCalledWith("credentials", {
        email: "alice@example.com",
        password: "motdepasse1",
        redirect: false,
      });
    });
  });

  it("redirects_to_dashboard_after_successful_registration_and_auto_signin", async () => {
    mockRegisterUser.mockResolvedValueOnce({
      access_token: "tok",
      refresh_token: "ref",
      token_type: "bearer",
      expires_in: 1800,
    });
    mockSignIn.mockResolvedValueOnce({ error: null, url: "/dashboard" });

    render(<RegisterPage />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/^email$/i), "alice@example.com");
    await user.type(screen.getByLabelText(/^mot de passe$/i), "motdepasse1");
    await user.type(
      screen.getByLabelText(/confirmer le mot de passe/i),
      "motdepasse1"
    );
    await user.click(screen.getByRole("button", { name: /s'inscrire/i }));

    await waitFor(() => {
      expect(mockRouterPush).toHaveBeenCalledWith("/dashboard");
    });
  });

  // -------------------------------------------------------------------------
  // Erreur 409 — email déjà utilisé
  // -------------------------------------------------------------------------

  it("displays_email_already_used_error_when_register_returns_409", async () => {
    mockRegisterUser.mockRejectedValueOnce(new ApiAuthError("Email déjà utilisé", 409));

    render(<RegisterPage />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/^email$/i), "existing@example.com");
    await user.type(screen.getByLabelText(/^mot de passe$/i), "motdepasse1");
    await user.type(
      screen.getByLabelText(/confirmer le mot de passe/i),
      "motdepasse1"
    );
    await user.click(screen.getByRole("button", { name: /s'inscrire/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Cet email est déjà utilisé."
      );
    });
    // Pas de signIn si l'inscription échoue
    expect(mockSignIn).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Erreur 422 — validation Pydantic (detail string)
  // -------------------------------------------------------------------------

  it("displays_validation_detail_string_when_register_returns_422_with_string_detail", async () => {
    // handleResponse extrait le detail string → err.message = "Format d'email invalide."
    mockRegisterUser.mockRejectedValueOnce(
      new ApiAuthError("Format d'email invalide.", 422)
    );

    render(<RegisterPage />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/^email$/i), "bad-email");
    await user.type(screen.getByLabelText(/^mot de passe$/i), "motdepasse1");
    await user.type(
      screen.getByLabelText(/confirmer le mot de passe/i),
      "motdepasse1"
    );
    await user.click(screen.getByRole("button", { name: /s'inscrire/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Format d'email invalide."
      );
    });
  });

  it("displays_fallback_message_when_register_returns_422_with_array_detail", async () => {
    // handleResponse ne parse pas les tableaux → err.message = "HTTP 422" → fallback affiché
    mockRegisterUser.mockRejectedValueOnce(
      new ApiAuthError("HTTP 422", 422)
    );

    render(<RegisterPage />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/^email$/i), "alice@example.com");
    await user.type(screen.getByLabelText(/^mot de passe$/i), "motdepasse1");
    await user.type(
      screen.getByLabelText(/confirmer le mot de passe/i),
      "motdepasse1"
    );
    await user.click(screen.getByRole("button", { name: /s'inscrire/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Erreur de validation");
    });
  });

  // -------------------------------------------------------------------------
  // Erreur serveur générique (500)
  // -------------------------------------------------------------------------

  it("displays_generic_server_error_when_register_returns_500", async () => {
    mockRegisterUser.mockRejectedValueOnce(new ApiAuthError("HTTP 500", 500));

    render(<RegisterPage />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/^email$/i), "alice@example.com");
    await user.type(screen.getByLabelText(/^mot de passe$/i), "motdepasse1");
    await user.type(
      screen.getByLabelText(/confirmer le mot de passe/i),
      "motdepasse1"
    );
    await user.click(screen.getByRole("button", { name: /s'inscrire/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Erreur serveur, réessayez."
      );
    });
  });

  // -------------------------------------------------------------------------
  // Erreur réseau (NETWORK_ERROR)
  // -------------------------------------------------------------------------

  it("displays_server_error_when_registerUser_throws_network_error", async () => {
    mockRegisterUser.mockRejectedValueOnce(
      new ApiAuthError("Erreur réseau", 0, "NETWORK_ERROR")
    );

    render(<RegisterPage />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/^email$/i), "alice@example.com");
    await user.type(screen.getByLabelText(/^mot de passe$/i), "motdepasse1");
    await user.type(
      screen.getByLabelText(/confirmer le mot de passe/i),
      "motdepasse1"
    );
    await user.click(screen.getByRole("button", { name: /s'inscrire/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Erreur serveur, réessayez."
      );
    });
  });

  // -------------------------------------------------------------------------
  // signIn post-inscription échoue (cas improbable mais géré)
  // -------------------------------------------------------------------------

  it("displays_manual_login_message_and_redirects_to_login_when_auto_signin_fails_after_registration", async () => {
    mockRegisterUser.mockResolvedValueOnce({
      access_token: "tok",
      refresh_token: "ref",
      token_type: "bearer",
      expires_in: 1800,
    });
    mockSignIn.mockResolvedValueOnce({ error: "CredentialsSignin", url: null });

    render(<RegisterPage />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/^email$/i), "alice@example.com");
    await user.type(screen.getByLabelText(/^mot de passe$/i), "motdepasse1");
    await user.type(
      screen.getByLabelText(/confirmer le mot de passe/i),
      "motdepasse1"
    );
    await user.click(screen.getByRole("button", { name: /s'inscrire/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Compte créé, mais la connexion automatique a échoué. Connectez-vous manuellement."
      );
      expect(mockRouterPush).toHaveBeenCalledWith("/login");
    });
  });

  // -------------------------------------------------------------------------
  // Bouton Google
  // -------------------------------------------------------------------------

  it("calls_signIn_google_with_dashboard_callbackUrl_on_google_button_click", async () => {
    render(<RegisterPage />);
    const user = userEvent.setup();

    await user.click(
      screen.getByRole("button", { name: /continuer avec google/i })
    );

    expect(mockSignIn).toHaveBeenCalledOnce();
    expect(mockSignIn).toHaveBeenCalledWith("google", {
      callbackUrl: "/dashboard",
    });
  });
});
