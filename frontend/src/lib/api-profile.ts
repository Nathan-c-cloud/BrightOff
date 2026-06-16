/**
 * Module client API pour les endpoints profil BrightOff.
 *
 * Usage côté client uniquement (Client Component) — nécessite le token
 * Auth.js accessible via useSession().
 *
 * Base URL : NEXT_PUBLIC_API_URL (ex: http://localhost:8000)
 * Endpoints : GET /api/v1/profile/me, PUT /api/v1/profile/me
 */

// ---------------------------------------------------------------------------
// Types domaine
// ---------------------------------------------------------------------------

// Catégories alignées avec le backend (S3-16, QO-1) — valeurs françaises du CV parser.
// "technique" + "outil" = hard skills UI. "soft_skill" = soft skills UI.
export type DbSkillCategory = "technique" | "outil" | "soft_skill";

/** @deprecated Utiliser DbSkillCategory — conservé temporairement pour compatibilité tests existants */
export type SkillCategory = DbSkillCategory;

export type LanguageLevel =
  | "A1"
  | "A2"
  | "B1"
  | "B2"
  | "C1"
  | "C2"
  | "Natif"
  | "Bilingue";

export interface Skill {
  id: string;
  name: string;
  category: DbSkillCategory;
  level: number | null;
}

export interface Experience {
  id: string;
  company: string;
  position: string;
  start_date: string; // ISO date "YYYY-MM-DD"
  end_date: string | null;
  description: string | null;
}

export interface Education {
  id: string;
  school: string;
  degree: string;
  field: string | null;
  start_date: string;
  end_date: string | null;
}

export interface Language {
  id: string;
  name: string;
  level: string;
}

export interface ProfileData {
  id: string;
  title: string | null;
  summary: string | null;
  // years_of_experience absent de l'API depuis S3-16 (conservé en BDD, pas dans la réponse)
  skills: Skill[];
  experiences: Experience[];
  educations: Education[];
  languages: Language[];
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Payloads d'écriture (sans id — générés côté backend)
// ---------------------------------------------------------------------------

export interface SkillPayload {
  name: string;
  category: DbSkillCategory;
  level: number | null;
}

export interface ExperiencePayload {
  company: string;
  position: string;
  start_date: string;
  end_date: string | null;
  description: string | null;
}

export interface EducationPayload {
  school: string;
  degree: string;
  field: string | null;
  start_date: string;
  end_date: string | null;
}

export interface LanguagePayload {
  name: string;
  level: string;
}

export interface ProfileUpdatePayload {
  title: string | null;
  summary: string | null;
  // years_of_experience absent du payload depuis S3-16
  skills: SkillPayload[];
  experiences: ExperiencePayload[];
  educations: EducationPayload[];
  languages: LanguagePayload[];
}

// ---------------------------------------------------------------------------
// Erreur typée
// ---------------------------------------------------------------------------

/** Erreur FastAPI 422 — un champ spécifique est invalide. */
export interface ValidationIssue {
  loc: (string | number)[];
  msg: string;
  type: string;
}

export class ApiProfileError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    /** Issues de validation (422 uniquement). */
    public readonly issues?: ValidationIssue[]
  ) {
    super(message);
    this.name = "ApiProfileError";
  }
}

// ---------------------------------------------------------------------------
// Helpers internes
// ---------------------------------------------------------------------------

function getApiUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
}

/**
 * Traite une Response HTTP et lève ApiProfileError si non-ok.
 * Sur 422, extrait le tableau `detail` de validation FastAPI.
 */
async function handleResponse<T>(res: Response): Promise<T> {
  if (res.ok) {
    return res.json() as Promise<T>;
  }

  // Tenter de parser le body JSON (FastAPI renvoie toujours du JSON)
  let detail = `HTTP ${res.status}`;
  let issues: ValidationIssue[] | undefined;

  try {
    const body = (await res.json()) as
      | { detail?: string | ValidationIssue[] }
      | undefined;

    if (body?.detail) {
      if (typeof body.detail === "string") {
        detail = body.detail;
      } else if (Array.isArray(body.detail)) {
        // 422 FastAPI : detail est un tableau de ValidationError
        issues = body.detail as ValidationIssue[];
        detail = issues.map((i) => i.msg).join(", ");
      }
    }
  } catch {
    // Body non-JSON — on garde le message générique
  }

  throw new ApiProfileError(detail, res.status, issues);
}

// ---------------------------------------------------------------------------
// Fonctions exportées
// ---------------------------------------------------------------------------

/**
 * Récupère le profil complet de l'utilisateur connecté.
 *
 * @param accessToken  Bearer token BrightOff (session.backendToken)
 * @returns ProfileData avec toutes les collections
 *
 * @throws {ApiProfileError} status 401 si token invalide ou expiré
 * @throws {ApiProfileError} status 404 si le profil n'existe pas encore
 * @throws {ApiProfileError} status 0 si réseau indisponible
 */
export async function getMyProfile(accessToken: string): Promise<ProfileData> {
  try {
    const res = await fetch(`${getApiUrl()}/api/v1/profile/me`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    return handleResponse<ProfileData>(res);
  } catch (err) {
    if (err instanceof ApiProfileError) throw err;
    throw new ApiProfileError("Erreur réseau", 0);
  }
}

/**
 * Met à jour le profil complet de l'utilisateur connecté (remplacement total).
 *
 * @param accessToken  Bearer token BrightOff (session.backendToken)
 * @param payload      Données complètes du profil (collections incluses)
 * @returns ProfileData mis à jour (avec nouveaux IDs pour les collections)
 *
 * @throws {ApiProfileError} status 401 si token invalide ou expiré
 * @throws {ApiProfileError} status 404 si le profil n'existe pas encore
 * @throws {ApiProfileError} status 422 avec `issues` si données invalides
 * @throws {ApiProfileError} status 0 si réseau indisponible
 */
export async function updateMyProfile(
  accessToken: string,
  payload: ProfileUpdatePayload
): Promise<ProfileData> {
  try {
    const res = await fetch(`${getApiUrl()}/api/v1/profile/me`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(payload),
    });
    return handleResponse<ProfileData>(res);
  } catch (err) {
    if (err instanceof ApiProfileError) throw err;
    throw new ApiProfileError("Erreur réseau", 0);
  }
}
