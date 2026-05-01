/* App shell — orchestrates page navigation */

const App = () => {
  const [page, setPage] = React.useState("landing");
  const [selectedJob, setSelectedJob] = React.useState(null);
  const [user, setUser] = React.useState({ name: "Thomas Dupont" });

  // Scroll to top on page change
  React.useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [page, selectedJob]);

  const goTo = (p) => setPage(p);
  const handleLogout = () => {
    setSelectedJob(null);
    setPage("landing");
  };
  const navigate = (id) => {
    if (id === "dashboard") setPage("dashboard");
    else if (id === "profile") setPage("profile");
    else if (id === "applications") setPage("applications");
    else if (id === "settings") setPage("settings");
  };

  const openJob = (job) => {
    setSelectedJob(job);
    setPage("detail");
  };

  switch (page) {
    case "landing":
      return <LandingPage onSignup={() => goTo("signup")} onLogin={() => goTo("signup")}/>;
    case "signup":
      return <SignupPage
        onSubmit={(form) => {
          if (form.prenom || form.nom) {
            setUser({ name: `${form.prenom || "Thomas"} ${form.nom || "Dupont"}`.trim() });
          }
          goTo("onboarding");
        }}
        onLogin={() => goTo("onboarding")}
      />;
    case "onboarding":
      return <OnboardingPage onComplete={() => goTo("dashboard")}/>;
    case "dashboard":
      return <DashboardPage onOpen={openJob} onNavigate={navigate} userName={user.name} onLogout={handleLogout}/>;
    case "detail":
      return <JobDetailPage
        job={selectedJob || JOBS[0]}
        onBack={() => goTo("dashboard")}
        onNavigate={navigate}
        userName={user.name}
        onLogout={handleLogout}
      />;
    case "profile":
      return <ProfilePage
        onNavigate={navigate}
        userName={user.name}
        onReupload={() => goTo("onboarding")}
        onLogout={handleLogout}
      />;
    case "settings":
      return <SettingsPage
        onNavigate={navigate}
        userName={user.name}
        onLogout={handleLogout}
        onUserUpdate={(name) => setUser({ name })}
      />;
    case "applications":
      return <ApplicationsPage
        onNavigate={navigate}
        userName={user.name}
        onLogout={handleLogout}
        onOpenJob={(jobId) => {
          const job = JOBS.find(j => j.id === jobId);
          if (job) openJob(job);
        }}
      />;
    default:
      return <LandingPage onSignup={() => goTo("signup")} onLogin={() => goTo("signup")}/>;
  }
};

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App/>);
