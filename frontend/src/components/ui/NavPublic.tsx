import React from "react";
import Link from "next/link";
import { Logo } from "./Logo";

export type NavPublicProps = {
  /** Lien "Connexion" — défaut "/login" */
  loginHref?: string;
  /** Lien "S'inscrire" (bouton CTA) — défaut "/register" */
  registerHref?: string;
};

/**
 * NavPublic — header des pages publiques (landing, login, register).
 *
 * Structure : Logo (clic → "/") à gauche | Connexion + S'inscrire à droite.
 * Utilise next/link pour la navigation client-side (App Router Next.js 16).
 * Les styles proviennent des classes .nav-public / .btn / .btn-ghost / .btn-coral
 * définies dans globals.css — aucune valeur hex hardcodée ici.
 */
export function NavPublic({
  loginHref = "/login",
  registerHref = "/register",
}: NavPublicProps) {
  return (
    <header className="nav-public">
      <Link href="/" aria-label="BrightOff — retour à l'accueil">
        <Logo variant="standard" size={140} />
      </Link>
      <div className="nav-public-actions">
        <Link href={loginHref} className="btn btn-ghost">
          Connexion
        </Link>
        <Link href={registerHref} className="btn btn-coral">
          S&apos;inscrire
        </Link>
      </div>
    </header>
  );
}
