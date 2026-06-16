"use client";

import { useCallback, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { NavApp } from "@/components/ui";
import { CvStatusBanner } from "@/components/CvStatusBanner";
import { Toast } from "@/components/Toast";
import { useLatestCvPolling } from "@/hooks/useLatestCvPolling";
import type { CvStatusResponse } from "@/lib/api-cvs";

interface DashboardClientProps {
  userName: string;
  userInitials: string;
}

type ToastState = {
  message: string;
  variant: "success" | "error";
  onClick?: () => void;
} | null;

/**
 * DashboardClient — partie interactive du dashboard.
 * Isolé en Client Component pour usePathname(), useSession() et signOut().
 * La page parente (Server Component) récupère la session via auth()
 * et passe les données utilisateur en props.
 *
 * Intègre :
 *   - CvStatusBanner : bannière selon le statut du dernier CV
 *   - useLatestCvPolling : détecte et poll le CV en cours de parsing
 *   - Toast : notification quand le parsing termine (ready/failed)
 */
export default function DashboardClient({ userName, userInitials }: DashboardClientProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();

  const accessToken = session?.backendToken ?? null;

  const [toast, setToast] = useState<ToastState>(null);

  const handleReady = useCallback(
    (_cv: CvStatusResponse) => {
      setToast({
        message: "Ton profil est prêt !",
        variant: "success",
        onClick: () => {
          setToast(null);
          router.push("/profile");
        },
      });
    },
    [router]
  );

  const handleFailed = useCallback(() => {
    setToast({
      message: "L'analyse a échoué",
      variant: "error",
      onClick: () => {
        setToast(null);
        router.push("/onboarding");
      },
    });
  }, [router]);

  const handleTimeout = useCallback(() => {
    setToast({
      message: "L'analyse prend plus longtemps que prévu. Revenez dans quelques minutes.",
      variant: "error",
    });
  }, []);

  const { state } = useLatestCvPolling({
    accessToken,
    onReady: handleReady,
    onFailed: handleFailed,
    onTimeout: handleTimeout,
  });

  const activeLinkId = pathname?.startsWith("/dashboard")
    ? "dashboard"
    : pathname?.startsWith("/profile")
    ? "profile"
    : pathname?.startsWith("/applications")
    ? "applications"
    : undefined;

  return (
    <>
      {/* Animation spinner — partagée avec onboarding */}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>

      <NavApp
        userName={userName}
        userInitials={userInitials}
        activeLinkId={activeLinkId}
        onLogout={() => signOut({ callbackUrl: "/" })}
      />

      <div className="page-wrap">
        <div className="mb-8">
          <h1
            className="text-2xl md:text-3xl font-extrabold tracking-tight mb-2"
            style={{ color: "var(--color-text)" }}
          >
            Bienvenue {userName}
          </h1>
          <p className="text-base" style={{ color: "var(--color-text-secondary)" }}>
            Pour commencer à recevoir des offres alignées avec votre profil, importez votre CV.
          </p>
        </div>

        {/* Bannière d'état CV — gère les 4 états : no-cv / parsing / ready / failed */}
        <CvStatusBanner state={state} />
      </div>

      {/* Toast de notification (ready → profil, failed → retry) */}
      {toast && (
        <Toast
          message={toast.message}
          variant={toast.variant}
          onClick={toast.onClick}
          onClose={() => setToast(null)}
        />
      )}
    </>
  );
}
