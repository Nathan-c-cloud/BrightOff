/**
 * Hook useCvPolling — polling du statut d'un CV toutes les 2 secondes.
 *
 * Démarre dès que `cvId` et `accessToken` sont fournis.
 * S'arrête automatiquement quand :
 *   - parsing_status === "ready"
 *   - parsing_status === "failed"
 *   - Le timeout maximum est atteint (POLLING_TIMEOUT_MS)
 *   - Le composant est démonté (cleanup)
 *
 * Le hook communique l'état via les callbacks `onReady`, `onFailed`,
 * `onTimeout` et `onError` pour éviter de coupler la logique de polling
 * aux détails d'UI de la page.
 */

import { useEffect, useRef } from "react";
import { getCv, ApiCvsError } from "@/lib/api-cvs";
import type { CvStatusResponse } from "@/lib/api-cvs";

/** Intervalle entre chaque requête de polling (ms). */
const POLLING_INTERVAL_MS = 2000;

/** Durée maximale du polling avant déclenchement de onTimeout (ms). */
const POLLING_TIMEOUT_MS = 2 * 60 * 1000; // 2 minutes

export interface UseCvPollingOptions {
  /** UUID du CV à surveiller. Null désactive le polling. */
  cvId: string | null;
  /** Bearer token BrightOff pour authentifier les requêtes. */
  accessToken: string | null;
  /** Appelé quand parsing_status === "ready". Reçoit le CVStatusResponse complet. */
  onReady: (cv: CvStatusResponse) => void;
  /** Appelé quand parsing_status === "failed". */
  onFailed: () => void;
  /** Appelé si le polling dépasse POLLING_TIMEOUT_MS sans résultat terminal. */
  onTimeout: () => void;
  /** Appelé en cas d'erreur réseau ou HTTP inattendue. */
  onError: (error: ApiCvsError) => void;
}

/**
 * Lance un polling toutes les 2s sur GET /api/v1/cvs/{cvId}.
 *
 * @example
 * useCvPolling({
 *   cvId: uploadedCvId,
 *   accessToken: session?.backendToken ?? null,
 *   onReady: (cv) => router.push("/profile"),
 *   onFailed: () => setError("Parsing échoué"),
 *   onTimeout: () => setError("Délai dépassé"),
 *   onError: (err) => setError(err.message),
 * });
 */
export function useCvPolling({
  cvId,
  accessToken,
  onReady,
  onFailed,
  onTimeout,
  onError,
}: UseCvPollingOptions): void {
  // Refs pour éviter les stale closures dans setInterval sans re-créer l'intervalle
  const onReadyRef = useRef(onReady);
  const onFailedRef = useRef(onFailed);
  const onTimeoutRef = useRef(onTimeout);
  const onErrorRef = useRef(onError);

  // Mise à jour des refs après chaque render pour toujours avoir les dernières valeurs.
  // Placé dans un useEffect sans deps pour s'exécuter après le rendu (pas pendant).
  useEffect(() => {
    onReadyRef.current = onReady;
    onFailedRef.current = onFailed;
    onTimeoutRef.current = onTimeout;
    onErrorRef.current = onError;
  });

  useEffect(() => {
    // Polling désactivé si cvId ou accessToken absent
    if (!cvId || !accessToken) return;

    const startedAt = Date.now();
    let stopped = false;

    const intervalId = setInterval(async () => {
      // Vérification du timeout avant la requête
      if (Date.now() - startedAt >= POLLING_TIMEOUT_MS) {
        clearInterval(intervalId);
        if (!stopped) {
          stopped = true;
          onTimeoutRef.current();
        }
        return;
      }

      try {
        const cv = await getCv(cvId, accessToken);

        if (stopped) return;

        if (cv.parsing_status === "ready") {
          clearInterval(intervalId);
          stopped = true;
          onReadyRef.current(cv);
        } else if (cv.parsing_status === "failed") {
          clearInterval(intervalId);
          stopped = true;
          onFailedRef.current();
        }
        // Statuts "uploading" ou "parsing" → on continue le polling
      } catch (err) {
        if (stopped) return;
        clearInterval(intervalId);
        stopped = true;
        onErrorRef.current(
          err instanceof ApiCvsError
            ? err
            : new ApiCvsError("Erreur inattendue", 0)
        );
      }
    }, POLLING_INTERVAL_MS);

    // Cleanup au démontage : arrêt de l'intervalle sans déclencher les callbacks
    return () => {
      stopped = true;
      clearInterval(intervalId);
    };
  }, [cvId, accessToken]);
}
