/**
 * Page dashboard — placeholder Sprint 2.
 *
 * Server Component (par défaut dans l'App Router Next.js 16).
 * Récupère la session Auth.js côté serveur via auth() pour afficher
 * l'email de l'utilisateur connecté (US-205).
 *
 * La déconnexion est gérée par une Server Action inline qui appelle signOut()
 * (US-207). On utilise un <form> avec l'attribut action pour déclencher
 * la Server Action — compatible progressive enhancement (pas besoin de JS
 * côté client pour la déconnexion).
 *
 * Note : la protection de la route /dashboard est déjà assurée par proxy.ts
 * qui redirige vers /login si la session est absente ou expirée. La page
 * n'a donc pas besoin de re-vérifier l'authentification, mais on garde
 * auth() pour récupérer les données de session à afficher.
 */

import { auth, signOut } from "@/auth";
import type { Metadata } from "next";
import SignOutButton from "./sign-out-button";

export const metadata: Metadata = {
  title: "BrightOff — Dashboard",
};

export default async function DashboardPage() {
  const session = await auth();

  // La session est garantie non-null par proxy.ts, mais on reste défensif
  // pour que TypeScript soit satisfait et pour une éventuelle réutilisation.
  const userEmail = session?.user?.email ?? "Utilisateur";

  /**
   * Server Action de déconnexion.
   * signOut() invalide la session JWT (cookie httpOnly) et redirige
   * vers /login (configuré dans auth.ts → pages.signIn).
   */
  async function handleSignOut() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-12"
      style={{ backgroundColor: "var(--color-bg)" }}
    >
      {/* En-tête de marque */}
      <div className="mb-8 text-center">
        <span
          className="text-3xl font-bold tracking-tight"
          style={{
            background: "var(--gradient-brand)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
        >
          BrightOff
        </span>
        <p className="mt-1 text-sm" style={{ color: "var(--color-text-secondary)" }}>
          Trouve l&apos;offre qui te correspond vraiment
        </p>
      </div>

      {/* Carte principale */}
      <div
        className="w-full max-w-md rounded-2xl p-8"
        style={{
          backgroundColor: "var(--color-bg-card)",
          border: "1px solid var(--color-border)",
          boxShadow:
            "0 4px 6px -1px rgba(43, 58, 74, 0.08), 0 2px 4px -1px rgba(43, 58, 74, 0.04)",
        }}
      >
        {/* Message de bienvenue */}
        <h1
          className="text-2xl font-semibold text-center mb-2"
          style={{ color: "var(--color-text)" }}
        >
          Bonjour
        </h1>
        <p
          className="text-center text-sm font-medium mb-8 truncate"
          style={{ color: "var(--color-accent)" }}
          title={userEmail}
        >
          {userEmail}
        </p>

        {/* Notice placeholder */}
        <div
          className="rounded-xl px-5 py-4 mb-8 text-sm text-center"
          style={{
            backgroundColor: "var(--color-hover-light)",
            border: "1px solid var(--color-border)",
            color: "var(--color-text-secondary)",
          }}
        >
          Le contenu réel du dashboard sera disponible au Sprint 5.
        </div>

        {/* Bouton de déconnexion — Client Component qui encapsule la Server Action */}
        <SignOutButton signOutAction={handleSignOut} />
      </div>

      {/* Pied de page */}
      <p className="mt-6 text-xs" style={{ color: "var(--color-text-secondary)" }}>
        &copy; {new Date().getFullYear()} BrightOff. Tous droits réservés.
      </p>
    </div>
  );
}
