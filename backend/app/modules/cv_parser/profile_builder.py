"""Construction et mise à jour du profil utilisateur depuis les données parsées par Claude — S3-11.

Stratégie d'upsert :
- `profiles` : INSERT ... ON CONFLICT (user_id) DO UPDATE (pas de merge intelligent, post-MVP)
- Collections (skills, experiences, educations, languages) : DELETE + re-INSERT
  Simple, sans diff. Accepté pour le MVP — un re-upload écrase complètement le profil.

Pas de merge intelligent (post-MVP — voir docs/backlog.md).
"""

from __future__ import annotations

import logging
import uuid
from datetime import date

from sqlalchemy import delete, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.cv_parser.models import (
    Profile,
    ProfileEducation,
    ProfileExperience,
    ProfileLanguage,
    ProfileSkill,
)

log = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Helpers de conversion de dates
# ---------------------------------------------------------------------------


def _parse_date(value: str | None) -> date | None:
    """Convertit une chaîne YYYY-MM-DD en date Python. Retourne None si absent."""
    if not value:
        return None
    try:
        return date.fromisoformat(value)
    except (ValueError, TypeError):
        log.warning("Date invalide ignorée : %r", value)
        return None


# ---------------------------------------------------------------------------
# Upsert principal
# ---------------------------------------------------------------------------


async def upsert_profile(
    db: AsyncSession,
    user_id: uuid.UUID,
    cv_id: uuid.UUID,
    parsed: dict,
) -> Profile:
    """Crée ou met à jour le profil d'un utilisateur depuis les données Claude.

    Séquence :
        1. INSERT profiles ... ON CONFLICT (user_id) DO UPDATE → récupère l'id du profil
        2. DELETE des collections existantes (skills, experiences, educations, languages)
        3. INSERT des nouvelles collections

    Le re-upload d'un CV écrase complètement le profil existant (pas de merge — post-MVP).
    La session est flushée mais pas commitée — le commit est à la charge de l'appelant (tasks.py).

    Retourne l'objet Profile avec son id.
    """
    new_profile_id = uuid.uuid4()

    # --- Étape 1 : upsert profiles ---
    # ON CONFLICT (user_id) DO UPDATE : si le profil existe déjà pour cet user,
    # on met à jour les champs scalaires et on récupère l'id existant.
    # RETURNING id est nécessaire pour les INSERT des collections (clé étrangère profile_id).
    stmt = text(
        """
        INSERT INTO profiles (id, user_id, cv_id, title, summary, years_of_experience,
                              created_at, updated_at)
        VALUES (:id, :user_id, :cv_id, :title, :summary, :years_of_experience,
                now(), now())
        ON CONFLICT (user_id) DO UPDATE
            SET cv_id                = EXCLUDED.cv_id,
                title                = EXCLUDED.title,
                summary              = EXCLUDED.summary,
                years_of_experience  = EXCLUDED.years_of_experience,
                updated_at           = now()
        RETURNING id
        """
    )

    result = await db.execute(
        stmt,
        {
            "id": new_profile_id,
            "user_id": user_id,
            "cv_id": cv_id,
            "title": parsed.get("title"),
            "summary": parsed.get("summary"),
            "years_of_experience": parsed.get("years_of_experience"),
        },
    )
    profile_id: uuid.UUID = result.scalar_one()

    log.info(
        "upsert_profile: profil id=%s upserted pour user_id=%s cv_id=%s",
        profile_id,
        user_id,
        cv_id,
    )

    # --- Étape 2 : DELETE des collections existantes ---
    # On supprime en masse par profile_id avant de ré-insérer.
    # Plus simple qu'un diff — acceptable pour le MVP.
    await db.execute(delete(ProfileSkill).where(ProfileSkill.profile_id == profile_id))
    await db.execute(delete(ProfileExperience).where(ProfileExperience.profile_id == profile_id))
    await db.execute(delete(ProfileEducation).where(ProfileEducation.profile_id == profile_id))
    await db.execute(delete(ProfileLanguage).where(ProfileLanguage.profile_id == profile_id))

    # --- Étape 3 : INSERT des nouvelles collections ---

    for skill in parsed.get("skills") or []:
        name = skill.get("name")
        category = skill.get("category")
        if not name or not category:
            log.warning("Skill ignoré (name ou category absent) : %r", skill)
            continue
        db.add(
            ProfileSkill(
                profile_id=profile_id,
                name=name,
                category=category,
                level=skill.get("level"),
            )
        )

    for exp in parsed.get("experiences") or []:
        company = exp.get("company")
        position = exp.get("position")
        start_date = _parse_date(exp.get("start_date"))
        if not company or not position or not start_date:
            log.warning("Expérience ignorée (champs obligatoires manquants) : %r", exp)
            continue
        db.add(
            ProfileExperience(
                profile_id=profile_id,
                company=company,
                position=position,
                start_date=start_date,
                end_date=_parse_date(exp.get("end_date")),
                description=exp.get("description"),
            )
        )

    for edu in parsed.get("education") or []:
        school = edu.get("school")
        degree = edu.get("degree")
        start_date = _parse_date(edu.get("start_date"))
        if not school or not degree or not start_date:
            log.warning("Formation ignorée (champs obligatoires manquants) : %r", edu)
            continue
        db.add(
            ProfileEducation(
                profile_id=profile_id,
                school=school,
                degree=degree,
                field=edu.get("field"),
                start_date=start_date,
                end_date=_parse_date(edu.get("end_date")),
            )
        )

    for lang in parsed.get("languages") or []:
        name = lang.get("name")
        level = lang.get("level")
        if not name or not level:
            log.warning("Langue ignorée (name ou level absent) : %r", lang)
            continue
        db.add(
            ProfileLanguage(
                profile_id=profile_id,
                name=name,
                level=level,
            )
        )

    await db.flush()

    # Retourner un objet Profile minimal avec l'id réel (utilisé par tasks.py pour le log)
    profile = Profile(
        id=profile_id,
        user_id=user_id,
        cv_id=cv_id,
        title=parsed.get("title"),
        summary=parsed.get("summary"),
        years_of_experience=parsed.get("years_of_experience"),
    )
    # On ne re-add pas l'objet — il est déjà en BDD via le raw SQL. On le retourne pour le log.
    return profile
