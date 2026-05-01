import type { Metadata } from "next";
import { NavPublic } from "@/components/ui";

export const metadata: Metadata = {
  title: "BrightOff — Authentification",
};

/**
 * Layout auth — s'applique à /login et /register.
 * Structure : NavPublic en header + centrage vertical de la carte enfant.
 * Le contenu de chaque page (LoginPage / RegisterPage) est rendu dans .center-card.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <NavPublic />
      <div className="center-screen">
        <div
          className="w-full p-10"
          style={{
            background: "var(--color-bg-card)",
            border: "1px solid var(--color-border)",
            borderRadius: 14,
            boxShadow:
              "0 4px 6px -1px rgba(43, 58, 74, 0.08), 0 2px 4px -1px rgba(43, 58, 74, 0.04)",
            maxWidth: 460,
          }}
        >
          {children}
        </div>
      </div>
    </>
  );
}
