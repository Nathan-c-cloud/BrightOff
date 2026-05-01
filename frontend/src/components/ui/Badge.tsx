import React from "react";

export type BadgeVariant = "skill" | "mint" | "coral-dark" | "peach-dark";

export type BadgeProps = {
  variant?: BadgeVariant;
  children: React.ReactNode;
};

/**
 * Badge BrightOff — wrappe les classes .badge + .badge-{variant} de globals.css.
 * Utilisé pour afficher des compétences, statuts de match, alertes.
 */
export function Badge({ variant = "skill", children }: BadgeProps) {
  return (
    <span className={`badge badge-${variant}`}>
      {children}
    </span>
  );
}
