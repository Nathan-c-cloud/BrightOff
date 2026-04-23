/**
 * Tests unitaires — LoginPage
 *
 * Dépendances mockées :
 *   - next-auth/react : signIn (Client Component hook)
 *   - next/navigation : useSearchParams (lit l'URL ?error=)
 *   - next/link      : rendu simplifié (balise <a>)
 *
 * Pattern : Arrange → Act → Assert dans chaque test.
 * Un test = un comportement précis.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// ---------------------------------------------------------------------------
// Mocks de modules — déclarés avant les imports du composant (hoisting Vitest)
// ---------------------------------------------------------------------------

// Mock next-auth/react : on expose signIn comme spy contrôlable par test
const mockSignIn = vi.fn();
vi.mock("next-auth/react", () => ({
  signIn: mockSignIn,
}));

// Mock next/navigation : useSearchParams retourne un URLSearchParams vide par défaut.
// Certains tests le surchargeront via mockReturnValueOnce.
const mockGetSearchParam = vi.fn();
vi.mock("next/navigation", () => ({
  useSearchParams: () => ({
    get: mockGetSearchParam,
  }),
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
  }),
}));

// Mock next/link : rendu minimal pour éviter la dépendance au routeur Next.js
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

// ---------------------------------------------------------------------------
// Import du composant APRÈS les mocks (requis par l'hoisting de vi.mock)
// ---------------------------------------------------------------------------
import LoginPage from "./page";

// ---------------------------------------------------------------------------
// Suite de tests
// ---------------------------------------------------------------------------

describe("LoginPage", () => {
  beforeEach(() => {
    // Réinitialise les spies entre chaque test pour éviter la contamination
    vi.clearAllMocks();
    // Par défaut : aucun paramètre d'erreur dans l'URL
    mockGetSearchParam.mockReturnValue(null);
  });

  // -------------------------------------------------------------------------
  // Rendu initial
  // -------------------------------------------------------------------------

  it("renders_email_input", () => {
    render(<LoginPage />);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
  });

  it("renders_password_input", () => {
    render(<LoginPage />);
    expect(screen.getByLabelText(/mot de passe/i)).toBeInTheDocument();
  });

  it("renders_submit_button_with_label", () => {
    render(<LoginPage />);
    expect(
      screen.getByRole("button", { name: /se connecter/i })
    ).toBeInTheDocument();
  });

  it("renders_google_signin_button", () => {
    render(<LoginPage />);
    expect(
      screen.getByRole("button", { name: /continuer avec google/i })
    ).toBeInTheDocument();
  });

  it("renders_no_error_message_on_initial_load", () => {
    render(<LoginPage />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // Soumission du formulaire — cas nominal (succès)
  // -------------------------------------------------------------------------

  it("calls_signIn_credentials_with_correct_args_on_valid_submit", async () => {
    mockSignIn.mockResolvedValueOnce({ error: null, url: "/dashboard" });

    render(<LoginPage />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/email/i), "alice@example.com");
    await user.type(screen.getByLabelText(/mot de passe/i), "s3cr3tP@ss");
    await user.click(screen.getByRole("button", { name: /se connecter/i }));

    await waitFor(() => {
      expect(mockSignIn).toHaveBeenCalledOnce();
      expect(mockSignIn).toHaveBeenCalledWith("credentials", {
        email: "alice@example.com",
        password: "s3cr3tP@ss",
        redirect: false,
        callbackUrl: "/dashboard",
      });
    });
  });

  // -------------------------------------------------------------------------
  // Soumission du formulaire — cas d'erreur credentials invalides
  // -------------------------------------------------------------------------

  it("displays_invalid_credentials_error_when_signIn_returns_CredentialsSignin", async () => {
    mockSignIn.mockResolvedValueOnce({ error: "CredentialsSignin", url: null });

    render(<LoginPage />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/email/i), "alice@example.com");
    await user.type(screen.getByLabelText(/mot de passe/i), "mauvais_mdp");
    await user.click(screen.getByRole("button", { name: /se connecter/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Email ou mot de passe invalide."
      );
    });
  });

  it("does_not_call_signIn_twice_on_double_submit_while_loading", async () => {
    // signIn ne résout jamais → simule un état loading bloqué
    mockSignIn.mockImplementationOnce(() => new Promise(() => {}));

    render(<LoginPage />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/email/i), "alice@example.com");
    await user.type(screen.getByLabelText(/mot de passe/i), "s3cr3tP@ss");

    const submitButton = screen.getByRole("button", { name: /se connecter/i });
    await user.click(submitButton);

    // Le bouton est désactivé pendant le chargement
    expect(submitButton).toBeDisabled();
    expect(mockSignIn).toHaveBeenCalledOnce();
  });

  // -------------------------------------------------------------------------
  // Paramètre d'erreur dans l'URL (?error=AccountDisabled)
  // -------------------------------------------------------------------------

  it("displays_account_disabled_message_when_url_contains_AccountDisabled_error", () => {
    mockGetSearchParam.mockImplementation((key: string) =>
      key === "error" ? "AccountDisabled" : null
    );

    render(<LoginPage />);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Votre compte a été désactivé. Contactez le support."
    );
  });

  it("displays_session_expired_message_when_url_contains_SessionExpired_error", () => {
    mockGetSearchParam.mockImplementation((key: string) =>
      key === "error" ? "SessionExpired" : null
    );

    render(<LoginPage />);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Votre session a expiré, veuillez vous reconnecter."
    );
  });

  it("displays_generic_error_message_for_unknown_url_error_code", () => {
    mockGetSearchParam.mockImplementation((key: string) =>
      key === "error" ? "UnknownCode" : null
    );

    render(<LoginPage />);

    // Le switch default mappe les codes inconnus vers le message générique
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Email ou mot de passe invalide."
    );
  });

  // -------------------------------------------------------------------------
  // Form error prend le dessus sur l'erreur URL
  // -------------------------------------------------------------------------

  it("replaces_url_error_with_form_error_after_failed_submit", async () => {
    // L'URL contient déjà une erreur OAuth
    mockGetSearchParam.mockImplementation((key: string) =>
      key === "error" ? "AccountDisabled" : null
    );
    // La soumission échoue également
    mockSignIn.mockResolvedValueOnce({ error: "CredentialsSignin", url: null });

    render(<LoginPage />);
    const user = userEvent.setup();

    // Au départ, l'erreur URL est affichée
    expect(screen.getByRole("alert")).toHaveTextContent("désactivé");

    await user.type(screen.getByLabelText(/email/i), "alice@example.com");
    await user.type(screen.getByLabelText(/mot de passe/i), "mdp");
    await user.click(screen.getByRole("button", { name: /se connecter/i }));

    await waitFor(() => {
      // L'erreur formulaire remplace l'erreur URL
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Email ou mot de passe invalide."
      );
    });
  });

  // -------------------------------------------------------------------------
  // Bouton Google
  // -------------------------------------------------------------------------

  it("calls_signIn_google_with_dashboard_callbackUrl_on_google_button_click", async () => {
    render(<LoginPage />);
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
