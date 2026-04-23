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
          border: "1px solid #D4E3ED",
          color: "#2B3A4A",
          backgroundColor: "#FFFFFF",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = "#FFF0EE";
          e.currentTarget.style.borderColor = "#FF705A";
          e.currentTarget.style.color = "#FF705A";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = "#FFFFFF";
          e.currentTarget.style.borderColor = "#D4E3ED";
          e.currentTarget.style.color = "#2B3A4A";
        }}
      >
        Se déconnecter
      </button>
    </form>
  );
}
