"use client";

/**
 * Page /profile — S3-15.
 *
 * Client Component : données utilisateur via useSession(), appels API via
 * les helpers api-profile.ts. Pas de SSR pour cette page.
 *
 * Workflow :
 *   1. Chargement → GET /profile/me → pré-remplissage des formulaires
 *   2. "Enregistrer" → PUT /profile/me → toast succès / erreurs in-context
 *
 * La protection de la route /profile est assurée par proxy.ts (déjà configuré).
 */

import React, { useCallback, useEffect, useState } from "react";
import { signOut, useSession } from "next-auth/react";
import { usePathname } from "next/navigation";

import { NavApp } from "@/components/ui/NavApp";
import { Toast } from "@/components/Toast";
import { Button } from "@/components/ui/Button";

import { ProfileIdentitySection } from "@/components/profile/ProfileIdentitySection";
import type { IdentityFormData } from "@/components/profile/ProfileIdentitySection";

import { ProfileSkillsSection } from "@/components/profile/ProfileSkillsSection";
import type { LocalSkill } from "@/components/profile/ProfileSkillsSection";

import { ProfileExperiencesSection } from "@/components/profile/ProfileExperiencesSection";
import type { LocalExperience } from "@/components/profile/ProfileExperiencesSection";

import { ProfileEducationsSection } from "@/components/profile/ProfileEducationsSection";
import type { LocalEducation } from "@/components/profile/ProfileEducationsSection";

import { ProfileLanguagesSection } from "@/components/profile/ProfileLanguagesSection";
import type { LocalLanguage } from "@/components/profile/ProfileLanguagesSection";

import {
  getMyProfile,
  updateMyProfile,
  ApiProfileError,
} from "@/lib/api-profile";
import type {
  ProfileData,
  ProfileUpdatePayload,
  ValidationIssue,
} from "@/lib/api-profile";

// ---------------------------------------------------------------------------
// Types locaux
// ---------------------------------------------------------------------------

type ToastState = {
  message: string;
  variant: "success" | "error";
} | null;

// Erreurs retournées par le backend (422) mappées par chemin de champ
type FieldErrors = Record<string, string>;

// ---------------------------------------------------------------------------
// Helpers de conversion API → formulaire
// ---------------------------------------------------------------------------

function toLocalId() {
  return `local-${Math.random().toString(36).slice(2)}`;
}

function profileToFormState(profile: ProfileData): {
  identity: IdentityFormData;
  skills: LocalSkill[];
  experiences: LocalExperience[];
  educations: LocalEducation[];
  languages: LocalLanguage[];
} {
  return {
    identity: {
      title: profile.title ?? "",
      summary: profile.summary ?? "",
      years_of_experience:
        profile.years_of_experience !== null
          ? String(profile.years_of_experience)
          : "",
    },
    skills: profile.skills.map((s) => ({ ...s, _localId: toLocalId() })),
    experiences: profile.experiences.map((e) => ({
      ...e,
      _localId: toLocalId(),
    })),
    educations: profile.educations.map((ed) => ({
      ...ed,
      _localId: toLocalId(),
    })),
    languages: profile.languages.map((l) => ({ ...l, _localId: toLocalId() })),
  };
}

/**
 * Parse les issues de validation FastAPI 422 en map de champ → message.
 * Ex: loc ["body", "skills", 0, "level"] → clé "skills[0].level"
 */
