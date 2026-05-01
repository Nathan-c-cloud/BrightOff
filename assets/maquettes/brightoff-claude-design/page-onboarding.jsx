/* Onboarding / CV upload (P3) */

const OnboardingPage = ({ onComplete }) => {
  const [stage, setStage] = React.useState("idle"); // idle | file | analyzing
  const [file, setFile] = React.useState(null);
  const [progress, setProgress] = React.useState(0);
  const [step, setStep] = React.useState(0);
  const [over, setOver] = React.useState(false);
  const inputRef = React.useRef();

  const steps = [
    "Lecture du document...",
    "Extraction des compétences techniques...",
    "Détection des soft skills et langues...",
    "Construction de ton profil personnalisé..."
  ];

  React.useEffect(() => {
    if (stage !== "analyzing") return;
    let p = 0;
    const id = setInterval(() => {
      p += 2;
      setProgress(p);
      setStep(Math.min(steps.length - 1, Math.floor(p / 26)));
      if (p >= 100) {
        clearInterval(id);
        setTimeout(() => onComplete && onComplete(), 500);
      }
    }, 60);
    return () => clearInterval(id);
  }, [stage]);

  const onFile = (f) => {
    if (!f) return;
    setFile(f);
    setStage("file");
  };

  return (
    <div className="page-fade center-screen">
      <div className="center-card wide" style={{ padding: "44px 48px" }}>
        <div style={{ textAlign: "center", marginBottom: 8 }}>
          <Logo size={24}/>
        </div>
        <h1 style={{ margin: "8px 0 8px", fontSize: 28, fontWeight: 800, letterSpacing: "-0.02em", textAlign: "center" }}>
          Bienvenue sur BrightOff <span style={{ display: "inline-block", transform: "translateY(-2px)" }}>🎉</span>
        </h1>
        <p style={{ margin: "0 0 28px", color: "var(--text-2)", fontSize: 15, textAlign: "center" }}>
          Uploade ton CV pour découvrir les offres qui te correspondent
        </p>

        {stage !== "analyzing" && (
          <>
            <div
              className={"dropzone" + (over ? " over" : "")}
              onClick={() => inputRef.current && inputRef.current.click()}
              onDragOver={e => { e.preventDefault(); setOver(true); }}
              onDragLeave={() => setOver(false)}
              onDrop={e => { e.preventDefault(); setOver(false); onFile(e.dataTransfer.files[0]); }}
            >
              <div className="up-icon"><Icon name="upload" size={26}/></div>
              {file ? (
                <>
                  <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>{file.name}</div>
                  <div style={{ color: "var(--text-2)", fontSize: 13 }}>{(file.size / 1024).toFixed(0)} Ko · prêt à analyser</div>
                </>
              ) : (
                <>
                  <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>Glisse ton CV ici ou clique pour parcourir</div>
                  <div style={{ color: "var(--text-2)", fontSize: 13 }}>Formats acceptés : PDF, DOCX</div>
                </>
              )}
              <input ref={inputRef} type="file" accept=".pdf,.docx" hidden onChange={e => onFile(e.target.files[0])}/>
            </div>

            <div style={{ display: "flex", gap: 12, marginTop: 24, alignItems: "center", justifyContent: "space-between" }}>
              <a style={{ color: "var(--text-2)", fontSize: 14, cursor: "pointer", fontWeight: 500 }} onClick={() => onComplete && onComplete()}>
                Passer cette étape →
              </a>
              <button
                className="btn btn-coral"
                disabled={!file}
                style={{ opacity: file ? 1 : 0.55, pointerEvents: file ? "auto" : "none" }}
                onClick={() => setStage("analyzing")}
              >
                Analyser mon CV
              </button>
            </div>
          </>
        )}

        {stage === "analyzing" && (
          <div style={{ padding: "24px 8px 8px" }}>
            <div style={{ textAlign: "center", marginBottom: 32 }}>
              <div style={{
                width: 72, height: 72, margin: "0 auto 18px", borderRadius: "50%",
                background: "var(--sky-light)", display: "flex", alignItems: "center", justifyContent: "center",
                animation: "pulse 1.5s ease-in-out infinite"
              }}>
                <Icon name="sparkles" size={32} color="#7AC7E6"/>
              </div>
              <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 4 }}>Analyse en cours...</div>
              <div style={{ color: "var(--text-2)", fontSize: 14 }}>Notre IA extrait tes compétences</div>
            </div>
            <div className="bar"><i style={{ width: progress + "%" }}/></div>
            <div style={{ marginTop: 14, color: "var(--text-2)", fontSize: 13, textAlign: "center", minHeight: 20 }}>
              <Icon name="check" size={14} color="var(--sky)"/> {steps[step]}
            </div>
          </div>
        )}
      </div>
      <style>{`@keyframes pulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.06); } }`}</style>
    </div>
  );
};

window.OnboardingPage = OnboardingPage;
