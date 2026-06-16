"use client";

import React, { useRef, useState } from "react";
import type { Language } from "@/lib/api-profile";

type LanguageLevel = "A1" | "A2" | "B1" | "B2" | "C1" | "C2" | "Bilingue" | "Natif";

const LANGUAGE_LEVELS: LanguageLevel[] = [
  "A1", "A2", "B1", "B2", "C1", "C2", "Bilingue", "Natif",
];

interface LanguagesSectionProps {
  languages: Language[];
  onAdd: (name: string, level: LanguageLevel) => Promise<void>;
  onRemove: (languageId: string) => Promise<void>;
  saving?: boolean;
}

/**
 * Section Langues avec chips removables et mini-formulaire inline.
 * Le mini-form affiche un input nom + select niveau côte à côte.
 * Enter ou blur sur le champ nom valide (si nom non vide).
 *
 * Séparé de SkillsSection car la langue a deux champs (nom + niveau)
 * alors que la compétence n'en a qu'un.
 */
export function LanguagesSection({
  languages,
  onAdd,
  onRemove,
  saving = false,
}: LanguagesSectionProps) {
  const [adding, setAdding] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [draftLevel, setDraftLevel] = useState<LanguageLevel>("B1");
  const ignoreNextBlur = useRef(false);

  async function commitDraft() {
    const trimmed = draftName.trim();
    if (!trimmed) {
      setAdding(false);
      setDraftName("");
      return;
    }
    setDraftName("");
    setDraftLevel("B1");
    setAdding(false);
    await onAdd(trimmed, draftLevel);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      commitDraft();
    } else if (e.key === "Escape") {
      setDraftName("");
      setAdding(false);
    }
  }

  function handleBlur() {
    if (ignoreNextBlur.current) {
      ignoreNextBlur.current = false;
      return;
    }
    commitDraft();
  }

  return (
    <div className="profile-section">
      <h3>Langues</h3>
      <div className="skill-edit">
        {languages.map((lang) => (
          <span key={lang.id} className="badge-removable">
            {lang.name} ({lang.level})
            <button
              type="button"
              aria-label={`Retirer ${lang.name}`}
              disabled={saving}
              onMouseDown={() => {
                ignoreNextBlur.current = true;
              }}
              onClick={() => onRemove(lang.id)}
            >
              &times;
            </button>
          </span>
        ))}

        {adding ? (
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <input
              autoFocus
              className="input"
              style={{ width: 140, padding: "6px 10px", fontSize: 13 }}
              placeholder="Langue..."
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={handleBlur}
              disabled={saving}
            />
            <select
              className="input"
              style={{ width: 110, padding: "6px 10px", fontSize: 13 }}
              value={draftLevel}
              onChange={(e) => setDraftLevel(e.target.value as LanguageLevel)}
              disabled={saving}
            >
              {LANGUAGE_LEVELS.map((lv) => (
                <option key={lv} value={lv}>{lv}</option>
              ))}
            </select>
          </div>
        ) : (
          <button
            type="button"
            className="badge-add"
            onClick={() => setAdding(true)}
            disabled={saving}
          >
            + Ajouter
          </button>
        )}
      </div>
    </div>
  );
}
