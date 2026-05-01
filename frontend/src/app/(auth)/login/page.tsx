"use client";

import { useState, FormEvent, Suspense } from "react";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

/** Icône Google SVG inline — évite une dépendance externe pour un seul icône */
function GoogleIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="w-5 h-5"
    >
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

/**
 * Traduit les codes d'erreur Auth.js / BrightOff en messages lisibles.
 * Les codes viennent soit du searchParam `error` (redirect OAuth),
 * soit du retour de signIn({ redirect: false }).
 */
function resolveErrorMessage(errorCode: string | null): string | null {
  if (!errorCode) return null;

  switch (errorCode) {
    case "AccountDisabled":
      return "Votre compte a été désactivé. Contactez le support.";
    case "SessionExpired":
      return "Votre session a expiré, veuillez vous reconnecter.";
    case "CredentialsSignin":
      // Code Auth.js standard pour credentials invalides
      return "Email ou mot de passe invalide.";
    default:
      return "Email ou mot de passe invalide.";
  }
}

/**
 * Composant interne qui utilise useSearchParams() — doit être isolé dans un
 * Suspense boundary pour éviter l'erreur Next.js au build (CSR bailout).
 */
function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Auth.js redirige vers /login?error=<code> après une erreur OAuth ou AccountDisabled
  const urlError = searchParams.get("error");

  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [formError, setFormError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // L'erreur affichée est celle du formulaire (soumission) ou de l'URL (OAuth redirect)
  const displayedError = formError ?? resolveErrorMessage(urlError);

  async function handleCredentialsSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);
    setIsLoading(true);

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
        callbackUrl: "/dashboard",
      });

      if (result?.error) {
        setFormError(resolveErrorMessage(result.error));
        return;
      }

      // Redirection manuelle après succès (redirect: false désactive la redirection auto)
      if (result?.url) {
        router.push(result.url);
      }
    } finally {
      setIsLoading(false);
    }
  }

  async function handleGoogleSignIn() {
    await signIn("google", { callbackUrl: "/dashboard" });
  }

  return (
    <>
      <h1
        className="text-2xl font-semibold text-center mb-6"
        style={{ color: "var(--color-text)" }}
      >
        Se connecter
      </h1>

      {/* Message d'erreur global */}
      {displayedError && (
        <div
          role="alert"
          className="mb-4 px-4 py-3 rounded-lg text-sm"
          style={{
            backgroundColor: "var(--color-error-bg)",
            border: "1px solid var(--color-error)",
            color: "var(--color-error)",
          }}
        >
          {displayedError}
        </div>
      )}

      {/* Formulaire email / password */}
      <form onSubmit={handleCredentialsSubmit} noValidate>
        <div className="mb-4">
          <label
            htmlFor="email"
            className="block text-sm font-medium mb-1"
            style={{ color: "var(--color-text)" }}
          >
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isLoading}
            className="w-full px-4 py-2.5 rounded-lg text-sm outline-none transition-shadow"
            style={{
              border: "1px solid var(--color-border)",
              color: "var(--color-text)",
              backgroundColor: "var(--color-bg-card)",
            }}
            onFocus={(e) => {
              e.currentTarget.style.boxShadow = "0 0 0 3px rgba(122, 199, 230, 0.3)";
              e.currentTarget.style.borderColor = "var(--color-primary)";
            }}
            onBlur={(e) => {
              e.currentTarget.style.boxShadow = "none";
              e.currentTarget.style.borderColor = "var(--color-border)";
            }}
            placeholder="vous@exemple.fr"
          />
        </div>

        <div className="mb-6">
          <div className="flex items-center justify-between mb-1">
            <label
              htmlFor="password"
              className="block text-sm font-medium"
              style={{ color: "var(--color-text)" }}
            >
              Mot de passe
            </label>
          </div>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isLoading}
            className="w-full px-4 py-2.5 rounded-lg text-sm outline-none transition-shadow"
            style={{
              border: "1px solid var(--color-border)",
              color: "var(--color-text)",
              backgroundColor: "var(--color-bg-card)",
            }}
            onFocus={(e) => {
              e.currentTarget.style.boxShadow = "0 0 0 3px rgba(122, 199, 230, 0.3)";
              e.currentTarget.style.borderColor = "var(--color-primary)";
            }}
            onBlur={(e) => {
              e.currentTarget.style.boxShadow = "none";
              e.currentTarget.style.borderColor = "var(--color-border)";
            }}
            placeholder="••••••••"
          />
        </div>

        {/* Bouton primaire — corail */}
        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-2.5 px-4 rounded-lg text-sm font-semibold text-white transition-opacity"
          style={{ backgroundColor: "var(--color-accent)" }}
          onMouseEnter={(e) => {
            if (!isLoading) e.currentTarget.style.backgroundColor = "var(--color-accent-soft)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "var(--color-accent)";
          }}
        >
          {isLoading ? "Connexion…" : "Se connecter"}
        </button>
      </form>

      {/* Séparateur */}
      <div className="flex items-center my-5">
        <div className="flex-1 h-px" style={{ backgroundColor: "var(--color-border)" }} />
        <span className="mx-3 text-xs" style={{ color: "var(--color-text-secondary)" }}>
          ou
        </span>
        <div className="flex-1 h-px" style={{ backgroundColor: "var(--color-border)" }} />
      </div>

      {/* Bouton Google — secondaire */}
      <button
        type="button"
        onClick={handleGoogleSignIn}
        disabled={isLoading}
        className="w-full flex items-center justify-center gap-3 py-2.5 px-4 rounded-lg text-sm font-medium transition-colors"
        style={{
          border: "1px solid var(--color-border)",
          color: "var(--color-text)",
          backgroundColor: "var(--color-bg-card)",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = "var(--color-hover-light)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = "var(--color-bg-card)";
        }}
      >
        <GoogleIcon />
        Continuer avec Google
      </button>

      {/* Lien vers inscription */}
      <p className="mt-6 text-center text-sm" style={{ color: "var(--color-text-secondary)" }}>
        Pas encore de compte ?{" "}
        <Link
          href="/register"
          className="font-medium"
          style={{ color: "var(--color-primary)" }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = "var(--color-info)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = "var(--color-primary)";
          }}
        >
          S&apos;inscrire
        </Link>
      </p>
    </>
  );
}

/**
 * Page de connexion exportée par défaut.
 * LoginForm est isolé dans un Suspense boundary car il appelle useSearchParams(),
 * ce qui provoque un CSR bailout si la page n'est pas enveloppée.
 */
export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
