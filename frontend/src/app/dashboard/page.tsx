/**
 * Page dashboard — Sprint 3.
 *
 * Server Component : récupère la session Auth.js via auth() et passe
 * les données utilisateur au Client Component DashboardClient.
 *
 * La protection de la route /dashboard est assurée par proxy.ts
 * qui redirige vers /login si la session est absente ou expirée.
 *
 * DashboardClient gère : NavApp (usePathname + signOut), état vide.
 */

import { auth } from "@/auth";
import type { Metadata } from "next";
import DashboardClient from "./DashboardClient";

export const metadata: Metadata = {
  title: "BrightOff — Dashboard",
};

export default async function DashboardPage() {
  const session = await auth();

  // La session est garantie non-null par proxy.ts, mais on reste défensif
  const rawName = session?.user?.name ?? session?.user?.email?.split("@")[0] ?? "Utilisateur";
  const userName = rawName;
  const userInitials = rawName.slice(0, 2).toUpperCase();

  return (
    <DashboardClient
      userName={userName}
      userInitials={userInitials}
    />
  );
}
