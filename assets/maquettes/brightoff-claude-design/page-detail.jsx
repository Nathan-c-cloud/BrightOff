/* Job Detail + Gap Analysis (P5) */

const ScoreRing = ({ value, size = 96, stroke = 9 }) => {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const id = "grad-" + value;
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#7AC7E6"/>
          <stop offset="100%" stopColor="#FF705A"/>
        </linearGradient>
      </defs>
      <circle cx={size/2} cy={size/2} r={r} stroke="#F0E9E2" strokeWidth={stroke} fill="none"/>
      <circle
        cx={size/2} cy={size/2} r={r}
        stroke={`url(#${id})`} strokeWidth={stroke} fill="none"
        strokeDasharray={c}
        strokeDashoffset={c - (c * value) / 100}
        strokeLinecap="round"
        style={{ transition: "stroke-dashoffset 0.8s cubic-bezier(.2,.8,.2,1)" }}
      />
    </svg>
  );
};

const JobDetailPage = ({ job, onBack, onNavigate, userName, onLogout }) => {
  const [saved, setSaved] = React.useState(false);
  const [ringValue, setRingValue] = React.useState(0);
  React.useEffect(() => {
    const t = setTimeout(() => setRingValue(job.score), 100);
    return () => clearTimeout(t);
  }, [job.score]);

  return (
    <div className="page-fade">
      <NavApp active="dashboard" onNavigate={onNavigate} userName={userName} onLogout={onLogout}/>
      <div className="page-wrap">
        <a className="back-link" onClick={onBack}>
          <Icon name="arrow-left" size={16}/> Retour au dashboard
        </a>

        <div className="detail-grid">
          <div>
            <div className="detail-head">
              <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 12 }}>
                <div className="company-logo" style={{ background: job.color, width: 56, height: 56, fontSize: 18, borderRadius: 12 }}>{job.initials}</div>
                <div>
                  <h1>{job.title}</h1>
                  <div className="company">{job.company} — {job.location}</div>
                </div>
              </div>
            </div>

            <div className="score-circle-row">
              <div style={{ position: "relative", width: 96, height: 96 }}>
                <ScoreRing value={ringValue}/>
                <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column" }}>
                  <div style={{ fontSize: 24, fontWeight: 800, color: "var(--coral)", letterSpacing: "-0.02em", lineHeight: 1 }}>{job.score}%</div>
                  <div style={{ fontSize: 10, color: "var(--text-2)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>Match</div>
                </div>
              </div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 2 }}>Bon match avec ton profil</div>
                <div style={{ color: "var(--text-2)", fontSize: 14 }}>
                  Tu peux passer à <b style={{ color: "var(--text-1)" }}>{job.reco.to}%</b> en développant {job.reco.skill}.
                </div>
              </div>
            </div>

            <div className="detail-section">
              <h2>Description du poste</h2>
              <p>{job.description}</p>
            </div>

            <div className="detail-section">
              <h2>Détails</h2>
              <div className="facts-grid">
                <div className="fact"><div className="k">Type de contrat</div><div className="v">{job.type}</div></div>
                <div className="fact"><div className="k">Salaire</div><div className="v">{job.salary}</div></div>
                <div className="fact"><div className="k">Expérience</div><div className="v">{job.exp}</div></div>
                <div className="fact"><div className="k">Publié</div><div className="v">{job.posted}</div></div>
              </div>
            </div>

            <div className="detail-actions">
              <button className="btn btn-coral btn-lg">
                Candidater sur le site <Icon name="arrow-right" size={16} color="white"/>
              </button>
              <button
                className="btn btn-sky-outline btn-lg"
                onClick={() => setSaved(s => !s)}
                style={saved ? { background: "var(--sky-light)", color: "var(--sky)" } : {}}
              >
                <Icon name="heart" size={16} color={saved ? "#FF705A" : "currentColor"}/> {saved ? "Sauvegardé" : "Sauvegarder en favori"}
              </button>
            </div>
          </div>

          <div className="gap-card">
            <h2><Icon name="sparkles" size={18} color="#FF705A" style={{ verticalAlign: "-3px", marginRight: 6 }}/> Gap Analysis</h2>

            <div className="gap-section">
              <div className="gap-h" style={{ color: "#1f5c2a" }}>
                <Icon name="check-circle" size={16} color="#1f5c2a"/> Compétences acquises
              </div>
              <div className="skill-row">
                {job.acquired.map(s => <span key={s} className="badge badge-mint">{s}</span>)}
              </div>
            </div>

            <div className="gap-section">
              <div className="gap-h" style={{ color: "var(--coral-dark)" }}>
                <Icon name="x" size={16} color="#E8503A"/> Compétences manquantes
              </div>
              <div className="gap-sub">Must-have</div>
              <div className="skill-row">
                {job.mustHave.map(m => (
                  <span key={m.name} className="badge badge-coral-dark">{m.name} — Impact : {m.impact}%</span>
                ))}
              </div>
              {job.niceHave.length > 0 && (
                <>
                  <div className="gap-sub">Nice-to-have</div>
                  <div className="skill-row">
                    {job.niceHave.map(m => (
                      <span key={m.name} className="badge badge-peach-dark">{m.name} — Impact : {m.impact}%</span>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="reco">
              <div className="reco-title"><Icon name="lightbulb" size={16} color="#5a2a1d" style={{ verticalAlign: "-3px", marginRight: 4 }}/> Recommandation</div>
              <p>Apprends <b>{job.reco.skill}</b> pour passer de <b>{job.reco.from}%</b> à <b>{job.reco.to}%</b> de match.</p>
              <div className="formation"><b>Formation suggérée :</b> {job.reco.course}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

window.JobDetailPage = JobDetailPage;
