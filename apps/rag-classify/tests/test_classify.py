import os

os.environ.setdefault("DATABASE_URL", "postgresql://test:test@localhost:5432/test")

from src.services.local_llm import LocalLLMService  # noqa: E402
from src.services.quantity_parser import parse_quantity  # noqa: E402
from src.services.taxonomy import detect_category, resolve  # noqa: E402


def parse(raw, text):
    return LocalLLMService.__new__(LocalLLMService)._parse_response(raw, text)


def test_detailed_code_keeps_cpcb_category():
    assert resolve("PET_RIGID", "Polypet bottle grade") == ("PET", "CATEGORY_I", "PET_RIGID", False)
    assert resolve("LDPE_FLEX", "LDPE shrink film")[:2] == ("LDPE", "CATEGORY_II")
    assert resolve("MLP_TETRA", "Tetra pak cartons")[:2] == ("MLP", "CATEGORY_III")
    assert resolve("MLP_PLASTIC", "all plastic laminate pouch")[:2] == ("MLP", "CATEGORY_II")


def test_compostable_has_category_but_no_base_polymer():
    material, category, detailed, _ = resolve("COMPOST_BAG", "Compostable carry bags")
    assert material is None
    assert category == "CATEGORY_IV"
    assert detailed == "COMPOST_BAG"


def test_canonical_code_uses_description_for_form():
    assert resolve("HDPE", "HDPE bottles 500 kg")[:2] == ("HDPE", "CATEGORY_I")
    assert resolve("PP", "PP woven sacks")[:2] == ("PP", "CATEGORY_II")
    assert resolve("PET", "PET resin chips")[:2] == ("PET", None)


def test_disagreement_between_model_and_description_is_flagged():
    assert resolve("PET_RIGID", "PET film roll")[3] is True


def test_keyword_detection():
    assert detect_category("Metallised laminate for snacks") == "CATEGORY_III"
    assert detect_category("Freight charges") is None


def test_parse_response_requires_review_without_category():
    result = parse('{"material_code": "PET", "confidence": 0.95, "reasoning": "PET resin"}', "PET resin chips")
    assert result["material_code"] == "PET"
    assert result["cpcb_category"] is None
    assert result["needs_human_review"] is True


def test_parse_response_accepts_confident_detailed_code():
    raw = '{"material_code": "PET_RIGID", "confidence": 0.95, "reasoning": "bottle grade", "needs_human_review": false}'
    result = parse(raw, "Reliance Polypet 3020 bottle grade 500 kg")
    assert result["material_code"] == "PET"
    assert result["cpcb_category"] == "CATEGORY_I"
    assert result["needs_human_review"] is False


def test_unknown_material_has_zero_confidence():
    result = parse('{"material_code": "UNKNOWN", "confidence": 0.95, "reasoning": "?"}', "Compostable carry bags")
    assert result["material_code"] == "UNKNOWN"
    assert result["confidence"] == 0.0
    assert result["cpcb_category"] == "CATEGORY_IV"
    assert result["needs_human_review"] is True


def test_unparseable_output_is_reviewed():
    result = parse("I think it is plastic", "something")
    assert result["material_code"] == "UNKNOWN"
    assert result["needs_human_review"] is True


def test_quantity_parser_handles_tonnes_and_commas():
    assert parse_quantity("PET 10,000 KG")["normalized_value"] == 10000
    assert parse_quantity("HDPE 2.5 MT")["normalized_value"] == 2500


def test_invented_codes_fall_back_to_the_base_polymer():
    assert resolve("PET_RESIN", "PET resin chips") == ("PET", None, None, False)
    assert resolve("HDPE_GRANULES", "HDPE bottles")[:2] == ("HDPE", "CATEGORY_I")


def test_json_is_found_after_mirrored_few_shot_text():
    raw = (
        'Input: "PET resin chips 2 MT bottle grade"\n\nAnalysis: PET resin, bottle grade = RIGID\n\n'
        'Output: {"material_code": "PET_RIGID", "confidence": 0.95, "reasoning": "bottle grade", "needs_human_review": false}'
    )
    result = parse(raw, "PET resin chips 2 MT bottle grade")
    assert result["material_code"] == "PET"
    assert result["cpcb_category"] == "CATEGORY_I"


def test_json_in_code_fence_with_trailing_comma():
    raw = '```json\n{"material_code": "LDPE_FLEX", "confidence": 0.9, "reasoning": "film",}\n```'
    assert parse(raw, "LDPE film")["material_code"] == "LDPE"
