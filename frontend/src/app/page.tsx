import Link from "next/link";
import { NavPublic } from "@/components/ui";

/**
 * Landing page BrightOff — Sprint 3.
 * Server Component (pas de hooks client nécessaires).
 * Structure : NavPublic | Hero | "Comment ça marche" | Footer.
 * Les styles proviennent des classes @layer components de globals.css.
 */
export default function Home() {
  return (
    <>
      <NavPublic />

      {/* Hero */}
      <section className="hero-section">
        <div className="hero">
          <div>
            <h1>Trouvez le job qui vous ressemble</h1>
            <p className="sub">
              BrightOff analyse votre CV et vous propose des offres alignées avec vos compétences.
              Découvrez ce qui vous manque pour décrocher le poste idéal.
            </p>
            <Link href="/register" className="btn btn-coral btn-lg">
              Commencer maintenant
            </Link>
            <div className="micro">Gratuit · 100% en français</div>
          </div>
        </div>
      </section>

      {/* Comment ça marche */}
      <section className="how">
        <div className="how-inner">
          <h2>Comment ça marche</h2>
          <p className="h2sub">Trois étapes pour passer du CV au job idéal</p>
          <div className="how-grid">
            <div className="how-card">
              <div className="icon-wrap">📄</div>
              <h3>Upload de votre CV</h3>
              <p>
                Importez votre CV en PDF ou DOCX. Notre IA extrait automatiquement vos
                compétences, expériences et formations.
              </p>
            </div>
            <div className="how-card">
              <div className="icon-wrap">🎯</div>
              <h3>Matching intelligent</h3>
              <p>
                Recevez chaque jour des offres scrapées qui collent à votre profil, classées
                par score de correspondance.
              </p>
            </div>
            <div className="how-card">
              <div className="icon-wrap">📊</div>
              <h3>Gap Analysis</h3>
              <p>
                Pour chaque offre, voyez exactement les compétences manquantes et comment
                combler l&apos;écart.
              </p>
            </div>
          </div>
        </div>
      </section>

      <footer className="footer">© 2026 BrightOff · Tous droits réservés</footer>
    </>
  );
}
