/**
 * Tests unitaires — useCvPolling
 *
 * Couvre :
 *   - Polling appelle getCv toutes les 2s tant que status ∈ {uploading, parsing}
 *   - Polling s'arrête quand status === "ready" → onReady appelé
 *   - Polling s'arrête quand status === "failed" → onFailed appelé
 *   - Cleanup au démontage : pas de fuite setInterval
 *   - Timeout maximum → onTimeout appelé
 *   - Erreur réseau → onError appelé et polling stoppé
 *   - Polling désactivé si cvId ou accessToken est null
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useCvPolling } from "./useCvPolling";
import type { UseCvPollingOptions } from "./useCvPolling";
import { ApiCvsError } from "@/lib/api-cvs";
import type { CvStatusResponse } from "@/lib/api-cvs";

// ---------------------------------------------------------------------------
// Mock de api-cvs — getCv est le seul point d'entrée du hook vers l'extérieur
// ---------------------------------------------------------------------------

const mockGetCv = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api-cvs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-cvs")>();
  return {
    ...actual,
    getCv: mockGetCv,
  };
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCvStatus(
  parsing_status: CvStatusResponse["parsing_status"]
): CvStatusResponse {
  return {
    id: "cv-uuid-1",
    original_filename: "cv.pdf",
    file_format: "pdf",
    parsing_status,
    created_at: new Date().toISOString(),
    parsed_at: null,
  };
}

function defaultOptions(
  overrides: Partial<UseCvPollingOptions> = {}
): UseCvPollingOptions {
  return {
    cvId: "cv-uuid-1",
    accessToken: "test-token",
    onReady: vi.fn(),
    onFailed: vi.fn(),
    onTimeout: vi.fn(),
    onError: vi.fn(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Setup timers — on utilise les faux timers de Vitest pour contrôler setInterval
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useCvPolling", () => {
  // -------------------------------------------------------------------------
  // Cas nominal — passage par "parsing" puis "ready"
  // -------------------------------------------------------------------------

  it("calls_getCv_every_2_seconds_while_status_is_parsing", async () => {
    mockGetCv.mockResolvedValue(makeCvStatus("parsing"));
    const opts = defaultOptions();

    renderHook(() => useCvPolling(opts));

    // Avancer 3 intervalles de 2s = 6s → 3 appels
    await act(async () => {
      vi.advanceTimersByTime(6000);
      // Laisser les promises se résoudre
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockGetCv).toHaveBeenCalledTimes(3);
    expect(mockGetCv).toHaveBeenCalledWith("cv-uuid-1", "test-token");
  });

  it("stops_polling_and_calls_onReady_when_status_is_ready", async () => {
    // D'abord "parsing", puis "ready" au 2e tick
    mockGetCv
      .mockResolvedValueOnce(makeCvStatus("parsing"))
      .mockResolvedValueOnce(makeCvStatus("ready"));

    const opts = defaultOptions();
    renderHook(() => useCvPolling(opts));

    await act(async () => {
      vi.advanceTimersByTime(2000);
      await Promise.resolve();
      await Promise.resolve();
    });

    await act(async () => {
      vi.advanceTimersByTime(2000);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(opts.onReady).toHaveBeenCalledOnce();
    expect(opts.onFailed).not.toHaveBeenCalled();

    // Vérifier que le polling est arrêté — un tick supplémentaire ne doit pas appeler getCv
    const callsAfterReady = mockGetCv.mock.calls.length;
    await act(async () => {
      vi.advanceTimersByTime(2000);
      await Promise.resolve();
    });
    expect(mockGetCv.mock.calls.length).toBe(callsAfterReady);
  });

  it("stops_polling_and_calls_onFailed_when_status_is_failed", async () => {
    mockGetCv.mockResolvedValue(makeCvStatus("failed"));
    const opts = defaultOptions();

    renderHook(() => useCvPolling(opts));

    await act(async () => {
      vi.advanceTimersByTime(2000);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(opts.onFailed).toHaveBeenCalledOnce();
    expect(opts.onReady).not.toHaveBeenCalled();

    // Aucun appel supplémentaire après l'arrêt
    const callsAfterFailed = mockGetCv.mock.calls.length;
    await act(async () => {
      vi.advanceTimersByTime(4000);
      await Promise.resolve();
    });
    expect(mockGetCv.mock.calls.length).toBe(callsAfterFailed);
  });

  // -------------------------------------------------------------------------
  // Cleanup au démontage
  // -------------------------------------------------------------------------

  it("clears_interval_on_unmount_without_calling_callbacks", async () => {
    mockGetCv.mockResolvedValue(makeCvStatus("parsing"));
    const opts = defaultOptions();

    const { unmount } = renderHook(() => useCvPolling(opts));

    // Avancer 1 tick
    await act(async () => {
      vi.advanceTimersByTime(2000);
      await Promise.resolve();
    });

    // Démonter le composant
    unmount();

    // Avancer plusieurs ticks supplémentaires
    const callsAtUnmount = mockGetCv.mock.calls.length;
    await act(async () => {
      vi.advanceTimersByTime(10000);
      await Promise.resolve();
    });

    // Aucun appel supplémentaire après démontage
    expect(mockGetCv.mock.calls.length).toBe(callsAtUnmount);
    // Les callbacks ne doivent PAS avoir été appelés
    expect(opts.onReady).not.toHaveBeenCalled();
    expect(opts.onFailed).not.toHaveBeenCalled();
    expect(opts.onTimeout).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Timeout
  // -------------------------------------------------------------------------

  it("calls_onTimeout_after_2_minutes_without_terminal_status", async () => {
    mockGetCv.mockResolvedValue(makeCvStatus("parsing"));
    const opts = defaultOptions();

    renderHook(() => useCvPolling(opts));

    // Avancer 2 minutes + 1 tick (le timeout est vérifié avant la requête)
    await act(async () => {
      vi.advanceTimersByTime(2 * 60 * 1000 + 2000);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(opts.onTimeout).toHaveBeenCalledOnce();
    expect(opts.onReady).not.toHaveBeenCalled();
    expect(opts.onFailed).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Erreur réseau
  // -------------------------------------------------------------------------

  it("calls_onError_and_stops_polling_on_network_error", async () => {
    const networkError = new ApiCvsError("Erreur réseau", 0, "NETWORK_ERROR");
    mockGetCv.mockRejectedValue(networkError);
    const opts = defaultOptions();

    renderHook(() => useCvPolling(opts));

    await act(async () => {
      vi.advanceTimersByTime(2000);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(opts.onError).toHaveBeenCalledOnce();
    expect(opts.onError).toHaveBeenCalledWith(networkError);

    // Pas d'appels supplémentaires
    const callsAfterError = mockGetCv.mock.calls.length;
    await act(async () => {
      vi.advanceTimersByTime(4000);
      await Promise.resolve();
    });
    expect(mockGetCv.mock.calls.length).toBe(callsAfterError);
  });

  // -------------------------------------------------------------------------
  // Désactivation du polling
  // -------------------------------------------------------------------------

  it("does_not_start_polling_when_cvId_is_null", async () => {
    const opts = defaultOptions({ cvId: null });
    renderHook(() => useCvPolling(opts));

    await act(async () => {
      vi.advanceTimersByTime(10000);
      await Promise.resolve();
    });

    expect(mockGetCv).not.toHaveBeenCalled();
  });

  it("does_not_start_polling_when_accessToken_is_null", async () => {
    const opts = defaultOptions({ accessToken: null });
    renderHook(() => useCvPolling(opts));

    await act(async () => {
      vi.advanceTimersByTime(10000);
      await Promise.resolve();
    });

    expect(mockGetCv).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Continue le polling en status "uploading"
  // -------------------------------------------------------------------------

  it("continues_polling_while_status_is_uploading", async () => {
    mockGetCv.mockResolvedValue(makeCvStatus("uploading"));
    const opts = defaultOptions();

    renderHook(() => useCvPolling(opts));

    await act(async () => {
      vi.advanceTimersByTime(6000);
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    // Au moins 3 appels = polling actif
    expect(mockGetCv.mock.calls.length).toBeGreaterThanOrEqual(3);
    expect(opts.onReady).not.toHaveBeenCalled();
    expect(opts.onFailed).not.toHaveBeenCalled();
  });
});
