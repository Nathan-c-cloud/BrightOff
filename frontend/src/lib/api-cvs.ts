/**
 * Module client API pour les endpoints CV BrightOff.
 *
 * Usage côté client uniquement (Client Component) car :
 *   - uploadCv() utilise XMLHttpRequest pour la progression réelle
 *   - getCv() requiert le token Auth.js accessible via useSession()
 *
 * Base URL : NEXT_PUBLIC_API_URL (ex: http://localhost:8000)
 * Endpoints : POST /api/v1/cvs/upload, GET /api/v1/cvs/{cv_id}
 */

/** Réponse de POST /api/v1/cvs/upload */
export interface CvUploadResponse {
  id: string;
  filename: string;
  status: string;
  uploaded_at: string;
}

/** Réponse de GET /api/v1/cvs/{cv_id} */
export interface CvStatusResponse {
  id: string;
  original_filename: string;
  file_format: string;
  parsing_status: "uploading" | "parsing" | "ready" | "failed";
  created_at: string;
  parsed_at: string | null;
}

/**
 * Erreur typée levée par les helpers de ce module.
 *
 * - `status === 0` → erreur réseau ou XHR annulé
 * - `status >= 400` → réponse HTTP d'erreur du backend
 * - `code === "NETWORK_ERROR"` → cas réseau uniquement
 */
export class ApiCvsError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string
  ) {
    super(message);
    this.name = "ApiCvsError";
  }
}

// ---------------------------------------------------------------------------
// Helpers internes
// ---------------------------------------------------------------------------

function getApiUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
}

/**
 * Traite une Response HTTP et lève ApiCvsError si non-ok.
 * Tente de parser le champ `detail` du JSON d'erreur FastAPI.
 */
async function handleResponse<T>(res: Response): Promise<T> {
  if (res.ok) {
    return res.json() as Promise<T>;
  }

  let detail = `HTTP ${res.status}`;
  try {
    const body = (await res.json()) as { detail?: string };
    if (typeof body.detail === "string" && body.detail.length > 0) {
      detail = body.detail;
    }
  } catch {
    // Body non-JSON — on garde le message générique
  }

  throw new ApiCvsError(detail, res.status);
}

/**
 * Traduit les codes d'erreur HTTP en messages lisibles pour l'utilisateur.
 */
export function resolveUploadError(error: ApiCvsError): string {
  switch (error.status) {
    case 0:
      return "Impossible de contacter le serveur. Vérifiez votre connexion.";
    case 401:
      return "Session expirée. Veuillez vous reconnecter.";
    case 413:
      return "Le fichier est trop volumineux (5 MB maximum).";
    case 415:
      return "Format non supporté. Utilisez un fichier PDF ou DOCX.";
    case 429:
      return "Trop d'uploads récents. Réessayez dans 24 heures.";
    default:
      return "Une erreur est survenue lors de l'upload. Réessayez.";
  }
}

// ---------------------------------------------------------------------------
// Fonctions exportées
// ---------------------------------------------------------------------------

/**
 * Upload un CV via XMLHttpRequest pour suivre la progression réelle.
 *
 * fetch() ne supporte pas la progression d'upload nativement — XHR est
 * nécessaire pour alimenter la barre de progression.
 *
 * @param file           Fichier à uploader (PDF ou DOCX, max 5 MB)
 * @param accessToken    Bearer token BrightOff (session.backendToken)
 * @param onProgress     Callback appelé avec la progression 0-100 à chaque tick XHR
 * @returns CvUploadResponse contenant l'id et le statut initial
 *
 * @throws {ApiCvsError} status 413 si > 5 MB
 * @throws {ApiCvsError} status 415 si format non supporté
 * @throws {ApiCvsError} status 429 si rate limit atteint
 * @throws {ApiCvsError} status 0 + code "NETWORK_ERROR" si réseau indisponible
 */
export function uploadCv(
  file: File,
  accessToken: string,
  onProgress?: (percent: number) => void
): Promise<CvUploadResponse> {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append("file", file);

    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable && onProgress) {
        const percent = Math.round((event.loaded / event.total) * 100);
        onProgress(percent);
      }
    });

    xhr.addEventListener("load", async () => {
      try {
        if (xhr.status >= 200 && xhr.status < 300) {
          const data = JSON.parse(xhr.responseText) as CvUploadResponse;
          resolve(data);
        } else {
          let detail = `HTTP ${xhr.status}`;
          try {
            const body = JSON.parse(xhr.responseText) as { detail?: string };
            if (typeof body.detail === "string" && body.detail.length > 0) {
              detail = body.detail;
            }
          } catch {
            // Response non-JSON
          }
          reject(new ApiCvsError(detail, xhr.status));
        }
      } catch {
        reject(new ApiCvsError("Réponse invalide du serveur", 0, "PARSE_ERROR"));
      }
    });

    xhr.addEventListener("error", () => {
      reject(new ApiCvsError("Erreur réseau", 0, "NETWORK_ERROR"));
    });

    xhr.addEventListener("abort", () => {
      reject(new ApiCvsError("Upload annulé", 0, "ABORTED"));
    });

    xhr.open("POST", `${getApiUrl()}/api/v1/cvs/upload`);
    xhr.setRequestHeader("Authorization", `Bearer ${accessToken}`);
    xhr.send(formData);
  });
}

/**
 * Récupère le statut d'un CV via GET /api/v1/cvs/{cv_id}.
 *
 * Utilisé par le polling (toutes les 2s) jusqu'à ce que parsing_status
 * soit "ready" ou "failed".
 *
 * @param cvId        UUID du CV retourné par uploadCv
 * @param accessToken Bearer token BrightOff (session.backendToken)
 * @returns CvStatusResponse avec le statut courant
 *
 * @throws {ApiCvsError} status 401 si token invalide ou expiré
 * @throws {ApiCvsError} status 403 si le CV appartient à un autre utilisateur
 * @throws {ApiCvsError} status 404 si le CV n'existe pas
 * @throws {ApiCvsError} status 0 + code "NETWORK_ERROR" si réseau indisponible
 */
export async function getCv(
  cvId: string,
  accessToken: string
): Promise<CvStatusResponse> {
  try {
    const res = await fetch(`${getApiUrl()}/api/v1/cvs/${cvId}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    return handleResponse<CvStatusResponse>(res);
  } catch (err) {
    if (err instanceof ApiCvsError) throw err;
    throw new ApiCvsError("Erreur réseau", 0, "NETWORK_ERROR");
  }
}
