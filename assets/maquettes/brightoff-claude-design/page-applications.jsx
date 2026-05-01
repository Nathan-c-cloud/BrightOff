/* Mes Candidatures (Applications page) */

const APPLICATIONS_SEED = [
  {
    id: 1, jobId: 5, title: "Fullstack Developer", company: "E-commerce", location: "Bordeaux, Remote",
    color: "#7AC7E6", initials: "EC", score: 91, status: "interview",
    appliedDate: "Il y a 2 jours", lastUpdate: "Aujourd'hui",
    notes: "Premier entretien RH prévu vendredi 14h.",
    timeline: [
      { date: "5 avr.", label: "Candidature envoyée", done: true },
      { date: "6 avr.", label: "CV consulté", done: true },
      { date: "7 avr.", label: "Réponse positive", done: true },
      { date: "12 avr.", label: "Entretien RH", done: false, current: true },
      { date: "—", label: "Entretien technique", done: false },
      { date: "—", label: "Décision finale", done: false }
    ]
  },
  {
    id: 2, jobId: 1, title: "Développeur Fullstack Junior", company: "TechStartup", location: "Paris, Remote",
    color: "#FF705A", initials: "TS", score: 85, status: "in-review",
    appliedDate: "Il y a 4 jours", lastUpdate: "Il y a 1 jour",
    notes: "CV consulté 2 fois cette semaine.",
    timeline: [
      { date: "3 avr.", label: "Candidature envoyée", done: true },
      { date: "4 avr.", label: "CV consulté", done: true, current: true },
      { date: "—", label: "Réponse de l'entreprise", done: false },
      { date: "—", label: "Décision finale", done: false }
    ]
  },
  {
    id: 3, jobId: 2, title: "Ingénieur Logiciel Junior", company: "SaaS Corp", location: "Lyon",
    color: "#FF705A", initials: "SC", score: 78, status: "draft",
    appliedDate: "Brouillon", lastUpdate: "Il y a 2 jours",
    notes: "Lettre de motivation à finaliser. Apprendre Spring Boot avant l'envoi.",
    timeline: [
      { date: "—", label: "Brouillon en cours", done: false, current: true },
      { date: "—", label: "Candidature envoyée", done: false },
      { date: "—", label: "Réponse de l'entreprise", done: false }
    ]
  },
  {
    id: 4, jobId: 3, title: "Dev Full Stack", company: "FinTech Scale-up", location: "Lyon, Remote",
    color: "#ADF7B6", initials: "FT", score: 72, status: "rejected",
    appliedDate: "Il y a 12 jours", lastUpdate: "Il y a 5 jours",
    notes: "Refus poli — profil retenu pour de futures opportunités.",
    timeline: [
      { date: "16 mars", label: "Candidature envoyée", done: true },
      { date: "18 mars", label: "CV consulté", done: true },
      { date: "23 mars", label: "Réponse négative", done: true, current: true }
    ]
  },
  {
    id: 5, jobId: 4, title: "Développeur Backend Python", company: "DataCompany", location: "Paris",
    color: "#FFC2AC", initials: "DC", score: 68, status: "offer",
    appliedDate: "Il y a 3 semaines", lastUpdate: "Hier",
    notes: "Offre reçue : 40k€ + 4k€ variable. Réponse attendue avant le 25 avril.",
    timeline: [
      { date: "5 mars", label: "Candidature envoyée", done: true },
      { date: "8 mars", label: "Entretien RH", done: true },
      { date: "15 mars", label: "Entretien technique", done: true },
      { date: "22 mars", label: "Entretien final", done: true },
      { date: "27 avr.", label: "Offre reçue", done: true, current: true }
    ]
  },
  {
    id: 6, jobId: 6, title: "Développeur Web Junior", company: "AgenceDev", location: "Nantes",
    color: "#E8503A", initials: "AD", score: 65, status: "saved",
    appliedDate: "Sauvegardée", lastUpdate: "Il y a 1 jour",
    notes: "Intéressante mais nécessite PHP/Symfony — à voir.",
    timeline: [
      { date: "—", label: "Sauvegardée en favori", done: false, current: true },
      { date: "—", label: "Candidature à envoyer", done: false }
    ]
  }
];

