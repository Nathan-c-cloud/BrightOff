/* Simple Lucide-style line icon set, returns React elements */
const Icon = ({ name, size = 20, color = "currentColor", strokeWidth = 2, ...props }) => {
  const common = {
    width: size, height: size, viewBox: "0 0 24 24",
    fill: "none", stroke: color, strokeWidth, strokeLinecap: "round", strokeLinejoin: "round",
    ...props
  };
  switch (name) {
    case "upload":
      return (<svg {...common}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>);
    case "target":
      return (<svg {...common}><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>);
    case "lightbulb":
      return (<svg {...common}><path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.7c.7.5 1 1.3 1 2.1V18h6v-1.2c0-.8.3-1.6 1-2.1A7 7 0 0 0 12 2z"/></svg>);
    case "bell":
      return (<svg {...common}><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>);
    case "search":
      return (<svg {...common}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>);
    case "heart":
      return (<svg {...common}><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>);
    case "arrow-right":
      return (<svg {...common}><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>);
    case "arrow-left":
      return (<svg {...common}><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>);
    case "check":
      return (<svg {...common}><polyline points="20 6 9 17 4 12"/></svg>);
    case "check-circle":
      return (<svg {...common}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>);
    case "x":
      return (<svg {...common}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="18" x2="18" y2="6"/></svg>);
    case "plus":
      return (<svg {...common}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>);
    case "file":
      return (<svg {...common}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>);
    case "sparkles":
      return (<svg {...common}><path d="M12 3l1.9 5.6L19.5 10l-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.4L12 3z"/></svg>);
    case "google":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24">
          <path fill="#4285F4" d="M21.35 11.1H12v3.2h5.35c-.23 1.45-1.69 4.25-5.35 4.25-3.22 0-5.85-2.66-5.85-5.95s2.63-5.95 5.85-5.95c1.83 0 3.05.78 3.75 1.45l2.56-2.46C16.7 4.13 14.55 3.2 12 3.2 6.98 3.2 3 7.18 3 12.2s3.98 9 9 9c5.2 0 8.65-3.65 8.65-8.79 0-.59-.07-1.04-.15-1.31z"/>
          <path fill="#34A853" d="M12 21.2c2.43 0 4.47-.81 5.96-2.18l-2.84-2.2c-.78.55-1.83.9-3.12.9-2.4 0-4.43-1.62-5.16-3.8H3.93v2.39A8.96 8.96 0 0 0 12 21.2z"/>
          <path fill="#FBBC05" d="M6.84 13.92a5.4 5.4 0 0 1 0-3.44V8.09H3.93a9 9 0 0 0 0 8.22l2.91-2.39z"/>
          <path fill="#EA4335" d="M12 6.95c1.32 0 2.5.46 3.43 1.34l2.51-2.51A8.94 8.94 0 0 0 12 3.2a8.96 8.96 0 0 0-8.07 4.89l2.91 2.39C7.57 8.57 9.6 6.95 12 6.95z"/>
        </svg>
      );
    case "map-pin":
      return (<svg {...common}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>);
    case "briefcase":
      return (<svg {...common}><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>);
    case "edit":
      return (<svg {...common}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>);
    case "menu-dots":
      return (<svg {...common}><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>);
    default: return null;
  }
};

window.Icon = Icon;
