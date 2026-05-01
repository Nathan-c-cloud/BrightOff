/* Shared components: Logo, Navbars */

const Logo = ({ white = false, size = 22 }) => (
  <span className={"logo" + (white ? " white" : "")} style={{ fontSize: size }}>
    <span className="grad">Br</span>
    <span style={{ position: "relative", display: "inline-flex", alignItems: "center" }}>
      <span className={white ? "" : "grad"} style={{ color: white ? "white" : undefined }}>i</span>
      <svg
        className="bulb"
        viewBox="0 0 24 24"
        style={{
          position: "absolute",
          top: -size * 0.45,
          left: "50%",
          transform: "translateX(-50%)",
          width: size * 0.55,
          height: size * 0.55
        }}
        fill="none"
        stroke={white ? "white" : "#FF705A"}
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M9 18h6"/>
        <path d="M10 21h4"/>
        <path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5.9 1.2.9 2v.6h5.2v-.6c0-.8.3-1.5.9-2A6 6 0 0 0 12 3z" fill={white ? "rgba(255,255,255,0.25)" : "#FFE9D9"}/>
        <line x1="12" y1="1" x2="12" y2="2"/>
        <line x1="4" y1="9" x2="3" y2="9"/>
        <line x1="21" y1="9" x2="20" y2="9"/>
      </svg>
    </span>
    <span className="grad">ghtOff</span>
  </span>
);

const NavPublic = ({ onSignup, onLogin }) => (
  <nav className="nav-public">
    <Logo />
    <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
      <button className="btn btn-ghost" onClick={onLogin}>Se connecter</button>
      <button className="btn btn-coral" onClick={onSignup}>S'inscrire gratuitement</button>
    </div>
  </nav>
);

