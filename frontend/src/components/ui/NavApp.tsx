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

/** Icône hamburger (3 traits) */
function HamburgerIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}

/** Icône croix (fermeture drawer) */
function CloseIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

/**
 * NavApp — header de l'application connectée (dashboard, profile, etc.).
 *
 * Fond bleu ciel (--color-primary), texte blanc.
 * Desktop : Logo white | liens de navigation | cloche notif + avatar avec dropdown.
 * Mobile (< 640px) : Logo | Cloche | Burger → drawer pleine hauteur fond bleu ciel.
 *
 * Drawer mobile :
 * - Ouvert/fermé par state mobileMenuOpen
 * - Fermé sur Escape ou clic overlay
 * - Focus revient au bouton burger à la fermeture
 * - La cloche reste dans la barre principale (jamais dans le drawer)
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const userMetaRef = useRef<HTMLDivElement>(null);
  const burgerRef = useRef<HTMLButtonElement>(null);

  // Fermeture dropdown utilisateur au clic en dehors du composant
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

  // Fermeture drawer mobile sur Escape
  useEffect(() => {
    if (!mobileMenuOpen) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setMobileMenuOpen(false);
        burgerRef.current?.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [mobileMenuOpen]);

  // Bloquer le scroll du body quand le drawer est ouvert
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileMenuOpen]);

  const notifLabel =
    unreadNotifications > 0
      ? `${unreadNotifications} notification${unreadNotifications > 1 ? "s" : ""} non lue${unreadNotifications > 1 ? "s" : ""}`
      : "Notifications";

  function closeMobileMenu() {
    setMobileMenuOpen(false);
    burgerRef.current?.focus();
  }

  return (
    <>
      <header className="nav-app">
        {/* Gauche : Logo + liens de navigation (desktop) */}
        <div className="nav-app-left">
          <Link href="/dashboard" aria-label="BrightOff — retour au dashboard">
            <Logo variant="white" size={120} />
          </Link>
          {/* Liens masqués en mobile, visibles en tablette/desktop */}
          <nav className="nav-links hidden md:flex" aria-label="Navigation principale">
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

        {/* Droite : cloche + avatar (desktop) / cloche + burger (mobile) */}
        <div className="nav-right">
          {/* Cloche — toujours visible dans la barre, y compris en mobile */}
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

          {/* Avatar + dropdown utilisateur — visible en tablette/desktop uniquement */}
          <div
            ref={userMetaRef}
            className="user-meta hidden md:flex"
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

          {/* Bouton burger — visible uniquement en mobile */}
          <button
            ref={burgerRef}
            type="button"
            className="bell-btn block md:hidden"
            aria-expanded={mobileMenuOpen}
            aria-label="Menu de navigation"
            onClick={() => setMobileMenuOpen((o) => !o)}
          >
            {mobileMenuOpen ? <CloseIcon /> : <HamburgerIcon />}
          </button>
        </div>
      </header>

      {/* Overlay semi-transparent — ferme le drawer au clic */}
      {mobileMenuOpen && (
        <div
          className="nav-mobile-drawer-overlay"
          aria-hidden="true"
          onClick={closeMobileMenu}
        />
      )}

      {/* Drawer mobile — pleine hauteur, fond bleu ciel */}
      {mobileMenuOpen && (
        <div
          className="nav-mobile-drawer"
          role="dialog"
          aria-modal="true"
          aria-label="Menu de navigation"
        >
          {/* En-tête du drawer : logo + bouton fermer */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <Logo variant="white" size={100} />
            <button
              type="button"
              className="bell-btn"
              aria-label="Fermer le menu"
              onClick={closeMobileMenu}
            >
              <CloseIcon />
            </button>
          </div>

          {/* Liens de navigation */}
          <nav
            className="nav-mobile-drawer-links"
            aria-label="Navigation principale"
          >
            {links.map((link) => (
              <Link
                key={link.id}
                href={link.href}
                className={`nav-mobile-drawer-link${activeLinkId === link.id ? " active" : ""}`}
                onClick={closeMobileMenu}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Pied du drawer : info utilisateur + déconnexion */}
          <div className="nav-mobile-drawer-footer">
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
              <Avatar initials={userInitials} size="sm" />
              <span style={{ color: "white", fontWeight: 600, fontSize: 14 }}>{userName}</span>
            </div>
            <button
              type="button"
              className="nav-mobile-drawer-logout btn"
              onClick={() => {
                closeMobileMenu();
                onLogout();
              }}
            >
              Se déconnecter
            </button>
          </div>
        </div>
      )}
    </>
  );
}
