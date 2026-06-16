/**
 * Tests unitaires — CvStatusBanner
 *
 * Couvre :
 *   - Render des 4 états visibles (no-cv, parsing, ready, failed)
 *   - État "loading" → rendu null (rien dans le DOM)
 *   - Clic sur "Voir mon profil" (état ready) → navigation vers /profile
 *   - Clic sur "Réessayer" (état failed) → navigation vers /onboarding
 *   - États timeout/error → rendu null
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CvStatusBanner } from "./CvStatusBanner";
import type { LatestCvState } from "@/hooks/useLatestCvPolling";
import type { CvListItem } from "@/lib/api-cvs";

// ---------------------------------------------------------------------------
// Mock next/navigation
// ---------------------------------------------------------------------------

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCvListItem(
  parsing_status: CvListItem["parsing_status"]
): CvListItem {
  return {
    id: "cv-uuid-1",
    filename: "cv.pdf",
    file_format: "pdf",
    parsing_status,
    uploaded_at: new Date().toISOString(),
    parsed_at: null,
  };
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("CvStatusBanner", () => {
  // -------------------------------------------------------------------------
  // État loading → null
  // -------------------------------------------------------------------------

  it("renders_nothing_when_state_is_loading", () => {
    const { container } = render(
      <CvStatusBanner state={{ phase: "loading" }} />
    );
    expect(container.firstChild).toBeNull();
  });

  // -------------------------------------------------------------------------
  // État no-cv
  // -------------------------------------------------------------------------

  it("renders_import_cta_when_state_is_no_cv", () => {
    render(<CvStatusBanner state={{ phase: "no-cv" }} />);

    expect(
      screen.getByText("Votre profil n'est pas encore configuré")
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /importer mon cv/i })
    ).toBeInTheDocument();
  });

  it("navigates_to_onboarding_when_clicking_importer_from_no_cv", async () => {
    const user = userEvent.setup();

    render(<CvStatusBanner state={{ phase: "no-cv" }} />);

    await user.click(screen.getByRole("button", { name: /importer mon cv/i }));

    expect(mockPush).toHaveBeenCalledWith("/onboarding");
  });

  // -------------------------------------------------------------------------
  // État parsing
  // -------------------------------------------------------------------------

  it("renders_spinner_and_message_when_state_is_parsing", () => {
    const state: LatestCvState = {
      phase: "parsing",
      cv: makeCvListItem("parsing"),
    };

    render(<CvStatusBanner state={state} />);

    expect(screen.getByText("On analyse ton CV...")).toBeInTheDocument();
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // État ready
  // -------------------------------------------------------------------------

  it("renders_success_message_and_profile_cta_when_state_is_ready", () => {
    const state: LatestCvState = {
      phase: "ready",
      cv: makeCvListItem("ready"),
    };

    render(<CvStatusBanner state={state} />);

    expect(screen.getByText("Ton profil est prêt !")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /voir mon profil/i })
    ).toBeInTheDocument();
  });

  it("navigates_to_profile_when_clicking_voir_mon_profil", async () => {
    const user = userEvent.setup();
    const state: LatestCvState = {
      phase: "ready",
      cv: makeCvListItem("ready"),
    };

    render(<CvStatusBanner state={state} />);

    await user.click(screen.getByRole("button", { name: /voir mon profil/i }));

    expect(mockPush).toHaveBeenCalledWith("/profile");
  });

  // -------------------------------------------------------------------------
  // État failed
  // -------------------------------------------------------------------------

  it("renders_error_message_and_retry_cta_when_state_is_failed", () => {
    const state: LatestCvState = {
      phase: "failed",
      cv: makeCvListItem("failed"),
    };

    render(<CvStatusBanner state={state} />);

    expect(screen.getByText("L'analyse a échoué")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /réessayer/i })
    ).toBeInTheDocument();
  });

  it("navigates_to_onboarding_when_clicking_retry", async () => {
    const user = userEvent.setup();
    const state: LatestCvState = {
      phase: "failed",
      cv: makeCvListItem("failed"),
    };

    render(<CvStatusBanner state={state} />);

    await user.click(screen.getByRole("button", { name: /réessayer/i }));

    expect(mockPush).toHaveBeenCalledWith("/onboarding");
  });

  // -------------------------------------------------------------------------
  // États timeout et error → null
  // -------------------------------------------------------------------------

  it("renders_nothing_when_state_is_timeout", () => {
    const { container } = render(
      <CvStatusBanner state={{ phase: "timeout" }} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders_nothing_when_state_is_error", () => {
    const { container } = render(
      <CvStatusBanner state={{ phase: "error", message: "Erreur réseau" }} />
    );
    expect(container.firstChild).toBeNull();
  });
});