const STATUS_META = {
  saved:     { label: "Sauvegardée",      color: "#FFC2AC", text: "#5a2a1d" },
  draft:     { label: "Brouillon",        color: "#E6F7FD", text: "#2680a0" },
  "in-review": { label: "En cours d'analyse", color: "#7AC7E6", text: "white" },
  interview: { label: "Entretien",        color: "#ADF7B6", text: "#1f5c2a" },
  offer:     { label: "Offre reçue",      color: "#FF705A", text: "white" },
  rejected:  { label: "Refusée",          color: "#E8503A", text: "white" }
};

const ApplicationsPage = ({ onNavigate, userName, onLogout, onOpenJob }) => {
  const [apps, setApps] = React.useState(APPLICATIONS_SEED);
  const [filter, setFilter] = React.useState("all");
  const [selectedId, setSelectedId] = React.useState(APPLICATIONS_SEED[0].id);

  const counts = React.useMemo(() => {
    const c = { all: apps.length };
    Object.keys(STATUS_META).forEach(k => c[k] = apps.filter(a => a.status === k).length);
    return c;
  }, [apps]);

  const visible = filter === "all" ? apps : apps.filter(a => a.status === filter);
  const selected = apps.find(a => a.id === selectedId) || visible[0];

  const filterTabs = [
    { id: "all", label: "Toutes" },
    { id: "saved", label: STATUS_META.saved.label },
    { id: "draft", label: STATUS_META.draft.label },
    { id: "in-review", label: STATUS_META["in-review"].label },
    { id: "interview", label: STATUS_META.interview.label },
    { id: "offer", label: STATUS_META.offer.label },
    { id: "rejected", label: STATUS_META.rejected.label }
  ];

  const updateStatus = (id, status) => setApps(a => a.map(x => x.id === id ? { ...x, status } : x));
  const removeApp = (id) => {
    setApps(a => a.filter(x => x.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  // Stats
  const total = apps.length;
  const responseRate = total > 0
    ? Math.round((apps.filter(a => ["interview", "offer", "rejected", "in-review"].includes(a.status)).length / total) * 100)
    : 0;

  return (
    <div className="page-fade">
      <NavApp active="applications" onNavigate={onNavigate} userName={userName} onLogout={onLogout}/>
      <div className="page-wrap">
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ margin: 0, fontSize: 30, fontWeight: 800, letterSpacing: "-0.02em" }}>Mes Candidatures</h1>
          <div style={{ color: "var(--text-2)", marginTop: 4, fontSize: 15 }}>
            Suis l'avancement de toutes tes candidatures en un coup d'œil.
          </div>
        </div>

        {/* Stat cards */}
        <div className="app-stats">
          <StatCard label="Total" value={total} icon="briefcase" color="#7AC7E6"/>
          <StatCard label="En cours" value={counts["in-review"] + counts.interview} icon="target" color="#FF705A"/>
          <StatCard label="Entretiens" value={counts.interview + counts.offer} icon="check-circle" color="#ADF7B6"/>
          <StatCard label="Taux de réponse" value={responseRate + "%"} icon="sparkles" color="#FFC2AC"/>
        </div>

        {/* Filter chips */}
        <div className="app-filters">
          {filterTabs.map(t => (
            <button
              key={t.id}
              className={"filter-chip" + (filter === t.id ? " on" : "")}
              onClick={() => setFilter(t.id)}
            >
              {t.label}
              <span className="filter-count">{t.id === "all" ? total : (counts[t.id] || 0)}</span>
            </button>
          ))}
        </div>

        {visible.length === 0 ? (
          <div className="empty-state">
            <div style={{ fontSize: 40, marginBottom: 8 }}>📭</div>
            <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 4 }}>Aucune candidature dans cette catégorie</div>
            <div style={{ color: "var(--text-2)", marginBottom: 18 }}>Essaie un autre filtre, ou découvre de nouvelles offres.</div>
            <button className="btn btn-coral" onClick={() => onNavigate("dashboard")}>Voir les offres</button>
          </div>
        ) : (
          <div className="app-grid">
            <div className="app-list">
              {visible.map(app => (
                <div
                  key={app.id}
                  className={"app-row" + (selectedId === app.id ? " selected" : "")}
                  onClick={() => setSelectedId(app.id)}
                >
                  <div className="company-logo" style={{ background: app.color, width: 40, height: 40, fontSize: 13, borderRadius: 10 }}>{app.initials}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ fontWeight: 700, fontSize: 15, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{app.title}</div>
                    </div>
                    <div style={{ fontSize: 13, color: "var(--text-2)", marginTop: 1 }}>{app.company} · {app.location}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
                      <span className="status-pill" style={{ background: STATUS_META[app.status].color, color: STATUS_META[app.status].text }}>
                        {STATUS_META[app.status].label}
                      </span>
                      <span style={{ fontSize: 12, color: "var(--text-2)" }}>· {app.appliedDate}</span>
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 18, fontWeight: 800, color: "var(--coral)", lineHeight: 1 }}>{app.score}%</div>
                    <div style={{ fontSize: 11, color: "var(--text-2)", marginTop: 2 }}>match</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Detail panel */}
            {selected && (
              <div className="app-detail">
                <div className="app-detail-head">
                  <div className="company-logo" style={{ background: selected.color, width: 52, height: 52, fontSize: 16, borderRadius: 12 }}>{selected.initials}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, letterSpacing: "-0.01em" }}>{selected.title}</h2>
                    <div style={{ color: "var(--text-2)", fontSize: 14, marginTop: 2 }}>{selected.company} · {selected.location}</div>
                  </div>
                  <span className="status-pill" style={{ background: STATUS_META[selected.status].color, color: STATUS_META[selected.status].text }}>
                    {STATUS_META[selected.status].label}
                  </span>
                </div>

                <div className="app-detail-meta">
                  <div className="meta-block">
                    <div className="k">Match</div>
                    <div className="v" style={{ color: "var(--coral)" }}>{selected.score}%</div>
                  </div>
                  <div className="meta-block">
                    <div className="k">Candidature</div>
                    <div className="v">{selected.appliedDate}</div>
                  </div>
                  <div className="meta-block">
                    <div className="k">Dernière activité</div>
                    <div className="v">{selected.lastUpdate}</div>
                  </div>
                </div>

                <div className="app-section">
                  <h3>Suivi</h3>
                  <div className="timeline">
                    {selected.timeline.map((t, i) => (
                      <div key={i} className={"tl-step" + (t.done ? " done" : "") + (t.current ? " current" : "")}>
                        <div className="tl-dot">
                          {t.done && !t.current && <Icon name="check" size={11} color="white"/>}
                        </div>
                        <div className="tl-body">
                          <div className="tl-label">{t.label}</div>
                          <div className="tl-date">{t.date}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="app-section">
                  <h3>Notes</h3>
                  <div className="note-card">{selected.notes}</div>
                </div>

                <div className="app-section">
                  <h3>Mettre à jour le statut</h3>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {Object.entries(STATUS_META).map(([k, m]) => (
                      <button
                        key={k}
                        className={"chip-toggle" + (selected.status === k ? " on" : "")}
                        onClick={() => updateStatus(selected.id, k)}
                        style={selected.status === k ? { background: m.color, color: m.text, borderColor: m.color } : {}}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="app-actions">
                  <button className="btn btn-coral" onClick={() => onOpenJob && onOpenJob(selected.jobId)}>
                    Voir l'offre <Icon name="arrow-right" size={14} color="white"/>
                  </button>
                  <button className="btn btn-sky-outline" onClick={() => removeApp(selected.id)}>
                    <Icon name="x" size={14}/> Retirer
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const StatCard = ({ label, value, icon, color }) => (
  <div className="stat-card">
    <div className="stat-icon" style={{ background: color }}>
      <Icon name={icon} size={18} color="white"/>
    </div>
    <div>
      <div style={{ fontSize: 24, fontWeight: 800, lineHeight: 1, letterSpacing: "-0.01em" }}>{value}</div>
      <div style={{ fontSize: 13, color: "var(--text-2)", marginTop: 4 }}>{label}</div>
    </div>
  </div>
);

window.ApplicationsPage = ApplicationsPage;
