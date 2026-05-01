"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Logo } from "./Logo";
import { Avatar } from "./Avatar";

export type NavAppLink = {
  label: string;
  href: string;
  /** Identifiant unique pour détecter l'état actif (ex: 'dashboard') */
  id: string;
};

export type NavAppProps = {
  /** Liens de navigation principaux */
  links?: NavAppLink[];
  /** ID du lien actif (utilisé pour le soulignement blanc) */
  activeLinkId?: string;
  /** Nom utilisateur affiché à droite (ex: "Thomas D.") */
  userName: string;
  /** Initiales affichées dans l'avatar (ex: "TD") */
  userInitials: string;
  /** Callback appelé quand l'utilisateur clique sur "Se déconnecter" */
  onLogout: () => void;
  /** Nombre de notifications non lues (default 0) — affiche un badge si > 0 */
  unreadNotifications?: number;
};

const DEFAULT_LINKS: NavAppLink[] = [
  { id: "dashboard", label: "Dashboard", href: "/dashboard" },
  { id: "profile", label: "Mon profil", href: "/profile" },
  { id: "applications", label: "Candidatures", href: "/applications" },
];

/**
 * Icône cloche SVG — inline pour éviter toute dépendance externe.
 * Taille fixée à 20×20 pour la nav.
 */
function BellIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

/**
 * NavApp — header de l'application connectée (dashboard, profile, etc.).
 *
 * Fond bleu ciel (--color-primary), texte blanc.
 * Contient : Logo white | liens de navigation | cloche notif + avatar avec dropdown.
 *
 * Le dropdown utilisateur est géré par state local + fermeture sur clic extérieur
 * (mousedown sur document) et touche Escape. Accessible via ARIA menu pattern.
 *
 * Utilise next/link (App Router Next.js 16) — className est passé directement
 * au <a> sous-jacent (comportement supporté depuis v13).
 */
export function NavApp({
  links = DEFAULT_LINKS,
  activeLinkId,
  userName,
  userInitials,
  onLogout,
  unreadNotifications = 0,
}: NavAppProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const userMetaRef = useRef<HTMLDivElement>(null);

  // Fermeture dropdown au clic en dehors du composant
  useEffect(() => {
    if (!menuOpen) return;

    function handleMouseDown(e: MouseEvent) {
      if (
        userMetaRef.current &&
        !userMetaRef.current.contains(e.target as Node)
      ) {
        setMenuOpen(false);
      }
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  const notifLabel =
    unreadNotifications > 0
      ? `${unreadNotifications} notification${unreadNotifications > 1 ? "s" : ""} non lue${unreadNotifications > 1 ? "s" : ""}`
      : "Notifications";

  return (
    <header className="nav-app">
      {/* Gauche : Logo + liens de navigation */}
      <div className="nav-app-left">
        <Link href="/dashboard" aria-label="BrightOff — retour au dashboard">
          <Logo variant="white" size={120} />
        </Link>
        <nav className="nav-links" aria-label="Navigation principale">
          {links.map((link) => (
            <Link
              key={link.id}
              href={link.href}
              className={`nav-link${activeLinkId === link.id ? " active" : ""}`}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>

      {/* Droite : cloche + avatar utilisateur */}
      <div className="nav-right">
        {/* Cloche notifications — clic sans action pour S3-03 (panel prévu sprint ultérieur) */}
        <button
          className="bell-btn"
          aria-label={notifLabel}
          type="button"
        >
          <BellIcon />
          {unreadNotifications > 0 && (
            <span className="bell-badge" aria-hidden>
              {unreadNotifications}
            </span>
          )}
        </button>

        {/* Avatar + dropdown utilisateur */}
        <div
          ref={userMetaRef}
          className="user-meta"
          onClick={() => setMenuOpen((prev) => !prev)}
          role="button"
          tabIndex={0}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setMenuOpen((prev) => !prev);
            }
          }}
        >
          <Avatar initials={userInitials} size="sm" />
          <span className="user-name">{userName}</span>

          {menuOpen && (
            <div className="user-menu">
              <button
                className="user-menu-item"
                type="button"
                onClick={(e) => {
                  // Stopper la propagation pour éviter le re-toggle du parent
                  e.stopPropagation();
                  setMenuOpen(false);
                  onLogout();
                }}
              >
                Se déconnecter
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
