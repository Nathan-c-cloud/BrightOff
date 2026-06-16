"use client";

import React, { useRef, useState } from "react";
import type { DbSkillCategory, Skill } from "@/lib/api-profile";
import { categoryForSection, splitSkillsBySection } from "@/lib/profile-utils";

interface SkillsSectionProps {
  section: "hard" | "soft";
  skills: Skill[];
  onAdd: (name: string, category: DbSkillCategory) => Promise<void>;
  onRemove: (skillId: string) => Promise<void>;
  saving?: boolean;
}

const SECTION_LABELS: Record<"hard" | "soft", string> = {
  hard: "Hard skills",
  soft: "Soft skills",
};

/**
 * Section compétences réutilisable.
 * Paramétrable via `section` ("hard" | "soft") — filtre les skills en interne
 * via splitSkillsBySection. L'ajout utilise l'input inline (Enter valide,
 * Escape annule, blur valide si non-vide).
 *
 * Stratégie blur/mousedown pour éviter la race condition :
 * quand l'utilisateur clique sur le X d'un chip alors que l'input est actif,
 * l'ordre est mousedown (chip X) → blur (input) → click (chip X).
 * On utilise un flag ref `ignoreNextBlur` positionné au mousedown pour
 * que le blur ne valide pas dans ce cas.
 */
export function SkillsSection({
  section,
  skills,
  onAdd,
  onRemove,
  saving = false,
}: SkillsSectionProps) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const ignoreNextBlur = useRef(false);

  const { hard, soft } = splitSkillsBySection(skills);
  const visibleSkills = section === "hard" ? hard : soft;
  const label = SECTION_LABELS[section];

  async function commitDraft() {
    const trimmed = draft.trim();
    if (!trimmed) {
      setAdding(false);
      return;
    }
    setDraft("");
    setAdding(false);
    await onAdd(trimmed, categoryForSection(section));
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      commitDraft();
    } else if (e.key === "Escape") {
      setDraft("");
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
      <h3>{label}</h3>
      <div className="skill-edit">
        {visibleSkills.map((skill) => (
          <span key={skill.id} className="badge-removable">
            {skill.name}
            <button
              type="button"
              aria-label={`Retirer ${skill.name}`}
              disabled={saving}
              onMouseDown={() => {
                // Empêche le blur de l'input inline de valider avant ce click
                ignoreNextBlur.current = true;
              }}
              onClick={() => onRemove(skill.id)}
            >
              &times;
            </button>
          </span>
        ))}

        {adding ? (
          <input
            autoFocus
            className="input skill-input-inline"
            placeholder="Ajouter..."
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            disabled={saving}
          />
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
