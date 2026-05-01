import React from "react";

export type AvatarSize = "sm" | "md" | "lg";

export type AvatarProps = {
  /** Initiales affichées dans l'avatar, ex. "TM" pour Thomas Martin */
  initials: string;
  size?: AvatarSize;
};

/**
 * Avatar BrightOff — cercle dégradé pêche→corail avec initiales.
 * Utilise les classes .avatar-sm / .avatar / .avatar-lg définies dans globals.css,
 * dont le gradient s'appuie sur les tokens CSS (--color-accent-soft, --color-accent).
 */
export function Avatar({ initials, size = "md" }: AvatarProps) {
  const sizeClass = size === "sm" ? "avatar-sm" : size === "lg" ? "avatar-lg" : "avatar";

  return (
    <span className={sizeClass} aria-label={`Avatar ${initials}`} role="img">
      {initials}
    </span>
  );
}
