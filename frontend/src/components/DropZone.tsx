"use client";

/**
 * DropZone — zone de dépôt de fichier drag-and-drop.
 *
 * Composant contrôlé : l'état d'upload est géré par le parent via les props.
 * Le composant ne détient pas d'état interne au-delà du survol drag.
 *
 * Validation côté client :
 *   - Extensions autorisées : .pdf, .docx
 *   - Types MIME acceptés : application/pdf, application/vnd.openxmlformats-officedocument.wordprocessingml.document
 *   - Taille max : 5 MB
 *
 * Accessibilité :
 *   - <input type="file"> visuellement caché mais focusable (clip-path)
 *   - Label explicite via aria-label sur la zone cliquable
 *   - aria-live="polite" sur les messages de statut et d'erreur
 */

import React, { useRef, useState, useCallback } from "react";

export type DropZoneState = "idle" | "uploading" | "error";

export interface DropZoneProps {
  /** État courant du composant — contrôlé par le parent */
  state: DropZoneState;
  /** Progression de l'upload 0-100 (utilisée uniquement quand state === "uploading") */
  uploadProgress: number;
  /** Nom du fichier en cours d'upload (null si idle) */
  fileName: string | null;
  /** Message d'erreur à afficher (null si pas d'erreur) */
  errorMessage: string | null;
  /** Callback déclenché quand l'utilisateur sélectionne ou dépose un fichier valide */
  onFile: (file: File) => void;
  /** Callback déclenché quand l'utilisateur veut réessayer après une erreur */
  onRetry: () => void;
}

/** Extensions de fichier autorisées (display uniquement — la validation est sur MIME) */
const ACCEPTED_EXTENSIONS = [".pdf", ".docx"];

/** Types MIME acceptés */
const ACCEPTED_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

/** Taille maximale du fichier en octets (5 MB) */
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

/**
 * Valide un fichier côté client.
 * Retourne un message d'erreur ou null si le fichier est valide.
 */
export function validateFile(file: File): string | null {
  // Vérification de la taille
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return "Le fichier dépasse la taille maximum de 5 MB.";
  }

  // Vérification du type MIME (plus fiable que l'extension seule)
  if (!ACCEPTED_MIME_TYPES.includes(file.type)) {
    return "Format non supporté. Utilisez un fichier PDF ou DOCX.";
  }

  // Double-vérification sur l'extension (garde-fou si le MIME est spoofé)
  const name = file.name.toLowerCase();
  const hasValidExtension = ACCEPTED_EXTENSIONS.some((ext) =>
    name.endsWith(ext)
  );
  if (!hasValidExtension) {
    return "Extension non supportée. Utilisez un fichier PDF ou DOCX.";
  }

  return null;
}

/**
 * Zone de dépôt de fichier drag-and-drop.
 *
 * Trois états visuels :
 *   - idle     : zone vide avec instruction + bouton "Sélectionner"
 *   - uploading: barre de progression + nom du fichier
 *   - error    : message d'erreur + bouton "Réessayer"
 */
