"""Benchmark Claude API pour le parsing de CVs PDF/DOCX.

Compare Sonnet 4.6 et Haiku 4.5 sur des CVs réels pour valider la qualité
d'extraction avant d'implémenter l'endpoint de prod (S3-10 / S3-11).

Usage :
    cd backend
    source venv/bin/activate
    python -m scripts.benchmark_claude_cv --model both
    python -m scripts.benchmark_claude_cv --model sonnet --cvs-dir scripts/benchmark_cvs
"""

from __future__ import annotations

import argparse
import csv
import json
import logging
import os
import re
import sys
import time
from dataclasses import dataclass, field
from pathlib import Path

# ---------------------------------------------------------------------------
# Imports conditionnels — vérification des dépendances au démarrage
# ---------------------------------------------------------------------------
try:
    import pdfplumber
except ImportError:
    print("Erreur : pdfplumber non installé. Lancez : pip install pdfplumber==0.11.9")
    sys.exit(1)

try:
    import docx  # python-docx
except ImportError:
    print("Erreur : python-docx non installé. Lancez : pip install python-docx==1.2.0")
    sys.exit(1)

try:
    import anthropic
except ImportError:
    print("Erreur : anthropic non installé. Lancez : pip install anthropic==0.49.0")
    sys.exit(1)

# ---------------------------------------------------------------------------
# Import config — doit être fait APRÈS avoir set ENVIRONMENT si nécessaire
# ---------------------------------------------------------------------------
# Le script tourne hors contexte web : on force dev pour éviter le validateur
# _enforce_prod_safety (DEBUG=False donc pas de risque réel).
os.environ.setdefault("ENVIRONMENT", "dev")
os.environ.setdefault("JWT_SECRET_KEY", "benchmark-script-only-not-prod-32chars-min")

from app.core.config import settings  # noqa: E402

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constantes
# ---------------------------------------------------------------------------

SUPPORTED_EXTENSIONS = {".pdf", ".docx"}

# Limite de caractères envoyés à Claude pour éviter des tokens excessifs.
# Un CV bien chargé dépasse rarement 15 000 chars — 30 000 est volontairement
# large pour ne pas tronquer les CVs denses (tableaux, multi-colonnes).
MAX_TEXT_CHARS = 30_000

# Identifiants de modèles Anthropic
MODEL_IDS = {
    "sonnet": "claude-sonnet-4-6",
    "haiku": "claude-haiku-4-5-20251001",
}

# Tarification 2026 ($/million de tokens)
PRICING = {
    "claude-sonnet-4-6": {
        "input": 3.00,
        "output": 15.00,
        "cache_read": 0.30,
        "cache_create": 3.75,
    },
    "claude-haiku-4-5-20251001": {
        "input": 1.00,
        "output": 5.00,
        "cache_read": 0.10,
        "cache_create": 1.25,
    },
}

# ---------------------------------------------------------------------------
# System prompt — identique entre tous les appels → cache_control ephemeral
# ---------------------------------------------------------------------------