function parseValidationIssues(issues: ValidationIssue[]): FieldErrors {
  const errors: FieldErrors = {};
  for (const issue of issues) {
    // Ignorer "body" en tête de loc
    const path = issue.loc
      .filter((part) => part !== "body")
      .map((part, idx) =>
        typeof part === "number"
          ? `[${part}]`
          : idx === 0
          ? part
          : `.${part}`
      )
      .join("");
    errors[path] = issue.msg;
  }
  return errors;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ProfilePage() {
  const { data: session, status: sessionStatus } = useSession();
  const pathname = usePathname();

  const accessToken = session?.backendToken ?? null;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  // Form state
  const [identity, setIdentity] = useState<IdentityFormData>({
    title: "",
    summary: "",
    years_of_experience: "",
  });
  const [skills, setSkills] = useState<LocalSkill[]>([]);
  const [experiences, setExperiences] = useState<LocalExperience[]>([]);
  const [educations, setEducations] = useState<LocalEducation[]>([]);
  const [languages, setLanguages] = useState<LocalLanguage[]>([]);

  // Charger le profil au montage
  useEffect(() => {
    if (sessionStatus === "loading") return;
    if (!accessToken) return;

    let cancelled = false;

    async function load() {
      try {
        const profile = await getMyProfile(accessToken!);
        if (!cancelled) {
          const form = profileToFormState(profile);
          setIdentity(form.identity);
          setSkills(form.skills);
          setExperiences(form.experiences);
          setEducations(form.educations);
          setLanguages(form.languages);
        }
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiProfileError && err.status === 404) {
          // Pas encore de profil — page vide (l'user peut toujours retourner
          // uploader un CV) — ne pas bloquer l'affichage
          setLoading(false);
          return;
        }
        setToast({
          message: "Impossible de charger votre profil. Réessayez.",
          variant: "error",
        });
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [accessToken, sessionStatus]);

  // Validation côté client minimale
  function validateForm(): FieldErrors {
    const errors: FieldErrors = {};

    // Niveau skill 1-5
    skills.forEach((s, i) => {
      if (s.level !== null && (s.level < 1 || s.level > 5)) {
        errors[`skills[${i}].level`] = "Le niveau doit être entre 1 et 5.";
      }
      if (!s.name.trim()) {
        errors[`skills[${i}].name`] = "Le nom est requis.";
      }
    });

    experiences.forEach((e, i) => {
      if (!e.company.trim())
        errors[`experiences[${i}].company`] = "L'entreprise est requise.";
      if (!e.position.trim())
        errors[`experiences[${i}].position`] = "Le poste est requis.";
      if (!e.start_date)
        errors[`experiences[${i}].start_date`] = "La date de début est requise.";
    });

    educations.forEach((ed, i) => {
      if (!ed.school.trim())
        errors[`educations[${i}].school`] = "L'école est requise.";
      if (!ed.degree.trim())
        errors[`educations[${i}].degree`] = "Le diplôme est requis.";
      if (!ed.start_date)
        errors[`educations[${i}].start_date`] = "La date de début est requise.";
    });

    return errors;
  }

  const handleSave = useCallback(async () => {
    if (!accessToken) return;

    const clientErrors = validateForm();
    if (Object.keys(clientErrors).length > 0) {
      setFieldErrors(clientErrors);
      setToast({
        message: "Certains champs sont invalides. Vérifiez le formulaire.",
        variant: "error",
      });
      return;
    }

    setSaving(true);
    setFieldErrors({});

    const yearsRaw = identity.years_of_experience.trim();
    const years = yearsRaw === "" ? null : parseInt(yearsRaw, 10);

    const payload: ProfileUpdatePayload = {
      title: identity.title.trim() || null,
      summary: identity.summary.trim() || null,
      years_of_experience: isNaN(years!) ? null : years,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      skills: skills.map(({ _localId, ...s }) => s),
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      experiences: experiences.map(({ _localId, ...e }) => e),
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      educations: educations.map(({ _localId, ...ed }) => ed),
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      languages: languages.map(({ _localId, ...l }) => l),
    };

    try {
      const updated = await updateMyProfile(accessToken, payload);
      // Re-sync depuis la réponse pour récupérer les nouveaux IDs backend
      const form = profileToFormState(updated);
      setIdentity(form.identity);
      setSkills(form.skills);
      setExperiences(form.experiences);
      setEducations(form.educations);
      setLanguages(form.languages);

      setToast({ message: "Profil enregistré avec succès.", variant: "success" });
    } catch (err) {
      if (err instanceof ApiProfileError && err.status === 422 && err.issues) {
        const parsed = parseValidationIssues(err.issues);
        setFieldErrors(parsed);
        setToast({
          message: "Certains champs sont invalides. Vérifiez le formulaire.",
          variant: "error",
        });
      } else {
        setToast({
          message: "Une erreur est survenue lors de la sauvegarde. Réessayez.",
          variant: "error",
        });
      }
    } finally {
      setSaving(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, identity, skills, experiences, educations, languages]);

  // Navigation active
  const activeLinkId = pathname?.startsWith("/profile") ? "profile" : undefined;

  // Initiales pour la nav
  const rawName =
    session?.user?.name ?? session?.user?.email?.split("@")[0] ?? "Utilisateur";
  const userInitials = rawName.slice(0, 2).toUpperCase();

  // ---------------------------------------------------------------------------
  // Rendu
  // ---------------------------------------------------------------------------

  return (
    <>
      <NavApp
        userName={rawName}
        userInitials={userInitials}
        activeLinkId={activeLinkId}
        onLogout={() => signOut({ callbackUrl: "/" })}
      />

      <div className="page-wrap">
        <div className="mb-8">
          <h1
            className="text-3xl font-extrabold tracking-tight mb-2"
            style={{ color: "var(--color-text)" }}
          >
            Mon profil
          </h1>
          <p className="text-base" style={{ color: "var(--color-text-secondary)" }}>
            Vérifiez et modifiez les informations extraites de votre CV.
          </p>
        </div>

        {loading ? (
          <div
            className="flex items-center gap-3 text-sm"
            style={{ color: "var(--color-text-secondary)" }}
            role="status"
            aria-live="polite"
          >
            <span
              style={{
                display: "inline-block",
                width: 20,
                height: 20,
                border: "2px solid var(--color-border)",
                borderTopColor: "var(--color-primary)",
                borderRadius: "50%",
                animation: "spin 0.7s linear infinite",
              }}
              aria-hidden="true"
            />
            Chargement du profil...
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSave();
            }}
            noValidate
          >
            <div className="space-y-10">
              {/* Section Identité */}
              <div
                className="card p-6"
                style={{ border: "1px solid var(--color-border)" }}
              >
                <ProfileIdentitySection
                  value={identity}
                  onChange={setIdentity}
                  errors={{
                    title: fieldErrors["title"],
                    summary: fieldErrors["summary"],
                    years_of_experience: fieldErrors["years_of_experience"],
                  }}
                />
              </div>

              {/* Section Skills */}
              <div
                className="card p-6"
                style={{ border: "1px solid var(--color-border)" }}
              >
                <ProfileSkillsSection value={skills} onChange={setSkills} />
              </div>

              {/* Section Expériences */}
              <div
                className="card p-6"
                style={{ border: "1px solid var(--color-border)" }}
              >
                <ProfileExperiencesSection
                  value={experiences}
                  onChange={setExperiences}
                />
              </div>

              {/* Section Formations */}
              <div
                className="card p-6"
                style={{ border: "1px solid var(--color-border)" }}
              >
                <ProfileEducationsSection
                  value={educations}
                  onChange={setEducations}
                />
              </div>

              {/* Section Langues */}
              <div
                className="card p-6"
                style={{ border: "1px solid var(--color-border)" }}
              >
                <ProfileLanguagesSection
                  value={languages}
                  onChange={setLanguages}
                />
              </div>
            </div>

            {/* Barre d'actions fixe en bas */}
            <div
              className="flex justify-end mt-10 pt-6"
              style={{ borderTop: "1px solid var(--color-border)" }}
            >
              <Button
                type="submit"
                variant="coral"
                size="lg"
                disabled={saving}
                aria-disabled={saving}
              >
                {saving ? "Enregistrement..." : "Enregistrer"}
              </Button>
            </div>
          </form>
        )}
      </div>

      {/* Spinner CSS */}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>

      {/* Toast de notification */}
      {toast && (
        <Toast
          message={toast.message}
          variant={toast.variant}
          onClose={() => setToast(null)}
        />
      )}
    </>
  );
}
