/* Dashboard (P4) */

const JobCard = ({ job, onOpen }) => (
  <div className="job-card" onClick={() => onOpen(job)} style={{ cursor: "pointer" }}>
    <div className="job-head">
      <div className="company-logo" style={{ background: job.color }}>{job.initials}</div>
      <div className="job-title-block">
        <h3>{job.title}</h3>
        <div className="meta">{job.company} — {job.location}</div>
      </div>
    </div>

    <div className="score-row">
      <div className="score-num">{job.score}%</div>
      <div className="score-bar">
        <div className="label">Match avec ton profil</div>
        <div className="bar"><i style={{ width: job.score + "%" }}/></div>
      </div>
    </div>

    <div className="skill-row">
      {job.skills.slice(0, 4).map(s => <span key={s} className="badge badge-skill">{s}</span>)}
    </div>

    <button
      className="btn btn-coral"
      style={{ alignSelf: "flex-start", marginTop: 4 }}
      onClick={(e) => { e.stopPropagation(); onOpen(job); }}
    >
      Voir détail <Icon name="arrow-right" size={16} color="white"/>
    </button>
  </div>
);

const DashboardPage = ({ onOpen, onNavigate, userName, onLogout }) => {
  const [sort, setSort] = React.useState("Pertinence");
  const [query, setQuery] = React.useState("");
  const sorted = React.useMemo(() => {
    const filtered = JOBS.filter(j =>
      !query || (j.title + j.company + j.location + j.skills.join(" ")).toLowerCase().includes(query.toLowerCase())
    );
    if (sort === "Pertinence") return [...filtered].sort((a, b) => b.score - a.score);
    if (sort === "Date") return filtered;
    if (sort === "Salaire") return [...filtered].sort((a, b) => parseInt(b.salary) - parseInt(a.salary));
    return filtered;
  }, [sort, query]);

  return (
    <div className="page-fade">
      <NavApp active="dashboard" onNavigate={onNavigate} userName={userName} onLogout={onLogout}/>
      <div className="page-wrap">
        <div className="welcome">
          <div>
            <h1>Bonjour {userName.split(" ")[0]} <span style={{ display: "inline-block" }}>👋</span></h1>
            <div className="sub">{sorted.length} nouvelles offres correspondent à ton profil</div>
          </div>
          <button className="btn btn-sky-outline" onClick={() => onNavigate("profile")}>
            Voir mon profil
          </button>
        </div>

        <div className="filter-bar">
          <select className="select" value={sort} onChange={e => setSort(e.target.value)}>
            <option>Pertinence</option>
            <option>Date</option>
            <option>Salaire</option>
          </select>
          <div style={{ position: "relative", flex: 1, maxWidth: 360 }}>
            <input
              className="input"
              style={{ paddingLeft: 38 }}
              placeholder="Rechercher un poste, une compétence..."
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
            <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-2)" }}>
              <Icon name="search" size={16}/>
            </span>
          </div>
        </div>

        <div className="job-grid">
          {sorted.map(j => <JobCard key={j.id} job={j} onOpen={onOpen}/>)}
        </div>

        {sorted.length === 0 && (
          <div style={{ padding: 60, textAlign: "center", color: "var(--text-2)" }}>
            Aucune offre ne correspond à ta recherche.
          </div>
        )}
      </div>
    </div>
  );
};

window.DashboardPage = DashboardPage;
