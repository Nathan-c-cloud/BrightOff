"""Tests unitaires — prompt.py (S3-11)."""

from __future__ import annotations

from app.modules.cv_parser.prompt import MAX_TEXT_CHARS, SYSTEM_PROMPT, build_user_message


class TestSystemPrompt:
    def test_system_prompt_is_not_empty(self):
        assert SYSTEM_PROMPT.strip() != ""

    def test_system_prompt_contains_is_cv_sentinel(self):
        # Sentinel attendu par le contrat JSON retourné par Claude
        assert "is_cv" in SYSTEM_PROMPT

    def test_system_prompt_mentions_json_format(self):
        # Le prompt doit demander un JSON pur — contrat fort pour le parser aval
        assert "JSON" in SYSTEM_PROMPT

    def test_system_prompt_contains_schema_fields(self):
        # Vérification que les champs clés du schéma sont présents dans le prompt
        for field in ("skills", "experiences", "education", "languages"):
            assert field in SYSTEM_PROMPT, f"Champ '{field}' absent du SYSTEM_PROMPT"


class TestBuildUserMessage:
    def test_build_user_message_contains_cv_text(self):
        cv_text = "Jean Dupont — Développeur Python"
        result = build_user_message(cv_text)

        assert cv_text in result

    def test_build_user_message_returns_string(self):
        result = build_user_message("texte quelconque")

        assert isinstance(result, str)

    def test_build_user_message_short_text_not_truncated(self):
        cv_text = "CV court"
        result = build_user_message(cv_text)

        assert cv_text in result
        # Le texte court ne doit pas être altéré
        assert result.endswith(cv_text)

    def test_build_user_message_text_exactly_at_limit_not_truncated(self):
        cv_text = "A" * MAX_TEXT_CHARS
        result = build_user_message(cv_text)

        assert cv_text in result

    def test_build_user_message_text_over_limit_is_truncated(self):
        cv_text = "B" * (MAX_TEXT_CHARS + 5000)
        result = build_user_message(cv_text)

        # Le texte tronqué à MAX_TEXT_CHARS doit être présent, pas plus
        truncated = cv_text[:MAX_TEXT_CHARS]
        assert truncated in result
        # Le texte complet ne doit PAS être intégralement dans le message
        # (vérification indirecte : la longueur du résultat est bornée)
        assert len(result) < len(cv_text)

    def test_build_user_message_truncation_stops_at_max_chars(self):
        cv_text = "C" * (MAX_TEXT_CHARS * 2)
        result = build_user_message(cv_text)

        # La partie CV dans le message fait exactement MAX_TEXT_CHARS
        # (le message contient un préfixe fixe + le texte tronqué)
        assert "C" * MAX_TEXT_CHARS in result
        assert "C" * (MAX_TEXT_CHARS + 1) not in result

    def test_build_user_message_empty_text_is_handled(self):
        result = build_user_message("")

        assert isinstance(result, str)
        # Le message reste cohérent même avec un texte vide
        assert len(result) > 0
