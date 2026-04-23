/**
 * Configuration Auth.js v5 (next-auth@5.0.0-beta.31)
 *
 * Providers :
 *   - Credentials : email/password → POST /api/v1/auth/login (backend FastAPI)
 *   - Google : OAuth 2.0 → POST /api/v1/auth/google (backend FastAPI)
 *
 * Stockage : les tokens BrightOff sont stockés dans le JWT Auth.js signé
 * (cookie httpOnly côté serveur). Seul l'access token est exposé via
 * session.backendToken pour les Server Components et Client Components.
 * Le refresh token reste confiné au JWT signé, jamais dans session.
 *
 * Refresh automatique (US-204) :
 *   Le callback jwt détecte l'expiration imminente de l'access token
 *   (marge de 60 secondes) et appelle refreshBackendToken() pour obtenir
 *   un nouveau couple access/refresh token par rotation.
 */

import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import type { JWT } from "next-auth/jwt";

/** Base URL du backend FastAPI — définie via NEXT_PUBLIC_API_URL */
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

/**
 * Marge de renouvellement en secondes avant expiration effective.
 * Si l'access token expire dans moins de REFRESH_MARGIN_SECONDS, on rafraîchit.
 */
const REFRESH_MARGIN_SECONDS = 60;

/**
 * Structure de la réponse TokenResponse du backend FastAPI.
 * Correspond au schéma Pydantic TokenResponse (access + refresh depuis US-204).
 */
interface BackendTokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

/**
 * Calcule le timestamp Unix d'expiration absolu (secondes) à partir
 * du champ expires_in retourné par le backend.
 */
function toTokenExpiresAt(expiresIn: number): number {
  return Math.floor(Date.now() / 1000) + expiresIn;
}

/**
 * Appelle POST /api/v1/auth/login et retourne le TokenResponse.
 * Retourne null si les credentials sont invalides (401).
 * Lance une Error si le compte est désactivé (403 is_active=false).
 */
