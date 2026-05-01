/* Settings page (Paramètres) */

const SettingsPage = ({ onNavigate, userName, onLogout, onUserUpdate }) => {
  const [tab, setTab] = React.useState("compte");
  const [saved, setSaved] = React.useState(false);

  const [account, setAccount] = React.useState({
    prenom: userName.split(" ")[0] || "Thomas",
    nom: userName.split(" ").slice(1).join(" ") || "Dupont",
    email: "thomas.dupont@email.com",
    phone: "+33 6 12 34 56 78",
    city: "Lyon",
    birthYear: "2002"
  });

  const [notifPrefs, setNotifPrefs] = React.useState({
    newMatches: true,
    matchThreshold: 80,
    weeklyDigest: true,
    formationReco: true,
    profileViews: false,
    applicationUpdates: true,
    marketing: false,
    pushNotif: true,
    emailNotif: true
  });

  const [matching, setMatching] = React.useState({
    contractTypes: { CDI: true, CDD: false, alternance: true, stage: false, freelance: false },
    locations: ["Paris", "Lyon", "Remote"],
    minSalary: 32,
    maxDistance: 30,
    remoteOnly: false,
    minScore: 60
  });

  const [privacy, setPrivacy] = React.useState({
    profilePublic: true,
    shareWithRecruiters: true,
    anonymousMode: false,
    blockCurrentEmployer: false,
    currentEmployer: ""
  });

  const [security, setSecurity] = React.useState({
    twoFactor: false,
    pwd: "",
    pwdNew: "",
    pwdConfirm: ""
  });

  const [theme, setTheme] = React.useState("light");
  const [language, setLanguage] = React.useState("fr");

  const flashSaved = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2200);
  };

  const handleSave = () => {
    if (tab === "compte") {
      onUserUpdate && onUserUpdate(`${account.prenom} ${account.nom}`.trim());
    }
    flashSaved();
  };

  const tabs = [
    { id: "compte", label: "Compte", icon: "briefcase" },
    { id: "notifications", label: "Notifications", icon: "bell" },
    { id: "matching", label: "Préférences de matching", icon: "target" },
    { id: "confidentialite", label: "Confidentialité", icon: "check-circle" },
    { id: "securite", label: "Sécurité", icon: "edit" },
    { id: "apparence", label: "Apparence", icon: "sparkles" },
    { id: "danger", label: "Zone à risque", icon: "x" }
  ];

  return (
    <div className="page-fade">
      <NavApp active="settings" onNavigate={onNavigate} userName={userName} onLogout={onLogout}/>
      <div className="page-wrap">
        <div style={{ marginBottom: 24 }}>
          <a className="back-link" onClick={() => onNavigate("dashboard")}>
            <Icon name="arrow-left" size={16}/> Retour au dashboard
          </a>
          <h1 style={{ margin: "0", fontSize: 30, fontWeight: 800, letterSpacing: "-0.02em" }}>Paramètres</h1>
          <div style={{ color: "var(--text-2)", marginTop: 4, fontSize: 15 }}>Gère ton compte, tes préférences et ta confidentialité.</div>
        </div>

        <div className="settings-grid">
          <aside className="settings-side">
            {tabs.map(t => (
              <div
                key={t.id}
                className={"settings-tab" + (tab === t.id ? " active" : "") + (t.id === "danger" ? " danger" : "")}
                onClick={() => setTab(t.id)}
              >
                <Icon name={t.icon} size={16} color={t.id === "danger" ? "#E8503A" : (tab === t.id ? "#FF705A" : "#6B7F94")}/>
                {t.label}
              </div>
            ))}
          </aside>

          <main className="settings-main">
            {tab === "compte" && (
              <Section title="Informations personnelles" desc="Ces informations apparaissent sur ton profil candidat.">
                <div className="grid-2">
                  <Field label="Prénom"><input className="input" value={account.prenom} onChange={e => setAccount({...account, prenom: e.target.value})}/></Field>
                  <Field label="Nom"><input className="input" value={account.nom} onChange={e => setAccount({...account, nom: e.target.value})}/></Field>
                </div>
                <Field label="Email"><input className="input" value={account.email} onChange={e => setAccount({...account, email: e.target.value})}/></Field>
                <div className="grid-2">
                  <Field label="Téléphone"><input className="input" value={account.phone} onChange={e => setAccount({...account, phone: e.target.value})}/></Field>
                  <Field label="Ville"><input className="input" value={account.city} onChange={e => setAccount({...account, city: e.target.value})}/></Field>
                </div>
                <Field label="Année de naissance"><input className="input" value={account.birthYear} onChange={e => setAccount({...account, birthYear: e.target.value})}/></Field>
              </Section>
            )}

            {tab === "notifications" && (
              <>
                <Section title="Canaux" desc="Comment veux-tu être notifié ?">
                  <Toggle label="Notifications par email" desc="Reçois un email quand une nouvelle offre te correspond." value={notifPrefs.emailNotif} onChange={v => setNotifPrefs({...notifPrefs, emailNotif: v})}/>
                  <Toggle label="Notifications push" desc="Notifications instantanées dans le navigateur." value={notifPrefs.pushNotif} onChange={v => setNotifPrefs({...notifPrefs, pushNotif: v})}/>
                </Section>
                <Section title="Quoi" desc="Choisis les types d'événements à recevoir.">
                  <Toggle label="Nouveaux matchs" desc="Une nouvelle offre correspond à ton profil." value={notifPrefs.newMatches} onChange={v => setNotifPrefs({...notifPrefs, newMatches: v})}/>
                  <div style={{ paddingLeft: 20, marginTop: -4, marginBottom: 16, opacity: notifPrefs.newMatches ? 1 : 0.4 }}>
                    <div style={{ fontSize: 13, color: "var(--text-2)", marginBottom: 8 }}>Notifie-moi à partir de <b style={{ color: "var(--coral)" }}>{notifPrefs.matchThreshold}%</b> de match.</div>
                    <input type="range" min="50" max="100" step="5" value={notifPrefs.matchThreshold} onChange={e => setNotifPrefs({...notifPrefs, matchThreshold: +e.target.value})} className="slider"/>
                  </div>
                  <Toggle label="Recommandations de formation" desc="Les compétences à apprendre pour décrocher tes top matches." value={notifPrefs.formationReco} onChange={v => setNotifPrefs({...notifPrefs, formationReco: v})}/>
                  <Toggle label="Profil consulté" desc="Quand un recruteur regarde ton profil." value={notifPrefs.profileViews} onChange={v => setNotifPrefs({...notifPrefs, profileViews: v})}/>
                  <Toggle label="Mises à jour de candidature" desc="Statut de tes candidatures en cours." value={notifPrefs.applicationUpdates} onChange={v => setNotifPrefs({...notifPrefs, applicationUpdates: v})}/>
                  <Toggle label="Récap hebdomadaire" desc="Le digest des nouveautés chaque lundi matin." value={notifPrefs.weeklyDigest} onChange={v => setNotifPrefs({...notifPrefs, weeklyDigest: v})}/>
                  <Toggle label="Communications BrightOff" desc="Conseils, événements et nouveautés produit." value={notifPrefs.marketing} onChange={v => setNotifPrefs({...notifPrefs, marketing: v})}/>
                </Section>
              </>
            )}

            {tab === "matching" && (
              <>
                <Section title="Type de contrat" desc="Sélectionne tous les types qui t'intéressent.">
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {Object.entries(matching.contractTypes).map(([k, v]) => (
                      <button
                        key={k}
                        className={"chip-toggle" + (v ? " on" : "")}
                        onClick={() => setMatching({...matching, contractTypes: {...matching.contractTypes, [k]: !v}})}
                      >
                        {v && <Icon name="check" size={13} color="white"/>} {k}
                      </button>
                    ))}
                  </div>
                </Section>
                <Section title="Localisation" desc="Villes où tu acceptes de travailler.">
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
                    {matching.locations.map(loc => (
                      <span key={loc} className="badge-removable">
                        <Icon name="map-pin" size={12} color="#2680a0"/>
                        {loc}
                        <button onClick={() => setMatching({...matching, locations: matching.locations.filter(l => l !== loc)})}><Icon name="x" size={11}/></button>
                      </span>
                    ))}
                    <AddLoc onAdd={loc => setMatching({...matching, locations: [...matching.locations, loc]})}/>
                  </div>
                  <Toggle label="Remote uniquement" desc="Ne montrer que les offres 100% télétravail." value={matching.remoteOnly} onChange={v => setMatching({...matching, remoteOnly: v})}/>
                </Section>
                <Section title="Critères">
                  <Field label={`Salaire minimum souhaité : ${matching.minSalary}k€`}>
                    <input type="range" min="20" max="80" step="1" value={matching.minSalary} onChange={e => setMatching({...matching, minSalary: +e.target.value})} className="slider"/>
                  </Field>
                  <Field label={`Score de match minimum : ${matching.minScore}%`}>
                    <input type="range" min="0" max="100" step="5" value={matching.minScore} onChange={e => setMatching({...matching, minScore: +e.target.value})} className="slider"/>
                  </Field>
                  <Field label={`Distance maximale : ${matching.maxDistance} km`}>
                    <input type="range" min="0" max="200" step="10" value={matching.maxDistance} onChange={e => setMatching({...matching, maxDistance: +e.target.value})} className="slider"/>
                  </Field>
                </Section>
              </>
            )}

            {tab === "confidentialite" && (
              <Section title="Visibilité" desc="Qui peut voir ton profil et ce qu'il contient.">
                <Toggle label="Profil public" desc="Ton profil est visible par les recruteurs partenaires." value={privacy.profilePublic} onChange={v => setPrivacy({...privacy, profilePublic: v})}/>
                <Toggle label="Partage avec les recruteurs" desc="Autorise BrightOff à transmettre ton profil aux entreprises qui matchent." value={privacy.shareWithRecruiters} onChange={v => setPrivacy({...privacy, shareWithRecruiters: v})}/>
                <Toggle label="Mode anonyme" desc="Cache ton nom et tes anciennes entreprises jusqu'à ce que tu candidates." value={privacy.anonymousMode} onChange={v => setPrivacy({...privacy, anonymousMode: v})}/>
                <Toggle label="Bloquer mon employeur actuel" desc="Empêche ton entreprise actuelle de voir ton profil." value={privacy.blockCurrentEmployer} onChange={v => setPrivacy({...privacy, blockCurrentEmployer: v})}/>
                {privacy.blockCurrentEmployer && (
                  <Field label="Nom de l'entreprise à bloquer">
                    <input className="input" placeholder="ex : WebAgency Lyon" value={privacy.currentEmployer} onChange={e => setPrivacy({...privacy, currentEmployer: e.target.value})}/>
                  </Field>
                )}
              </Section>
            )}

            {tab === "securite" && (
              <>
                <Section title="Mot de passe" desc="Change ton mot de passe régulièrement pour sécuriser ton compte.">
                  <Field label="Mot de passe actuel"><input type="password" className="input" value={security.pwd} onChange={e => setSecurity({...security, pwd: e.target.value})}/></Field>
                  <div className="grid-2">
                    <Field label="Nouveau mot de passe"><input type="password" className="input" value={security.pwdNew} onChange={e => setSecurity({...security, pwdNew: e.target.value})}/></Field>
                    <Field label="Confirme"><input type="password" className="input" value={security.pwdConfirm} onChange={e => setSecurity({...security, pwdConfirm: e.target.value})}/></Field>
                  </div>
                </Section>
                <Section title="Authentification à deux facteurs">
                  <Toggle label="Activer la 2FA" desc="Une couche de sécurité supplémentaire à la connexion via un code SMS." value={security.twoFactor} onChange={v => setSecurity({...security, twoFactor: v})}/>
                </Section>
                <Section title="Sessions actives">
                  <div className="session-item">
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>MacBook Pro · Lyon, France</div>
                      <div style={{ fontSize: 13, color: "var(--text-2)" }}>Chrome · Session actuelle</div>
                    </div>
                    <span className="badge badge-mint">Active</span>
                  </div>
                  <div className="session-item">
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>iPhone 15 · Lyon, France</div>
                      <div style={{ fontSize: 13, color: "var(--text-2)" }}>Safari · Il y a 2 jours</div>
                    </div>
                    <button className="btn btn-sky-outline" style={{ padding: "6px 12px", fontSize: 13 }}>Déconnecter</button>
                  </div>
                </Section>
              </>
            )}

            {tab === "apparence" && (
              <>
                <Section title="Thème">
                  <div className="theme-row">
                    {[
                      { id: "light", label: "Clair", bg: "#FFF7F1", fg: "#2B3A4A" },
                      { id: "dark", label: "Sombre", bg: "#1B2330", fg: "#FFF7F1" },
                      { id: "system", label: "Système", bg: "linear-gradient(135deg, #FFF7F1 50%, #1B2330 50%)", fg: "#2B3A4A" }
                    ].map(t => (
                      <div
                        key={t.id}
                        className={"theme-card" + (theme === t.id ? " active" : "")}
                        onClick={() => setTheme(t.id)}
                      >
                        <div className="theme-swatch" style={{ background: t.bg }}>
                          <div style={{ width: 32, height: 6, borderRadius: 3, background: "#7AC7E6", margin: "12px auto 0" }}/>
                          <div style={{ width: 22, height: 6, borderRadius: 3, background: "#FF705A", margin: "6px auto 0" }}/>
                        </div>
                        <div style={{ textAlign: "center", fontWeight: 600, fontSize: 14, marginTop: 10 }}>{t.label}</div>
                      </div>
                    ))}
                  </div>
                </Section>
                <Section title="Langue">
                  <div style={{ display: "flex", gap: 8 }}>
                    {[
                      { id: "fr", label: "🇫🇷 Français" },
                      { id: "en", label: "🇬🇧 English" },
                      { id: "es", label: "🇪🇸 Español" }
                    ].map(l => (
                      <button key={l.id} className={"chip-toggle" + (language === l.id ? " on" : "")} onClick={() => setLanguage(l.id)}>
                        {l.label}
                      </button>
                    ))}
                  </div>
                </Section>
              </>
            )}

            {tab === "danger" && (
              <Section title="Zone à risque" desc="Ces actions sont définitives. Procède avec prudence." danger>
                <div className="danger-row">
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>Exporter mes données</div>
                    <div style={{ fontSize: 13, color: "var(--text-2)" }}>Télécharge l'ensemble de tes données BrightOff au format JSON.</div>
                  </div>
                  <button className="btn btn-sky-outline">Exporter</button>
                </div>
                <div className="danger-row">
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>Désactiver mon compte</div>
                    <div style={{ fontSize: 13, color: "var(--text-2)" }}>Met ton compte en pause. Tu pourras le réactiver à tout moment.</div>
                  </div>
                  <button className="btn btn-sky-outline">Désactiver</button>
                </div>
                <div className="danger-row danger">
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15, color: "var(--coral-dark)" }}>Supprimer mon compte</div>
                    <div style={{ fontSize: 13, color: "var(--text-2)" }}>Suppression définitive de toutes tes données. Cette action est irréversible.</div>
                  </div>
                  <button
                    className="btn"
                    style={{ background: "var(--coral-dark)", color: "white" }}
                    onClick={() => {
                      if (confirm("Es-tu vraiment sûr ? Cette action est définitive.")) onLogout && onLogout();
                    }}
                  >Supprimer</button>
                </div>
              </Section>
            )}

            {tab !== "danger" && (
              <div className="settings-actions">
                <button className="btn btn-coral" onClick={handleSave}>
                  {saved ? <><Icon name="check" size={16} color="white"/> Modifications enregistrées</> : "Enregistrer les modifications"}
                </button>
                <button className="btn btn-ghost" onClick={() => onNavigate("dashboard")}>Annuler</button>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
};

const Section = ({ title, desc, children, danger }) => (
  <div className={"settings-section" + (danger ? " danger" : "")}>
    <div className="section-head">
      <h2>{title}</h2>
      {desc && <div className="section-desc">{desc}</div>}
    </div>
    <div className="section-body">{children}</div>
  </div>
);

const Field = ({ label, children }) => (
  <label className="field">
    <span>{label}</span>
    {children}
  </label>
);

const Toggle = ({ label, desc, value, onChange }) => (
  <div className="toggle-row" onClick={() => onChange(!value)}>
    <div style={{ flex: 1 }}>
      <div style={{ fontWeight: 600, fontSize: 14 }}>{label}</div>
      {desc && <div style={{ fontSize: 13, color: "var(--text-2)", marginTop: 2 }}>{desc}</div>}
    </div>
    <div className={"toggle" + (value ? " on" : "")}>
      <div className="toggle-knob"/>
    </div>
  </div>
);

const AddLoc = ({ onAdd }) => {
  const [editing, setEditing] = React.useState(false);
  const [v, setV] = React.useState("");
  if (!editing) return <button className="badge-add" onClick={() => setEditing(true)}><Icon name="plus" size={12}/> Ajouter une ville</button>;
  return (
    <input
      autoFocus
      className="input"
      style={{ width: 160, padding: "6px 10px", fontSize: 13 }}
      placeholder="ex : Paris"
      value={v}
      onChange={e => setV(e.target.value)}
      onBlur={() => { if (v.trim()) onAdd(v.trim()); setV(""); setEditing(false); }}
      onKeyDown={e => { if (e.key === "Enter") { if (v.trim()) onAdd(v.trim()); setV(""); setEditing(false); } if (e.key === "Escape") { setV(""); setEditing(false); } }}
    />
  );
};

window.SettingsPage = SettingsPage;
