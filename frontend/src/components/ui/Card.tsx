import React from "react";

export type CardProps = {
  children: React.ReactNode;
  className?: string;
};

/**
 * Card BrightOff — wrapper autour de la classe .card de globals.css.
 * Accepte un className supplémentaire concaténé avec .card (ex: padding, margin).
 */
export function Card({ children, className }: CardProps) {
  const classes = ["card", className].filter(Boolean).join(" ");

  return (
    <div className={classes}>
      {children}
    </div>
  );
}
