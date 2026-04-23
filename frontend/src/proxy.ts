/**
 * Proxy Auth.js v5 — protection des routes BrightOff.
 *
 * Next.js 16 a renommé `middleware.ts` en `proxy.ts` et la convention
 * de fonction `middleware` en `proxy`. Ce fichier utilise la nouvelle
 * convention (voir node_modules/next/dist/docs/01-app/03-api-reference/
 * 03-file-conventions/proxy.md — section "Migration to Proxy").
 *
 * Auth.js v5 : `auth` peut wrapper une fonction proxy. Le paramètre `req`
 * est un `NextAuthRequest` (extension de `NextRequest`) qui expose `req.auth`
 * avec la session courante (ou null si non authentifié).
 *
 * Comportements :
 *   1. Route protégée (/dashboard/**) + pas de session → redirect /login
 *   2. Route protégée (/dashboard/**) + session avec RefreshTokenError
 *      → redirect /login?error=SessionExpired (force re-login)
 *   3. Route publique auth (/login, /register) + session valide
 *      → redirect /dashboard (évite double-login)
 *   4. Tous les autres cas → laisse passer
 */

import { auth } from "@/auth";
import type { NextAuthRequest } from "next-auth";
import { NextResponse } from "next/server";

/**
 * Préfixes des routes qui nécessitent une authentification valide.
 * Tout chemin commençant par l'un de ces préfixes est protégé.
 */
const PROTECTED_PREFIXES = ["/dashboard"] as const;

/**
 * Routes publiques d'authentification.
 * Un utilisateur déjà connecté (session valide) est redirigé vers /dashboard.
 */
const AUTH_ROUTES = ["/login", "/register"] as const;

export const proxy = auth((req: NextAuthRequest) => {
  const { pathname } = req.nextUrl;
  const session = req.auth;

  const isProtectedRoute = PROTECTED_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix)
  );
  const isAuthRoute = AUTH_ROUTES.some((route) => pathname === route);

  // Cas 2 : session présente mais refresh token invalide → forcer re-login.
  // Vérifier avant isProtectedRoute pour intercepter même sur routes protégées.
  if (session?.error === "RefreshTokenError") {
    // Évite la boucle infinie : si on est déjà sur /login, on laisse passer
    if (!pathname.startsWith("/login")) {
      return NextResponse.redirect(
        new URL("/login?error=SessionExpired", req.url)
      );
    }
    return NextResponse.next();
  }

  // Cas 1 : route protégée sans session → redirect vers /login
  if (isProtectedRoute && !session) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // Cas 3 : utilisateur connecté tente d'accéder à /login ou /register
  if (isAuthRoute && session) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  // Cas 4 : tout le reste → laisser passer
  return NextResponse.next();
});

/**
 * Matcher : le proxy s'exécute sur toutes les routes sauf :
 *   - api/auth/** (handlers Auth.js — ne pas intercepter)
 *   - _next/static et _next/image (assets Next.js)
 *   - favicon.ico, sitemap.xml, robots.txt (metadata)
 *
 * Note : Auth.js recommande d'inclure toutes les routes applicatives dans
 * le matcher pour maintenir la session vivante, même sur les routes publiques.
 */
export const config = {
  matcher: [
    "/((?!api/auth|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};
