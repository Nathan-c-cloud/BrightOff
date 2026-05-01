/* Inscription page (P2) */

const SignupPage = ({ onSubmit, onLogin }) => {
  const [form, setForm] = React.useState({ nom: "", prenom: "", email: "", pwd: "" });
  const [submitting, setSubmitting] = React.useState(false);
  const update = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const handleSubmit = (e) => {
    e.preventDefault();
    setSubmitting(true);
    setTimeout(() => onSubmit && onSubmit(form), 600);
  };
  const valid = form.nom && form.prenom && form.email.includes("@") && form.pwd.length >= 6;

  return (
    <div className="page-fade center-screen">
      <div className="center-card">
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <Logo size={26} />
        </div>
        <h1 style={{ margin: "0 0 6px", fontSize: 26, fontWeight: 800, letterSpacing: "-0.02em", textAlign: "center" }}>Créer un compte</h1>
        <p style={{ margin: "0 0 26px", color: "var(--text-2)", fontSize: 14, textAlign: "center" }}>Rejoins +12 000 jeunes diplômés qui ont trouvé leur match.</p>

        <form onSubmit={handleSubmit}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <label className="field">
              <span>Prénom</span>
              <input className="input" value={form.prenom} onChange={e => update("prenom", e.target.value)} placeholder="Thomas" />
            </label>
            <label className="field">
              <span>Nom</span>
              <input className="input" value={form.nom} onChange={e => update("nom", e.target.value)} placeholder="Dupont" />
            </label>
          </div>
          <label className="field">
            <span>Email</span>
            <input className="input" type="email" value={form.email} onChange={e => update("email", e.target.value)} placeholder="thomas.dupont@email.com" />
          </label>
          <label className="field">
            <span>Mot de passe</span>
            <input className="input" type="password" value={form.pwd} onChange={e => update("pwd", e.target.value)} placeholder="Minimum 6 caractères" />
          </label>

          <button type="submit" className="btn btn-coral" style={{ width: "100%", marginTop: 6, opacity: valid ? 1 : 0.65, pointerEvents: submitting ? "none" : "auto" }} disabled={!valid || submitting}>
            {submitting ? <span className="spinner"/> : "S'inscrire"}
          </button>
        </form>

        <div className="divider-or">ou</div>

        <button className="btn-google" onClick={() => onSubmit && onSubmit({ prenom: "Thomas", nom: "Dupont" })}>
          <Icon name="google" size={18}/> Continuer avec Google
        </button>

        <div style={{ marginTop: 22, textAlign: "center", fontSize: 14, color: "var(--text-2)" }}>
          Déjà un compte ? <a onClick={onLogin} style={{ cursor: "pointer", fontWeight: 600 }}>Se connecter</a>
        </div>
      </div>
    </div>
  );
};

window.SignupPage = SignupPage;
