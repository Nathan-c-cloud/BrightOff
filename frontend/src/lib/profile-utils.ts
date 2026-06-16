/**
 * Utilitaires front pour la page profil (S3-16).
 *
 * Ces helpers sont purs (aucune dépendance externe) et testables unitairement.
 */

import type {
  DbSkillCategory,
  Skill,
  Experience,
  Education,
  Language,
  SkillPayload,
  ExperiencePayload,
  EducationPayload,
  LanguagePayload,
  ProfileData,
  ProfileUpdatePayload,
} from "@/lib/api-profile";

// ---------------------------------------------------------------------------
// Helpers de formatage de dates
// ---------------------------------------------------------------------------

const MONTHS_FR = [
  "jan.",
  "fév.",
  "mars",
  "avr.",
  "mai",
  "juin",
  "juil.",
  "août",
  "sept.",
  "oct.",
  "nov.",
  "déc.",
];

function parseIsoDate(iso: string): Date {
  // "YYYY-MM-DD" → Date locale (évite les décalages de fuseau liés à new Date(iso))
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Formate une plage de dates en français.
 *
 * Ex : formatRange("2022-01-01", "2024-06-30") → "jan. 2022 — juin 2024"
 *      formatRange("2022-01-01", null)          → "jan. 2022 — en cours"
 */
export function formatRange(start: string, end: string | null): string {
  const startDate = parseIsoDate(start);
  const startStr = `${MONTHS_FR[startDate.getMonth()]} ${startDate.getFullYear()}`;

  if (!end) {
    return `${startStr} — en cours`;
  }

  const endDate = parseIsoDate(end);
  const endStr = `${MONTHS_FR[endDate.getMonth()]} ${endDate.getFullYear()}`;
  return `${startStr} — ${endStr}`;
}

/**
 * Calcule la durée entre deux dates en français, arrondie au mois.
 *
 * Ex : formatDuration("2022-01-01", "2024-06-30") → "2 ans 5 mois"
 *      formatDuration("2022-01-01", "2023-01-01") → "1 an"
 *      formatDuration("2022-01-01", "2022-08-01") → "7 mois"
 *      formatDuration("2022-01-01", null)          → "en cours"
 */
export function formatDuration(start: string, end: string | null): string {
  if (!end) return "en cours";

  const startDate = parseIsoDate(start);
  const endDate = parseIsoDate(end);

  let months =
    (endDate.getFullYear() - startDate.getFullYear()) * 12 +
    (endDate.getMonth() - startDate.getMonth());

  // Ajustement si le jour de fin est avant le jour de début dans le mois
  if (endDate.getDate() < startDate.getDate()) {
    months -= 1;
  }

  if (months <= 0) return "moins d'un mois";

  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;

  const yearStr =
    years > 0 ? `${years} ${years === 1 ? "an" : "ans"}` : "";
  const monthStr =
    remainingMonths > 0 ? `${remainingMonths} mois` : "";

  return [yearStr, monthStr].filter(Boolean).join(" ");
}

// ---------------------------------------------------------------------------
// Helper avatar
// ---------------------------------------------------------------------------

/**
 * Calcule les initiales (2 caractères majuscules) depuis prénom + nom.
 *
 * Règle : prend la première lettre du prénom et la première lettre du nom.
 * Si l'un est vide, prend les 2 premiers caractères du champ disponible.
 * Si les deux sont vides mais qu'un email est fourni, prend sa première lettre.
 * Sinon retourne "?".
 */
export function computeInitials(
  firstName: string,
  lastName: string,
  email?: string,
): string {
  const first = (firstName || "").trim();
  const last = (lastName || "").trim();

  if (first && last) {
    return `${first[0]}${last[0]}`.toUpperCase();
  }
  if (first) {
    return first.slice(0, 2).toUpperCase();
  }
  if (last) {
    return last.slice(0, 2).toUpperCase();
  }
  if (email) {
    const cleanedEmail = email.trim();
    if (cleanedEmail.length > 0) {
      return cleanedEmail[0].toUpperCase();
    }
  }
  return "?";
}

// ---------------------------------------------------------------------------
// Helper mapping DB → UI pour les compétences
// ---------------------------------------------------------------------------

/**
 * Sépare les skills en deux buckets UI selon la catégorie DB.
 *
 * Mapping :
 *   hard = "technique" + "outil"  (hard skills / compétences techniques)
 *   soft = "soft_skill"           (soft skills)
 *
 * Ce mapping est la conséquence de QO-1 (Nathan, 2026-06-16) : le Literal
 * backend utilise les valeurs françaises du CV parser. L'option "outil" n'est
 * pas exposée en ajout UI — les skills ajoutées manuellement reçoivent
 * toujours "technique". Les skills "outil" issues du parsing restent dans
 * le bucket hard.
 */
export function splitSkillsBySection(skills: Skill[]): {
  hard: Skill[];
  soft: Skill[];
} {
  return {
    hard: skills.filter(
      (s) => s.category === "technique" || s.category === "outil"
    ),
    soft: skills.filter((s) => s.category === "soft_skill"),
  };
}

/**
 * Catégorie DB assignée lors de l'ajout manuel depuis un bucket UI.
 *
 * Hard skills → "technique" (l'option "outil" n'est pas exposée en MVP).
 * Soft skills → "soft_skill".
 */
export function categoryForSection(
  section: "hard" | "soft"
): DbSkillCategory {
  return section === "hard" ? "technique" : "soft_skill";
}

// ---------------------------------------------------------------------------
// Helpers de conversion ProfileData → payload PUT (suppression des ids)
// ---------------------------------------------------------------------------

/** Convertit un Skill (avec id) en SkillPayload (sans id). */
export function toSkillPayload(s: Skill): SkillPayload {
  return { name: s.name, category: s.category, level: s.level };
}

/** Convertit une Experience (avec id) en ExperiencePayload (sans id). */
export function toExperiencePayload(e: Experience): ExperiencePayload {
  return {
    company: e.company,
    position: e.position,
    start_date: e.start_date,
    end_date: e.end_date,
    description: e.description,
  };
}

/** Convertit une Education (avec id) en EducationPayload (sans id). */
export function toEducationPayload(ed: Education): EducationPayload {
  return {
    school: ed.school,
    degree: ed.degree,
    field: ed.field,
    start_date: ed.start_date,
    end_date: ed.end_date,
  };
}

/** Convertit une Language (avec id) en LanguagePayload (sans id). */
export function toLanguagePayload(l: Language): LanguagePayload {
  return { name: l.name, level: l.level };
}

/**
 * Convertit un ProfileData complet en ProfileUpdatePayload pour le PUT.
 * Centralise la suppression des `id` pour éviter les destructurings répétés.
 */
export function toUpdatePayload(data: ProfileData): ProfileUpdatePayload {
  return {
    title: data.title,
    summary: data.summary,
    skills: data.skills.map(toSkillPayload),
    experiences: data.experiences.map(toExperiencePayload),
    educations: data.educations.map(toEducationPayload),
    languages: data.languages.map(toLanguagePayload),
  };
}