const NavApp = ({ active, onNavigate, userName = "Thomas", onLogout }) => {
  const links = [
    { id: "dashboard", label: "Dashboard" },
    { id: "profile", label: "Mon Profil" },
    { id: "applications", label: "Mes Candidatures" }
  ];
  const initials = userName.split(" ").map(s => s[0]).slice(0, 2).join("").toUpperCase();
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [notifOpen, setNotifOpen] = React.useState(false);
  const [notifs, setNotifs] = React.useState([
    { id: 1, type: "match", icon: "target", title: "Nouveau match à 91%", desc: "Fullstack Developer chez E-commerce correspond fortement à ton profil.", time: "Il y a 12 min", unread: true, color: "#7AC7E6" },
    { id: 2, type: "reco", icon: "lightbulb", title: "Recommandation de formation", desc: "Apprends Node.js pour passer de 78% à 93% sur 3 offres.", time: "Il y a 2 h", unread: true, color: "#FF705A" },
    { id: 3, type: "view", icon: "sparkles", title: "Ton profil a été consulté", desc: "TechStartup a regardé ton profil — candidate avant les autres.", time: "Hier", unread: true, color: "#FFC2AC" },
    { id: 4, type: "reminder", icon: "briefcase", title: "Candidature en attente", desc: "Tu as commencé une candidature chez SaaS Corp. Termine-la !", time: "Il y a 2 jours", unread: false, color: "#ADF7B6" },
    { id: 5, type: "match", icon: "check-circle", title: "Profil enrichi avec succès", desc: "Tes nouvelles compétences ont débloqué 3 offres supplémentaires.", time: "Il y a 4 jours", unread: false, color: "#7AC7E6" }
  ]);
  const unreadCount = notifs.filter(n => n.unread).length;
  const menuRef = React.useRef();
  const notifRef = React.useRef();
  React.useEffect(() => {
    const close = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const markAllRead = () => setNotifs(ns => ns.map(n => ({ ...n, unread: false })));
  const openNotif = (id) => setNotifs(ns => ns.map(n => n.id === id ? { ...n, unread: false } : n));

  return (
    <nav className="nav-app">
      <div style={{ display: "flex", alignItems: "center" }}>
        <Logo white />
        <div className="nav-links">
          {links.map(l => (
            <span
              key={l.id}
              className={"nav-link" + (active === l.id ? " active" : "")}
              onClick={() => onNavigate && onNavigate(l.id)}
            >
              {l.label}
            </span>
          ))}
        </div>
      </div>
      <div className="nav-right">
        <div ref={notifRef} style={{ position: "relative" }}>
          <button
            className="bell-btn"
            onClick={() => { setNotifOpen(o => !o); setMenuOpen(false); }}
            aria-label="Notifications"
          >
            <Icon name="bell" size={22} color="white"/>
            {unreadCount > 0 && (
              <span className="bell-badge">{unreadCount}</span>
            )}
          </button>
          {notifOpen && (
            <div className="notif-panel">
              <div className="notif-head">
                <div>
                  <div style={{ fontWeight: 800, fontSize: 16, letterSpacing: "-0.01em" }}>Notifications</div>
                  <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 2 }}>
                    {unreadCount > 0 ? `${unreadCount} non lue${unreadCount > 1 ? "s" : ""}` : "Tout est à jour"}
                  </div>
                </div>
                {unreadCount > 0 && (
                  <button className="notif-mark" onClick={markAllRead}>
                    Tout marquer comme lu
                  </button>
                )}
              </div>
              <div className="notif-list">
                {notifs.map(n => (
                  <div
                    key={n.id}
                    className={"notif-item" + (n.unread ? " unread" : "")}
                    onClick={() => openNotif(n.id)}
                  >
                    <div className="notif-icon" style={{ background: n.color }}>
                      <Icon name={n.icon} size={16} color="white"/>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="notif-title">
                        {n.title}
                        {n.unread && <span className="notif-dot"/>}
                      </div>
                      <div className="notif-desc">{n.desc}</div>
                      <div className="notif-time">{n.time}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="notif-foot">
                <a>Voir toutes les notifications</a>
              </div>
            </div>
          )}
        </div>
        <div className="user-meta" ref={menuRef} style={{ position: "relative" }} onClick={() => { setMenuOpen(o => !o); setNotifOpen(false); }}>
          <span className="name">{userName}</span>
          <div className="avatar">{initials}</div>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.85, transform: menuOpen ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}>
            <polyline points="6 9 12 15 18 9"/>
          </svg>
          {menuOpen && (
            <div style={{
              position: "absolute",
              top: "calc(100% + 10px)",
              right: 0,
              minWidth: 220,
              background: "white",
              border: "1px solid var(--border-light)",
              borderRadius: 10,
              boxShadow: "0 10px 30px rgba(43,58,74,0.15), 0 2px 8px rgba(43,58,74,0.06)",
              padding: 6,
              zIndex: 100
            }}>
              <div style={{ padding: "10px 12px", borderBottom: "1px solid var(--border-light)", marginBottom: 4 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: "var(--text-1)" }}>{userName}</div>
                <div style={{ fontSize: 12, color: "var(--text-2)" }}>thomas.dupont@email.com</div>
              </div>
              <MenuItem onClick={() => { setMenuOpen(false); onNavigate && onNavigate("profile"); }} icon="briefcase" label="Mon Profil"/>
              <MenuItem onClick={() => { setMenuOpen(false); onNavigate && onNavigate("applications"); }} icon="target" label="Mes Candidatures"/>
              <MenuItem onClick={() => { setMenuOpen(false); onNavigate && onNavigate("settings"); }} icon="edit" label="Paramètres"/>
              <div style={{ height: 1, background: "var(--border-light)", margin: "4px 0" }}/>
              <MenuItem
                onClick={() => { setMenuOpen(false); onLogout && onLogout(); }}
                icon="arrow-left"
                label="Se déconnecter"
                danger
              />
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};

const MenuItem = ({ icon, label, onClick, danger }) => (
  <div
    onClick={(e) => { e.stopPropagation(); onClick && onClick(); }}
    style={{
      display: "flex",
      alignItems: "center",
      gap: 10,
      padding: "10px 12px",
      borderRadius: 6,
      cursor: "pointer",
      fontSize: 14,
      fontWeight: 500,
      color: danger ? "var(--coral-dark)" : "var(--text-1)",
      transition: "background 0.12s"
    }}
    onMouseEnter={e => e.currentTarget.style.background = danger ? "#fdeae6" : "var(--bg-cream)"}
    onMouseLeave={e => e.currentTarget.style.background = "transparent"}
  >
    <Icon name={icon} size={16} color={danger ? "#E8503A" : "#6B7F94"}/>
    {label}
  </div>
);

window.Logo = Logo;
window.NavPublic = NavPublic;
window.NavApp = NavApp;
