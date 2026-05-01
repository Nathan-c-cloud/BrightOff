import React from "react";

export type InputProps = {
  error?: boolean;
} & React.InputHTMLAttributes<HTMLInputElement>;

/**
 * Input BrightOff — wrappe la classe .input de globals.css.
 * La prop `error` ajoute la classe input-error (bordure + focus shadow rouge via globals.css).
 * Tous les props HTML natifs d'un <input> sont transmis (onChange, disabled, etc.).
 */
export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  function Input({ error, className, ...rest }, ref) {
    const classes = ["input", error ? "input-error" : "", className]
      .filter(Boolean)
      .join(" ");

    return (
      <input
        ref={ref}
        className={classes}
        aria-invalid={error ? true : undefined}
        {...rest}
      />
    );
  }
);
