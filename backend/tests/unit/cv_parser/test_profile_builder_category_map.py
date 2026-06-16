"""Tests unitaires — normalisation des catégories de skills (S3-16).

Couvre _normalize_category et _SKILL_CATEGORY_MAP sans base de données.
Le mapping est le filet de sécurité entre les valeurs historiques produites
par Claude (tech/soft/tool/language/other) et le Literal DB/API actuel
(technique/outil/soft_skill).
"""

from __future__ import annotations

import pytest

from app.modules.cv_parser.profile_builder import (
    _DEFAULT_SKILL_CATEGORY,
    _SKILL_CATEGORY_MAP,
    _normalize_category,
)

# Valeurs du Literal DB/API en vigueur après S3-16
_VALID_CATEGORIES = {"technique", "outil", "soft_skill"}


class TestSkillCategoryMapCompleteness:
    """Toutes les valeurs du mapping ciblent un Literal valide."""

    def test_all_mapped_values_are_valid_literals(self):
        for raw, normalized in _SKILL_CATEGORY_MAP.items():
            assert normalized in _VALID_CATEGORIES, (
                f"_SKILL_CATEGORY_MAP[{raw!r}] = {normalized!r} n'est pas un Literal valide"
            )

    def test_default_category_is_valid_literal(self):
        assert _DEFAULT_SKILL_CATEGORY in _VALID_CATEGORIES


class TestNormalizeCategoryLegacyValues:
    """Les anciennes valeurs produites par Claude sont correctement normalisées."""

    @pytest.mark.parametrize(
        "raw, expected",
        [
            ("tech", "technique"),
            ("soft", "soft_skill"),
            ("tool", "outil"),
            ("language", "outil"),
            ("other", "technique"),
        ],
    )
    def test_legacy_value_maps_to_correct_category(self, raw, expected):
        assert _normalize_category(raw) == expected


class TestNormalizeCategoryPassthrough:
    """Les valeurs déjà conformes au nouveau vocabulaire passent sans transformation."""

    @pytest.mark.parametrize("value", ["technique", "outil", "soft_skill"])
    def test_conformant_value_passes_through(self, value):
        assert _normalize_category(value) == value


class TestNormalizeCategoryFallback:
    """Les valeurs inconnues tombent sur le fallback conservateur."""

    @pytest.mark.parametrize("unknown", ["", "unknown", "TECH", "Tech", None])
    def test_unknown_value_falls_back_to_default(self, unknown):
        assert _normalize_category(unknown) == _DEFAULT_SKILL_CATEGORY
