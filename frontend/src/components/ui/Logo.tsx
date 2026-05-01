import React from "react";
import Image from "next/image";

export type LogoVariant = "standard" | "white";

export type LogoProps = {
  /**
   * standard : PNG optimisé via next/image (défaut — header de page, fond clair)
   * white    : SVG inline wordmark blanc (fond sombre, ex. NavApp sur fond bleu)
   */
  variant?: LogoVariant;
  /** Largeur d'affichage en px. Défaut : 140. Le height est calculé proportionnellement. */
  size?: number;
};

/**
 * Logo BrightOff.
 *
 * Mode standard — next/image :
 *   - src intrinsèque : 800×436 (ratio ≈ 1.835)
 *   - `preload` remplace `priority` (deprecated depuis Next.js 16)
 *   - `height: 'auto'` préserve le ratio d'aspect lors du redimensionnement CSS
 *
 * Mode white — SVG inline :
 *   - Wordmark "BrightOff" en blanc, font Inter, weight 800
 *   - Pas de fichier séparé — inline pour flexibilité de taille via prop `size`
 */
export function Logo({ variant = "standard", size = 140 }: LogoProps) {
  if (variant === "white") {
    // Le ratio viewBox est ajusté pour le texte "BrightOff" (environ 5:1 largeur/hauteur)
    const height = Math.round(size / 5);
    return (
      <svg
        width={size}
        height={height}
        viewBox="0 0 500 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="BrightOff"
        role="img"
      >
        <text
          x="0"
          y="78"
          fill="white"
          fontFamily="var(--font-sans), Inter, -apple-system, sans-serif"
          fontWeight="800"
          fontSize="90"
          letterSpacing="-2"
        >
          BrightOff
        </text>
      </svg>
    );
  }

  // Mode standard : PNG via next/image
  // Dimensions intrinsèques du fichier public/logo.png : 800×436
  // `preload` (Next.js 16+) remplace l'ancien `priority` (deprecated)
  // `style` contrôle la taille CSS rendue tout en préservant le ratio
  const intrinsicWidth = 800;
  const intrinsicHeight = 436;

  return (
    <Image
      src="/logo.png"
      alt="BrightOff"
      width={intrinsicWidth}
      height={intrinsicHeight}
      preload
      style={{
        width: `${size}px`,
        height: "auto",
      }}
    />
  );
}
