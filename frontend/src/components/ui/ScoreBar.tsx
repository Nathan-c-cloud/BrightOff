import React from "react";

export type ScoreBarProps = {
  /** Score 0-100 */
  score: number;
  /** Label optionnel affiché au-dessus de la barre */
  label?: string;
  /** Affiche la valeur numérique du score à côté de la barre (ex: "78%") — default false */
  showValue?: boolean;
};

/**
 * ScoreBar — barre de progression avec dégradé de marque (bleu→corail).
 *
 * Le score est clampé entre 0 et 100 pour éviter tout affichage cassé
 * en cas de valeur invalide reçue depuis l'API.
 *
 * Classe CSS : .bar et .bar > i définies dans globals.css.
 * Le dégradé utilise var(--gradient-brand) ; le fond de piste var(--color-bar-track).
 */
export function ScoreBar({ score, label, showValue = false }: ScoreBarProps) {
  // Clamp entre 0 et 100 — défense contre les valeurs hors-plage
  const clamped = Math.min(100, Math.max(0, score));

  return (
    <div
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      {label && (
        <div
          style={{
            fontSize: "12px",
            color: "var(--color-text-secondary)",
            marginBottom: "6px",
          }}
        >
          {label}
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <div className="bar" style={{ flex: 1 }}>
          <i style={{ width: `${clamped}%` }} aria-hidden />
        </div>
        {showValue && (
          <span
            style={{
              fontSize: "13px",
              fontWeight: 600,
              color: "var(--color-text-secondary)",
              flexShrink: 0,
            }}
          >
            {clamped}%
          </span>
        )}
      </div>
    </div>
  );
}
