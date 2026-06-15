"use client";

import React, { useState } from "react";
import type { SkillCategory, SkillPayload } from "@/lib/api-profile";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Field } from "@/components/ui/Field";

// Skill avec un id local temporaire pour l'édition (les IDs backend arrivent après PUT)
export interface LocalSkill extends SkillPayload {
  _localId: string;
}

interface ProfileSkillsSectionProps {
  value: LocalSkill[];
  onChange: (value: LocalSkill[]) => void;
}

const CATEGORIES: { value: SkillCategory; label: string }[] = [
  { value: "tech", label: "Technique" },
  { value: "soft", label: "Soft skill" },
  { value: "tool", label: "Outil" },
  { value: "language", label: "Langage" },
  { value: "other", label: "Autre" },
];

function newLocalId() {
  return `local-${Math.random().toString(36).slice(2)}`;
}

function emptySkill(): LocalSkill {
  return { _localId: newLocalId(), name: "", category: "tech", level: null };
}

/**
 * Section Skills du formulaire profil.
 * Supporte ajout, suppression et édition inline de chaque compétence.
 */
export function ProfileSkillsSection({
  value,
  onChange,
}: ProfileSkillsSectionProps) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<LocalSkill>(emptySkill);

  function update(localId: string, field: keyof SkillPayload, val: unknown) {
    onChange(
      value.map((s) =>
        s._localId === localId ? { ...s, [field]: val } : s
      )
    );
  }

  function remove(localId: string) {
    onChange(value.filter((s) => s._localId !== localId));
  }

  function commitDraft() {
    if (!draft.name.trim()) return;
    onChange([...value, { ...draft, name: draft.name.trim() }]);
    setDraft(emptySkill());
    setAdding(false);
  }

  function cancelDraft() {
    setDraft(emptySkill());
    setAdding(false);
  }

  return (
    <section aria-labelledby="skills-section-title">
      <div className="flex items-center justify-between mb-4">
        <h2
          id="skills-section-title"
          className="text-xl font-bold"
          style={{ color: "var(--color-text)" }}
        >
          Compétences
        </h2>
        {!adding && (
          <Button
            type="button"
            variant="sky-outline"
            size="md"
            onClick={() => setAdding(true)}
          >
            + Ajouter
          </Button>
        )}
      </div>

      {/* Liste des skills existantes */}
      {value.length === 0 && !adding && (
        <p style={{ color: "var(--color-text-secondary)" }} className="text-sm">
          Aucune compétence ajoutée.
        </p>
      )}

      <ul className="space-y-3 mb-4" aria-label="Liste des compétences">
        {value.map((skill) => (
          <li
            key={skill._localId}
            className="flex flex-wrap items-start gap-3 p-3 rounded-lg"
            style={{
              background: "var(--color-primary-light)",
              border: "1px solid var(--color-border)",
            }}
          >
            {/* Nom */}
            <div style={{ flex: "1 1 160px" }}>
              <Field label="Nom" htmlFor={`skill-name-${skill._localId}`}>
                <Input
                  id={`skill-name-${skill._localId}`}
                  value={skill.name}
                  onChange={(e) =>
                    update(skill._localId, "name", e.target.value)
                  }
                  placeholder="ex : React"
                  maxLength={100}
                />
              </Field>
            </div>

            {/* Catégorie */}
            <div style={{ flex: "1 1 140px" }}>
              <Field
                label="Catégorie"
                htmlFor={`skill-category-${skill._localId}`}
              >
                <select
                  id={`skill-category-${skill._localId}`}
                  className="input"
                  value={skill.category}
                  onChange={(e) =>
                    update(
                      skill._localId,
                      "category",
                      e.target.value as SkillCategory
                    )
                  }
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            {/* Niveau 1-5 */}
            <div style={{ flex: "0 1 100px" }}>
              <Field
                label="Niveau (1-5)"
                htmlFor={`skill-level-${skill._localId}`}
                helperText="Optionnel"
              >
                <Input
                  id={`skill-level-${skill._localId}`}
                  type="number"
                  min={1}
                  max={5}
                  value={skill.level ?? ""}
                  onChange={(e) =>
                    update(
                      skill._localId,
                      "level",
                      e.target.value === "" ? null : Number(e.target.value)
                    )
                  }
                />
              </Field>
            </div>

            {/* Bouton supprimer */}
            <div className="flex items-end pb-1">
              <button
                type="button"
                aria-label={`Supprimer la compétence ${skill.name}`}
                onClick={() => remove(skill._localId)}
                style={{
                  color: "var(--color-error)",
                  padding: "8px",
                  borderRadius: "4px",
                }}
              >
                ✕
              </button>
            </div>
          </li>
        ))}
      </ul>

      {/* Formulaire d'ajout */}
      {adding && (
        <div
          className="p-4 rounded-lg"
          style={{
            background: "var(--color-bg-card)",
            border: "1.5px solid var(--color-primary)",
          }}
        >
          <p className="text-sm font-semibold mb-3" style={{ color: "var(--color-primary)" }}>
            Nouvelle compétence
          </p>
          <div className="flex flex-wrap gap-3">
            <div style={{ flex: "1 1 160px" }}>
              <Field label="Nom" htmlFor="skill-draft-name">
                <Input
                  id="skill-draft-name"
                  value={draft.name}
                  onChange={(e) =>
                    setDraft({ ...draft, name: e.target.value })
                  }
                  placeholder="ex : React"
                  maxLength={100}
                  autoFocus
                />
              </Field>
            </div>
            <div style={{ flex: "1 1 140px" }}>
              <Field label="Catégorie" htmlFor="skill-draft-category">
                <select
                  id="skill-draft-category"
                  className="input"
                  value={draft.category}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      category: e.target.value as SkillCategory,
                    })
                  }
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <div style={{ flex: "0 1 100px" }}>
              <Field label="Niveau (1-5)" htmlFor="skill-draft-level" helperText="Optionnel">
                <Input
                  id="skill-draft-level"
                  type="number"
                  min={1}
                  max={5}
                  value={draft.level ?? ""}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      level:
                        e.target.value === "" ? null : Number(e.target.value),
                    })
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
              disabled={!draft.name.trim()}
            >
              Ajouter
            </Button>
            <Button type="button" variant="ghost" onClick={cancelDraft}>
              Annuler
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
