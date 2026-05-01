/**
 * Tests unitaires — NavApp
 *
 * next/image est mocké (utilisé par Logo en mode standard — ici on passe variant="white"
 * mais le mock reste pour être safe si Logo est modifié).
 * next/link est réel — renvoie un <a> dans jsdom.
 * userEvent est utilisé pour les interactions utilisateur réalistes.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NavApp } from "./NavApp";

// Mock next/image
vi.mock("next/image", () => ({
  default: ({
    src,
    alt,
    width,
    height,
    style,
    ...rest
  }: {
    src: string;
    alt: string;
    width?: number;
    height?: number;
    style?: React.CSSProperties;
    [key: string]: unknown;
  }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} width={width} height={height} style={style} {...rest} />
  ),
}));

const DEFAULT_PROPS = {
  userName: "Thomas D.",
  userInitials: "TD",
  onLogout: vi.fn(),
};

describe("NavApp", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --- Structure de base ---

  it("renders_logo_white", () => {
    render(<NavApp {...DEFAULT_PROPS} />);
    // Logo white = SVG avec texte "BrightOff"
    expect(screen.getByText("BrightOff")).toBeInTheDocument();
  });

  it("renders_default_navigation_links", () => {
    render(<NavApp {...DEFAULT_PROPS} />);
    expect(screen.getByRole("link", { name: "Dashboard" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Mon profil" })).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Candidatures" })
    ).toBeInTheDocument();
  });

  it("renders_bell_button", () => {
    render(<NavApp {...DEFAULT_PROPS} />);
    expect(
      screen.getByRole("button", { name: "Notifications" })
    ).toBeInTheDocument();
  });

  it("renders_user_initials_in_avatar", () => {
    render(<NavApp {...DEFAULT_PROPS} />);
    expect(screen.getByText("TD")).toBeInTheDocument();
  });

  it("renders_username", () => {
    render(<NavApp {...DEFAULT_PROPS} />);
    expect(screen.getByText("Thomas D.")).toBeInTheDocument();
  });

  // --- État actif des liens ---

  it("applies_active_class_to_matching_link", () => {
    render(<NavApp {...DEFAULT_PROPS} activeLinkId="profile" />);
    const profileLink = screen.getByRole("link", { name: "Mon profil" });
    expect(profileLink.className).toContain("active");
  });

  it("does_not_apply_active_class_to_other_links", () => {
    render(<NavApp {...DEFAULT_PROPS} activeLinkId="profile" />);
    const dashboardLink = screen.getByRole("link", { name: "Dashboard" });
    expect(dashboardLink.className).not.toContain("active");
  });

  // --- Badge notifications ---

  it("shows_badge_when_unread_notifications_gt_zero", () => {
    render(<NavApp {...DEFAULT_PROPS} unreadNotifications={3} />);
    // Le badge est aria-hidden mais visible dans le DOM
    const badge = document.querySelector(".bell-badge");
    expect(badge).toBeInTheDocument();
    expect(badge?.textContent).toBe("3");
  });

  it("does_not_show_badge_when_unread_notifications_is_zero", () => {
    render(<NavApp {...DEFAULT_PROPS} unreadNotifications={0} />);
    expect(document.querySelector(".bell-badge")).not.toBeInTheDocument();
  });

  it("does_not_show_badge_by_default", () => {
    render(<NavApp {...DEFAULT_PROPS} />);
    expect(document.querySelector(".bell-badge")).not.toBeInTheDocument();
  });

  it("bell_aria_label_mentions_count_when_notifications_present", () => {
    render(<NavApp {...DEFAULT_PROPS} unreadNotifications={5} />);
    expect(
      screen.getByRole("button", { name: /5 notifications non lues/i })
    ).toBeInTheDocument();
  });

  // --- Dropdown utilisateur ---

  it("dropdown_is_closed_by_default", () => {
    render(<NavApp {...DEFAULT_PROPS} />);
    expect(
      screen.queryByRole("button", { name: "Se déconnecter" })
    ).not.toBeInTheDocument();
  });

  it("click_on_user_meta_opens_dropdown", async () => {
    const user = userEvent.setup();
    render(<NavApp {...DEFAULT_PROPS} />);
    const userMetaButton = screen.getByRole("button", { name: /thomas d\./i });
    await user.click(userMetaButton);
    expect(
      screen.getByRole("button", { name: "Se déconnecter" })
    ).toBeInTheDocument();
  });

  it("click_on_logout_calls_onLogout", async () => {
    const user = userEvent.setup();
    const onLogout = vi.fn();
    render(<NavApp {...DEFAULT_PROPS} onLogout={onLogout} />);
    // Ouvrir le menu
    await user.click(screen.getByRole("button", { name: /thomas d\./i }));
    // Cliquer sur Se déconnecter
    await user.click(screen.getByRole("button", { name: "Se déconnecter" }));
    expect(onLogout).toHaveBeenCalledOnce();
  });

  it("click_outside_closes_dropdown", async () => {
    const user = userEvent.setup();
    render(<NavApp {...DEFAULT_PROPS} />);
    // Ouvrir
    await user.click(screen.getByRole("button", { name: /thomas d\./i }));
    expect(
      screen.getByRole("button", { name: "Se déconnecter" })
    ).toBeInTheDocument();
    // Cliquer ailleurs
    await user.click(document.body);
    expect(
      screen.queryByRole("button", { name: "Se déconnecter" })
    ).not.toBeInTheDocument();
  });

  it("escape_key_closes_dropdown", async () => {
    const user = userEvent.setup();
    render(<NavApp {...DEFAULT_PROPS} />);
    // Ouvrir
    await user.click(screen.getByRole("button", { name: /thomas d\./i }));
    expect(
      screen.getByRole("button", { name: "Se déconnecter" })
    ).toBeInTheDocument();
    // Escape
    await user.keyboard("{Escape}");
    expect(
      screen.queryByRole("button", { name: "Se déconnecter" })
    ).not.toBeInTheDocument();
  });

  // --- Liens custom ---

  it("renders_custom_links_when_provided", () => {
    const customLinks = [
      { id: "home", label: "Accueil", href: "/home" },
      { id: "settings", label: "Paramètres", href: "/settings" },
    ];
    render(<NavApp {...DEFAULT_PROPS} links={customLinks} />);
    expect(screen.getByRole("link", { name: "Accueil" })).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Paramètres" })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Dashboard" })
    ).not.toBeInTheDocument();
  });

  // --- Accessibilité ---

  it("user_meta_has_aria_haspopup_menu", () => {
    render(<NavApp {...DEFAULT_PROPS} />);
    const userMetaButton = screen.getByRole("button", { name: /thomas d\./i });
    expect(userMetaButton).toHaveAttribute("aria-haspopup", "menu");
  });

  it("user_meta_aria_expanded_reflects_open_state", async () => {
    const user = userEvent.setup();
    render(<NavApp {...DEFAULT_PROPS} />);
    const userMetaButton = screen.getByRole("button", { name: /thomas d\./i });
    expect(userMetaButton).toHaveAttribute("aria-expanded", "false");
    await user.click(userMetaButton);
    expect(userMetaButton).toHaveAttribute("aria-expanded", "true");
  });

  it("dropdown_panel_is_visible_when_open", async () => {
    const user = userEvent.setup();
    render(<NavApp {...DEFAULT_PROPS} />);
    await user.click(screen.getByRole("button", { name: /thomas d\./i }));
    // Le panel dropdown est visible — on vérifie la présence du bouton "Se déconnecter"
    expect(screen.getByRole("button", { name: "Se déconnecter" })).toBeInTheDocument();
  });
});