SYSTEM_PROMPT = """Tu es un extracteur de données structurées spécialisé dans l'analyse de CVs professionnels.

Ta tâche est d'analyser le document fourni et de répondre UNIQUEMENT avec un objet JSON valide, sans aucun texte autour (pas de markdown, pas d'explication).

## Étape 1 — Détecter si le document est un CV

Si le document n'est PAS un CV (ex : lettre de motivation, fiche de poste, article, contrat...), retourne :
{"is_cv": false, "reason": "Description courte en 1 phrase de ce que c'est réellement"}

## Étape 2 — Si c'est un CV, extraire le profil structuré

Retourne exactement ce schéma JSON :

{
  "is_cv": true,
  "title": "string ou null — poste/titre recherché en 1 ligne (ex: 'Développeur Fullstack Senior'). null si absent",
  "summary": "string ou null — résumé ou objectif professionnel si présent dans le CV. null si absent",
  "years_of_experience": "int ou null — années d'expérience cumulées calculées depuis les dates d'expériences. null si non déductible",
  "skills": [
    {
      "name": "string — nom exact de la compétence (ex: 'Python', 'AWS', 'Gestion de projet')",
      "category": "string — OBLIGATOIREMENT l'une de ces valeurs : 'tech' | 'soft' | 'tool' | 'language' | 'other'",
      "level": "int 1 à 5 ou null — niveau si explicitement mentionné ou clairement déductible, sinon null"
    }
  ],
  "experiences": [
    {
      "company": "string — nom de l'entreprise ou organisation",
      "position": "string — intitulé du poste",
      "start_date": "string — format YYYY-MM-DD. Si seul le mois est connu : YYYY-MM-01. Si seule l'année : YYYY-01-01",
      "end_date": "string ou null — même format. null si le poste est en cours",
      "description": "string ou null — résumé court des missions en 2-3 phrases si fourni. null si absent"
    }
  ],
  "education": [
    {
      "school": "string — nom de l'établissement",
      "degree": "string — intitulé du diplôme (ex: 'Master Informatique', 'BTS SIO', 'Licence Pro')",
      "field": "string ou null — domaine d'études si distinct du nom du diplôme. null sinon",
      "start_date": "string — format YYYY-MM-DD (même règle que les expériences)",
      "end_date": "string ou null — même format. null si en cours"
    }
  ],
  "languages": [
    {
      "name": "string — nom de la langue (ex: 'Anglais', 'Français', 'Espagnol')",
      "level": "string — OBLIGATOIREMENT l'une de ces valeurs : 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2' | 'Natif' | 'Bilingue'"
    }
  ]
}

## Règles strictes

1. **JSON pur uniquement** — zéro texte autour. La réponse commence par { et finit par }.
2. **Champs manquants → null** — jamais de chaîne vide "", jamais de champ absent.
3. **Catégories de skills** :
   - 'tech' : langages de programmation, frameworks, technologies (Python, React, SQL, AWS, Docker...)
   - 'tool' : outils logiciels utilisés mais non programmés (Git, Jira, Figma, Excel, VS Code...)
   - 'soft' : compétences comportementales (Communication, Leadership, Travail en équipe...)
   - 'language' : langues parlées (Anglais, Espagnol...) — peut figurer EN PLUS du tableau languages
   - 'other' : tout ce qui ne rentre pas dans les catégories ci-dessus
4. **Dates** : si seul le mois est connu → YYYY-MM-01. Si seule l'année → YYYY-01-01.
5. **Langue du CV** : extraire dans la langue originale du document, sans traduire.
6. **Aucune hallucination** : n'invente aucune information absente du CV. Si un champ n'est pas présent, mettre null.
7. **years_of_experience** : calculer à partir des dates de début/fin des expériences. En cas de chevauchement, ne pas doubler compter. Arrondir à l'entier inférieur.

## Edge cases documentés

**CV en anglais** : extraire les données dans la langue originale du document. Ne jamais traduire. Un "Software Engineer" reste "Software Engineer", "Python" reste "Python".

**Dates partielles** : "2020 - présent" → `start_date: "2020-01-01"`, `end_date: null`. "Mars 2021" → `"2021-03-01"`. "2019" seul → `"2019-01-01"`. Ne jamais inventer un mois ou un jour non mentionné.

**Skills sans niveau explicite** : si le CV ne précise pas le niveau de maîtrise d'une compétence (pas de mention "avancé", "débutant", pas de barre de progression, pas d'étoiles...), mettre `"level": null`. Ne jamais deviner un niveau.

**Formations sans date de fin** : si une formation est en cours, `end_date: null`. Si seule l'année de diplôme est connue, `start_date: "YYYY-01-01"`, `end_date: "YYYY-06-01"` (convention juin pour les diplômes de fin d'année).

**Expériences multiples simultanées** : certains profils cumulent emploi + alternance + freelance. Extraire toutes les expériences même si les dates se chevauchent. Ne pas fusionner.

## Exemples de réponses attendues

**Exemple 1 — CV junior (2 ans d'expérience, peu de skills)**

Texte d'entrée : "Marie Dupont — Développeuse Web Junior. Compétences : HTML, CSS, JavaScript, React (débutante). Expérience : Stagiaire développeuse web chez Agence Pixel, juin 2023 - août 2023. Formation : BUT Informatique, IUT Lyon, 2021-2024. Langues : Français (natif), Anglais (B2)."

Sortie attendue :
{"is_cv": true, "title": "Développeuse Web Junior", "summary": null, "years_of_experience": 0, "skills": [{"name": "HTML", "category": "tech", "level": null}, {"name": "CSS", "category": "tech", "level": null}, {"name": "JavaScript", "category": "tech", "level": null}, {"name": "React", "category": "tech", "level": 1}], "experiences": [{"company": "Agence Pixel", "position": "Stagiaire développeuse web", "start_date": "2023-06-01", "end_date": "2023-08-01", "description": null}], "education": [{"school": "IUT Lyon", "degree": "BUT Informatique", "field": null, "start_date": "2021-01-01", "end_date": "2024-01-01"}], "languages": [{"name": "Français", "level": "Natif"}, {"name": "Anglais", "level": "B2"}]}

**Exemple 2 — CV senior (8 ans d'expérience, nombreux skills)**

Texte d'entrée : "Thomas Martin — Lead Développeur Fullstack. 8 ans d'expérience. Skills : Python (expert), Django, FastAPI, React, TypeScript, PostgreSQL, Docker, Kubernetes, AWS (avancé), Git, Jira. Leadership, mentorat. Expériences : Lead Dev Backend chez FinTech SA, 2020-présent. Développeur Senior chez WebAgency, 2017-2020. Développeur Junior chez StartupX, 2016-2017. Formation : Master Informatique, Université Paris-Saclay, 2014-2016. Licence Informatique, 2011-2014. Langues : Français (natif), Anglais (C1), Espagnol (B1)."

Sortie attendue :
{"is_cv": true, "title": "Lead Développeur Fullstack", "summary": null, "years_of_experience": 8, "skills": [{"name": "Python", "category": "tech", "level": 5}, {"name": "Django", "category": "tech", "level": null}, {"name": "FastAPI", "category": "tech", "level": null}, {"name": "React", "category": "tech", "level": null}, {"name": "TypeScript", "category": "tech", "level": null}, {"name": "PostgreSQL", "category": "tech", "level": null}, {"name": "Docker", "category": "tech", "level": null}, {"name": "Kubernetes", "category": "tech", "level": null}, {"name": "AWS", "category": "tech", "level": 4}, {"name": "Git", "category": "tool", "level": null}, {"name": "Jira", "category": "tool", "level": null}, {"name": "Leadership", "category": "soft", "level": null}, {"name": "Mentorat", "category": "soft", "level": null}], "experiences": [{"company": "FinTech SA", "position": "Lead Dev Backend", "start_date": "2020-01-01", "end_date": null, "description": null}, {"company": "WebAgency", "position": "Développeur Senior", "start_date": "2017-01-01", "end_date": "2020-01-01", "description": null}, {"company": "StartupX", "position": "Développeur Junior", "start_date": "2016-01-01", "end_date": "2017-01-01", "description": null}], "education": [{"school": "Université Paris-Saclay", "degree": "Master Informatique", "field": null, "start_date": "2014-01-01", "end_date": "2016-06-01"}, {"school": "Université Paris-Saclay", "degree": "Licence Informatique", "field": null, "start_date": "2011-01-01", "end_date": "2014-06-01"}], "languages": [{"name": "Français", "level": "Natif"}, {"name": "Anglais", "level": "C1"}, {"name": "Espagnol", "level": "B1"}]}

## CONTRAINTES STRICTES DE FORMAT

Ta réponse DOIT être un objet JSON valide respectant ces règles sans exception :
- Premier caractère de ta réponse : `{`
- Dernier caractère de ta réponse : `}`
- Aucun texte avant le `{` (pas de "Voici le JSON :", pas de "Bien sûr,", pas d'introduction)
- Aucun texte après le `}` (pas de commentaire, pas d'explication)
- Aucun bloc markdown (interdit : ```json, ```, ou toute autre balise)
- Aucun commentaire JSON (le format JSON standard ne supporte pas les commentaires)
- Tous les champs du schéma doivent être présents même si leur valeur est null

Si tu hésites entre deux interprétations d'une donnée du CV, choisis celle qui produit le JSON le plus structuré et le plus rempli avec des données réellement présentes dans le document. En cas de doute sur l'existence d'une information, préférer null plutôt qu'une valeur inventée."""


