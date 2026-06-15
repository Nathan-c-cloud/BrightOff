"use client";

import React from "react";
import { Input } from "@/components/ui/Input";
import { Field } from "@/components/ui/Field";

export interface IdentityFormData {
  title: string;
  summary: string;
  years_of_experience: string; // string pour l'input HTML, converti à la soumission
}

export interface IdentityErrors {
  title?: string;
  summary?: string;
  years_of_experience?: string;
}

interface ProfileIdentitySectionProps {
  value: IdentityFormData;
  onChange: (value: IdentityFormData) => void;
  errors?: IdentityErrors;
}

/**
 * Section Identité du formulaire profil.
 * Contrôlé : reçoit value + onChange, émet les changements au parent.
 */
export function ProfileIdentitySection({
  value,
  onChange,
  errors = {},
}: ProfileIdentitySectionProps) {
  function handle(field: keyof IdentityFormData, newVal: string) {
    onChange({ ...value, [field]: newVal });
  }

  return (
    <section aria-labelledby="identity-section-title">
      <h2
        id="identity-section-title"
        className="text-xl font-bold mb-4"
        style={{ color: "var(--color-text)" }}
      >
        Identité
      </h2>

      <Field
        label="Poste recherché"
        htmlFor="profile-title"
        error={errors.title}
      >
        <Input
          id="profile-title"
          placeholder="ex : Développeur Fullstack React/Node"
          value={value.title}
          onChange={(e) => handle("title", e.target.value)}
          error={!!errors.title}
          maxLength={255}
        />
      </Field>

      <Field
        label="Résumé"
        htmlFor="profile-summary"
        error={errors.summary}
        helperText="Quelques phrases pour présenter votre profil."
      >
        <textarea
          id="profile-summary"
          className={[
            "input",
            errors.summary ? "input-error" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          placeholder="ex : Passionné par le cloud et les APIs REST..."
          rows={4}
          value={value.summary}
          onChange={(e) => handle("summary", e.target.value)}
          aria-invalid={errors.summary ? true : undefined}
          style={{ resize: "vertical" }}
        />
        {errors.summary && (
          <span className="block text-sm mt-1 text-error" role="alert">
            {errors.summary}
          </span>
        )}
      </Field>

      <Field
        label="Années d'expérience"
        htmlFor="profile-years"
        error={errors.years_of_experience}
      >
        <Input
          id="profile-years"
          type="number"
          min={0}
          max={70}
          placeholder="ex : 3"
          value={value.years_of_experience}
          onChange={(e) => handle("years_of_experience", e.target.value)}
          error={!!errors.years_of_experience}
          style={{ maxWidth: "120px" }}
        />
      </Field>
    </section>
  );
}
