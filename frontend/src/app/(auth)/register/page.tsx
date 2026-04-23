"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";

interface ApiErrorDetail {
  msg: string;
  loc?: string[];
  type?: string;
}

interface ApiErrorResponse {
  detail: string | ApiErrorDetail[];
}

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
 * Extrait un message lisible depuis une erreur de validation Pydantic (422).
 * Le champ `detail` peut être une string ou un tableau d'objets ValidationError.
 */
function extractApiErrorMessage(body: ApiErrorResponse): string {
  if (typeof body.detail === "string") {
    return body.detail;
  }

  if (Array.isArray(body.detail) && body.detail.length > 0) {
    return body.detail.map((e) => e.msg).join(", ");
  }

  return "Erreur de validation";
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
    if (password.length < 8) {
      return "Le mot de passe doit contenir au moins 8 caractères.";
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
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      const res = await fetch(`${apiUrl}/api/v1/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (res.status === 201) {
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
        return;
      }

      if (res.status === 409) {
        setErrorMessage("Cet email est déjà utilisé.");
        return;
      }

      if (res.status === 422) {
        const body = (await res.json()) as ApiErrorResponse;
        setErrorMessage(extractApiErrorMessage(body));
        return;
      }

      // 500 ou toute autre erreur inattendue
      setErrorMessage("Erreur serveur, réessayez.");
    } catch {
      // Erreur réseau (fetch a rejeté la promesse)
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
        className="text-2xl font-semibold text-center mb-6"
        style={{ color: "#2B3A4A" }}
      >
        Créer un compte
      </h1>

      {/* Message d'erreur global */}
      {errorMessage && (
        <div
          role="alert"
          className="mb-4 px-4 py-3 rounded-lg text-sm"
          style={{
            backgroundColor: "#FFF0EE",
            border: "1px solid #E8503A",
            color: "#E8503A",
          }}
        >
          {errorMessage}
        </div>
      )}

      {/* Formulaire email / password / confirmation */}
      <form onSubmit={handleSubmit} noValidate>
        <div className="mb-4">
          <label
            htmlFor="email"
            className="block text-sm font-medium mb-1"
            style={{ color: "#2B3A4A" }}
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
              border: "1px solid #D4E3ED",
              color: "#2B3A4A",
              backgroundColor: "#FFFFFF",
            }}
            onFocus={(e) => {
              e.currentTarget.style.boxShadow = "0 0 0 3px rgba(122, 199, 230, 0.3)";
              e.currentTarget.style.borderColor = "#7AC7E6";
            }}
            onBlur={(e) => {
              e.currentTarget.style.boxShadow = "none";
              e.currentTarget.style.borderColor = "#D4E3ED";
            }}
            placeholder="vous@exemple.fr"
          />
        </div>

        <div className="mb-4">
          <label
            htmlFor="password"
            className="block text-sm font-medium mb-1"
            style={{ color: "#2B3A4A" }}
          >
            Mot de passe
          </label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isLoading}
            className="w-full px-4 py-2.5 rounded-lg text-sm outline-none transition-shadow"
            style={{
              border: "1px solid #D4E3ED",
              color: "#2B3A4A",
              backgroundColor: "#FFFFFF",
            }}
            onFocus={(e) => {
              e.currentTarget.style.boxShadow = "0 0 0 3px rgba(122, 199, 230, 0.3)";
              e.currentTarget.style.borderColor = "#7AC7E6";
            }}
            onBlur={(e) => {
              e.currentTarget.style.boxShadow = "none";
              e.currentTarget.style.borderColor = "#D4E3ED";
            }}
            placeholder="8 caractères minimum"
          />
        </div>

        <div className="mb-6">
          <label
            htmlFor="confirmPassword"
            className="block text-sm font-medium mb-1"
            style={{ color: "#2B3A4A" }}
          >
            Confirmer le mot de passe
          </label>
          <input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            disabled={isLoading}
            className="w-full px-4 py-2.5 rounded-lg text-sm outline-none transition-shadow"
            style={{
              border: "1px solid #D4E3ED",
              color: "#2B3A4A",
              backgroundColor: "#FFFFFF",
            }}
            onFocus={(e) => {
              e.currentTarget.style.boxShadow = "0 0 0 3px rgba(122, 199, 230, 0.3)";
              e.currentTarget.style.borderColor = "#7AC7E6";
            }}
            onBlur={(e) => {
              e.currentTarget.style.boxShadow = "none";
              e.currentTarget.style.borderColor = "#D4E3ED";
            }}
            placeholder="Répétez votre mot de passe"
          />
        </div>

        {/* Bouton primaire — corail */}
        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-2.5 px-4 rounded-lg text-sm font-semibold text-white transition-opacity"
          style={{ backgroundColor: "#FF705A" }}
          onMouseEnter={(e) => {
            if (!isLoading) e.currentTarget.style.backgroundColor = "#FFC2AC";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "#FF705A";
          }}
        >
          {isLoading ? "Création du compte…" : "S'inscrire"}
        </button>
      </form>

      {/* Séparateur */}
      <div className="flex items-center my-5">
        <div className="flex-1 h-px" style={{ backgroundColor: "#D4E3ED" }} />
        <span className="mx-3 text-xs" style={{ color: "#6B7F94" }}>
          ou
        </span>
        <div className="flex-1 h-px" style={{ backgroundColor: "#D4E3ED" }} />
      </div>

      {/* Bouton Google — secondaire */}
      <button
        type="button"
        onClick={handleGoogleSignIn}
        disabled={isLoading}
        className="w-full flex items-center justify-center gap-3 py-2.5 px-4 rounded-lg text-sm font-medium transition-colors"
        style={{
          border: "1px solid #D4E3ED",
          color: "#2B3A4A",
          backgroundColor: "#FFFFFF",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = "#F5FAFE";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = "#FFFFFF";
        }}
      >
        <GoogleIcon />
        Continuer avec Google
      </button>

      {/* Lien vers connexion */}
      <p className="mt-6 text-center text-sm" style={{ color: "#6B7F94" }}>
        Déjà un compte ?{" "}
        <Link
          href="/login"
          className="font-medium"
          style={{ color: "#7AC7E6" }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = "#5BB8DB";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = "#7AC7E6";
          }}
        >
          Se connecter
        </Link>
      </p>
    </>
  );
}