# ---------------------------------------------------------------------------
# Dataclasses de résultats
# ---------------------------------------------------------------------------


@dataclass
class ParseResult:
    """Résultat d'un appel Claude pour un CV."""

    cv_name: str
    model: str
    model_id: str
    latency_ms: float
    input_tokens: int
    output_tokens: int
    cache_read_tokens: int
    cache_create_tokens: int
    cost_usd: float
    parsed_ok: bool
    is_cv: bool | None
    n_skills: int
    n_experiences: int
    n_education: int
    n_languages: int
    error: str
    raw_json: dict = field(default_factory=dict)


# ---------------------------------------------------------------------------
# Extraction de texte
# ---------------------------------------------------------------------------


def extract_text_pdf(path: Path) -> str:
    """Extrait le texte d'un PDF via pdfplumber.

    pdfplumber gère mieux les PDFs multi-colonnes que PyPDF2 grâce à son
    algorithme de reconstruction des lignes basé sur les positions des glyphes.
    """
    pages_text: list[str] = []
    with pdfplumber.open(path) as pdf:
        for page in pdf.pages:
            text = page.extract_text()
            if text:
                pages_text.append(text)
    return "\n\n".join(pages_text)


def extract_text_docx(path: Path) -> str:
    """Extrait le texte d'un fichier DOCX via python-docx."""
    doc = docx.Document(str(path))
    paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
    return "\n".join(paragraphs)


