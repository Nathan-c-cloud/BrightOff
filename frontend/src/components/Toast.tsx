"use client";

/**
 * Composant Toast — notification temporaire positionnée en bas à droite.
 *
 * Toast minimal sans dépendance externe, utilisant les tokens CSS du design system.
 * Deux variantes : "success" (menthe) et "error" (corail).
 *
 * Le toast est cliquable dans son intégralité (role="button") pour les toasts
 * avec action de navigation.
 *
 * Accessibilité :
 *   - role="alert" + aria-live="polite" → annoncé par les lecteurs d'écran
 *   - Focusable au clavier via tabIndex={0}
 */

import React, { useEffect, useRef } from "react";

export type ToastVariant = "success" | "error";

export interface ToastProps {
  /** Texte affiché dans le toast. */
  message: string;
  /** Variante visuelle. "success" = menthe, "error" = corail. */
  variant: ToastVariant;
  /** Durée d'affichage en ms. 0 = affiché indéfiniment. Défaut : 5000 ms. */
  duration?: number;
  /** Appelé quand l'utilisateur clique sur le toast (navigation, retry...). */
  onClick?: () => void;
  /** Appelé quand le toast doit se fermer (timeout ou clic sur fermer). */
  onClose: () => void;
}

/**
 * Toast notification — s'affiche en bas à droite, disparaît après `duration` ms.
 *
 * @example
 * <Toast
 *   message="Ton profil est prêt !"
 *   variant="success"
 *   duration={5000}
 *   onClick={() => router.push("/profile")}
 *   onClose={() => setToast(null)}
 * />
 */
export function Toast({
  message,
  variant,
  duration = 5000,
  onClick,
  onClose,
}: ToastProps) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (duration <= 0) return;

    timerRef.current = setTimeout(() => {
      onClose();
    }, duration);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [duration, onClose]);

  const isSuccess = variant === "success";

  // Le positionnement (bottom/right/left) est géré par la classe .toast-container
  // dans globals.css pour permettre à la media query mobile de le surcharger
  // sans !important sur des styles inline.
  const containerStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "14px 16px",
    borderRadius: "var(--radius-card)",
    boxShadow: "var(--shadow-hover)",
    background: isSuccess ? "var(--color-success)" : "var(--color-error-bg)",
    border: `1.5px solid ${isSuccess ? "var(--color-success)" : "var(--color-error)"}`,
    color: isSuccess ? "var(--color-success-text)" : "var(--color-error)",
    fontSize: "14px",
    fontWeight: 600,
    cursor: onClick ? "pointer" : "default",
    userSelect: "none",
    animation: "toast-in 0.2s ease",
  };

  const closeStyle: React.CSSProperties = {
    marginLeft: "auto",
    background: "none",
    border: "none",
    cursor: "pointer",
    color: "inherit",
    fontSize: "16px",
    lineHeight: 1,
    padding: "2px 4px",
    opacity: 0.7,
    flexShrink: 0,
  };

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onClick?.();
    }
  }

  return (
    <>
      <style>{`
        @keyframes toast-in {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div
        role="alert"
        aria-live="polite"
        className="toast-container"
        style={containerStyle}
        onClick={onClick}
        onKeyDown={handleKeyDown}
        tabIndex={onClick ? 0 : undefined}
      >
        {/* Icône sémantique */}
        <span aria-hidden="true">{isSuccess ? "✓" : "✕"}</span>

        <span>{message}</span>

        {/* Bouton fermer */}
        <button
          style={closeStyle}
          aria-label="Fermer la notification"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
        >
          ×
        </button>
      </div>
    </>
  );
}
