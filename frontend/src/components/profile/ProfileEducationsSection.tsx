"use client";

import React, { useState } from "react";
import type { EducationPayload } from "@/lib/api-profile";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Field } from "@/components/ui/Field";

export interface LocalEducation extends EducationPayload {
  _localId: string;
}

interface ProfileEducationsSectionProps {
  value: LocalEducation[];
  onChange: (value: LocalEducation[]) => void;
}

function newLocalId() {
  return `local-${Math.random().toString(36).slice(2)}`;
}

function emptyEducation(): LocalEducation {
  return {
    _localId: newLocalId(),
    school: "",
    degree: "",
    field: null,
    start_date: "",
    end_date: null,
  };
}

/**
 * Section Formations du formulaire profil.
 * Chaque formation est éditable inline.
 */
export function ProfileEducationsSection({
  value,
  onChange,
}: ProfileEducationsSectionProps) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<LocalEducation>(emptyEducation);

  function update(
    localId: string,
    field: keyof EducationPayload,
    val: unknown
  ) {
    onChange(
      value.map((ed) =>
        ed._localId === localId ? { ...ed, [field]: val } : ed
      )
    );
  }

  function remove(localId: string) {
    onChange(value.filter((ed) => ed._localId !== localId));
  }

  function commitDraft() {
    if (!draft.school.trim() || !draft.degree.trim() || !draft.start_date) {
      return;
    }
    onChange([
      ...value,
      {
        ...draft,
        school: draft.school.trim(),
        degree: draft.degree.trim(),
        field: draft.field?.trim() || null,
      },
    ]);
    setDraft(emptyEducation());
    setAdding(false);
  }

  return (
    <section aria-labelledby="educations-section-title">
      <div className="flex items-center justify-between mb-4">
        <h2
          id="educations-section-title"
          className="text-xl font-bold"
          style={{ color: "var(--color-text)" }}
        >
          Formations
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
          Aucune formation ajoutée.
        </p>
      )}

      <ul className="space-y-4 mb-4" aria-label="Liste des formations">
        {value.map((ed) => (
          <li
            key={ed._localId}
            className="p-4 rounded-lg"
            style={{
              background: "var(--color-bg-card)",
              border: "1px solid var(--color-border)",
            }}
          >
            <div className="flex flex-wrap gap-3">
              <div style={{ flex: "1 1 200px" }}>
                <Field label="École" htmlFor={`ed-school-${ed._localId}`}>
                  <Input
                    id={`ed-school-${ed._localId}`}
                    value={ed.school}
                    onChange={(e) =>
                      update(ed._localId, "school", e.target.value)
                    }
                    maxLength={255}
                    placeholder="ex : EPITECH"
                  />
                </Field>
              </div>
              <div style={{ flex: "1 1 200px" }}>
                <Field label="Diplôme" htmlFor={`ed-degree-${ed._localId}`}>
                  <Input
                    id={`ed-degree-${ed._localId}`}
                    value={ed.degree}
                    onChange={(e) =>
                      update(ed._localId, "degree", e.target.value)
                    }
                    maxLength={255}
                    placeholder="ex : Bac+5 Expert IT"
                  />
                </Field>
              </div>
              <div style={{ flex: "1 1 160px" }}>
                <Field
                  label="Domaine"
                  htmlFor={`ed-field-${ed._localId}`}
                  helperText="Optionnel"
                >
                  <Input
                    id={`ed-field-${ed._localId}`}
                    value={ed.field ?? ""}
                    onChange={(e) =>
                      update(ed._localId, "field", e.target.value || null)
                    }
                    maxLength={255}
                    placeholder="ex : Informatique"
                  />
                </Field>
              </div>
              <div style={{ flex: "0 1 150px" }}>
                <Field
                  label="Date de début"
                  htmlFor={`ed-start-${ed._localId}`}
                >
                  <Input
                    id={`ed-start-${ed._localId}`}
                    type="date"
                    value={ed.start_date}
                    onChange={(e) =>
                      update(ed._localId, "start_date", e.target.value)
                    }
                  />
                </Field>
              </div>
              <div style={{ flex: "0 1 150px" }}>
                <Field
                  label="Date de fin"
                  htmlFor={`ed-end-${ed._localId}`}
                  helperText="Vide = en cours"
                >
                  <Input
                    id={`ed-end-${ed._localId}`}
                    type="date"
                    value={ed.end_date ?? ""}
                    onChange={(e) =>
                      update(ed._localId, "end_date", e.target.value || null)
                    }
                  />
                </Field>
              </div>
            </div>
            <button
              type="button"
              aria-label={`Supprimer la formation ${ed.school}`}
              onClick={() => remove(ed._localId)}
              className="text-sm mt-2"
              style={{ color: "var(--color-error)" }}
            >
              Supprimer cette formation
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
            Nouvelle formation
          </p>
          <div className="flex flex-wrap gap-3">
            <div style={{ flex: "1 1 200px" }}>
              <Field label="École" htmlFor="ed-draft-school">
                <Input
                  id="ed-draft-school"
                  value={draft.school}
                  onChange={(e) =>
                    setDraft({ ...draft, school: e.target.value })
                  }
                  placeholder="ex : EPITECH"
                  maxLength={255}
                  autoFocus
                />
              </Field>
            </div>
            <div style={{ flex: "1 1 200px" }}>
              <Field label="Diplôme" htmlFor="ed-draft-degree">
                <Input
                  id="ed-draft-degree"
                  value={draft.degree}
                  onChange={(e) =>
                    setDraft({ ...draft, degree: e.target.value })
                  }
                  placeholder="ex : Bac+5 Expert IT"
                  maxLength={255}
                />
              </Field>
            </div>
            <div style={{ flex: "1 1 160px" }}>
              <Field
                label="Domaine"
                htmlFor="ed-draft-field"
                helperText="Optionnel"
              >
                <Input
                  id="ed-draft-field"
                  value={draft.field ?? ""}
                  onChange={(e) =>
                    setDraft({ ...draft, field: e.target.value || null })
                  }
                  placeholder="ex : Informatique"
                  maxLength={255}
                />
              </Field>
            </div>
            <div style={{ flex: "0 1 150px" }}>
              <Field label="Date de début" htmlFor="ed-draft-start">
                <Input
                  id="ed-draft-start"
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
                htmlFor="ed-draft-end"
                helperText="Vide = en cours"
              >
                <Input
                  id="ed-draft-end"
                  type="date"
                  value={draft.end_date ?? ""}
                  onChange={(e) =>
                    setDraft({ ...draft, end_date: e.target.value || null })
                  }
                />
              </Field>
            </div>
          </div>
          <div className="flex gap-2 mt-2">
            <Button
              type="button"
              variant="coral"
              onClick={commitDraft}
              disabled={
                !draft.school.trim() ||
                !draft.degree.trim() ||
                !draft.start_date
              }
            >
              Ajouter
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setDraft(emptyEducation());
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
