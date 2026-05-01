/**
 * Module client API pour les endpoints d'authentification BrightOff.
 *
 * Usage côté serveur (Server Component, Server Action, auth.ts) :
 *   import { loginUser, getMe } from "@/lib/api-auth"
 *
 * Usage côté client (Client Component) :
 *   import { registerUser } from "@/lib/api-auth"
 *
 * Ce module est isomorphique : il utilise uniquement fetch natif,
 * sans dépendance tierce, et peut s'exécuter côté serveur (Node 18+)
 * comme côté client (navigateur).
 *
 * Base URL : NEXT_PUBLIC_API_URL (ex: http://localhost:8000)
 * Tous les endpoints sont préfixés par /api/v1/auth/.
 */

/** Réponse de tous les endpoints qui émettent des tokens. */
export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  /** Durée de validité de l'access token en secondes. */
  expires_in: number;
}

/** Réponse de GET /api/v1/auth/me. */
export interface UserMeResponse {
  id: string;
  email: string;
  is_active: boolean;
  /** Date ISO 8601 de création du compte. */
  created_at: string;
}

/**
 * Erreur typée levée par tous les helpers de ce module.
 *
 * - `status === 0` → erreur réseau (pas de réponse du serveur)
 * - `status >= 400` → réponse HTTP d'erreur du backend
 * - `code === "NETWORK_ERROR"` → cas réseau uniquement
 *
 * @example
 * try {
 *   await loginUser(email, password)
 * } catch (err) {
 *   if (err instanceof ApiAuthError && err.status === 401) {
 *     // Credentials invalides
 *   }
 * }
 */
export class ApiAuthError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string
  ) {
    super(message);
    this.name = "ApiAuthError";
  }
}

// ---------------------------------------------------------------------------
// Helpers internes
// ---------------------------------------------------------------------------

/**
 * Retourne la base URL du backend.
 * Centralise l'accès à NEXT_PUBLIC_API_URL pour faciliter les mocks en test.
 */
function getApiUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
}

/**
 * Traite une Response HTTP et lève ApiAuthError si non-ok.
 * Tente de parser le champ `detail` du JSON d'erreur FastAPI.
 */
async function handleResponse<T>(res: Response): Promise<T> {
  if (res.ok) {
    return res.json() as Promise<T>;
  }

  // Tente d'extraire le message d'erreur depuis le JSON FastAPI
  let detail = `HTTP ${res.status}`;
  try {
    const body = (await res.json()) as { detail?: string };
    if (typeof body.detail === "string" && body.detail.length > 0) {
      detail = body.detail;
    }
  } catch {
    // Le body n'est pas du JSON ou est vide — on garde le message générique
  }

  throw new ApiAuthError(detail, res.status);
}

// ---------------------------------------------------------------------------
// Fonctions exportées
// ---------------------------------------------------------------------------

/**
 * Crée un compte utilisateur via POST /api/v1/auth/register.
 *
 * @param email    Adresse email de l'utilisateur
 * @param password Mot de passe en clair (transmis via HTTPS)
 * @returns TokenResponse avec les tokens d'accès et de rafraîchissement
 *
 * @throws {ApiAuthError} status 409 si l'email est déjà utilisé
 * @throws {ApiAuthError} status 422 si les données sont invalides (validation Pydantic)
 * @throws {ApiAuthError} status 0 + code "NETWORK_ERROR" si le backend est inaccessible
 *
 * @example
 * const tokens = await registerUser("alice@example.com", "s3cr3t!")
 * // → { access_token: "eyJ...", refresh_token: "eyJ...", token_type: "bearer", expires_in: 1800 }
 */
export async function registerUser(
  email: string,
  password: string
): Promise<TokenResponse> {
  try {
    const res = await fetch(
      `${getApiUrl()}/api/v1/auth/register`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      }
    );
    return handleResponse<TokenResponse>(res);
  } catch (err) {
    if (err instanceof ApiAuthError) throw err;
    throw new ApiAuthError("Erreur réseau", 0, "NETWORK_ERROR");
  }
}

