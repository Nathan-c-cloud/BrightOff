-- Migration S3-16 : alignement vocabulaire skills.category (anglais → français)
-- À exécuter une fois sur chaque environnement (dev, staging, prod)
-- avant le déploiement S3-16. Idempotente.

BEGIN;

UPDATE profile_skills SET category = 'technique'  WHERE category = 'tech';
UPDATE profile_skills SET category = 'soft_skill' WHERE category = 'soft';
UPDATE profile_skills SET category = 'outil'      WHERE category = 'tool';
UPDATE profile_skills SET category = 'outil'      WHERE category = 'language';
UPDATE profile_skills SET category = 'technique'  WHERE category = 'other';

-- Vérification (informatif) :
-- SELECT DISTINCT category, COUNT(*) FROM profile_skills GROUP BY category ORDER BY count DESC;

COMMIT;
