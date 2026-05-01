import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "BrightOff — Authentification",
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-12"
      style={{ backgroundColor: "var(--brightoff-bg)" }}
    >
      {/* Logo / titre de marque */}
      <div className="mb-8 text-center">
        <Link href="/" aria-label="Retour à l'accueil BrightOff">
          <span
            className="text-3xl font-bold tracking-tight"
            style={{
              background: "var(--brightoff-gradient)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            BrightOff
          </span>
        </Link>
        <p
          className="mt-1 text-sm"
          style={{ color: "var(--brightoff-text-secondary)" }}
        >
          Trouve l&apos;offre qui te correspond vraiment
        </p>
      </div>

      {/* Carte centrale */}
      <div
        className="w-full max-w-md rounded-2xl p-8"
        style={{
          backgroundColor: "var(--brightoff-bg-secondary)",
          border: "1px solid var(--brightoff-border)",
          boxShadow:
            "0 4px 6px -1px rgba(43, 58, 74, 0.08), 0 2px 4px -1px rgba(43, 58, 74, 0.04)",
        }}
      >
        {children}
      </div>

      {/* Pied de page minimaliste */}
      <p className="mt-6 text-xs" style={{ color: "var(--brightoff-text-secondary)" }}>
        &copy; {new Date().getFullYear()} BrightOff. Tous droits réservés.
      </p>
    </div>
  );
}
