/* Mon Profil (P6) */

const ProfilePage = ({ onNavigate, userName, onReupload, onLogout }) => {
  const [techSkills, setTechSkills] = React.useState(["React", "Python", "JavaScript", "HTML/CSS", "Git"]);
  const [softSkills, setSoftSkills] = React.useState(["Travail d'équipe", "Autonomie", "Communication"]);
  const [adding, setAdding] = React.useState(null); // 'tech' | 'soft' | null
  const [draft, setDraft] = React.useState("");

  const addSkill = (which) => {
    if (!draft.trim()) { setAdding(null); return; }
    const setter = which === "tech" ? setTechSkills : setSoftSkills;
    setter(s => [...s, draft.trim()]);
    setDraft("");
    setAdding(null);
  };
  const removeSkill = (which, name) => {
    const setter = which === "tech" ? setTechSkills : setSoftSkills;
    setter(s => s.filter(x => x !== name));
  };

  const initials = userName.split(" ").map(s => s[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div className="page-fade">
      <NavApp active="profile" onNavigate={onNavigate} userName={userName} onLogout={onLogout}/>
      <div className="page-wrap">
        <h1 style={{ margin: "0 0 24px", fontSize: 28, fontWeight: 800, letterSpacing: "-0.02em" }}>Mon Profil</h1>

        <div className="profile-grid">
          <div className="profile-side">
            <div className="avatar-lg">{initials}</div>
            <h2>{userName}</h2>
            <div className="em">thomas.dupont@email.com</div>
            <div className="since">Membre depuis mars 2026</div>
            <button
              className="btn btn-sky-outline"
              style={{ width: "100%", marginTop: 18 }}
              onClick={onReupload}
            >
              <Icon name="upload" size={16}/> Mettre à jour mon CV
            </button>
          </div>

          <div className="profile-main">
            <div className="profile-section">
              <h3>Compétences techniques</h3>
              <div className="skill-edit">
                {techSkills.map(s => (
                  <span key={s} className="badge-removable">
                    {s}
                    <button onClick={() => removeSkill("tech", s)} aria-label="retirer"><Icon name="x" size={11}/></button>
                  </span>
                ))}
                {adding === "tech" ? (
                  <input
                    autoFocus
                    className="input"
                    style={{ width: 140, padding: "6px 10px", fontSize: 13 }}
                    placeholder="Ajouter..."
                    value={draft}
                    onChange={e => setDraft(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") addSkill("tech"); if (e.key === "Escape") setAdding(null); }}
                    onBlur={() => addSkill("tech")}
                  />
                ) : (
                  <button className="badge-add" onClick={() => setAdding("tech")}><Icon name="plus" size={12}/> Ajouter</button>
                )}
              </div>
            </div>

            <div className="profile-section">
              <h3>Soft skills</h3>
              <div className="skill-edit">
                {softSkills.map(s => (
                  <span key={s} className="badge-removable">
                    {s}
                    <button onClick={() => removeSkill("soft", s)} aria-label="retirer"><Icon name="x" size={11}/></button>
                  </span>
                ))}
                {adding === "soft" ? (
                  <input
                    autoFocus
                    className="input"
                    style={{ width: 160, padding: "6px 10px", fontSize: 13 }}
                    placeholder="Ajouter..."
                    value={draft}
                    onChange={e => setDraft(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") addSkill("soft"); if (e.key === "Escape") setAdding(null); }}
                    onBlur={() => addSkill("soft")}
                  />
                ) : (
                  <button className="badge-add" onClick={() => setAdding("soft")}><Icon name="plus" size={12}/> Ajouter</button>
                )}
              </div>
            </div>

            <div className="profile-section">
              <h3>Formation</h3>
              <div className="body">
                <p><b>Master Ingénierie Informatique</b></p>
                <p style={{ color: "var(--text-2)" }}>École Polytechnique Lyon — 2026</p>
              </div>
            </div>

            <div className="profile-section">
              <h3>Langues</h3>
              <div className="skill-edit">
                <span className="badge badge-skill">Français (natif)</span>
                <span className="badge badge-skill">Anglais (B2)</span>
              </div>
            </div>

            <div className="profile-section">
              <h3>Expérience</h3>
              <div className="body">
                <p><b>Développeur Web — Alternance 2 ans</b></p>
                <p style={{ color: "var(--text-2)" }}>WebAgency Lyon · 2024 — 2026</p>
              </div>
            </div>

            <div style={{ marginTop: 22 }}>
              <button className="btn btn-coral" onClick={onReupload}>
                <Icon name="upload" size={16} color="white"/> Mettre à jour mon CV
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

window.ProfilePage = ProfilePage;
