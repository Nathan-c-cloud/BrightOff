"use client";

/**
 * Page onboarding — Upload du CV.
 *
 * Première page après le signup. Protégée par proxy.ts (session requise).
 *
 * Cycle de vie :
 *   1. Au montage : vérifie si l'user a déjà un CV "ready" → redirect /profile
 *   2. État idle    : DropZone en attente de fichier
 *   3. État uploading : POST /api/v1/cvs/upload avec barre de progression XHR
 *   4. État parsing  : spinner + polling GET /api/v1/cvs/{id} toutes les 2s
 *   5. parsing_status === "ready" → redirect /profile
 *   6. parsing_status === "failed" → état error + message + bouton "Réessayer"
 *   7. Timeout polling (2 min) → message d'attente spécifique
 *
 * Sécurité :
 *   - Le token BrightOff est lu depuis la session Auth.js (useSession)
 *   - Aucun stockage local du fichier ou du token
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { NavApp } from "@/components/ui";
import { DropZone } from "@/components/DropZone";
import type { DropZoneState } from "@/components/DropZone";
import {
  uploadCv,
  ApiCvsError,
  resolveUploadError,
} from "@/lib/api-cvs";
import { useCvPolling } from "@/hooks/useCvPolling";

/** Statut interne de la page — plus granulaire que DropZoneState */
type PageStatus =
  | "idle"
  | "uploading"
  | "parsing"
  | "ready"
  | "failed"
  | "timeout";

export default function OnboardingPage() {
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();

  const [pageStatus, setPageStatus] = useState<PageStatus>("idle");
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [fileName, setFileName] = useState<string | null>(null);
  const [uploadedCvId, setUploadedCvId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Token BrightOff depuis la session Auth.js
  const accessToken = session?.backendToken ?? null;

  // ---------- Redirection si pas de session ----------

  useEffect(() => {
    if (sessionStatus === "unauthenticated") {
      router.push("/login");
    }
  }, [sessionStatus, router]);

  // ---------- Polling du statut CV ----------

  useCvPolling({
    // Polling actif seulement en phase "parsing"
    cvId: pageStatus === "parsing" ? uploadedCvId : null,
    accessToken,
    onReady: () => {
      setPageStatus("ready");
      router.push("/profile");
    },
    onFailed: () => {
      setPageStatus("failed");
      setErrorMessage(
        "L'analyse de votre CV a échoué. Vérifiez que le fichier est lisible et réessayez."
      );
    },
    onTimeout: () => {
      setPageStatus("timeout");
      setErrorMessage(
        "L'analyse prend plus longtemps que prévu. Votre CV a bien été reçu — revenez dans quelques minutes."
      );
    },
    onError: (err) => {
      setPageStatus("failed");
      setErrorMessage(resolveUploadError(err));
    },
  });

  // ---------- Handler upload ----------

  async function handleFile(file: File): Promise<void> {
    if (!accessToken) {
      setErrorMessage("Session expirée. Veuillez vous reconnecter.");
      setPageStatus("failed");
      return;
    }

    setFileName(file.name);
    setUploadProgress(0);
    setErrorMessage(null);
    setPageStatus("uploading");

    try {
      const response = await uploadCv(file, accessToken, (percent) => {
        setUploadProgress(percent);
      });

      // Upload terminé — on passe en phase parsing
      setUploadedCvId(response.id);
      setPageStatus("parsing");
    } catch (err) {
      const message =
        err instanceof ApiCvsError
          ? resolveUploadError(err)
          : "Une erreur est survenue lors de l'upload. Réessayez.";
      setErrorMessage(message);
      setPageStatus("failed");
    }
  }

  // ---------- Handler retry ----------

  function handleRetry(): void {
    setPageStatus("idle");
    setUploadProgress(0);
    setFileName(null);
    setUploadedCvId(null);
    setErrorMessage(null);
  }

  // ---------- Mapping pageStatus → DropZoneState ----------

  function getDropZoneState(): DropZoneState {
    switch (pageStatus) {
      case "uploading":
        return "uploading";
      case "failed":
      case "timeout":
        return "error";
      default:
        return "idle";
    }
  }

  // ---------- Rendu en phase "parsing" — spinner ----------

  function renderParsingState() {
    return (
      <div
        style={{
          border: "2px dashed var(--color-border)",
          borderRadius: "var(--radius-card)",
          background: "var(--color-bg-card)",
          padding: "48px 32px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "20px",
          minHeight: "260px",
          textAlign: "center",
        }}
      >
        {/* Spinner accessible */}
        <div
          role="status"
          aria-label="Analyse du CV en cours"
          style={{
            width: "48px",
            height: "48px",
            border: "4px solid var(--color-border)",
            borderTopColor: "var(--color-primary)",
            borderRadius: "50%",
            animation: "spin 0.8s linear infinite",
          }}
        />

        <div>
          <p
            className="text-base font-semibold mb-1"
            style={{ color: "var(--color-text)" }}
          >
            On analyse ton CV...
          </p>
          <p
            className="text-sm"
            style={{ color: "var(--color-text-secondary)" }}
            aria-live="polite"
          >
            Cette étape peut prendre quelques secondes.
          </p>
        </div>
      </div>
    );
  }

  // ---------- Chargement de la session ----------

  if (sessionStatus === "loading") {
    return (
      <div
        className="center-screen"
        aria-busy="true"
        aria-label="Chargement de la session"
      />
    );
  }

  // ---------- Rendu principal ----------

  const userName =
    session?.user?.name ??
    session?.user?.email?.split("@")[0] ??
    "Utilisateur";
  const userInitials = userName.slice(0, 2).toUpperCase();

  return (
    <>
      {/* Animation spinner — injectée en style global minimal */}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>

      <NavApp
        userName={userName}
        userInitials={userInitials}
        activeLinkId={undefined}
        onLogout={() => {
          import("next-auth/react").then(({ signOut }) =>
            signOut({ callbackUrl: "/" })
          );
        }}
      />

      <div className="page-wrap">
        <div className="mb-8">
          <h1
            className="text-2xl md:text-3xl font-extrabold tracking-tight mb-2"
            style={{ color: "var(--color-text)" }}
          >
            Importe ton CV
          </h1>
          <p className="text-base" style={{ color: "var(--color-text-secondary)" }}>
            On analyse ton CV pour créer ton profil et trouver les offres qui te correspondent.
          </p>
        </div>

        {/* Zone centrale — 560px max pour ne pas étirer la drop zone */}
        <div style={{ maxWidth: "560px", width: "100%" }}>
          {pageStatus === "parsing" || pageStatus === "ready" ? (
            renderParsingState()
          ) : (
            <DropZone
              state={getDropZoneState()}
              uploadProgress={uploadProgress}
              fileName={fileName}
              errorMessage={errorMessage}
              onFile={handleFile}
              onRetry={handleRetry}
            />
          )}
        </div>
      </div>
    </>
  );
}
