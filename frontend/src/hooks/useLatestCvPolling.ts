/**
 * Hook useLatestCvPolling — orchestrateur dashboard pour le polling du CV le plus récent.
 *
 * Au montage, récupère la liste des CVs via listMyCvs() et sélectionne le plus récent.
 * Si son statut est non-terminal (uploading/parsing), démarre le polling via useCvPolling.
 * Si son statut est déjà terminal (ready/failed), expose l'état directement sans polling.
 *
 * Callbacks onReady/onFailed permettent au composant parent de déclencher
 * les toasts de notification sans coupler ce hook aux détails d'UI.
 *
 * Contraintes respectées :
 *   - Pas de stockage local : re-fetch à chaque montage
 *   - Timeout 2 min identique à /onboarding (géré par useCvPolling)
 *   - Ne modifie pas useCvPolling (extension par composition)
 */

import { useEffect, useState } from "react";
import { listMyCvs, ApiCvsError } from "@/lib/api-cvs";
import type { CvListItem } from "@/lib/api-cvs";
import { useCvPolling } from "./useCvPolling";
import type { CvStatusResponse } from "@/lib/api-cvs";

/** Statuts non-terminaux : le polling doit continuer. */
const NON_TERMINAL_STATUSES = new Set(["uploading", "parsing"]);

/** État exposé par le hook au composant parent. */
export type LatestCvState =
  | { phase: "loading" }
  | { phase: "no-cv" }
  | { phase: "parsing"; cv: CvListItem }
  | { phase: "ready"; cv: CvListItem }
  | { phase: "failed"; cv: CvListItem }
  | { phase: "timeout" }
  | { phase: "error"; message: string };

export interface UseLatestCvPollingOptions {
  /** Bearer token BrightOff. Null désactive le hook. */
  accessToken: string | null;
  /** Appelé quand le parsing passe à "ready" pendant le polling actif. */
  onReady: (cv: CvStatusResponse) => void;
  /** Appelé quand le parsing passe à "failed" pendant le polling actif. */
  onFailed: () => void;
  /** Appelé si le polling dépasse 2 min sans résultat terminal. */
  onTimeout: () => void;
}

/**
 * Orchestre la détection du dernier CV en cours de parsing au montage du dashboard.
 *
 * @example
 * const { state } = useLatestCvPolling({
 *   accessToken: session?.backendToken ?? null,
 *   onReady: (cv) => showToast("success"),
 *   onFailed: () => showToast("error"),
 *   onTimeout: () => showToast("timeout"),
 * });
 */
export function useLatestCvPolling({
  accessToken,
  onReady,
  onFailed,
  onTimeout,
}: UseLatestCvPollingOptions): { state: LatestCvState } {
  const [state, setState] = useState<LatestCvState>({ phase: "loading" });

  // L'id du CV à poller — null si pas de CV non-terminal ou si état déjà terminal
  const [pollingCvId, setPollingCvId] = useState<string | null>(null);

  // Fetch initial au montage
  useEffect(() => {
    if (!accessToken) {
      setState({ phase: "no-cv" });
      return;
    }

    let cancelled = false;

    async function fetchLatestCv() {
      try {
        const list = await listMyCvs(accessToken!);

        if (cancelled) return;

        if (list.items.length === 0) {
          setState({ phase: "no-cv" });
          return;
        }

        // Le backend trie déjà DESC par created_at — le premier est le plus récent
        const latest = list.items[0];

        if (NON_TERMINAL_STATUSES.has(latest.parsing_status)) {
          // Statut non-terminal : on affiche la bannière "parsing" et on démarre le polling
          setState({ phase: "parsing", cv: latest });
          setPollingCvId(latest.id);
        } else if (latest.parsing_status === "ready") {
          setState({ phase: "ready", cv: latest });
          // Pas de polling nécessaire
        } else {
          // failed
          setState({ phase: "failed", cv: latest });
        }
      } catch (err) {
        if (cancelled) return;
        const message =
          err instanceof ApiCvsError ? err.message : "Erreur de chargement";
        setState({ phase: "error", message });
      }
    }

    fetchLatestCv();

    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  // Polling actif uniquement si un CV non-terminal a été détecté
  useCvPolling({
    cvId: pollingCvId,
    accessToken,
    onReady: (cv) => {
      // Mettre à jour l'état local ET notifier le parent pour le toast
      setState((prev) => {
        if (prev.phase === "parsing") {
          return { phase: "ready", cv: prev.cv };
        }
        return prev;
      });
      setPollingCvId(null);
      onReady(cv);
    },
    onFailed: () => {
      setState((prev) => {
        if (prev.phase === "parsing") {
          return { phase: "failed", cv: prev.cv };
        }
        return prev;
      });
      setPollingCvId(null);
      onFailed();
    },
    onTimeout: () => {
      setState({ phase: "timeout" });
      setPollingCvId(null);
      onTimeout();
    },
    onError: (err) => {
      setState({ phase: "error", message: err.message });
      setPollingCvId(null);
    },
  });

  return { state };
}
