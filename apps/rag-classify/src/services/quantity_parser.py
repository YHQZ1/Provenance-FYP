# src/services/quantity_parser.py
"""
Extract and normalize quantities from text.
Handles KG, MT, tons, and Indian number formats.
"""

import re
from typing import Optional, Dict, Any

# Regex patterns for quantities
QUANTITY_PATTERNS = [
    # Standard formats: 10,000 KG, 5.5 MT, 1000 kg
    r'(\d{1,3}(?:,\d{3})*(?:\.\d+)?|\d+(?:\.\d+)?)\s*(KG|kg|Kg|MT|mt|Mt|TON|ton|Ton|kgs|KGS)',
    # Space separated: 10000 KG
    r'(\d+)\s*(KG|kg|Kg|MT|mt|Mt)',
    # Decimal: 5.5MT
    r'(\d+\.\d+)(KG|kg|Kg|MT|mt|Mt)',
]

# Unit normalization
UNIT_MAP = {
    'kg': 'KG', 'kgs': 'KG', 'KG': 'KG', 'Kg': 'KG',
    'mt': 'MT', 'MT': 'MT', 'Mt': 'MT',
    'ton': 'MT', 'tons': 'MT', 'TON': 'MT', 'Ton': 'MT'
}


def parse_quantity(text: str) -> Optional[Dict[str, Any]]:
    """
    Extract quantity and unit from text.
    Returns normalized value in KG.
    """
    if not text:
        return None
    
    for pattern in QUANTITY_PATTERNS:
        match = re.search(pattern, text)
        if match:
            raw_value = match.group(1)
            raw_unit = match.group(2)
            
            # Parse number (handle commas)
            try:
                numeric = float(raw_value.replace(',', ''))
            except ValueError:
                continue
            
            # Normalize unit
            unit = UNIT_MAP.get(raw_unit, 'KG')
            
            # Convert to KG
            if unit == 'MT':
                normalized = numeric * 1000
                unit = 'KG'
            else:
                normalized = numeric
            
            return {
                "raw_value": match.group(0),
                "normalized_value": round(normalized, 2),
                "unit": unit,
                "original_unit": raw_unit.upper()
            }
    
    return None


def extract_all_quantities(text: str) -> list:
    """Extract all quantities found in text."""
    quantities = []
    for pattern in QUANTITY_PATTERNS:
        for match in re.finditer(pattern, text):
            parsed = parse_quantity(match.group(0))
            if parsed:
                quantities.append(parsed)
    return quantities