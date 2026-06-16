"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { EducationPayload, ExperiencePayload } from "@/lib/api-profile";

// ---------------------------------------------------------------------------
// Types discrimines
// ---------------------------------------------------------------------------

interface ModalEducation {
  type: "education";
  mode: "create" | "edit";
  initialData?: Partial<EducationPayload>;
  onSave: (data: EducationPayload) => Promise<void>;
  onDelete?: () => Promise<void>;
  onClose: () => void;
  saving?: boolean;
}

interface ModalExperience {
  type: "experience";
  mode: "create" | "edit";
  initialData?: Partial<ExperiencePayload>;
  onSave: (data: ExperiencePayload) => Promise<void>;
  onDelete?: () => Promise<void>;
  onClose: () => void;
  saving?: boolean;
}

type ProfileFormModalProps = ModalEducation | ModalExperience;

// ---------------------------------------------------------------------------
// Helper : selectionner tous les elements focusables dans un conteneur
// ---------------------------------------------------------------------------

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )
  ).filter((el) => !el.closest("[hidden]"));
}

// ---------------------------------------------------------------------------
// Formulaire Education
// ---------------------------------------------------------------------------

interface EducationFormProps {
  initialData?: Partial<EducationPayload>;
  saving: boolean;
  onSave: (data: EducationPayload) => Promise<void>;
  onDelete?: () => Promise<void>;
  onClose: () => void;
}

