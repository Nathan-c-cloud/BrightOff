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
          border: "1px solid var(--color-border)",
          color: "var(--color-text)",
          backgroundColor: "var(--color-bg-card)",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = "var(--color-error-bg)";
          e.currentTarget.style.borderColor = "var(--color-accent)";
          e.currentTarget.style.color = "var(--color-accent)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = "var(--color-bg-card)";
          e.currentTarget.style.borderColor = "var(--color-border)";
          e.currentTarget.style.color = "var(--color-text)";
        }}
      >
        Se déconnecter
      </button>
    </form>
  );
}
