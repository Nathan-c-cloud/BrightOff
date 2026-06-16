"use client";

import React from "react";
import type { Education } from "@/lib/api-profile";
import { formatRange, formatDuration } from "@/lib/profile-utils";

interface EducationCardProps {
  education: Education;
  onEdit: () => void;
}

function EducationCard({ education, onEdit }: EducationCardProps) {
  const range = formatRange(education.start_date, education.end_date);
  const duration = formatDuration(education.start_date, education.end_date);

  return (
    <div className="profile-card">
      <div className="profile-card-body">
        <p>
          <b>{education.degree}</b>
          {education.field && ` — ${education.field}`}
        </p>
        <p style={{ color: "var(--color-text-secondary)", marginTop: 2 }}>
          {education.school} &middot; {range} &middot; {duration}
        </p>
      </div>
      <button
        type="button"
        className="profile-card-edit"
        aria-label={`Modifier la formation ${education.degree}`}
        onClick={onEdit}
        title="Modifier"
      >
        &#9998;
      </button>
    </div>
  );
}

interface EducationSectionProps {
  educations: Education[];
  onEdit: (item: Education) => void;
  onAdd: () => void;
}

/**
 * Section Formation — lecture seule + icone edit par carte.
 * L'icone edit (par carte, pas sur le h3) ouvre la modale d'edition.
 * Le bouton "+ Ajouter une formation" en bas ouvre la modale en mode creation.
 */
export function EducationSection({
  educations,
  onEdit,
  onAdd,
}: EducationSectionProps) {
  return (
    <div className="profile-section">
      <h3>Formation</h3>
      <div className="body">
        {educations.length === 0 ? (
          <p style={{ color: "var(--color-text-secondary)" }}>
            Aucune formation ajoutée.
          </p>
        ) : (
          educations.map((ed) => (
            <EducationCard
              key={ed.id}
              education={ed}
              onEdit={() => onEdit(ed)}
            />
          ))
        )}
        <button
          type="button"
          className="badge-add"
          style={{ marginTop: 12 }}
          onClick={onAdd}
        >
          + Ajouter une formation
        </button>
      </div>
    </div>
  );
}
