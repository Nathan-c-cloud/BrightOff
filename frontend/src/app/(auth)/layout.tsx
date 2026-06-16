import type { Metadata } from "next";
import { NavPublic } from "@/components/ui";

export const metadata: Metadata = {
  title: "BrightOff — Authentification",
};

/**
 * Layout auth — s'applique à /login et /register.
 * Structure : NavPublic en header + centrage vertical de la carte enfant.
 *
 * La carte .center-card est définie dans globals.css (@layer components).
 * Les styles padding/maxWidth/borderRadius/shadow ne sont plus inline pour
 * permettre aux media queries de les surcharger en mobile.
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
        <div className="center-card">
          {children}
        </div>
      </div>
    </>
  );
}
