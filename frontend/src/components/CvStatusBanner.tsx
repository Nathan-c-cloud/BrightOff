"use client";

/**
 * CvStatusBanner — bannière d'état CV affichée dans le dashboard.
 *
 * 4 états possibles :
 *   - no-cv    : invitation à importer un CV (état vide initial)
 *   - parsing  : spinner + message "On analyse ton CV..."
 *   - ready    : CTA "Voir mon profil" (lien vers /profile)
 *   - failed   : message d'erreur + lien "Réessayer" vers /onboarding
 *
 * Les états loading/timeout/error du hook sont traités silencieusement
 * (le parent décide de les afficher via toast ou non).
 *
 * Accessibilité :
 *   - Spinner avec role="status" + aria-label
 *   - Zones de contenu avec aria-live="polite" pour les mises à jour dynamiques
 */

import React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import type { LatestCvState } from "@/hooks/useLatestCvPolling";

export interface CvStatusBannerProps {
  state: LatestCvState;
}

/**
 * Bannière affichée en haut du dashboard selon le statut du dernier CV.
 *
 * @example
 * <CvStatusBanner state={cvState} />
 */
export function CvStatusBanner({ state }: CvStatusBannerProps) {
  const router = useRouter();

  // Chargement initial — on n'affiche rien pour éviter le flash
  if (state.phase === "loading") {
    return null;
  }

  // -------------------------------------------------------------------------
  // État : pas de CV
  // -------------------------------------------------------------------------

  if (state.phase === "no-cv") {
    return (
      <div
        className="card p-10 flex flex-col items-center text-center"
        style={{ maxWidth: 480 }}
        aria-live="polite"
      >
        <div className="text-5xl mb-5" aria-hidden="true">
          📄
        </div>
        <h2
          className="text-lg font-semibold mb-2"
          style={{ color: "var(--color-text)" }}
        >
          Votre profil n&apos;est pas encore configuré
        </h2>
        <p
          className="text-sm mb-6"
          style={{ color: "var(--color-text-secondary)" }}
        >
          Importez votre CV pour générer votre profil et recevoir vos premiers matchs.
        </p>
        <Button
          variant="coral"
          size="lg"
          onClick={() => router.push("/onboarding")}
        >
          Importer mon CV
        </Button>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // État : parsing en cours
  // -------------------------------------------------------------------------

  if (state.phase === "parsing") {
    return (
      <div
        className="card p-8 flex items-center gap-5"
        style={{
          maxWidth: 480,
          background: "var(--color-primary-light)",
          borderColor: "var(--color-primary)",
        }}
        aria-live="polite"
      >
        {/* Spinner accessible */}
        <div
          role="status"
          aria-label="Analyse du CV en cours"
          style={{
            width: "36px",
            height: "36px",
            border: "3px solid var(--color-border)",
            borderTopColor: "var(--color-primary)",
            borderRadius: "50%",
            animation: "spin 0.8s linear infinite",
            flexShrink: 0,
          }}
        />
        <div>
          <p
            className="font-semibold text-base mb-1"
            style={{ color: "var(--color-primary-text)" }}
          >
            On analyse ton CV...
          </p>
          <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
            Cette étape peut prendre quelques secondes.
          </p>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // État : prêt
  // -------------------------------------------------------------------------

  if (state.phase === "ready") {
    return (
      <div
        className="card p-8 flex items-center gap-5"
        style={{
          maxWidth: 480,
          background: "var(--color-success)",
          borderColor: "var(--color-success)",
        }}
        aria-live="polite"
      >
        <span className="text-3xl" aria-hidden="true">
          ✓
        </span>
        <div className="flex-1">
          <p
            className="font-semibold text-base mb-1"
            style={{ color: "var(--color-success-text)" }}
          >
            Ton profil est prêt !
          </p>
          <p className="text-sm mb-3" style={{ color: "var(--color-success-text)" }}>
            Ton CV a été analysé avec succès.
          </p>
          <Button
            variant="sky-outline"
            size="md"
            onClick={() => router.push("/profile")}
          >
            Voir mon profil
          </Button>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // État : échec
  // -------------------------------------------------------------------------

  if (state.phase === "failed") {
    return (
      <div
        className="card p-8 flex items-center gap-5"
        style={{
          maxWidth: 480,
          background: "var(--color-error-bg)",
          borderColor: "var(--color-error)",
        }}
        aria-live="polite"
      >
        <span className="text-3xl" aria-hidden="true">
          ✕
        </span>
        <div className="flex-1">
          <p
            className="font-semibold text-base mb-1"
            style={{ color: "var(--color-error)" }}
          >
            L&apos;analyse a échoué
          </p>
          <p className="text-sm mb-3" style={{ color: "var(--color-text-secondary)" }}>
            Vérifiez que votre CV est lisible et réessayez.
          </p>
          <Button
            variant="coral"
            size="md"
            onClick={() => router.push("/onboarding")}
          >
            Réessayer
          </Button>
        </div>
      </div>
    );
  }

  // Phases timeout/error — on n'affiche pas de bannière intrusive
  // (le parent gère ces cas via toast si nécessaire)
  return null;
}
