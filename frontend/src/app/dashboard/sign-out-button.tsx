"use client";

/**
 * Client Component isolé pour le bouton de déconnexion.
 *
 * Séparé de la page (Server Component) pour pouvoir utiliser les
 * event handlers onMouseEnter/onMouseLeave nécessaires aux styles
 * hover inline de la charte BrightOff (même pattern que /login).
 *
 * La Server Action handleSignOut est passée en prop depuis la page
 * parente — c'est le pattern idiomatique Next.js pour injecter
 * une Server Action dans un Client Component sans exposer la logique
 * serveur dans le bundle client.
 */

interface SignOutButtonProps {
  signOutAction: () => Promise<void>;
}

export default function SignOutButton({ signOutAction }: SignOutButtonProps) {
  return (
    <form action={signOutAction}>
      <button
        type="submit"
        className="w-full py-2.5 px-4 rounded-lg text-sm font-semibold transition-colors"
        style={{
          border: "1px solid var(--brightoff-border)",
          color: "var(--brightoff-text)",
          backgroundColor: "var(--brightoff-bg-secondary)",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = "var(--brightoff-error-bg)";
          e.currentTarget.style.borderColor = "var(--brightoff-coral)";
          e.currentTarget.style.color = "var(--brightoff-coral)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = "var(--brightoff-bg-secondary)";
          e.currentTarget.style.borderColor = "var(--brightoff-border)";
          e.currentTarget.style.color = "var(--brightoff-text)";
        }}
      >
        Se déconnecter
      </button>
    </form>
  );
}
