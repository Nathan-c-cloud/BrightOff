"use client";

import React, { useState } from "react";
import type { ExperiencePayload } from "@/lib/api-profile";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Field } from "@/components/ui/Field";

export interface LocalExperience extends ExperiencePayload {
  _localId: string;
}

interface ProfileExperiencesSectionProps {
  value: LocalExperience[];
  onChange: (value: LocalExperience[]) => void;
}

function newLocalId() {
  return `local-${Math.random().toString(36).slice(2)}`;
}

function emptyExperience(): LocalExperience {
  return {
    _localId: newLocalId(),
    company: "",
    position: "",
    start_date: "",
    end_date: null,
    description: null,
  };
}

/**
 * Section Expériences du formulaire profil.
 * Chaque expérience est éditable inline. end_date null = poste actuel.
 */
export function ProfileExperiencesSection({
  value,
  onChange,
}: ProfileExperiencesSectionProps) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<LocalExperience>(emptyExperience);

  function update(
    localId: string,
    field: keyof ExperiencePayload,
    val: unknown
  ) {
    onChange(
      value.map((e) =>
        e._localId === localId ? { ...e, [field]: val } : e
      )
    );
  }

  function remove(localId: string) {
    onChange(value.filter((e) => e._localId !== localId));
  }

  function commitDraft() {
    if (!draft.company.trim() || !draft.position.trim() || !draft.start_date) {
      return;
    }
    onChange([
      ...value,
      {
        ...draft,
        company: draft.company.trim(),
        position: draft.position.trim(),
        description: draft.description?.trim() || null,
      },
    ]);
    setDraft(emptyExperience());
    setAdding(false);
  }

  return (
    <section aria-labelledby="experiences-section-title">
      <div className="flex items-center justify-between mb-4">
        <h2
          id="experiences-section-title"
          className="text-xl font-bold"
          style={{ color: "var(--color-text)" }}
        >
          Expériences
        </h2>
        {!adding && (
          <Button
            type="button"
            variant="sky-outline"
            onClick={() => setAdding(true)}
          >
            + Ajouter
          </Button>
        )}
      </div>

      {value.length === 0 && !adding && (
        <p style={{ color: "var(--color-text-secondary)" }} className="text-sm">
          Aucune expérience ajoutée.
        </p>
      )}

      <ul className="space-y-4 mb-4" aria-label="Liste des expériences">
        {value.map((exp) => (
          <li
            key={exp._localId}
            className="p-4 rounded-lg"
            style={{
              background: "var(--color-bg-card)",
              border: "1px solid var(--color-border)",
            }}
          >
            <div className="flex flex-wrap gap-3">
              <div style={{ flex: "1 1 200px" }}>
                <Field
                  label="Entreprise"
                  htmlFor={`exp-company-${exp._localId}`}
                >
                  <Input
                    id={`exp-company-${exp._localId}`}
                    value={exp.company}
                    onChange={(e) =>
                      update(exp._localId, "company", e.target.value)
                    }
                    placeholder="ex : Startup SAS"
                    maxLength={255}
                  />
                </Field>
              </div>
              <div style={{ flex: "1 1 200px" }}>
                <Field label="Poste" htmlFor={`exp-position-${exp._localId}`}>
                  <Input
                    id={`exp-position-${exp._localId}`}
                    value={exp.position}
                    onChange={(e) =>
                      update(exp._localId, "position", e.target.value)
                    }
                    placeholder="ex : Développeur Fullstack"
                    maxLength={255}
                  />
                </Field>
              </div>
              <div style={{ flex: "0 1 150px" }}>
                <Field
                  label="Date de début"
                  htmlFor={`exp-start-${exp._localId}`}
                >
                  <Input
                    id={`exp-start-${exp._localId}`}
                    type="date"
                    value={exp.start_date}
                    onChange={(e) =>
                      update(exp._localId, "start_date", e.target.value)
                    }
                  />
                </Field>
              </div>
              <div style={{ flex: "0 1 150px" }}>
                <Field
                  label="Date de fin"
                  htmlFor={`exp-end-${exp._localId}`}
                  helperText="Vide = poste actuel"
                >
                  <Input
                    id={`exp-end-${exp._localId}`}
                    type="date"
                    value={exp.end_date ?? ""}
                    onChange={(e) =>
                      update(
                        exp._localId,
                        "end_date",
                        e.target.value || null
                      )
                    }
                  />
                </Field>
              </div>
            </div>

            <Field
              label="Description"
              htmlFor={`exp-desc-${exp._localId}`}
              helperText="Optionnel"
            >
              <textarea
                id={`exp-desc-${exp._localId}`}
                className="input"
                rows={3}
                value={exp.description ?? ""}
                onChange={(e) =>
                  update(exp._localId, "description", e.target.value || null)
                }
                placeholder="Missions, technologies utilisées..."
                style={{ resize: "vertical" }}
              />
            </Field>

            <button
              type="button"
              aria-label={`Supprimer l'expérience chez ${exp.company}`}
              onClick={() => remove(exp._localId)}
              className="text-sm"
              style={{ color: "var(--color-error)" }}
            >
              Supprimer cette expérience
            </button>
          </li>
        ))}
      </ul>

      {adding && (
        <div
          className="p-4 rounded-lg"
          style={{
            background: "var(--color-bg-card)",
            border: "1.5px solid var(--color-primary)",
          }}
        >
          <p
            className="text-sm font-semibold mb-3"
            style={{ color: "var(--color-primary)" }}
          >
            Nouvelle expérience
          </p>
          <div className="flex flex-wrap gap-3">
            <div style={{ flex: "1 1 200px" }}>
              <Field label="Entreprise" htmlFor="exp-draft-company">
                <Input
                  id="exp-draft-company"
                  value={draft.company}
                  onChange={(e) =>
                    setDraft({ ...draft, company: e.target.value })
                  }
                  placeholder="ex : Startup SAS"
                  maxLength={255}
                  autoFocus
                />
              </Field>
            </div>
            <div style={{ flex: "1 1 200px" }}>
              <Field label="Poste" htmlFor="exp-draft-position">
                <Input
                  id="exp-draft-position"
                  value={draft.position}
                  onChange={(e) =>
                    setDraft({ ...draft, position: e.target.value })
                  }
                  placeholder="ex : Développeur Fullstack"
                  maxLength={255}
                />
              </Field>
            </div>
            <div style={{ flex: "0 1 150px" }}>
              <Field label="Date de début" htmlFor="exp-draft-start">
                <Input
                  id="exp-draft-start"
                  type="date"
                  value={draft.start_date}
                  onChange={(e) =>
                    setDraft({ ...draft, start_date: e.target.value })
                  }
                />
              </Field>
            </div>
            <div style={{ flex: "0 1 150px" }}>
              <Field
                label="Date de fin"
                htmlFor="exp-draft-end"
                helperText="Vide = poste actuel"
              >
                <Input
                  id="exp-draft-end"
                  type="date"
                  value={draft.end_date ?? ""}
                  onChange={(e) =>
                    setDraft({ ...draft, end_date: e.target.value || null })
                  }
                />
              </Field>
            </div>
          </div>
          <Field
            label="Description"
            htmlFor="exp-draft-desc"
            helperText="Optionnel"
          >
            <textarea
              id="exp-draft-desc"
              className="input"
              rows={3}
              value={draft.description ?? ""}
              onChange={(e) =>
                setDraft({ ...draft, description: e.target.value || null })
              }
              style={{ resize: "vertical" }}
            />
          </Field>
          <div className="flex gap-2 mt-2">
            <Button
              type="button"
              variant="coral"
              onClick={commitDraft}
              disabled={
                !draft.company.trim() ||
                !draft.position.trim() ||
                !draft.start_date
              }
            >
              Ajouter
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setDraft(emptyExperience());
                setAdding(false);
              }}
            >
              Annuler
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
