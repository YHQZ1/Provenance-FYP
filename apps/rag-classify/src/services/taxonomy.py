import re
from typing import Optional, Tuple

CATEGORY_LABELS = {
    "CATEGORY_I": "Category I — rigid plastic packaging",
    "CATEGORY_II": "Category II — flexible plastic packaging",
    "CATEGORY_III": "Category III — multilayered packaging with a non-plastic layer",
    "CATEGORY_IV": "Category IV — compostable plastic packaging",
    "BIODEGRADABLE": "Biodegradable plastic — confirm the applicable category",
}

PROMPT_GROUPS = {
    "CATEGORY_I_RIGID": "CATEGORY_I",
    "CATEGORY_II_FLEXIBLE": "CATEGORY_II",
    "CATEGORY_III_MULTILAYER": "CATEGORY_III",
    "CATEGORY_IV_COMPOSTABLE": "CATEGORY_IV",
    "CATEGORY_V_BIODEGRADABLE": "BIODEGRADABLE",
}

CPCB_MATERIALS = {
    "CATEGORY_I_RIGID": [
        (
            "PET_RIGID",
            "Polyethylene Terephthalate (Rigid)",
            "water bottles, soda bottles, rigid containers",
        ),
        (
            "HDPE_RIGID",
            "High Density Polyethylene (Rigid)",
            "milk jugs, detergent bottles, rigid pipes",
        ),
        ("PVC_RIGID", "Polyvinyl Chloride (Rigid)", "window frames, rigid pipes, fittings"),
        ("LDPE_RIGID", "Low Density Polyethylene (Rigid)", "rare, some rigid caps"),
        ("PP_RIGID", "Polypropylene (Rigid)", "bottle caps, yogurt containers, buckets"),
        ("PS_RIGID", "Polystyrene (Rigid)", "disposable cutlery, CD cases, rigid packaging"),
        ("OTHER_RIGID", "Other Rigid Plastics", "unspecified rigid plastics"),
    ],
    "CATEGORY_II_FLEXIBLE": [
        ("LDPE_FLEX", "Low Density Polyethylene (Flexible)", "plastic bags, wraps, films"),
        ("PP_FLEX", "Polypropylene (Flexible)", "woven sacks, flexible packaging, tapes"),
        ("HDPE_FLEX", "High Density Polyethylene (Flexible)", "flexible containers, bags"),
        ("PET_FLEX", "Polyethylene Terephthalate (Flexible)", "films, sheets, flexible packaging"),
        ("PVC_FLEX", "Polyvinyl Chloride (Flexible)", "flexible pipes, hoses, sheets"),
        ("PS_FLEX", "Polystyrene (Flexible)", "foam packaging, flexible foam"),
        ("MLP_PLASTIC", "Multi-layer Plastic (All Plastic)", "chip bags, juice pouches"),
    ],
    "CATEGORY_III_MULTILAYER": [
        ("MLP_TETRA", "Tetra Pak / Aseptic Cartons", "juice boxes, milk cartons"),
        ("MLP_LAM_TUBE", "Laminated Tubes", "toothpaste tubes, cosmetic tubes"),
        ("MLP_METALIZED", "Metalized Multi-layer", "snack packaging with foil"),
        ("MLP_PAPER_PLASTIC", "Paper-Plastic Combinations", "paper cups with plastic lining"),
    ],
    "CATEGORY_IV_COMPOSTABLE": [
        ("COMPOST_PET", "Compostable PET (Bio-PET)", "biodegradable bottles"),
        ("COMPOST_BAG", "Compostable Carry Bags", "biodegradable shopping bags"),
        ("COMPOST_SHEET", "Compostable Sheets/Films", "biodegradable packaging films"),
        ("COMPOST_COMM", "Compostable Commodities", "other compostable items"),
    ],
    "CATEGORY_V_BIODEGRADABLE": [
        ("BIO_PET", "Biodegradable PET", "bio-based bottles"),
        ("BIO_BAG", "Biodegradable Carry Bags", "bio-based shopping bags"),
        ("BIO_SHEET", "Biodegradable Sheets/Films", "bio-based films"),
        ("BIO_COMM", "Biodegradable Commodities", "other biodegradable items"),
    ],
}

DETAILED = {
    code: {"name": name, "category": PROMPT_GROUPS[group]}
    for group, materials in CPCB_MATERIALS.items()
    for code, name, _ in materials
}

CANONICAL_CODES = {"PET", "HDPE", "LDPE", "PP", "PS", "PVC", "MLP"}

CANONICAL_NAMES = {
    "PET": "Polyethylene Terephthalate",
    "HDPE": "High Density Polyethylene",
    "LDPE": "Low Density Polyethylene",
    "PP": "Polypropylene",
    "PS": "Polystyrene",
    "PVC": "Polyvinyl Chloride",
    "MLP": "Multi-layer Plastic",
}


def base_polymer(detailed_code: str) -> Optional[str]:
    prefix = detailed_code.split("_", 1)[0]
    return prefix if prefix in CANONICAL_CODES else None


_RULES = [
    ("CATEGORY_IV", r"\bcompostable\b"),
    ("BIODEGRADABLE", r"\b(bio-?degradable|oxo-?degradable|bio-?based)\b"),
    (
        "CATEGORY_III",
        r"\b(tetra ?pa(k|ck)|aseptic|carton|laminated tube|lami ?tube|metall?i[sz]ed|alu(minium)? foil|foil|paper[- ]?(plastic|cup|laminate))\b",
    ),
    (
        "CATEGORY_II",
        r"\b(film|films|bags?|pouch(es)?|sachets?|wraps?|wrapping|sheets?|sacks?|woven|liners?|flexible|shrink|stretch|rolls?|laminates?)\b",
    ),
    (
        "CATEGORY_I",
        r"\b(bottles?|containers?|jars?|caps?|closures?|preforms?|tubs?|buckets?|crates?|trays?|drums?|jugs?|rigid|cans?|bottle grade)\b",
    ),
]


def detect_category(text: str) -> Optional[str]:
    lowered = text.lower()
    for category, pattern in _RULES:
        if re.search(pattern, lowered):
            return category
    return None


def resolve(llm_code: str, text: str) -> Tuple[Optional[str], Optional[str], Optional[str], bool]:
    code = (llm_code or "UNKNOWN").strip().upper()
    detected = detect_category(text)

    if code in DETAILED:
        category = DETAILED[code]["category"]
        material = base_polymer(code)
        detailed = code
    elif code in CANONICAL_CODES:
        material = code
        detailed = None
        if code == "MLP":
            category = "CATEGORY_III" if detected in (None, "CATEGORY_III") else "CATEGORY_II"
        else:
            category = detected if detected in ("CATEGORY_I", "CATEGORY_II") else None
    elif base_polymer(code):
        material = base_polymer(code)
        detailed = None
        category = detected if detected in ("CATEGORY_I", "CATEGORY_II") else None
    else:
        return None, detected, None, False

    disagreement = bool(detected and category and detected != category)
    return material, category, detailed, disagreement