def extract_text(path: Path) -> str | None:
    """Dispatch l'extraction selon l'extension. Retourne None si non supporté."""
    ext = path.suffix.lower()
    if ext == ".pdf":
        return extract_text_pdf(path)
    if ext == ".docx":
        return extract_text_docx(path)
    log.warning("Extension non supportée : %s — fichier ignoré.", path.name)
    return None


# ---------------------------------------------------------------------------
# Calcul du coût
# ---------------------------------------------------------------------------


def compute_cost(model_id: str, usage: anthropic.types.Usage) -> float:
    """Calcule le coût USD d'un appel Claude selon la tarification 2026."""
    p = PRICING[model_id]
    # Les tokens d'input facturés normalement = total input - cache_read - cache_create
    cache_read = getattr(usage, "cache_read_input_tokens", 0) or 0
    cache_create = getattr(usage, "cache_creation_input_tokens", 0) or 0
    normal_input = max(0, usage.input_tokens - cache_read - cache_create)

    cost = (
            (normal_input / 1_000_000) * p["input"]
            + (usage.output_tokens / 1_000_000) * p["output"]
            + (cache_read / 1_000_000) * p["cache_read"]
            + (cache_create / 1_000_000) * p["cache_create"]
    )
    return cost


# ---------------------------------------------------------------------------
# Parseur JSON tolérant au markdown wrapping
# ---------------------------------------------------------------------------


def extract_json_from_response(raw_text: str) -> dict:
    """Extrait un objet JSON depuis une réponse Claude potentiellement enveloppée en markdown.

    Stratégie en 3 passes :
    1. Tentative directe (réponse déjà propre)
    2. Extraction depuis un bloc ```json ... ``` ou ``` ... ``` (Haiku wrappe souvent)
    3. Extraction par balises { ... } (JSON inline avec texte autour)
    Lève ValueError si aucune passe ne réussit.
    """
    # Passe 1 — JSON brut
    stripped = raw_text.strip()
    try:
        return json.loads(stripped)
    except json.JSONDecodeError:
        pass

    # Passe 2 — bloc markdown ```json ... ``` ou ``` ... ```
    # Pattern greedy sur \{.*\} pour capturer le JSON complet (avec imbrications)
    match = re.search(r"```(?:json)?\s*(\{.*\})\s*```", stripped, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(1))
        except json.JSONDecodeError:
            pass

    # Passe 3 — premier { ... dernier } (JSON inline avec préambule/postambule)
    first_brace = stripped.find("{")
    last_brace = stripped.rfind("}")
    if first_brace != -1 and last_brace > first_brace:
        try:
            return json.loads(stripped[first_brace : last_brace + 1])
        except json.JSONDecodeError:
            pass

    raise ValueError("Aucun JSON valide trouvé dans la réponse Claude")


# ---------------------------------------------------------------------------
# Appel Claude
# ---------------------------------------------------------------------------


