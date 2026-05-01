/* Landing page (P1) */

const LandingPage = ({ onSignup, onLogin }) => {
  return (
    <div className="page-fade">
      <NavPublic onSignup={onSignup} onLogin={onLogin} />

      <section style={{ maxWidth: 1200, margin: "0 auto", padding: "0 48px" }}>
        <div className="hero">
          <div>
            <h1>Trouve le job qui te correspond.<br/><span style={{ color: "var(--coral)" }}>Sache exactement</span> ce qui te manque.</h1>
            <p className="sub">Upload ton CV, découvre les offres qui matchent avec ton profil, et sache précisément quelles compétences développer pour décrocher le poste.</p>
            <button className="btn btn-coral btn-lg" onClick={onSignup}>
              Commencer gratuitement <Icon name="arrow-right" size={18} color="white"/>
            </button>
            <div className="micro">Pas de carte bancaire requise · 2 minutes pour démarrer</div>
          </div>
          <div>
            <DashboardPreview />
          </div>
        </div>
      </section>

      <section className="how">
        <div className="how-inner">
          <h2>Comment ça marche</h2>
          <p className="h2sub">Trois étapes pour passer du CV au job de tes rêves</p>
          <div className="how-grid">
            <div className="how-card">
              <div className="icon-wrap"><Icon name="upload" size={26}/></div>
              <h3>Uploade ton CV</h3>
              <p>Notre IA analyse tes compétences en 30 secondes et construit automatiquement ton profil.</p>
            </div>
            <div className="how-card">
              <div className="icon-wrap"><Icon name="target" size={26}/></div>
              <h3>Découvre tes matchs</h3>
              <p>Des offres triées par pertinence avec un score de 0 à 100% calculé sur tes compétences réelles.</p>
            </div>
            <div className="how-card">
              <div className="icon-wrap"><Icon name="lightbulb" size={26}/></div>
              <h3>Comble tes lacunes</h3>
              <p>Sache exactement quoi apprendre — et où — pour faire grimper ton score et décrocher le job.</p>
            </div>
          </div>
        </div>
      </section>

      <footer className="footer">BrightOff © 2026</footer>
    </div>
  );
};

/* Visual mockup of dashboard for hero */
const DashboardPreview = () => (
  <div style={{
    background: "white",
    borderRadius: 14,
    boxShadow: "0 20px 50px rgba(43,58,74,0.12), 0 6px 16px rgba(43,58,74,0.05)",
    padding: 18,
    border: "1px solid var(--border-light)",
    transform: "rotate(0.5deg)"
  }}>
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
      <div style={{ fontWeight: 700, fontSize: 14 }}>8 offres pour toi</div>
      <div style={{ display: "flex", gap: 4 }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#FF705A" }}></span>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#FFC2AC" }}></span>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#7AC7E6" }}></span>
      </div>
    </div>
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {[
        { t: "Fullstack Developer", c: "E-commerce · Bordeaux", s: 91, col: "#7AC7E6" },
        { t: "Développeur Fullstack Junior", c: "TechStartup · Paris", s: 85, col: "#FF705A" },
        { t: "Ingénieur Logiciel Junior", c: "SaaS Corp · Lyon", s: 78, col: "#ADF7B6" }
      ].map((j, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: 10, background: "var(--bg-cream)", borderRadius: 8 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: j.col, display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: 700, fontSize: 12 }}>
            {j.t.split(" ").map(w => w[0]).slice(0, 2).join("")}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{j.t}</div>
            <div style={{ fontSize: 11, color: "var(--text-2)" }}>{j.c}</div>
          </div>
          <div style={{ fontSize: 18, fontWeight: 800, color: "var(--coral)" }}>{j.s}%</div>
        </div>
      ))}
    </div>
    <div style={{
      marginTop: 14,
      padding: 12,
      background: "var(--peach)",
      borderRadius: 10,
      fontSize: 12,
      color: "#5a2a1d",
      display: "flex",
      gap: 8,
      alignItems: "flex-start"
    }}>
      <Icon name="lightbulb" size={16} color="#5a2a1d"/>
      <span><b>Apprends Node.js</b> pour passer de 78% → 93% de match</span>
    </div>
  </div>
);

window.LandingPage = LandingPage;