async function loginWithCredentials(
  email: string,
  password: string
): Promise<BackendTokenResponse | null> {
  const res = await fetch(`${API_URL}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (res.status === 403) {
    // Compte désactivé — on lance une erreur pour afficher un message distinct
    throw new Error("AccountDisabled");
  }

  if (!res.ok) {
    // 401 (mauvais credentials) ou autre erreur non gérée → retourne null
    return null;
  }

  return res.json() as Promise<BackendTokenResponse>;
}

/**
 * Après le callback Google OAuth, échange le id_token Google contre
 * un token BrightOff via POST /api/v1/auth/google.
 * Retourne null si le token Google est invalide.
 */
async function loginWithGoogle(
  googleIdToken: string
): Promise<BackendTokenResponse | null> {
  const res = await fetch(`${API_URL}/api/v1/auth/google`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ google_token: googleIdToken }),
  });

  if (!res.ok) {
    return null;
  }

  return res.json() as Promise<BackendTokenResponse>;
}

/**
 * Tente de renouveler l'access token via POST /api/v1/auth/refresh.
 *
 * Le backend implémente la rotation : il invalide le refresh token reçu
 * et émet un nouveau couple (access_token, refresh_token).
 *
 * Retourne le token JWT Auth.js mis à jour avec les nouveaux tokens,
 * ou un token marqué error="RefreshTokenError" si le refresh échoue
 * (refresh token expiré, révoqué, ou erreur réseau).
 *
 * Note : cette fonction n'est pas concurrent-safe. Si plusieurs requêtes
 * parallèles arrivent pendant la fenêtre d'expiration, plusieurs refresh
 * peuvent être tentés simultanément — seul le premier aboutira, les suivants
 * recevront un 401 et déclencheront RefreshTokenError. Ce cas est peu probable
 * en pratique mais constitue une dette technique connue (voir backlog).
 */
async function refreshBackendToken(token: JWT): Promise<JWT> {
  if (!token.backendRefreshToken) {
    // Pas de refresh token disponible — session invalide
    return { ...token, error: "RefreshTokenError" as const };
  }

  try {
    const res = await fetch(`${API_URL}/api/v1/auth/refresh`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token.backendRefreshToken}`,
      },
    });

    if (!res.ok) {
      // 401 → refresh token expiré ou révoqué
      // 4xx/5xx → erreur non récupérable dans ce contexte
      return { ...token, error: "RefreshTokenError" as const };
    }

    const refreshed = (await res.json()) as BackendTokenResponse;

    return {
      ...token,
      backendToken: refreshed.access_token,
      backendRefreshToken: refreshed.refresh_token,
      backendTokenExpiresAt: toTokenExpiresAt(refreshed.expires_in),
      // Réinitialise l'erreur si un refresh précédent avait échoué
      error: undefined,
    };
  } catch {
    // Erreur réseau ou parsing — on ne lève pas, on retourne l'erreur dans le token
    return { ...token, error: "RefreshTokenError" as const };
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    /**
     * Provider Credentials — email + password
     *
     * authorize() est appelé côté serveur uniquement (Server Action / API Route).
     * Il ne s'exécute jamais dans le navigateur.
     */
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Mot de passe", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email;
        const password = credentials?.password;

        if (typeof email !== "string" || typeof password !== "string") {
          return null;
        }

        const tokenResponse = await loginWithCredentials(email, password);

        if (!tokenResponse) {
          // Credentials invalides — Auth.js affiche CredentialsSignin
          return null;
        }

        // Objet User Auth.js — propagé dans le callback jwt({ user })
        return {
          id: email,
          email,
          backendToken: tokenResponse.access_token,
          backendRefreshToken: tokenResponse.refresh_token,
          backendTokenExpiresIn: tokenResponse.expires_in,
        };
      },
    }),

    /**
     * Provider Google — OAuth 2.0 standard
     *
     * AUTH_GOOGLE_ID et AUTH_GOOGLE_SECRET sont lus automatiquement
     * par Auth.js v5 depuis les variables d'env (convention AUTH_<PROVIDER>_<FIELD>).
     * Redirect URI : http://localhost:3000/api/auth/callback/google
     */
    Google,
  ],

  callbacks: {
    /**
     * Callback signIn — garde-fou minimal pour le provider Google.
     *
     * On laisse passer tous les logins Credentials (la logique de validation
     * est dans authorize()). Pour Google, on valide simplement que le id_token
     * est présent dans account — le vrai échange avec le backend est dans jwt().
     */
    async signIn({ account }) {
      if (account?.provider === "google" && !account.id_token) {
        // id_token absent = scope openid non accordé — ne devrait pas arriver
        return false;
      }
      return true;
    },

    /**
     * Callback jwt — construit, maintient et rafraîchit le JWT Auth.js interne.
     *
     * Appelé lors :
     *   1. Premier login Credentials (user présent) → tokens dans user depuis authorize()
     *   2. Premier login Google (account présent, trigger="signIn") → échange id_token
     *      contre tokens BrightOff directement ici (pattern idiomatique Auth.js v5)
     *   3. Appels suivants (user et account absents) → vérification d'expiration
     *      et refresh automatique si nécessaire
     *
     * Pourquoi gérer Google ici plutôt que dans signIn() ?
     * Dans Auth.js v5, les mutations sur user dans signIn() ne sont pas garanties
     * d'être propagées dans jwt(). Centraliser la logique dans jwt() avec account
     * est le pattern idiomatique et plus fiable.
     */
    async jwt({ token, user, account }) {
      // Cas 1 : login Credentials — user contient les tokens depuis authorize()
      if (user?.backendToken) {
        token.backendToken = user.backendToken;
        token.backendRefreshToken = user.backendRefreshToken;

        if (user.backendTokenExpiresIn) {
          token.backendTokenExpiresAt = toTokenExpiresAt(user.backendTokenExpiresIn);
        }

        // Premier login réussi — pas d'erreur à conserver
        token.error = undefined;
        return token;
      }

      // Cas 2 : premier login Google — échange le id_token contre des tokens BrightOff
      if (account?.provider === "google" && account.id_token) {
        const tokenResponse = await loginWithGoogle(account.id_token);

        if (tokenResponse) {
          token.backendToken = tokenResponse.access_token;
          token.backendRefreshToken = tokenResponse.refresh_token;
          token.backendTokenExpiresAt = toTokenExpiresAt(tokenResponse.expires_in);
          token.error = undefined;
        } else {
          // Backend a rejeté le token Google — on supprime les tokens BrightOff
          // pour forcer une erreur visible plutôt qu'une session invalide silencieuse
          delete token.backendToken;
          delete token.backendRefreshToken;
          delete token.backendTokenExpiresAt;
          token.error = "RefreshTokenError";
        }

        return token;
      }

      // Cas 3 : appels suivants — vérifier si l'access token est encore valide
      const nowSeconds = Math.floor(Date.now() / 1000);
      const expiresAt = token.backendTokenExpiresAt;

      if (
        expiresAt !== undefined &&
        expiresAt > nowSeconds + REFRESH_MARGIN_SECONDS
      ) {
        // Access token encore valide avec marge suffisante → retour sans refresh
        return token;
      }

      // Access token expiré ou dans la fenêtre critique → tenter le refresh
      return refreshBackendToken(token);
    },

    /**
     * Callback session — projette les champs du JWT vers l'objet Session.
     *
     * Seul l'access token est exposé (session accessible côté client).
     * Le refresh token reste dans le JWT signé côté serveur uniquement.
     *
     * session.backendToken est ainsi accessible dans :
     *   - les Server Components via auth()
     *   - les Client Components via useSession()
     *
     * session.error permet au frontend de détecter un échec de refresh
     * et de déconnecter l'utilisateur (signOut).
     */
    async session({ session, token }) {
      if (token.backendToken) {
        session.backendToken = token.backendToken;
      }

      if (token.backendTokenExpiresAt) {
        session.backendTokenExpiresAt = token.backendTokenExpiresAt;
      }

      if (token.error) {
        session.error = token.error;
      }

      return session;
    },
  },

  /**
   * Pages personnalisées — Auth.js redirigera vers ces URLs plutôt que
   * vers ses pages intégrées (qui n'existent pas dans notre app).
   * Les pages /login et /register sont implémentées au T2-15 et T2-16.
   */
  pages: {
    signIn: "/login",
    error: "/login", // Les erreurs OAuth (AccountDisabled, etc.) redirigent vers /login
  },

  /**
   * Session strategy : "jwt" (stateless, pas de base de données Auth.js).
   * Le token est signé avec NEXTAUTH_SECRET et stocké dans un cookie httpOnly.
   */
  session: {
    strategy: "jwt",
  },
});