def call_claude(
        client: anthropic.Anthropic,
        model_id: str,
        cv_text: str,
        cv_name: str,
        output_dir: Path,
) -> ParseResult:
    """Appelle Claude pour extraire le profil d'un CV.

    Le system prompt est identique entre tous les appels → cache_control ephemeral
    permet à Anthropic de mettre en cache les tokens du system prompt et de ne
    les facturer qu'au premier appel (cache_create), puis à tarif réduit (cache_read).

    output_dir est nécessaire pour sauvegarder la réponse brute systématiquement,
    indépendamment du succès ou de l'échec du parsing JSON.
    """
    model_alias = {v: k for k, v in MODEL_IDS.items()}[model_id]

    # Tronquer si nécessaire
    if len(cv_text) > MAX_TEXT_CHARS:
        log.warning(
            "[%s | %s] Texte tronqué : %d chars → %d chars",
            cv_name,
            model_alias,
            len(cv_text),
            MAX_TEXT_CHARS,
        )
        cv_text = cv_text[:MAX_TEXT_CHARS]

    user_message = f"Voici le texte extrait du document à analyser :\n\n{cv_text}"

    t0 = time.perf_counter()
    try:
        response = client.messages.create(
            model=model_id,
            max_tokens=4096,
            temperature=0,
            # cache_control sur le system prompt : le contenu est identique entre
            # tous les appels du benchmark → Anthropic met en cache après le 1er appel.
            system=[
                {
                    "type": "text",
                    "text": SYSTEM_PROMPT,
                    "cache_control": {"type": "ephemeral"},
                }
            ],
            messages=[{"role": "user", "content": user_message}],
        )
        latency_ms = (time.perf_counter() - t0) * 1000

        raw_text = response.content[0].text
        usage = response.usage
        cache_read = getattr(usage, "cache_read_input_tokens", 0) or 0
        cache_create = getattr(usage, "cache_creation_input_tokens", 0) or 0
        cost = compute_cost(model_id, usage)

        # Sauvegarde systématique de la réponse brute — AVANT le parsing JSON.
        # Indispensable pour diagnostiquer les échecs de parsing (markdown wrapping,
        # préambule, JSON tronqué...) sans avoir à relancer un appel API coûteux.
        raw_path = output_dir / f"{cv_name}__{model_alias}__raw.txt"
        raw_path.write_text(raw_text, encoding="utf-8")
        log.debug("[%s | %s] Réponse brute sauvée : %s", cv_name, model_alias, raw_path)

        # Parsing JSON tolérant au markdown wrapping (Haiku enveloppe souvent en ```json)
        try:
            parsed = extract_json_from_response(raw_text)
            parsed_ok = True
            error = ""
        except (json.JSONDecodeError, ValueError) as e:
            parsed = {}
            parsed_ok = False
            error = f"ParseError: {e}"
            log.error(
                "[%s | %s] Réponse non parseable (raw sauvé dans %s) : %s",
                cv_name,
                model_alias,
                raw_path.name,
                error,
            )

        is_cv = parsed.get("is_cv") if parsed_ok else None
        n_skills = len(parsed.get("skills") or []) if parsed_ok else 0
        n_experiences = len(parsed.get("experiences") or []) if parsed_ok else 0
        n_education = len(parsed.get("education") or []) if parsed_ok else 0
        n_languages = len(parsed.get("languages") or []) if parsed_ok else 0

        return ParseResult(
            cv_name=cv_name,
            model=model_alias,
            model_id=model_id,
            latency_ms=latency_ms,
            input_tokens=usage.input_tokens,
            output_tokens=usage.output_tokens,
            cache_read_tokens=cache_read,
            cache_create_tokens=cache_create,
            cost_usd=cost,
            parsed_ok=parsed_ok,
            is_cv=is_cv,
            n_skills=n_skills,
            n_experiences=n_experiences,
            n_education=n_education,
            n_languages=n_languages,
            error=error,
            raw_json=parsed,
        )

    except anthropic.APIError as e:
        latency_ms = (time.perf_counter() - t0) * 1000
        log.error("[%s | %s] Erreur API : %s", cv_name, model_alias, e)
        return ParseResult(
            cv_name=cv_name,
            model=model_alias,
            model_id=model_id,
            latency_ms=latency_ms,
            input_tokens=0,
            output_tokens=0,
            cache_read_tokens=0,
            cache_create_tokens=0,
            cost_usd=0.0,
            parsed_ok=False,
            is_cv=None,
            n_skills=0,
            n_experiences=0,
            n_education=0,
            n_languages=0,
            error=f"APIError: {e}",
        )