export function DropZone({
  state,
  uploadProgress,
  fileName,
  errorMessage,
  onFile,
  onRetry,
}: DropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFileSelected = useCallback(
    (file: File) => {
      const error = validateFile(file);
      if (error) {
        // On remonte l'erreur via onFile avec un fichier invalide ?
        // Non — le composant gère la validation et appelle onFile uniquement si valide.
        // On expose l'erreur via un mécanisme interne... mais DropZone est contrôlé.
        // Solution : on appelle onFile avec un fichier invalide ET on gère l'erreur
        // dans le parent. Mais ça couples trop.
        // Alternative retenue : on déclenche un event synthétique d'erreur.
        // Le parent doit fournir onValidationError séparé... mais la spec dit onFile.
        //
        // Choix final : si le fichier est invalide, on appelle quand même onFile
        // pour que le parent puisse afficher l'erreur — NON, le parent ne sait pas.
        //
        // Pattern correct : DropZone gère la validation et n'appelle onFile
        // que si le fichier est valide. Pour les erreurs de validation, on
        // expose un second callback ou on gère l'état d'erreur en interne.
        //
        // La spec demande errorMessage comme prop (état contrôlé depuis le parent),
        // donc on a besoin d'un callback onValidationError. On l'ajoute implicitement
        // en appelant onFile avec l'erreur encodée — non, mauvais design.
        //
        // Décision : on appelle onFile(file) même pour les fichiers invalides et on
        // laisse le parent valider via validateFile() importée depuis ce module.
        // Le parent peut appeler validateFile() avant d'agir, ou on peut exposer
        // un callback séparé. Pour rester dans la spec "onFile appelé sur fichier valide",
        // on gère l'erreur de validation DANS DropZone via un état local minimal.
        setLocalValidationError(error);
        return;
      }
      setLocalValidationError(null);
      onFile(file);
    },
    [onFile]
  );

  // État local minimal : erreur de validation client (avant l'envoi)
  // Distinct de errorMessage (erreur serveur ou état parent)
  const [localValidationError, setLocalValidationError] = useState<string | null>(null);

  // L'erreur affichée : erreur parent > erreur locale de validation
  const displayedError = errorMessage ?? localValidationError;

  // État effectif pour l'affichage : si erreur locale → on force "error" visuellement
  const effectiveState: DropZoneState =
    localValidationError && state === "idle" ? "error" : state;

  // ---------- Handlers drag-and-drop ----------

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Indique au navigateur qu'on accepte le dépôt
    e.dataTransfer.dropEffect = "copy";
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Vérifier que le drag quitte vraiment la zone (et non un enfant)
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragging(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      // On prend uniquement le premier fichier déposé
      const file = e.dataTransfer.files[0];
      if (file) {
        handleFileSelected(file);
      }
    },
    [handleFileSelected]
  );

  // ---------- Handler input file ----------

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        handleFileSelected(file);
      }
      // Reset l'input pour permettre de re-sélectionner le même fichier
      e.target.value = "";
    },
    [handleFileSelected]
  );

  const handleZoneClick = useCallback(() => {
    // On ouvre le sélecteur seulement en état idle ou error (pas pendant upload)
    if (effectiveState !== "uploading") {
      inputRef.current?.click();
    }
  }, [effectiveState]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        handleZoneClick();
      }
    },
    [handleZoneClick]
  );

  const handleRetryClick = useCallback(
    (e: React.MouseEvent) => {
      // Empêche le clic de remonter jusqu'à handleZoneClick
      e.stopPropagation();
      setLocalValidationError(null);
      onRetry();
    },
    [onRetry]
  );

  // ---------- Styles dynamiques ----------

  const getBorderColor = () => {
    if (isDragging) return "var(--color-primary)";
    if (effectiveState === "error") return "var(--color-error)";
    return "var(--color-border)";
  };

  const getBackgroundColor = () => {
    if (isDragging) return "var(--color-primary-light)";
    if (effectiveState === "error") return "var(--color-error-bg)";
    return "var(--color-bg-card)";
  };

  return (
    <div
      role="button"
      tabIndex={effectiveState === "uploading" ? -1 : 0}
      aria-label="Zone de dépôt de CV — cliquez ou déposez votre fichier"
      aria-disabled={effectiveState === "uploading"}
      onClick={handleZoneClick}
      onKeyDown={handleKeyDown}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="dropzone-wrap"
      style={{
        // Styles dynamiques uniquement — les styles statiques sont dans .dropzone-wrap (globals.css)
        borderColor: getBorderColor(),
        background: getBackgroundColor(),
        cursor: effectiveState === "uploading" ? "default" : "pointer",
      }}
    >
      {/* Input file visuellement masqué mais accessible */}
      <input
        ref={inputRef}
        type="file"
        id="cv-file-input"
        accept=".pdf,.docx"
        onChange={handleInputChange}
        aria-label="Sélectionner un fichier CV"
        style={{
          position: "absolute",
          width: "1px",
          height: "1px",
          padding: 0,
          margin: "-1px",
          overflow: "hidden",
          clip: "rect(0, 0, 0, 0)",
          whiteSpace: "nowrap",
          border: 0,
        }}
      />

      {/* --- État IDLE --- */}
      {effectiveState === "idle" && (
        <>
          {/* Illustration SVG simple — pas de dépendance externe */}
          <div aria-hidden="true">
            <svg
              width="56"
              height="56"
              viewBox="0 0 56 56"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <rect
                width="56"
                height="56"
                rx="12"
                fill="var(--color-primary-light)"
              />
              <path
                d="M28 36V20M28 20L22 26M28 20L34 26"
                stroke="var(--color-primary)"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M20 38H36"
                stroke="var(--color-primary)"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            </svg>
          </div>

          <div>
            <p
              className="text-base font-semibold mb-1"
              style={{ color: "var(--color-text)" }}
            >
              Glisse ton CV ici ou clique pour parcourir
            </p>
            <p
              className="text-sm"
              style={{ color: "var(--color-text-secondary)" }}
            >
              PDF ou DOCX — 5 MB maximum
            </p>
          </div>

          <button
            type="button"
            className="btn btn-sky-outline"
            onClick={(e) => {
              e.stopPropagation();
              inputRef.current?.click();
            }}
          >
            Sélectionner un fichier
          </button>
        </>
      )}

      {/* --- État UPLOADING --- */}
      {effectiveState === "uploading" && (
        <>
          <div aria-hidden="true">
            <svg
              width="56"
              height="56"
              viewBox="0 0 56 56"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <rect
                width="56"
                height="56"
                rx="12"
                fill="var(--color-primary-light)"
              />
              <path
                d="M20 28h16M28 20l8 8-8 8"
                stroke="var(--color-primary)"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>

          <div style={{ width: "100%", maxWidth: "320px" }}>
            {fileName && (
              <p
                className="text-sm font-medium mb-3 truncate"
                style={{ color: "var(--color-text)" }}
                title={fileName}
              >
                {fileName}
              </p>
            )}

            {/* Barre de progression */}
            <div
              role="progressbar"
              aria-valuenow={uploadProgress}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Upload en cours : ${uploadProgress}%`}
              className="bar"
            >
              <i style={{ width: `${uploadProgress}%` }} />
            </div>

            <p
              className="text-sm mt-2"
              style={{ color: "var(--color-text-secondary)" }}
              aria-live="polite"
            >
              Upload en cours… {uploadProgress}%
            </p>
          </div>
        </>
      )}

      {/* --- État ERROR --- */}
      {effectiveState === "error" && (
        <>
          <div aria-hidden="true">
            <svg
              width="56"
              height="56"
              viewBox="0 0 56 56"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <rect width="56" height="56" rx="12" fill="var(--color-error-bg)" />
              <path
                d="M28 22v10M28 36v1"
                stroke="var(--color-error)"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
              <circle
                cx="28"
                cy="28"
                r="11"
                stroke="var(--color-error)"
                strokeWidth="2.5"
              />
            </svg>
          </div>

          {/* Message d'erreur — aria-live pour les lecteurs d'écran */}
          <p
            role="alert"
            aria-live="polite"
            className="text-sm font-medium"
            style={{ color: "var(--color-error)" }}
          >
            {displayedError ?? "Une erreur est survenue."}
          </p>

          <button
            type="button"
            className="btn btn-sky-outline"
            onClick={handleRetryClick}
          >
            Réessayer
          </button>
        </>
      )}
    </div>
  );
}
