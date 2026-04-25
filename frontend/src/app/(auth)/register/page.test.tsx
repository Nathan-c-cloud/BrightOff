/**
 * Tests unitaires — RegisterPage
 *
 * Dépendances mockées :
 *   - next-auth/react : signIn (connexion automatique post-inscription)
 *   - next/navigation : useRouter (router.push après inscription réussie)
 *   - next/link      : rendu simplifié (balise <a>)
 *   - global.fetch   : RegisterPage appelle directement fetch (pas api-auth.ts)
 *
 * Pattern : Arrange → Act → Assert dans chaque test.
 * Un test = un comportement précis.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// ---------------------------------------------------------------------------
// Mocks de modules
// ---------------------------------------------------------------------------

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
// Helpers — factory de Response fetch mockée
// ---------------------------------------------------------------------------

/**
 * Crée un objet Response minimal compatible avec le comportement de
 * RegisterPage (lit .status et éventuellement .json()).
 */
function makeFetchResponse(status: number, body?: object): Response {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: () => Promise.resolve(body ?? {}),
  } as unknown as Response;
}

// ---------------------------------------------------------------------------
// Suite de tests
// ---------------------------------------------------------------------------

describe("RegisterPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Réinitialise global.fetch entre chaque test
    vi.stubGlobal("fetch", vi.fn());
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

  it("displays_error_when_password_is_shorter_than_8_chars_and_does_not_call_fetch", async () => {
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
      "Le mot de passe doit contenir au moins 8 caractères."
    );
    // fetch ne doit pas être appelé si la validation client bloque
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Validation client — mots de passe non identiques
  // -------------------------------------------------------------------------

  it("displays_error_when_passwords_do_not_match_and_does_not_call_fetch", async () => {
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
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Soumission valide — inscription réussie (201) + signIn auto
  // -------------------------------------------------------------------------

  it("calls_fetch_register_endpoint_with_correct_payload_on_valid_submit", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      makeFetchResponse(201, {
        access_token: "tok",
        refresh_token: "ref",
        token_type: "bearer",
        expires_in: 1800,
      })
    );
    // signIn post-inscription réussit
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
      expect(vi.mocked(fetch)).toHaveBeenCalledOnce();
    });

    const [url, options] = vi.mocked(fetch).mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(url).toContain("/api/v1/auth/register");
    expect(options.method).toBe("POST");
    expect(JSON.parse(options.body as string)).toEqual({
      email: "alice@example.com",
      password: "motdepasse1",
    });
  });

  it("calls_signIn_credentials_after_successful_registration", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(makeFetchResponse(201));
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
    vi.mocked(fetch).mockResolvedValueOnce(makeFetchResponse(201));
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
    vi.mocked(fetch).mockResolvedValueOnce(makeFetchResponse(409));

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
    vi.mocked(fetch).mockResolvedValueOnce(
      makeFetchResponse(422, { detail: "Format d'email invalide." })
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

  it("displays_concatenated_messages_when_register_returns_422_with_array_detail", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      makeFetchResponse(422, {
        detail: [
          { msg: "champ email requis", loc: ["body", "email"], type: "missing" },
          { msg: "mot de passe trop court", loc: ["body", "password"], type: "too_short" },
        ],
      })
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
        "champ email requis, mot de passe trop court"
      );
    });
  });

  // -------------------------------------------------------------------------
  // Erreur serveur générique (500)
  // -------------------------------------------------------------------------

  it("displays_generic_server_error_when_register_returns_500", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(makeFetchResponse(500));

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
  // Erreur réseau (fetch rejette la promesse)
  // -------------------------------------------------------------------------

  it("displays_server_error_when_fetch_throws_network_error", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error("Network Error"));

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
    vi.mocked(fetch).mockResolvedValueOnce(makeFetchResponse(201));
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
