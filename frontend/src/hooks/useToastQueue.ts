"use client";

/**
 * Hook useToastQueue — file d'attente de notifications Toast.
 *
 * Résout le problème d'écrasement de toast : si un 2e toast est déclenché
 * alors qu'un 1er est encore affiché, il est mis en file d'attente et
 * s'affiche automatiquement après la fermeture du précédent.
 *
 * Usage :
 *   const { current, enqueue, close } = useToastQueue();
 *   enqueue("Profil sauvegardé", "success");
 *   <Toast message={current.message} variant={current.variant} onClose={close} />
 */

import { useState, useCallback, useRef } from "react";

export type ToastVariant = "success" | "error";

export interface ToastItem {
  id: string;
  message: string;
  variant: ToastVariant;
}

export interface UseToastQueueReturn {
  /** Toast actuellement affiché, null si aucun. */
  current: ToastItem | null;
  /** Ajoute un toast en file d'attente (ou l'affiche immédiatement si la file est vide). */
  enqueue: (message: string, variant: ToastVariant) => void;
  /** Ferme le toast courant et passe au suivant en file. */
  close: () => void;
}

export function useToastQueue(): UseToastQueueReturn {
  const [current, setCurrent] = useState<ToastItem | null>(null);
  // queue est une ref (pas un state) car ses mutations ne doivent pas déclencher de re-render
  const queue = useRef<ToastItem[]>([]);

  const enqueue = useCallback(
    (message: string, variant: ToastVariant) => {
      const item: ToastItem = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        message,
        variant,
      };
      // Accès à la valeur courante via le setter fonctionnel pour éviter la stale closure
      setCurrent((prev) => {
        if (prev === null) {
          // File vide : affichage immédiat
          return item;
        }
        // Toast déjà affiché : mise en file d'attente
        queue.current.push(item);
        return prev;
      });
    },
    []
  );

  const close = useCallback(() => {
    const next = queue.current.shift() ?? null;
    setCurrent(next);
  }, []);

  return { current, enqueue, close };
}
