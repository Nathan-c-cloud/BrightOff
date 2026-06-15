"use client";

import React, { useState } from "react";
import type { LanguagePayload } from "@/lib/api-profile";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Field } from "@/components/ui/Field";

export interface LocalLanguage extends LanguagePayload {
  _localId: string;
}

interface ProfileLanguagesSectionProps {
  value: LocalLanguage[];
  onChange: (value: LocalLanguage[]) => void;
}

const LANGUAGE_LEVELS = [
  "A1",
  "A2",
  "B1",
  "B2",
  "C1",
  "C2",
  "Natif",
  "Bilingue",
] as const;

function newLocalId() {
  return `local-${Math.random().toString(36).slice(2)}`;
}

function emptyLanguage(): LocalLanguage {
  return { _localId: newLocalId(), name: "", level: "B2" };
}

/**
 * Section Langues du formulaire profil.
 * Chaque langue a un nom et un niveau CECRL ou Natif/Bilingue.
 */
export function ProfileLanguagesSection({
  value,
  onChange,
}: ProfileLanguagesSectionProps) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<LocalLanguage>(emptyLanguage);

  function update(localId: string, field: keyof LanguagePayload, val: string) {
    onChange(
      value.map((l) =>
        l._localId === localId ? { ...l, [field]: val } : l
      )
    );
  }

  function remove(localId: string) {
    onChange(value.filter((l) => l._localId !== localId));
  }

  function commitDraft() {
    if (!draft.name.trim()) return;
    onChange([...value, { ...draft, name: draft.name.trim() }]);
    setDraft(emptyLanguage());
    setAdding(false);
  }

  return (
    <section aria-labelledby="languages-section-title">
      <div className="flex items-center justify-between mb-4">
        <h2
          id="languages-section-title"
          className="text-xl font-bold"
          style={{ color: "var(--color-text)" }}
        >
          Langues
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
          Aucune langue ajoutée.
        </p>
      )}

      <ul className="space-y-3 mb-4" aria-label="Liste des langues">
        {value.map((lang) => (
          <li
            key={lang._localId}
            className="flex flex-wrap items-start gap-3 p-3 rounded-lg"
            style={{
              background: "var(--color-bg-card)",
              border: "1px solid var(--color-border)",
            }}
          >
            <div style={{ flex: "1 1 180px" }}>
              <Field label="Langue" htmlFor={`lang-name-${lang._localId}`}>
                <Input
                  id={`lang-name-${lang._localId}`}
                  value={lang.name}
                  onChange={(e) =>
                    update(lang._localId, "name", e.target.value)
                  }
                  placeholder="ex : Anglais"
                  maxLength={100}
                />
              </Field>
            </div>
            <div style={{ flex: "0 1 140px" }}>
              <Field label="Niveau" htmlFor={`lang-level-${lang._localId}`}>
                <select
                  id={`lang-level-${lang._localId}`}
                  className="input"
                  value={lang.level}
                  onChange={(e) =>
                    update(lang._localId, "level", e.target.value)
                  }
                >
                  {LANGUAGE_LEVELS.map((lv) => (
                    <option key={lv} value={lv}>
                      {lv}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <div className="flex items-end pb-1">
              <button
                type="button"
                aria-label={`Supprimer la langue ${lang.name}`}
                onClick={() => remove(lang._localId)}
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
            Nouvelle langue
          </p>
          <div className="flex flex-wrap gap-3">
            <div style={{ flex: "1 1 180px" }}>
              <Field label="Langue" htmlFor="lang-draft-name">
                <Input
                  id="lang-draft-name"
                  value={draft.name}
                  onChange={(e) =>
                    setDraft({ ...draft, name: e.target.value })
                  }
                  placeholder="ex : Anglais"
                  maxLength={100}
                  autoFocus
                />
              </Field>
            </div>
            <div style={{ flex: "0 1 140px" }}>
              <Field label="Niveau" htmlFor="lang-draft-level">
                <select
                  id="lang-draft-level"
                  className="input"
                  value={draft.level}
                  onChange={(e) =>
                    setDraft({ ...draft, level: e.target.value })
                  }
                >
                  {LANGUAGE_LEVELS.map((lv) => (
                    <option key={lv} value={lv}>
                      {lv}
                    </option>
                  ))}
                </select>
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
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setDraft(emptyLanguage());
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