function EducationForm({
  initialData,
  saving,
  onSave,
  onDelete,
  onClose,
}: EducationFormProps) {
  const [school, setSchool] = useState(initialData?.school ?? "");
  const [degree, setDegree] = useState(initialData?.degree ?? "");
  const [field, setField] = useState(initialData?.field ?? "");
  const [startDate, setStartDate] = useState(initialData?.start_date ?? "");
  const [endDate, setEndDate] = useState(initialData?.end_date ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!school.trim()) errs.school = "L'ecole est requise.";
    if (!degree.trim()) errs.degree = "Le diplome est requis.";
    if (!startDate) errs.startDate = "La date de debut est requise.";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    await onSave({
      school: school.trim(),
      degree: degree.trim(),
      field: field.trim() || null,
      start_date: startDate,
      end_date: endDate || null,
    });
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <label className="field">
          <span>Ecole *</span>
          <input
            className={`input${errors.school ? " input-error" : ""}`}
            value={school}
            onChange={(e) => setSchool(e.target.value)}
            placeholder="ex : EPITECH"
            maxLength={255}
            autoFocus
          />
          {errors.school && (
            <span style={{ color: "var(--color-error)", fontSize: 12 }}>{errors.school}</span>
          )}
        </label>
        <label className="field">
          <span>Diplome *</span>
          <input
            className={`input${errors.degree ? " input-error" : ""}`}
            value={degree}
            onChange={(e) => setDegree(e.target.value)}
            placeholder="ex : Master Ingenierie Informatique"
            maxLength={255}
          />
          {errors.degree && (
            <span style={{ color: "var(--color-error)", fontSize: 12 }}>{errors.degree}</span>
          )}
        </label>
        <label className="field">
          <span>Domaine <span style={{ fontWeight: 400, color: "var(--color-text-secondary)" }}>(optionnel)</span></span>
          <input
            className="input"
            value={field}
            onChange={(e) => setField(e.target.value)}
            placeholder="ex : Informatique"
            maxLength={255}
          />
        </label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <label className="field">
            <span>Date de debut *</span>
            <input
              className={`input${errors.startDate ? " input-error" : ""}`}
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
            {errors.startDate && (
              <span style={{ color: "var(--color-error)", fontSize: 12 }}>{errors.startDate}</span>
            )}
          </label>
          <label className="field">
            <span>Date de fin <span style={{ fontWeight: 400, color: "var(--color-text-secondary)" }}>(vide = en cours)</span></span>
            <input
              className="input"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </label>
        </div>
      </div>
      <div className="modal-actions">
        <button type="submit" className="btn btn-coral" disabled={saving}>
          {saving ? "Enregistrement..." : "Enregistrer"}
        </button>
        <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>
          Annuler
        </button>
        {onDelete && (
          <button type="button" className="btn-delete" onClick={onDelete} disabled={saving}>
            Supprimer
          </button>
        )}
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Formulaire Experience
// ---------------------------------------------------------------------------

interface ExperienceFormProps {
  initialData?: Partial<ExperiencePayload>;
  saving: boolean;
  onSave: (data: ExperiencePayload) => Promise<void>;
  onDelete?: () => Promise<void>;
  onClose: () => void;
}

function ExperienceForm({
  initialData,
  saving,
  onSave,
  onDelete,
  onClose,
}: ExperienceFormProps) {
  const [company, setCompany] = useState(initialData?.company ?? "");
  const [position, setPosition] = useState(initialData?.position ?? "");
  const [startDate, setStartDate] = useState(initialData?.start_date ?? "");
  const [endDate, setEndDate] = useState(initialData?.end_date ?? "");
  const [description, setDescription] = useState(initialData?.description ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!company.trim()) errs.company = "L'entreprise est requise.";
    if (!position.trim()) errs.position = "Le poste est requis.";
    if (!startDate) errs.startDate = "La date de debut est requise.";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    await onSave({
      company: company.trim(),
      position: position.trim(),
      start_date: startDate,
      end_date: endDate || null,
      description: description.trim() || null,
    });
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <label className="field">
          <span>Entreprise *</span>
          <input
            className={`input${errors.company ? " input-error" : ""}`}
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            placeholder="ex : Startup SAS"
            maxLength={255}
            autoFocus
          />
          {errors.company && (
            <span style={{ color: "var(--color-error)", fontSize: 12 }}>{errors.company}</span>
          )}
        </label>
        <label className="field">
          <span>Poste *</span>
          <input
            className={`input${errors.position ? " input-error" : ""}`}
            value={position}
            onChange={(e) => setPosition(e.target.value)}
            placeholder="ex : Developpeur Fullstack"
            maxLength={255}
          />
          {errors.position && (
            <span style={{ color: "var(--color-error)", fontSize: 12 }}>{errors.position}</span>
          )}
        </label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <label className="field">
            <span>Date de debut *</span>
            <input
              className={`input${errors.startDate ? " input-error" : ""}`}
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
            {errors.startDate && (
              <span style={{ color: "var(--color-error)", fontSize: 12 }}>{errors.startDate}</span>
            )}
          </label>
          <label className="field">
            <span>Date de fin <span style={{ fontWeight: 400, color: "var(--color-text-secondary)" }}>(vide = en cours)</span></span>
            <input
              className="input"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </label>
        </div>
        <label className="field">
          <span>Description <span style={{ fontWeight: 400, color: "var(--color-text-secondary)" }}>(optionnel)</span></span>
          <textarea
            className="input"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Missions, technologies..."
            style={{ resize: "vertical" }}
          />
        </label>
      </div>
      <div className="modal-actions">
        <button type="submit" className="btn btn-coral" disabled={saving}>
          {saving ? "Enregistrement..." : "Enregistrer"}
        </button>
        <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>
          Annuler
        </button>
        {onDelete && (
          <button type="button" className="btn-delete" onClick={onDelete} disabled={saving}>
            Supprimer
          </button>
        )}
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Modale generique avec portail, focus trap et Escape
// ---------------------------------------------------------------------------

/**
 * Modale generique pour la creation/edition d'une formation ou d'une experience.
 * Montee via createPortal dans document.body pour eviter les problemes de z-index.
 *
 * Accessibilite :
 * - role="dialog" + aria-modal="true" + aria-labelledby
 * - Focus trap : Tab / Shift+Tab circule uniquement dans la modale
 * - Escape : ferme la modale
 * - Focus restaure sur l'element actif avant l'ouverture
 */
export function ProfileFormModal(props: ProfileFormModalProps) {
  const { type, mode, onClose, saving = false } = props;
  const modalRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<Element | null>(null);
  const titleId = "profile-modal-title";

  // Stocker l'element actif avant montage pour le restaurer a la fermeture.
  // On vérifie aussi document.body.contains() pour ne pas tenter de focus
  // sur un element qui aurait été retiré du DOM entre-temps.
  useEffect(() => {
    previousFocusRef.current = document.activeElement;
    return () => {
      const prev = previousFocusRef.current;
      if (prev instanceof HTMLElement && document.body.contains(prev)) {
        prev.focus();
      }
    };
  }, []);

  // Fermeture via Escape
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
      // Focus trap : Tab / Shift+Tab
      if (e.key === "Tab" && modalRef.current) {
        const focusable = getFocusableElements(modalRef.current);
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    },
    [onClose]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleKeyDown]);

  const title =
    type === "education"
      ? mode === "edit"
        ? "Modifier la formation"
        : "Ajouter une formation"
      : mode === "edit"
      ? "Modifier l'experience"
      : "Ajouter une experience";

  const modalContent = (
    <div
      className="modal-overlay"
      onClick={(e) => {
        // Fermer si clic sur l'overlay (pas sur la box)
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={modalRef}
        className="modal-box"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <h2 id={titleId}>{title}</h2>
        {type === "education" ? (
          <EducationForm
            initialData={(props as ModalEducation).initialData}
            saving={saving}
            onSave={(props as ModalEducation).onSave}
            onDelete={(props as ModalEducation).onDelete}
            onClose={onClose}
          />
        ) : (
          <ExperienceForm
            initialData={(props as ModalExperience).initialData}
            saving={saving}
            onSave={(props as ModalExperience).onSave}
            onDelete={(props as ModalExperience).onDelete}
            onClose={onClose}
          />
        )}
      </div>
    </div>
  );

  // createPortal necessite document.body — uniquement accessible cote client
  if (typeof document === "undefined") return null;
  return createPortal(modalContent, document.body);
}
