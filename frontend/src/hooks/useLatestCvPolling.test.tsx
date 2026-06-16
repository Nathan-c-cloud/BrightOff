/**
 * Tests unitaires — useLatestCvPolling
 *
 * Couvre :
 *   - Pas de CV → état "no-cv", pas de polling lancé
 *   - CV en parsing au mount → polling démarre, onReady appelé quand status passe à ready
 *   - CV ready au mount → état "ready", pas de polling
 *   - CV failed au mount → état "failed", onFailed non appelé (état initial, pas de transition)
 *   - Transition parsing → failed pendant le polling → onFailed appelé
 *   - Token null → état "no-cv", listMyCvs non appelé
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useLatestCvPolling } from "./useLatestCvPolling";
import { ApiCvsError } from "@/lib/api-cvs";
import type { CvListItem, CvStatusResponse } from "@/lib/api-cvs";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockListMyCvs = vi.hoisted(() => vi.fn());
const mockGetCv = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api-cvs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-cvs")>();
  return {
    ...actual,
    listMyCvs: mockListMyCvs,
    getCv: mockGetCv,
  };
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeListItem(
  parsing_status: CvListItem["parsing_status"],
  id = "cv-uuid-1"
): CvListItem {
  return {
    id,
    filename: "cv.pdf",
    file_format: "pdf",
    parsing_status,
    uploaded_at: new Date().toISOString(),
    parsed_at: null,
  };
}

function makeCvStatus(
  parsing_status: CvStatusResponse["parsing_status"],
  id = "cv-uuid-1"
): CvStatusResponse {
  return {
    id,
    original_filename: "cv.pdf",
    file_format: "pdf",
    parsing_status,
    created_at: new Date().toISOString(),
    parsed_at: null,
  };
}

function defaultOptions(overrides = {}) {
  return {
    accessToken: "test-token",
    onReady: vi.fn(),
    onFailed: vi.fn(),
    onTimeout: vi.fn(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Setup
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

describe("useLatestCvPolling", () => {
  // -------------------------------------------------------------------------
  // Pas de CV
  // -------------------------------------------------------------------------

  it("sets_state_no_cv_when_list_is_empty", async () => {
    mockListMyCvs.mockResolvedValue({ items: [], total: 0 });
    const opts = defaultOptions();

    const { result } = renderHook(() => useLatestCvPolling(opts));

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.state.phase).toBe("no-cv");
    // Pas de polling démarré
    expect(mockGetCv).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Token null
  // -------------------------------------------------------------------------

  it("sets_state_no_cv_and_skips_fetch_when_token_is_null", async () => {
    const opts = defaultOptions({ accessToken: null });

    const { result } = renderHook(() => useLatestCvPolling(opts));

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.state.phase).toBe("no-cv");
    expect(mockListMyCvs).not.toHaveBeenCalled();
    expect(mockGetCv).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // CV en parsing → polling démarre → onReady
  // -------------------------------------------------------------------------

  it("starts_polling_and_calls_onReady_when_parsing_transitions_to_ready", async () => {
    mockListMyCvs.mockResolvedValue({
      items: [makeListItem("parsing")],
      total: 1,
    });
    mockGetCv.mockResolvedValue(makeCvStatus("ready"));

    const opts = defaultOptions();
    const { result } = renderHook(() => useLatestCvPolling(opts));

    // Attendre le fetch initial
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    // L'état passe en "parsing"
    expect(result.current.state.phase).toBe("parsing");

    // Avancer un tick de polling (2s)
    await act(async () => {
      vi.advanceTimersByTime(2000);
      await Promise.resolve();
      await Promise.resolve();
    });

    // getCv doit avoir été appelé
    expect(mockGetCv).toHaveBeenCalledWith("cv-uuid-1", "test-token");

    // onReady doit avoir été appelé
    expect(opts.onReady).toHaveBeenCalledOnce();
    expect(opts.onFailed).not.toHaveBeenCalled();

    // L'état local passe à "ready"
    expect(result.current.state.phase).toBe("ready");
  });

  // -------------------------------------------------------------------------
  // CV ready au mount → pas de polling
  // -------------------------------------------------------------------------

  it("sets_state_ready_without_polling_when_cv_is_already_ready", async () => {
    mockListMyCvs.mockResolvedValue({
      items: [makeListItem("ready")],
      total: 1,
    });

    const opts = defaultOptions();
    const { result } = renderHook(() => useLatestCvPolling(opts));

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.state.phase).toBe("ready");

    // Aucun polling déclenché
    await act(async () => {
      vi.advanceTimersByTime(6000);
      await Promise.resolve();
    });

    expect(mockGetCv).not.toHaveBeenCalled();
    expect(opts.onReady).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // CV failed au mount → état failed, onFailed non appelé (pas de transition)
  // -------------------------------------------------------------------------

  it("sets_state_failed_without_calling_onFailed_when_cv_is_already_failed", async () => {
    mockListMyCvs.mockResolvedValue({
      items: [makeListItem("failed")],
      total: 1,
    });

    const opts = defaultOptions();
    const { result } = renderHook(() => useLatestCvPolling(opts));

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.state.phase).toBe("failed");
    // onFailed ne doit PAS être appelé — c'est un état initial, pas une transition
    expect(opts.onFailed).not.toHaveBeenCalled();
    expect(mockGetCv).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Transition parsing → failed pendant le polling
  // -------------------------------------------------------------------------

  it("calls_onFailed_and_updates_state_when_parsing_transitions_to_failed", async () => {
    mockListMyCvs.mockResolvedValue({
      items: [makeListItem("parsing")],
      total: 1,
    });
    mockGetCv.mockResolvedValue(makeCvStatus("failed"));

    const opts = defaultOptions();
    const { result } = renderHook(() => useLatestCvPolling(opts));

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.state.phase).toBe("parsing");

    await act(async () => {
      vi.advanceTimersByTime(2000);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(opts.onFailed).toHaveBeenCalledOnce();
    expect(opts.onReady).not.toHaveBeenCalled();
    expect(result.current.state.phase).toBe("failed");
  });

  // -------------------------------------------------------------------------
  // Erreur réseau sur listMyCvs
  // -------------------------------------------------------------------------

  it("sets_state_error_when_listMyCvs_throws", async () => {
    mockListMyCvs.mockRejectedValue(new ApiCvsError("Erreur réseau", 0, "NETWORK_ERROR"));

    const opts = defaultOptions();
    const { result } = renderHook(() => useLatestCvPolling(opts));

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.state.phase).toBe("error");
  });
});
