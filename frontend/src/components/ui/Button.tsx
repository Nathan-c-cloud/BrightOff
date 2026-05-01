import React from "react";

export type ButtonVariant = "coral" | "sky-outline" | "ghost";
export type ButtonSize = "md" | "lg";

export type ButtonProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: React.ReactNode;
} & React.ButtonHTMLAttributes<HTMLButtonElement>;

/**
 * Bouton BrightOff — wrappe les classes .btn + variants de globals.css.
 * Utilise les tokens CSS via les classes @layer components (jamais de valeurs hex).
 * Supporte forwardRef pour permettre aux composants parents d'accéder au nœud DOM.
 */
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  function Button({ variant = "coral", size = "md", children, className, ...rest }, ref) {
    const variantClass = {
      coral: "btn-coral",
      "sky-outline": "btn-sky-outline",
      ghost: "btn-ghost",
    }[variant];

    const sizeClass = size === "lg" ? "btn-lg" : "";

    const classes = ["btn", variantClass, sizeClass, className]
      .filter(Boolean)
      .join(" ");

    return (
      <button ref={ref} className={classes} {...rest}>
        {children}
      </button>
    );
  }
);
