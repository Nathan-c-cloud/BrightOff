"use client";

import React from "react";
import type { Experience } from "@/lib/api-profile";
import { formatRange, formatDuration } from "@/lib/profile-utils";

interface ExperienceCardProps {
  experience: Experience;
  onEdit: () => void;
}

function ExperienceCard({ experience, onEdit }: ExperienceCardProps) {
  const range = formatRange(experience.start_date, experience.end_date);
  const duration = formatDuration(experience.start_date, experience.end_date);

  return (
    <div className="profile-card">
      <div className="profile-card-body">
        <p>
          <b>{experience.position}</b>
        </p>
        <p style={{ color: "var(--color-text-secondary)", marginTop: 2 }}>
          {experience.company} &middot; {range} &middot; {duration}
        </p>
      </div>
      <button
        type="button"
        className="profile-card-edit"
        aria-label={`Modifier l'experience ${experience.position}`}
        onClick={onEdit}
        title="Modifier"
      >
        &#9998;
      </button>
    </div>
  );
}

interface ExperienceSectionProps {
  experiences: Experience[];
  onEdit: (item: Experience) => void;
  onAdd: () => void;
}

/**
 * Section Experience — lecture seule + icone edit par carte.
 * Symetrique a EducationSection.
 */
export function ExperienceSection({
  experiences,
  onEdit,
  onAdd,
}: ExperienceSectionProps) {
  return (
    <div className="profile-section">
      <h3>Experience</h3>
      <div className="body">
        {experiences.length === 0 ? (
          <p style={{ color: "var(--color-text-secondary)" }}>
            Aucune experience ajoutee.
          </p>
        ) : (
          experiences.map((exp) => (
            <ExperienceCard
              key={exp.id}
              experience={exp}
              onEdit={() => onEdit(exp)}
            />
          ))
        )}
        <button
          type="button"
          className="badge-add"
          style={{ marginTop: 12 }}
          onClick={onAdd}
        >
          + Ajouter une experience
        </button>
      </div>
    </div>
  );
}
