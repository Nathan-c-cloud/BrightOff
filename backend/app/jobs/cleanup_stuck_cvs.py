"""
Job de recovery des CVs bloqués en "parsing".

Scanne la table cvs et marque "failed" les entries où parsing_status="parsing"
ET updated_at < now() - threshold.

Cause root : si le container ECS Fargate redémarre pendant un BackgroundTask
de parsing (rolling deploy, OOM, scale-in), la tâche est tuée sans rollback.
Le CV reste indéfiniment en "parsing".

À exécuter régulièrement (recommandé : toutes les 5 min via EventBridge Scheduler
→ ECS Fargate Task one-shot). Exécution standalone :
    python -m app.jobs.cleanup_stuck_cvs [--threshold-minutes N] [--dry-run]

Note : le modèle CV n'expose pas de champ failure_reason — seul parsing_status
est mis à jour. Un message d'erreur structuré nécessiterait une migration (Sprint 4+).
"""

import argparse
import asyncio
import logging
from datetime import UTC, datetime, timedelta

from sqlalchemy import select, update

from app.core.database import AsyncSessionLocal
from app.modules.cv_parser.models import CV

log = logging.getLogger(__name__)

DEFAULT_THRESHOLD_MINUTES = 5


async def cleanup_stuck_cvs(
    threshold_minutes: int = DEFAULT_THRESHOLD_MINUTES, dry_run: bool = False
) -> int:
    """
    Marque comme "failed" les CVs en "parsing" depuis plus de threshold_minutes.

    Retourne le nombre de CVs traités.
    """
    cutoff = datetime.now(UTC) - timedelta(minutes=threshold_minutes)

    async with AsyncSessionLocal() as db:
        stmt = select(CV).where(
            CV.parsing_status == "parsing",
            CV.updated_at < cutoff,
        )
        result = await db.execute(stmt)
        stuck_cvs = list(result.scalars().all())

        if not stuck_cvs:
            log.info("cleanup_stuck_cvs: aucun CV bloqué (seuil=%d min)", threshold_minutes)
            return 0

        log.warning(
            "cleanup_stuck_cvs: %d CV(s) bloqué(s) en parsing — seuil=%d min, dry_run=%s",
            len(stuck_cvs), threshold_minutes, dry_run,
        )

        if dry_run:
            for cv in stuck_cvs:
                log.warning(
                    "cleanup_stuck_cvs: [DRY RUN] cv_id=%s updated_at=%s",
                    cv.id, cv.updated_at,
                )
            return len(stuck_cvs)

        # Mise à jour atomique en batch
        await db.execute(
            update(CV)
            .where(CV.id.in_([cv.id for cv in stuck_cvs]))
            .values(parsing_status="failed")
        )
        await db.commit()

        for cv in stuck_cvs:
            log.warning("cleanup_stuck_cvs: marqué failed cv_id=%s", cv.id)

        return len(stuck_cvs)


async def _main() -> None:
    parser = argparse.ArgumentParser(description="Cleanup CVs bloqués en parsing")
    parser.add_argument("--threshold-minutes", type=int, default=DEFAULT_THRESHOLD_MINUTES)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    logging.basicConfig(
        level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
    )
    count = await cleanup_stuck_cvs(args.threshold_minutes, args.dry_run)
    print(f"Cleanup terminé : {count} CV(s) traités")


if __name__ == "__main__":
    asyncio.run(_main())
