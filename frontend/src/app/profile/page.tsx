"use client";

/**
 * Page /profile — S3-16.
 *
 * Refonte complete du layout : 2 colonnes (profile-grid), aside identite,
 * sections editables a droite avec chips optimistic update.
 *
 * Strategie mutations :
 * - Skills et langues : optimistic update local + PUT complet + rollback si erreur.
 * - Flag `mutating` pour serialiser les appels PUT et eviter les race conditions.
 * - Education et Experience : modale -> PUT -> re-sync depuis reponse API.
 *
 * Etat 404 : si GET /profile/me → 404, ecran dedie avec CTA vers /onboarding.
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { signOut, useSession } from "next-auth/react";
import { usePathname, useRouter } from "next/navigation";

import { NavApp } from "@/components/ui/NavApp";
import { Toast } from "@/components/Toast";
import { ProfileSide } from "@/components/profile/ProfileSide";
import { SkillsSection } from "@/components/profile/SkillsSection";
import { LanguagesSection } from "@/components/profile/LanguagesSection";
import { EducationSection } from "@/components/profile/EducationSection";
import { ExperienceSection } from "@/components/profile/ExperienceSection";
import { ProfileFormModal } from "@/components/profile/ProfileFormModal";

import {
  getMyProfile,
  updateMyProfile,
  ApiProfileError,
} from "@/lib/api-profile";
import type {
  ProfileData,
  Education,
  Experience,
  EducationPayload,
  ExperiencePayload,
  DbSkillCategory,
} from "@/lib/api-profile";
import {
  toUpdatePayload,
  toExperiencePayload,
  toEducationPayload,
} from "@/lib/profile-utils";

// ---------------------------------------------------------------------------
// Types locaux
// ---------------------------------------------------------------------------

type ToastState = {
  message: string;
  variant: "success" | "error";
} | null;

type ModalState =
  | { type: "education"; mode: "create" }
  | { type: "education"; mode: "edit"; item: Education }
  | { type: "experience"; mode: "create" }
  | { type: "experience"; mode: "edit"; item: Experience };

// ---------------------------------------------------------------------------
// Helper : extraire prenom/nom depuis session
// ---------------------------------------------------------------------------

function splitName(fullName: string | null | undefined): {
  firstName: string;
  lastName: string;
} {
  if (!fullName) return { firstName: "", lastName: "" };
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  const [first, ...rest] = parts;
  return { firstName: first, lastName: rest.join(" ") };
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ProfilePage() {
  const { data: session, status: sessionStatus } = useSession();
  const pathname = usePathname();
  const router = useRouter();

  const accessToken = session?.backendToken ?? null;

  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<ToastState>(null);
  const [modal, setModal] = useState<ModalState | null>(null);
  const [modalSaving, setModalSaving] = useState(false);

  // Serialise les mutations sur chips pour eviter les race conditions PUT/PUT
  const mutating = useRef(false);

  // ---------------------------------------------------------------------------
  // Chargement initial
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (sessionStatus === "loading") return;
    if (!accessToken) return;

    let cancelled = false;

    async function load() {
      try {
        const profile = await getMyProfile(accessToken!);
        if (!cancelled) {
          setProfileData(profile);
        }
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiProfileError && err.status === 404) {
          setNotFound(true);
          return;
        }
        setToast({
          message: "Impossible de charger votre profil. Reessayez.",
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

  // ---------------------------------------------------------------------------
  // Helper : PUT complet depuis un profileData donne
  // ---------------------------------------------------------------------------

  const putProfile = useCallback(
    async (data: ProfileData): Promise<ProfileData> => {
      if (!accessToken) throw new Error("No token");
      return updateMyProfile(accessToken, toUpdatePayload(data));
    },
    [accessToken]
  );

  // ---------------------------------------------------------------------------
  // Handlers skills (optimistic update + rollback)
  // ---------------------------------------------------------------------------

  const handleSkillAdd = useCallback(
    async (name: string, category: DbSkillCategory) => {
      if (!profileData || mutating.current) return;
      mutating.current = true;

      const tempId = `temp-${Date.now()}`;
      const optimistic: ProfileData = {
        ...profileData,
        skills: [
          ...profileData.skills,
          { id: tempId, name, category, level: null },
        ],
      };
      const previous = profileData;
      setProfileData(optimistic);

      try {
        const updated = await putProfile(optimistic);
        setProfileData(updated);
      } catch {
        setProfileData(previous);
        setToast({
          message: "Impossible de sauvegarder. Reessayez.",
          variant: "error",
        });
      } finally {
        mutating.current = false;
      }
    },
    [profileData, putProfile]
  );

  const handleSkillRemove = useCallback(
    async (skillId: string) => {
      if (!profileData || mutating.current) return;
      mutating.current = true;

      const optimistic: ProfileData = {
        ...profileData,
        skills: profileData.skills.filter((s) => s.id !== skillId),
      };
      const previous = profileData;
      setProfileData(optimistic);

      try {
        const updated = await putProfile(optimistic);
        setProfileData(updated);
      } catch {
        setProfileData(previous);
        setToast({
          message: "Impossible de sauvegarder. Reessayez.",
          variant: "error",
        });
      } finally {
        mutating.current = false;
      }
    },
    [profileData, putProfile]
  );

  // ---------------------------------------------------------------------------
  // Handlers langues (optimistic update + rollback)
  // ---------------------------------------------------------------------------

  const handleLanguageAdd = useCallback(
    async (name: string, level: string) => {
      if (!profileData || mutating.current) return;
      mutating.current = true;

      const tempId = `temp-${Date.now()}`;
      const optimistic: ProfileData = {
        ...profileData,
        languages: [...profileData.languages, { id: tempId, name, level }],
      };
      const previous = profileData;
      setProfileData(optimistic);

      try {
        const updated = await putProfile(optimistic);
        setProfileData(updated);
      } catch {
        setProfileData(previous);
        setToast({
          message: "Impossible de sauvegarder. Reessayez.",
          variant: "error",
        });
      } finally {
        mutating.current = false;
      }
    },
    [profileData, putProfile]
  );

  const handleLanguageRemove = useCallback(
    async (languageId: string) => {
      if (!profileData || mutating.current) return;
      mutating.current = true;

      const optimistic: ProfileData = {
        ...profileData,
        languages: profileData.languages.filter((l) => l.id !== languageId),
      };
      const previous = profileData;
      setProfileData(optimistic);

      try {
        const updated = await putProfile(optimistic);
        setProfileData(updated);
      } catch {
        setProfileData(previous);
        setToast({
          message: "Impossible de sauvegarder. Reessayez.",
          variant: "error",
        });
      } finally {
        mutating.current = false;
      }
    },
    [profileData, putProfile]
  );

  // ---------------------------------------------------------------------------
  // Handlers modale education
  // ---------------------------------------------------------------------------

  const handleEducationSave = useCallback(
    async (data: EducationPayload) => {
      if (!profileData || mutating.current) {
        setToast({ message: "Une operation est en cours, reessayez dans un instant.", variant: "error" });
        return;
      }
      mutating.current = true;
      setModalSaving(true);
      try {
        let nextEducations: EducationPayload[];
        if (modal?.type === "education" && modal.mode === "edit") {
          const editedId = (modal.item as Education).id;
          nextEducations = profileData.educations.map((ed) =>
            ed.id === editedId ? data : toEducationPayload(ed)
          );
        } else {
          nextEducations = [...profileData.educations.map(toEducationPayload), data];
        }
        const updated = await updateMyProfile(accessToken!, {
          ...toUpdatePayload(profileData),
          educations: nextEducations,
        });
        setProfileData(updated);
        setModal(null);
      } catch {
        setToast({
          message: "Impossible de sauvegarder. Reessayez.",
          variant: "error",
        });
      } finally {
        mutating.current = false;
        setModalSaving(false);
      }
    },
    [profileData, modal, accessToken]
  );

  const handleEducationDelete = useCallback(async () => {
    if (!profileData || modal?.type !== "education" || modal.mode !== "edit")
      return;
    if (mutating.current) {
      setToast({ message: "Une operation est en cours, reessayez dans un instant.", variant: "error" });
      return;
    }
    mutating.current = true;
    setModalSaving(true);
    try {
      const deletedId = (modal.item as Education).id;
      const updated = await updateMyProfile(accessToken!, {
        ...toUpdatePayload(profileData),
        educations: profileData.educations
          .filter((ed) => ed.id !== deletedId)
          .map(toEducationPayload),
      });
      setProfileData(updated);
      setModal(null);
    } catch {
      setToast({
        message: "Impossible de supprimer. Reessayez.",
        variant: "error",
      });
    } finally {
      mutating.current = false;
      setModalSaving(false);
    }
  }, [profileData, modal, accessToken]);

  // ---------------------------------------------------------------------------
  // Handlers modale experience
  // ---------------------------------------------------------------------------

  const handleExperienceSave = useCallback(
    async (data: ExperiencePayload) => {
      if (!profileData || mutating.current) {
        setToast({ message: "Une operation est en cours, reessayez dans un instant.", variant: "error" });
        return;
      }
      mutating.current = true;
      setModalSaving(true);
      try {
        let nextExperiences: ExperiencePayload[];
        if (modal?.type === "experience" && modal.mode === "edit") {
          const editedId = (modal.item as Experience).id;
          nextExperiences = profileData.experiences.map((exp) =>
            exp.id === editedId ? data : toExperiencePayload(exp)
          );
        } else {
          nextExperiences = [...profileData.experiences.map(toExperiencePayload), data];
        }
        const updated = await updateMyProfile(accessToken!, {
          ...toUpdatePayload(profileData),
          experiences: nextExperiences,
        });
        setProfileData(updated);
        setModal(null);
      } catch {
        setToast({
          message: "Impossible de sauvegarder. Reessayez.",
          variant: "error",
        });
      } finally {
        mutating.current = false;
        setModalSaving(false);
      }
    },
    [profileData, modal, accessToken]
  );

  const handleExperienceDelete = useCallback(async () => {
    if (!profileData || modal?.type !== "experience" || modal.mode !== "edit")
      return;
    if (mutating.current) {
      setToast({ message: "Une operation est en cours, reessayez dans un instant.", variant: "error" });
      return;
    }
    mutating.current = true;
    setModalSaving(true);
    try {
      const deletedId = (modal.item as Experience).id;
      const updated = await updateMyProfile(accessToken!, {
        ...toUpdatePayload(profileData),
        experiences: profileData.experiences
          .filter((exp) => exp.id !== deletedId)
          .map(toExperiencePayload),
      });
      setProfileData(updated);
      setModal(null);
    } catch {
      setToast({
        message: "Impossible de supprimer. Reessayez.",
        variant: "error",
      });
    } finally {
      mutating.current = false;
      setModalSaving(false);
    }
  }, [profileData, modal, accessToken]);

  // ---------------------------------------------------------------------------
  // Navigation
  // ---------------------------------------------------------------------------

  function handleReupload() {
    router.push("/onboarding");
  }

  const activeLinkId = pathname?.startsWith("/profile") ? "profile" : undefined;

  const rawName =
    session?.user?.name ?? session?.user?.email?.split("@")[0] ?? "Utilisateur";
  const userInitials = rawName.slice(0, 2).toUpperCase();
  const { firstName, lastName } = splitName(session?.user?.name);
  const email = session?.user?.email ?? "";

  // ---------------------------------------------------------------------------
  // Rendu : etat de chargement
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <>
        <NavApp
          userName={rawName}
          userInitials={userInitials}
          activeLinkId={activeLinkId}
          onLogout={() => signOut({ callbackUrl: "/" })}
        />
        <div className="page-wrap">
          <div
            role="status"
            aria-live="polite"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              color: "var(--color-text-secondary)",
            }}
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
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </>
    );
  }

  // ---------------------------------------------------------------------------
  // Rendu : etat 404 — pas de profil
  // ---------------------------------------------------------------------------

  if (notFound || !profileData) {
    return (
      <>
        <NavApp
          userName={rawName}
          userInitials={userInitials}
          activeLinkId={activeLinkId}
          onLogout={() => signOut({ callbackUrl: "/" })}
        />
        <div className="page-wrap">
          <div
            style={{
              textAlign: "center",
              padding: "60px 24px",
              background: "var(--color-bg-card)",
              borderRadius: 12,
              border: "1px solid var(--color-border)",
              boxShadow: "var(--shadow-card)",
            }}
          >
            <p
              style={{
                fontSize: 18,
                color: "var(--color-text)",
                marginBottom: 24,
              }}
            >
              Vous n&apos;avez pas encore de profil. Uploadez votre CV pour commencer.
            </p>
            <button
              type="button"
              className="btn btn-coral"
              onClick={handleReupload}
            >
              Uploader mon CV
            </button>
          </div>
        </div>
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

  // ---------------------------------------------------------------------------
  // Rendu principal
  // ---------------------------------------------------------------------------

  return (
    <>
      <NavApp
        userName={rawName}
        userInitials={userInitials}
        activeLinkId={activeLinkId}
        onLogout={() => signOut({ callbackUrl: "/" })}
      />

      <div className="page-wrap page-wrap--wide">
        <h1 className="profile-page-title">
          Mon Profil
        </h1>

        <div className="profile-grid">
          {/* Aside gauche */}
          <ProfileSide
            firstName={firstName}
            lastName={lastName}
            email={email}
            onReupload={handleReupload}
          />

          {/* Main droite */}
          <div className="profile-main">
            <ExperienceSection
              experiences={profileData.experiences}
              onEdit={(item) => setModal({ type: "experience", mode: "edit", item })}
              onAdd={() => setModal({ type: "experience", mode: "create" })}
            />
            <EducationSection
              educations={profileData.educations}
              onEdit={(item) => setModal({ type: "education", mode: "edit", item })}
              onAdd={() => setModal({ type: "education", mode: "create" })}
            />
            <LanguagesSection
              languages={profileData.languages}
              onAdd={handleLanguageAdd}
              onRemove={handleLanguageRemove}
            />
            <SkillsSection
              section="soft"
              skills={profileData.skills}
              onAdd={handleSkillAdd}
              onRemove={handleSkillRemove}
            />
            <SkillsSection
              section="hard"
              skills={profileData.skills}
              onAdd={handleSkillAdd}
              onRemove={handleSkillRemove}
            />

            {/* Bouton "Mettre a jour mon CV" en bas de main */}
            <div style={{ marginTop: 22 }}>
              <button
                type="button"
                className="btn btn-coral"
                onClick={handleReupload}
              >
                Mettre a jour mon CV
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modale education */}
      {modal?.type === "education" && (
        <ProfileFormModal
          type="education"
          mode={modal.mode}
          initialData={
            modal.mode === "edit"
              ? {
                  school: modal.item.school,
                  degree: modal.item.degree,
                  field: modal.item.field,
                  start_date: modal.item.start_date,
                  end_date: modal.item.end_date,
                }
              : undefined
          }
          onSave={handleEducationSave}
          onDelete={modal.mode === "edit" ? handleEducationDelete : undefined}
          onClose={() => setModal(null)}
          saving={modalSaving}
        />
      )}

      {/* Modale experience */}
      {modal?.type === "experience" && (
        <ProfileFormModal
          type="experience"
          mode={modal.mode}
          initialData={
            modal.mode === "edit"
              ? {
                  company: modal.item.company,
                  position: modal.item.position,
                  start_date: modal.item.start_date,
                  end_date: modal.item.end_date,
                  description: modal.item.description,
                }
              : undefined
          }
          onSave={handleExperienceSave}
          onDelete={modal.mode === "edit" ? handleExperienceDelete : undefined}
          onClose={() => setModal(null)}
          saving={modalSaving}
        />
      )}

      {toast && (
        <Toast
          message={toast.message}
          variant={toast.variant}
          onClose={() => setToast(null)}
        />
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </>
  );
}
