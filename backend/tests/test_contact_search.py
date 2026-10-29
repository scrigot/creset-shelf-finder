from app.models import Prospect
from app.services import contact_search


def test_normalize_marks_guessed_email_low_confidence():
    candidates = contact_search.normalize_candidates(
        {
            "candidates": [
                {
                    "name": "Luis Ortega",
                    "role": "General Manager",
                    "email": "luis@f45.example",
                    "email_status": "guessed",
                    "phone": None,
                    "instagram": None,
                    "linkedin_url": None,
                    "source_url": "https://instagram.example/f45",
                    "confidence": "high",
                    "reasoning": "Pattern guess.",
                }
            ]
        }
    )

    assert len(candidates) == 1
    assert candidates[0]["email_status"] == "guessed"
    assert candidates[0]["confidence"] == "low"


def test_normalize_drops_invalid_email_and_sets_status_none():
    candidates = contact_search.normalize_candidates(
        {
            "candidates": [
                {
                    "name": "Priya Natarajan",
                    "role": "Franchise Owner",
                    "email": "priya at example",
                    "email_status": "verified",
                    "confidence": "medium",
                    "reasoning": "Owner named in local news.",
                    "source_url": "https://news.example/otf",
                }
            ]
        }
    )

    assert candidates[0]["email"] is None
    assert candidates[0]["email_status"] == "none"
    assert candidates[0]["confidence"] == "medium"


def test_normalize_treats_found_email_without_status_as_listed_publicly():
    candidates = contact_search.normalize_candidates(
        {
            "candidates": [
                {
                    "name": "Marcus Reyes",
                    "role": "Owner",
                    "email": "marcus@barbellunion.example",
                    "email_status": "none",
                    "confidence": "high",
                    "reasoning": "Published on the About page.",
                    "source_url": "https://barbellunion.example/about",
                }
            ]
        }
    )

    assert candidates[0]["email_status"] == "listed_publicly"


def test_normalize_caps_at_three_and_deduplicates_names():
    raw = {
        "candidates": [
            {"name": "Marcus Reyes", "role": "Owner", "confidence": "high", "reasoning": "a"},
            {"name": "marcus reyes", "role": "Owner", "confidence": "low", "reasoning": "b"},
            {"name": "Dana Whitfield", "role": "Head Coach", "confidence": "medium", "reasoning": "c"},
            {"name": "Sam Doyle", "role": "Coach", "confidence": "low", "reasoning": "d"},
            {"name": "Alex Chen", "role": "Coach", "confidence": "low", "reasoning": "e"},
        ]
    }

    candidates = contact_search.normalize_candidates(raw)

    assert [c["name"] for c in candidates] == [
        "Marcus Reyes",
        "Dana Whitfield",
        "Sam Doyle",
    ]


def test_normalize_repairs_typographic_hyphens_in_email_and_url():
    candidates = contact_search.normalize_candidates(
        {
            "candidates": [
                {
                    "name": "Matthew Holden",
                    "role": "Founder & Owner",
                    "email": "matt@barbell\u2011union.com",
                    "email_status": "listed_publicly",
                    "confidence": "high",
                    "reasoning": "Founder listed on the About page.",
                    "source_url": "https://www.barbell\u2011union.com/about-us",
                }
            ]
        }
    )

    assert candidates[0]["email"] == "matt@barbell-union.com"
    assert candidates[0]["source_url"] == "https://www.barbell-union.com/about-us"
    assert candidates[0]["email_status"] == "listed_publicly"


def test_normalize_rejects_non_ascii_email():
    candidates = contact_search.normalize_candidates(
        {
            "candidates": [
                {
                    "name": "Hannah Mottek",
                    "role": "Coach",
                    "email": "hannah@barbell\u2011union.c\u043em",
                    "email_status": "listed_publicly",
                    "confidence": "medium",
                    "reasoning": "Coach on the team page.",
                }
            ]
        }
    )

    assert candidates[0]["email"] is None
    assert candidates[0]["email_status"] == "none"


def test_normalize_resolves_citation_token_to_the_search_source():
    raw = {
        "candidates": [
            {
                "name": "Matthew Holden",
                "role": "Founder / Owner",
                "email": "matt@barbell-union.example",
                "email_status": "listed_publicly",
                "confidence": "high",
                "reasoning": "Founder listed on the About page.",
                "source_url": "turn1search4",
            }
        ]
    }
    sources = [["https://ignore.example"], ["https://a.example", "https://b.example", "https://c.example", "https://d.example", "https://barbell-union.example/about"]]

    candidates = contact_search.normalize_candidates(raw, search_sources=sources)

    assert candidates[0]["source_url"] == "https://barbell-union.example/about"


def test_normalize_drops_unresolvable_source_tokens():
    raw = {
        "candidates": [
            {
                "name": "Skyler Holt",
                "role": "Coach",
                "confidence": "medium",
                "reasoning": "Coach on the team page.",
                "source_url": "turn9search99",
            }
        ]
    }

    candidates = contact_search.normalize_candidates(raw, search_sources=[["https://a.example"]])

    assert candidates[0]["source_url"] is None


def test_normalize_ignores_blank_names_and_bad_payloads():
    assert contact_search.normalize_candidates({"candidates": [{"name": "  "}]}) == []
    assert contact_search.normalize_candidates(None) == []
    assert contact_search.normalize_candidates("nonsense") == []


def test_prompt_targets_the_role_rules_for_the_gym_type():
    prospect = Prospect(
        name="Orangetheory Westgate",
        type="boutique",
        address="4712 Westgate Blvd, Austin, TX",
        website="https://otfwestgate.example",
    )

    prompt = contact_search.build_user_prompt(prospect)

    assert "Orangetheory Westgate" in prompt
    assert "4712 Westgate Blvd" in prompt
    assert "franchise owner" in prompt
    assert "corporate" in prompt
    assert "Boutique studio" in prompt


def test_every_gym_type_has_a_target_role_rule():
    for gym_type in contact_search.TYPE_RULES:
        prospect = Prospect(name="Test Gym", type=gym_type)
        prompt = contact_search.build_user_prompt(prospect)
        assert "Who to look for:" in prompt
        assert contact_search.TYPE_RULES[gym_type].split(".")[0] in prompt