/**
 * Authentifie un utilisateur existant via POST /api/v1/auth/login.
 *
 * @param email    Adresse email de l'utilisateur
 * @param password Mot de passe en clair
 * @returns TokenResponse avec les tokens d'accès et de rafraîchissement
 *
 * @throws {ApiAuthError} status 401 si les credentials sont invalides
 * @throws {ApiAuthError} status 403 si le compte est désactivé
 * @throws {ApiAuthError} status 0 + code "NETWORK_ERROR" si le backend est inaccessible
 *
 * @example
 * const tokens = await loginUser("alice@example.com", "s3cr3t!")
 * // → { access_token: "eyJ...", refresh_token: "eyJ...", token_type: "bearer", expires_in: 1800 }
 */
export async function loginUser(
  email: string,
  password: string
): Promise<TokenResponse> {
  try {
    const res = await fetch(
      `${getApiUrl()}/api/v1/auth/login`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      }
    );
    return handleResponse<TokenResponse>(res);
  } catch (err) {
    if (err instanceof ApiAuthError) throw err;
    throw new ApiAuthError("Erreur réseau", 0, "NETWORK_ERROR");
  }
}

/**
 * Échange un id_token Google contre des tokens BrightOff
 * via POST /api/v1/auth/google.
 *
 * @param googleToken id_token issu du flux OAuth 2.0 Google
 * @returns TokenResponse avec les tokens d'accès et de rafraîchissement
 *
 * @throws {ApiAuthError} status 401 si le token Google est invalide ou expiré
 * @throws {ApiAuthError} status 0 + code "NETWORK_ERROR" si le backend est inaccessible
 *
 * @example
 * const tokens = await googleAuth(account.id_token)
 * // → { access_token: "eyJ...", refresh_token: "eyJ...", token_type: "bearer", expires_in: 1800 }
 */
export async function googleAuth(googleToken: string): Promise<TokenResponse> {
  try {
    const res = await fetch(
      `${getApiUrl()}/api/v1/auth/google`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ google_token: googleToken }),
      }
    );
    return handleResponse<TokenResponse>(res);
  } catch (err) {
    if (err instanceof ApiAuthError) throw err;
    throw new ApiAuthError("Erreur réseau", 0, "NETWORK_ERROR");
  }
}

/**
 * Rafraîchit le couple access/refresh token via POST /api/v1/auth/refresh.
 *
 * Le backend implémente la rotation des refresh tokens : le token transmis
 * est invalidé et un nouveau couple est émis. Ne pas réutiliser l'ancien
 * refresh token après cet appel.
 *
 * @param refreshToken Refresh token actuel (obtenu lors du login ou du dernier refresh)
 * @returns Nouveau TokenResponse avec un nouveau couple access/refresh
 *
 * @throws {ApiAuthError} status 401 si le refresh token est expiré ou révoqué
 * @throws {ApiAuthError} status 0 + code "NETWORK_ERROR" si le backend est inaccessible
 *
 * @example
 * const newTokens = await refreshTokens(currentRefreshToken)
 * // → { access_token: "eyJ...", refresh_token: "eyJ...", token_type: "bearer", expires_in: 1800 }
 */
export async function refreshTokens(
  refreshToken: string
): Promise<TokenResponse> {
  try {
    const res = await fetch(
      `${getApiUrl()}/api/v1/auth/refresh`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${refreshToken}`,
        },
      }
    );
    return handleResponse<TokenResponse>(res);
  } catch (err) {
    if (err instanceof ApiAuthError) throw err;
    throw new ApiAuthError("Erreur réseau", 0, "NETWORK_ERROR");
  }
}

/**
 * Récupère le profil de l'utilisateur connecté via GET /api/v1/auth/me.
 *
 * @param accessToken Access token BrightOff valide
 * @returns UserMeResponse avec les informations du compte
 *
 * @throws {ApiAuthError} status 401 si l'access token est invalide ou expiré
 * @throws {ApiAuthError} status 0 + code "NETWORK_ERROR" si le backend est inaccessible
 *
 * @example
 * const user = await getMe(session.backendToken)
 * // → { id: "uuid...", email: "alice@example.com", is_active: true, created_at: "2024-01-15T10:00:00Z" }
 */
export async function getMe(accessToken: string): Promise<UserMeResponse> {
  try {
    const res = await fetch(
      `${getApiUrl()}/api/v1/auth/me`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );
    return handleResponse<UserMeResponse>(res);
  } catch (err) {
    if (err instanceof ApiAuthError) throw err;
    throw new ApiAuthError("Erreur réseau", 0, "NETWORK_ERROR");
  }
}
