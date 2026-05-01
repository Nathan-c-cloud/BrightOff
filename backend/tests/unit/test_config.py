"""Tests unitaires de la configuration Settings — S3-07 (dette M-004).

Périmètre testé :
    - Valeurs par défaut de ENVIRONMENT et DEBUG (secure-by-default).
    - Validateur _enforce_prod_safety : refuse DEBUG=true en ENVIRONMENT=prod.
    - Combinaisons valides : prod/false, dev/true, staging/true.
    - Rejet des valeurs hors Literal pour ENVIRONMENT.

Stratégie d'isolation :
    Chaque test instancie Settings() directement avec `_env_file=None` pour ne pas
    charger le `.env` local. Les champs requis sans défaut (JWT_SECRET_KEY) sont
    fournis explicitement à chaque instanciation.
"""

import pytest
from pydantic import ValidationError

from app.core.config import Settings

# Valeur minimale pour satisfaire le champ requis JWT_SECRET_KEY dans chaque test.
_DUMMY_JWT = "dummy-secret-for-unit-tests-do-not-use"


class TestDefaults:
    def test_default_environment_is_prod(self):
        """ENVIRONMENT doit valoir 'prod' quand aucune variable n'est définie.

        Garantit le comportement secure-by-default : un déploiement sans ENVIRONMENT
        explicite reste dans le mode le plus restrictif.
        """
        s = Settings(_env_file=None, JWT_SECRET_KEY=_DUMMY_JWT, DEBUG=False)
        assert s.ENVIRONMENT == "prod"

    def test_default_debug_is_false(self):
        """DEBUG doit être False par défaut.

        Évite d'exposer des stack traces ou des logs SQL sur un environnement
        qui oublierait de définir explicitement DEBUG.
        """
        s = Settings(_env_file=None, JWT_SECRET_KEY=_DUMMY_JWT)
        assert s.DEBUG is False


class TestProdSafetyValidator:
    def test_prod_with_debug_true_raises_validation_error(self):
        """Le backend doit refuser de démarrer si ENVIRONMENT=prod et DEBUG=true.

        Ce fail-fast rend la misconfiguration immédiatement visible plutôt que de
        laisser un backend prod exposer des informations sensibles silencieusement.
        """
        with pytest.raises(ValidationError, match="DEBUG=true is forbidden"):
            Settings(
                _env_file=None,
                JWT_SECRET_KEY=_DUMMY_JWT,
                ENVIRONMENT="prod",
                DEBUG=True,
            )

    def test_prod_with_debug_false_is_valid(self):
        """ENVIRONMENT=prod + DEBUG=false est la configuration attendue en production."""
        s = Settings(
            _env_file=None,
            JWT_SECRET_KEY=_DUMMY_JWT,
            ENVIRONMENT="prod",
            DEBUG=False,
        )
        assert s.ENVIRONMENT == "prod"
        assert s.DEBUG is False

    def test_dev_with_debug_true_is_valid(self):
        """ENVIRONMENT=dev autorise DEBUG=true pour le développement local."""
        s = Settings(
            _env_file=None,
            JWT_SECRET_KEY=_DUMMY_JWT,
            ENVIRONMENT="dev",
            DEBUG=True,
        )
        assert s.ENVIRONMENT == "dev"
        assert s.DEBUG is True

    def test_staging_with_debug_true_is_valid(self):
        """ENVIRONMENT=staging autorise DEBUG=true pour les tests d'intégration en preprod.

        Staging est un environnement intermédiaire qui n'est pas exposé aux utilisateurs
        finaux — autoriser DEBUG facilite le diagnostic sans risque prod.
        """
        s = Settings(
            _env_file=None,
            JWT_SECRET_KEY=_DUMMY_JWT,
            ENVIRONMENT="staging",
            DEBUG=True,
        )
        assert s.ENVIRONMENT == "staging"
        assert s.DEBUG is True

    def test_default_prod_with_debug_false_does_not_raise(self):
        """Le cas le plus courant en déploiement : ENVIRONMENT absent (prod) + DEBUG=false."""
        # Ne doit pas lever d'exception.
        s = Settings(_env_file=None, JWT_SECRET_KEY=_DUMMY_JWT, DEBUG=False)
        assert s.ENVIRONMENT == "prod"
        assert s.DEBUG is False


class TestEnvironmentLiteral:
    def test_invalid_environment_value_raises_validation_error(self):
        """Une valeur hors du Literal['dev', 'staging', 'prod'] doit être rejetée par Pydantic.

        Évite les typos silencieuses comme ENVIRONMENT=production ou ENVIRONMENT=DEV
        qui bypasseraient le validateur sans avertissement.
        """
        with pytest.raises(ValidationError):
            Settings(
                _env_file=None,
                JWT_SECRET_KEY=_DUMMY_JWT,
                ENVIRONMENT="production",  # type: ignore[arg-type]  # hors Literal
                DEBUG=False,
            )

    def test_environment_case_sensitive(self):
        """Les valeurs du Literal sont sensibles à la casse — 'Dev' est invalide."""
        with pytest.raises(ValidationError):
            Settings(
                _env_file=None,
                JWT_SECRET_KEY=_DUMMY_JWT,
                ENVIRONMENT="Dev",  # type: ignore[arg-type]
                DEBUG=False,
            )