# ---------------------------------------------------------------------------
# Sauvegarde des résultats
# ---------------------------------------------------------------------------


def save_json_result(output_dir: Path, result: ParseResult) -> None:
    """Sauvegarde le JSON brut retourné par Claude."""
    filename = f"{result.cv_name}__{result.model}.json"
    dest = output_dir / filename
    with dest.open("w", encoding="utf-8") as f:
        json.dump(result.raw_json, f, ensure_ascii=False, indent=2)
    log.info("JSON sauvé : %s", dest)


def append_csv_row(csv_path: Path, result: ParseResult) -> None:
    """Ajoute une ligne au CSV récapitulatif."""
    write_header = not csv_path.exists()
    with csv_path.open("a", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        if write_header:
            writer.writerow(
                [
                    "cv_name",
                    "model",
                    "latency_ms",
                    "input_tokens",
                    "output_tokens",
                    "cache_read",
                    "cache_create",
                    "cost_usd",
                    "parsed_ok",
                    "is_cv",
                    "n_skills",
                    "n_experiences",
                    "n_education",
                    "n_languages",
                    "error",
                ]
            )
        writer.writerow(
            [
                result.cv_name,
                result.model,
                f"{result.latency_ms:.0f}",
                result.input_tokens,
                result.output_tokens,
                result.cache_read_tokens,
                result.cache_create_tokens,
                f"{result.cost_usd:.6f}",
                result.parsed_ok,
                result.is_cv,
                result.n_skills,
                result.n_experiences,
                result.n_education,
                result.n_languages,
                result.error,
            ]
        )


# ---------------------------------------------------------------------------
# Génération du rapport Markdown
# ---------------------------------------------------------------------------


def generate_report(results: list[ParseResult], output_dir: Path) -> str:
    """Génère un rapport Markdown de synthèse et le sauvegarde."""
    lines: list[str] = ["# Rapport Benchmark Claude CV Parsing\n"]
    lines.append(f"Date : {time.strftime('%Y-%m-%d %H:%M:%S')}\n")
    lines.append(f"Fichiers analysés : {len({r.cv_name for r in results})}\n")
    lines.append("")

    # ---- Tableau récap par modèle ----
    lines.append("## Synthèse par modèle\n")
    lines.append(
        "| Modèle | Appels | Parsing OK | Latence moy. (ms) | Coût total ($) |"
    )
    lines.append("|--------|--------|------------|-------------------|----------------|")

    models = sorted({r.model for r in results})
    model_stats: dict[str, dict] = {}

    for model in models:
        model_results = [r for r in results if r.model == model]
        n_total = len(model_results)
        n_ok = sum(1 for r in model_results if r.parsed_ok)
        avg_latency = sum(r.latency_ms for r in model_results) / n_total if n_total else 0
        total_cost = sum(r.cost_usd for r in model_results)
        model_stats[model] = {
            "n_total": n_total,
            "n_ok": n_ok,
            "avg_latency": avg_latency,
            "total_cost": total_cost,
            "results": model_results,
        }
        lines.append(
            f"| {model} | {n_total} | {n_ok}/{n_total} "
            f"| {avg_latency:.0f} | {total_cost:.4f} |"
        )

    lines.append("")

    # ---- Détail par CV ----
    lines.append("## Détail par CV\n")
    cv_names = sorted({r.cv_name for r in results})

    for cv_name in cv_names:
        lines.append(f"### {cv_name}\n")
        cv_results = [r for r in results if r.cv_name == cv_name]
        lines.append("| Modèle | is_cv | Skills | Expé. | Diplômes | Langues | Latence (ms) | Coût ($) | Erreur |")
        lines.append("|--------|-------|--------|-------|----------|---------|--------------|----------|--------|")
        for r in cv_results:
            err_short = (r.error[:40] + "...") if len(r.error) > 40 else r.error
            lines.append(
                f"| {r.model} | {r.is_cv} | {r.n_skills} | {r.n_experiences} "
                f"| {r.n_education} | {r.n_languages} | {r.latency_ms:.0f} "
                f"| {r.cost_usd:.4f} | {err_short} |"
            )
        lines.append("")

    # ---- Comparaison qualitative sur le 1er CV commun aux 2 modèles ----
    if "sonnet" in model_stats and "haiku" in model_stats:
        common_cvs = {r.cv_name for r in model_stats["sonnet"]["results"]} & {
            r.cv_name for r in model_stats["haiku"]["results"]
        }
        if common_cvs:
            ref_cv = sorted(common_cvs)[0]
            sonnet_r = next(r for r in results if r.cv_name == ref_cv and r.model == "sonnet")
            haiku_r = next(r for r in results if r.cv_name == ref_cv and r.model == "haiku")

            lines.append(f"## Comparaison qualitative — CV de référence : `{ref_cv}`\n")
            lines.append("| Critère | Sonnet 4.6 | Haiku 4.5 |")
            lines.append("|---------|------------|-----------|")
            lines.append(f"| Parsing OK | {sonnet_r.parsed_ok} | {haiku_r.parsed_ok} |")
            lines.append(f"| is_cv détecté | {sonnet_r.is_cv} | {haiku_r.is_cv} |")
            lines.append(f"| Nombre de skills | {sonnet_r.n_skills} | {haiku_r.n_skills} |")
            lines.append(f"| Nombre d'expériences | {sonnet_r.n_experiences} | {haiku_r.n_experiences} |")
            lines.append(f"| Nombre de diplômes | {sonnet_r.n_education} | {haiku_r.n_education} |")
            lines.append(f"| Nombre de langues | {sonnet_r.n_languages} | {haiku_r.n_languages} |")
            lines.append(f"| Latence (ms) | {sonnet_r.latency_ms:.0f} | {haiku_r.latency_ms:.0f} |")
            lines.append(f"| Coût ($) | {sonnet_r.cost_usd:.4f} | {haiku_r.cost_usd:.4f} |")
            lines.append("")

    # ---- Recommandation finale ----
    lines.append("## Recommandation\n")

    if "sonnet" in model_stats and "haiku" in model_stats:
        s = model_stats["sonnet"]
        h = model_stats["haiku"]
        s_rate = s["n_ok"] / s["n_total"] if s["n_total"] else 0
        h_rate = h["n_ok"] / h["n_total"] if h["n_total"] else 0

        if s_rate > h_rate:
            rec = "sonnet"
            reason = (
                f"Sonnet 4.6 a un taux de parsing supérieur ({s_rate:.0%} vs {h_rate:.0%}). "
                "La fiabilité prime sur le coût pour le parsing de CV (donnée critique)."
            )
        elif h_rate == s_rate:
            # Même qualité → préférer Haiku (moins cher, plus rapide)
            rec = "haiku"
            reason = (
                f"Même taux de parsing ({s_rate:.0%}). "
                f"Haiku 4.5 est {s['avg_latency'] / h['avg_latency']:.1f}x plus rapide "
                f"et {s['total_cost'] / h['total_cost']:.1f}x moins cher — recommandé."
            )
        else:
            rec = "haiku"
            reason = (
                f"Haiku 4.5 a un taux de parsing équivalent ou supérieur ({h_rate:.0%} vs {s_rate:.0%}) "
                "à moindre coût. Recommandé pour la prod."
            )

        lines.append(f"**Modèle recommandé : {rec.upper()}**\n")
        lines.append(reason)
        lines.append("")
        lines.append(
            "> Note : inspecter les JSONs dans `benchmark_results/` pour évaluer "
            "la qualité des dates extraites et la cohérence des catégories de skills. "
            "Un taux de parsing OK élevé ne garantit pas la précision des données."
        )
    else:
        lines.append("Benchmark incomplet — relancer avec `--model both` pour la recommandation.")

    lines.append("")
    lines.append("---")
    lines.append("*Rapport généré automatiquement par `benchmark_claude_cv.py`*")

    report = "\n".join(lines)
    report_path = output_dir / "REPORT.md"
    with report_path.open("w", encoding="utf-8") as f:
        f.write(report)
    log.info("Rapport sauvé : %s", report_path)
    return report


# ---------------------------------------------------------------------------
# Point d'entrée principal
# ---------------------------------------------------------------------------


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Benchmark Claude API pour le parsing de CVs BrightOff."
    )
    parser.add_argument(
        "--model",
        choices=["sonnet", "haiku", "both"],
        default="both",
        help="Modèle(s) à utiliser (défaut : both)",
    )
    parser.add_argument(
        "--cvs-dir",
        type=Path,
        default=Path("scripts/benchmark_cvs"),
        help="Dossier contenant les CVs à analyser (défaut : scripts/benchmark_cvs)",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path("scripts/benchmark_results"),
        help="Dossier de sortie pour les résultats (défaut : scripts/benchmark_results)",
    )
    return parser.parse_args()


