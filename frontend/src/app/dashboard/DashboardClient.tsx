"use client";

import { usePathname, useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { NavApp, Button } from "@/components/ui";

interface DashboardClientProps {
  userName: string;
  userInitials: string;
}

/**
 * DashboardClient — partie interactive du dashboard.
 * Isolé en Client Component pour usePathname() et signOut().
 * La page parente (Server Component) récupère la session via auth()
 * et passe les données utilisateur en props.
 */
export default function DashboardClient({ userName, userInitials }: DashboardClientProps) {
  const pathname = usePathname();
  const router = useRouter();

  // Calcul du lien actif selon le pathname courant
  const activeLinkId = pathname?.startsWith("/dashboard")
    ? "dashboard"
    : pathname?.startsWith("/profile")
    ? "profile"
    : pathname?.startsWith("/applications")
    ? "applications"
    : undefined;

  return (
    <>
      <NavApp
        userName={userName}
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
            Bienvenue {userName} 👋
          </h1>
          <p className="text-base" style={{ color: "var(--color-text-secondary)" }}>
            Pour commencer à recevoir des offres alignées avec votre profil, importez votre CV.
          </p>
        </div>

        {/* État vide — invitation à importer le CV */}
        <div
          className="card p-10 flex flex-col items-center text-center"
          style={{ maxWidth: 480 }}
        >
          <div
            className="text-5xl mb-5"
            aria-hidden="true"
          >
            📄
          </div>
          <h2
            className="text-lg font-semibold mb-2"
            style={{ color: "var(--color-text)" }}
          >
            Votre profil n&apos;est pas encore configuré
          </h2>
          <p
            className="text-sm mb-6"
            style={{ color: "var(--color-text-secondary)" }}
          >
            Importez votre CV pour générer votre profil et recevoir vos premiers matchs.
          </p>
          {/* /onboarding n'existe pas encore (S3-12) — le 404 est attendu */}
          <Button
            variant="coral"
            size="lg"
            onClick={() => router.push("/onboarding")}
          >
            Importer mon CV
          </Button>
        </div>
      </div>
    </>
  );
}
