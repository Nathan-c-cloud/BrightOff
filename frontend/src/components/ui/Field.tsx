import React from "react";

export type FieldProps = {
  label: string;
  htmlFor?: string;
  error?: string;
  helperText?: string;
  children: React.ReactNode;
};

/**
 * Field BrightOff — wrapper label.field de globals.css.
 * Regroupe un label, un input enfant, et des messages d'aide/d'erreur.
 * Le label et les messages d'erreur/aide utilisent les tokens CSS (text-error, text-text-secondary).
 */
export function Field({ label, htmlFor, error, helperText, children }: FieldProps) {
  return (
    <label className="field" htmlFor={htmlFor}>
      <span>{label}</span>
      {children}
      {error && (
        <span className="block text-sm mt-1 text-error" role="alert">
          {error}
        </span>
      )}
      {!error && helperText && (
        <span className="block text-sm mt-1 text-text-secondary">
          {helperText}
        </span>
      )}
    </label>
  );
}
