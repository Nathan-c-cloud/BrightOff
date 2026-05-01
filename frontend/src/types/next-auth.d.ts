/**
 * Module augmentation Auth.js v5 — étend les types Session et JWT
 * pour exposer le token BrightOff (JWT backend FastAPI).
 *
 * Ce fichier est automatiquement inclus par TypeScript via le pattern
 * **\/*.ts dans tsconfig.json.
 */

import type { DefaultSession } from "next-auth";
import type { JWT as DefaultJWT } from "next-auth/jwt";

declare module "next-auth" {
  /**
   * Étend l'objet Session pour exposer le token BrightOff côté client.
   * Accessible via : const { data: session } = useSession()
   * puis : session.backendToken
   *
   * IMPORTANT : backendRefreshToken ne doit jamais apparaître ici —
   * la session est lisible côté client.
   */
  interface Session extends DefaultSession {
    /** Access token JWT BrightOff — à transmettre dans Authorization: Bearer */
    backendToken?: string;
    /** Timestamp Unix d'expiration de l'access token (secondes) */
    backendTokenExpiresAt?: number;
    /**
     * Présent si le refresh a échoué (refresh token expiré ou invalide).
     * Le frontend doit déconnecter l'utilisateur dès que cette valeur est présente.
     */
    error?: "RefreshTokenError";
  }

  /**
   * Étend l'objet User retourné par le provider Credentials.
   * Valeurs propagées vers le JWT dans le callback jwt({ user }).
   */
  interface User {
    /** Access token JWT BrightOff reçu du backend après login */
    backendToken?: string;
    /** Refresh token JWT BrightOff — durée de vie 7 jours */
    backendRefreshToken?: string;
    /** Durée de vie de l'access token en secondes (expires_in du TokenResponse) */
    backendTokenExpiresIn?: number;
  }
}

declare module "next-auth/jwt" {
  /**
   * Étend le JWT Auth.js interne (cookie httpOnly signé, serveur uniquement).
   * Contient à la fois l'access token et le refresh token BrightOff.
   * Le refresh token ne doit jamais être copié dans Session.
   */
  interface JWT extends DefaultJWT {
    /** Access token JWT BrightOff — propagé depuis User au premier login */
    backendToken?: string;
    /**
     * Refresh token JWT BrightOff (7 jours).
     * Stocké uniquement dans le JWT signé côté serveur, jamais exposé en session.
     */
    backendRefreshToken?: string;
    /** Timestamp Unix d'expiration de l'access token (secondes) */
    backendTokenExpiresAt?: number;
    /**
     * Erreur de refresh — propagée vers Session pour que le frontend
     * puisse détecter l'échec et déconnecter l'utilisateur.
     */
    error?: "RefreshTokenError";
  }
}
