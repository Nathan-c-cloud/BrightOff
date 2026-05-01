"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { registerUser, ApiAuthError } from "@/lib/api-auth";
import { Button, Field, Input } from "@/components/ui";

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

export default function RegisterPage() {
  const router = useRouter();

  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [confirmPassword, setConfirmPassword] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  /**
   * Validation côté client avant l'envoi au backend.
   * Retourne un message d'erreur ou null si tout est valide.
   */
  function validateForm(): string | null {
    if (password.length < 10) {
      return "Le mot de passe doit contenir au moins 10 caractères.";
    }

    if (password !== confirmPassword) {
      return "Les mots de passe ne correspondent pas.";
    }

    return null;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setErrorMessage(null);

    const validationError = validateForm();
    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    setIsLoading(true);

    try {
      // Inscription via le helper centralisé — lève ApiAuthError en cas d'erreur HTTP
      await registerUser(email, password);

      // Inscription réussie — on crée la session Auth.js sans redemander les credentials
      const signInResult = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (signInResult?.error) {
        // Le login post-inscription a échoué (cas improbable mais géré)
        setErrorMessage("Compte créé, mais la connexion automatique a échoué. Connectez-vous manuellement.");
        router.push("/login");
        return;
      }

      router.push("/dashboard");
    } catch (err) {
      if (err instanceof ApiAuthError) {
        if (err.status === 409) {
          setErrorMessage("Cet email est déjà utilisé.");
          return;
        }
        if (err.status === 422) {
          // handleResponse dans api-auth.ts extrait déjà le detail si c'est une string.
          // Si c'est un tableau (ValidationError Pydantic), err.message sera "HTTP 422".
          const message = err.message !== `HTTP ${err.status}` ? err.message : "Erreur de validation";
          setErrorMessage(message);
          return;
        }
      }
      // Erreur réseau (NETWORK_ERROR) ou toute autre erreur inattendue
      setErrorMessage("Erreur serveur, réessayez.");
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
        className="text-2xl font-semibold text-center mb-2"
        style={{ color: "var(--color-text)" }}
      >
        Rejoignez BrightOff
      </h1>
      <p
        className="text-center text-sm mb-6"
        style={{ color: "var(--color-text-secondary)" }}
      >
        Créez votre compte gratuit en 30 secondes
      </p>

      {/* Bouton Google — en haut */}
      <button
        type="button"
        onClick={handleGoogleSignIn}
        disabled={isLoading}
        className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-lg text-sm font-semibold transition-colors mb-5"
        style={{
          border: "1.5px solid var(--color-border)",
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

      {/* Séparateur OU */}
      <div className="flex items-center mb-5">
        <div className="flex-1 h-px" style={{ backgroundColor: "var(--color-border)" }} />
        <span className="mx-3 text-xs" style={{ color: "var(--color-text-secondary)" }}>
          OU
        </span>
        <div className="flex-1 h-px" style={{ backgroundColor: "var(--color-border)" }} />
      </div>

      {/* Message d'erreur global */}
      {errorMessage && (
        <div
          role="alert"
          className="mb-4 px-4 py-3 rounded-lg text-sm"
          style={{
            backgroundColor: "var(--color-error-bg)",
            border: "1px solid var(--color-error)",
            color: "var(--color-error)",
          }}
        >
          {errorMessage}
        </div>
      )}

      {/* Formulaire email / password / confirmation */}
      <form onSubmit={handleSubmit} noValidate>
        <div className="mb-4">
          <Field label="Email" htmlFor="email">
            <Input
              id="email"
              type="email"
              name="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
              placeholder="vous@exemple.fr"
            />
          </Field>
        </div>

        <div className="mb-4">
          <Field
            label="Mot de passe"
            htmlFor="password"
          >
            <Input
              id="password"
              type="password"
              name="password"
              autoComplete="new-password"
              required
              minLength={10}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
              placeholder="10 caractères minimum"
            />
          </Field>
        </div>

        <div className="mb-6">
          <Field label="Confirmer le mot de passe" htmlFor="confirmPassword">
            <Input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={isLoading}
              placeholder="Répétez votre mot de passe"
            />
          </Field>
        </div>

        <Button
          variant="coral"
          size="lg"
          type="submit"
          disabled={isLoading}
          className="w-full"
        >
          {isLoading ? "Création du compte…" : "S'inscrire"}
        </Button>
      </form>

      {/* Lien vers connexion */}
      <p className="mt-6 text-center text-sm" style={{ color: "var(--color-text-secondary)" }}>
        Déjà un compte ?{" "}
        <Link
          href="/login"
          className="font-medium"
          style={{ color: "var(--color-primary)" }}
        >
          Se connecter
        </Link>
      </p>
    </>
  );
}