def collect_cv_files(cvs_dir: Path) -> list[Path]:
    """Retourne les fichiers PDF/DOCX du dossier, triés par nom."""
    if not cvs_dir.exists():
        log.error("Le dossier CVs n'existe pas : %s", cvs_dir)
        return []
    files = sorted(
        p for p in cvs_dir.iterdir() if p.suffix.lower() in SUPPORTED_EXTENSIONS
    )
    return files


def main() -> None:
    args = parse_args()

    # Résolution des chemins par rapport au répertoire de travail courant
    cvs_dir = args.cvs_dir
    output_dir = args.output_dir

    # Déterminer les modèles à utiliser
    models_to_run = list(MODEL_IDS.keys()) if args.model == "both" else [args.model]

    # Collecter les fichiers CV
    cv_files = collect_cv_files(cvs_dir)

    if not cv_files:
        log.info(
            "Aucun fichier CV trouvé dans '%s'. "
            "Placez des CVs (PDF/DOCX) dans ce dossier puis relancez.",
            cvs_dir,
        )
        return

    log.info("%d fichier(s) trouvé(s) dans %s", len(cv_files), cvs_dir)
    log.info("Modèles : %s", ", ".join(models_to_run))

    # Vérifier la clé API
    api_key = settings.ANTHROPIC_API_KEY
    if not api_key:
        log.error(
            "ANTHROPIC_API_KEY est vide. Ajoutez-la dans backend/.env et relancez."
        )
        sys.exit(1)

    # Créer le dossier de sortie
    output_dir.mkdir(parents=True, exist_ok=True)
    csv_path = output_dir / "summary.csv"

    # Supprimer le CSV précédent pour repartir propre (idempotent)
    if csv_path.exists():
        csv_path.unlink()
        log.info("CSV précédent supprimé — repartir propre.")

    client = anthropic.Anthropic(api_key=api_key)
    all_results: list[ParseResult] = []

    # ---- Boucle principale ----
    for cv_path in cv_files:
        cv_name = cv_path.stem

        log.info("--- Fichier : %s ---", cv_path.name)

        # Extraction du texte
        try:
            cv_text = extract_text(cv_path)
        except Exception as e:
            log.error("Impossible d'extraire le texte de '%s' : %s", cv_path.name, e)
            continue

        if not cv_text:
            log.warning("Texte vide extrait de '%s' — fichier ignoré.", cv_path.name)
            continue

        log.info("Texte extrait : %d chars", len(cv_text))

        # Appels Claude par modèle
        for model_alias in models_to_run:
            model_id = MODEL_IDS[model_alias]
            log.info("Appel %s (%s)...", model_alias, model_id)

            result = call_claude(client, model_id, cv_text, cv_name, output_dir)

            log.info(
                "  -> parsed_ok=%s | is_cv=%s | skills=%d | exp=%d | edu=%d | lang=%d "
                "| latence=%.0f ms | coût=$%.4f",
                result.parsed_ok,
                result.is_cv,
                result.n_skills,
                result.n_experiences,
                result.n_education,
                result.n_languages,
                result.latency_ms,
                result.cost_usd,
            )

            all_results.append(result)
            save_json_result(output_dir, result)
            append_csv_row(csv_path, result)

    if not all_results:
        log.info("Aucun résultat produit — vérifiez les fichiers et la clé API.")
        return

    # ---- Rapport final ----
    log.info("=== Génération du rapport ===")
    report = generate_report(all_results, output_dir)
    print("\n" + report)

    # Coûts totaux
    total_cost = sum(r.cost_usd for r in all_results)
    log.info("Coût total du benchmark : $%.4f", total_cost)
    log.info("Résultats dans : %s", output_dir)


if __name__ == "__main__":
    main()
