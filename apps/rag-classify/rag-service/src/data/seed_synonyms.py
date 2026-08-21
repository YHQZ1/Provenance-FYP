# src/data/seed_synonyms.py
"""
Seed material synonyms into PostgreSQL.
Run this once to populate material_synonyms table.
"""

import logging
from src.services.db_client import get_db_client

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Sample synonyms for testing (26 materials from your list)
SAMPLE_SYNONYMS = [
    # PET_RIGID
    ("PET_RIGID", "POLYPET"),
    ("PET_RIGID", "Polyethylene Terephthalate"),
    ("PET_RIGID", "PET Bottle Grade"),
    ("PET_RIGID", "PET Resin"),
    
    # HDPE_RIGID
    ("HDPE_RIGID", "High Density Polyethylene"),
    ("HDPE_RIGID", "HDPE"),
    ("HDPE_RIGID", "PEHD"),
    
    # LDPE_FLEX
    ("LDPE_FLEX", "Low Density Polyethylene"),
    ("LDPE_FLEX", "LDPE"),
    ("LDPE_FLEX", "PELD"),
    
    # PP_RIGID
    ("PP_RIGID", "Polypropylene"),
    ("PP_RIGID", "PP"),
    
    # PS_RIGID
    ("PS_RIGID", "Polystyrene"),
    ("PS_RIGID", "PS"),
    
    # PVC_RIGID
    ("PVC_RIGID", "Polyvinyl Chloride"),
    ("PVC_RIGID", "PVC"),
    
    # MLP_TETRA
    ("MLP_TETRA", "Tetra Pak"),
    ("MLP_TETRA", "Aseptic Carton"),
    
    # COMPOST_BAG
    ("COMPEST_BAG", "Compostable Bag"),
    ("COMPEST_BAG", "Bio Bag"),
    
    # Add more as needed...
]

def seed_postgres():
    """Insert sample synonyms into PostgreSQL."""
    db = get_db_client()
    
    query = """
        INSERT INTO material_synonyms (id, material_code, synonym, is_active, created_at)
        VALUES (gen_random_uuid(), %s, %s, true, NOW())
        ON CONFLICT (material_code, synonym) DO NOTHING
    """
    
    try:
        with db.get_cursor(commit=True) as cur:
            for material_code, synonym in SAMPLE_SYNONYMS:
                cur.execute(query, (material_code, synonym))
        
        logger.info(f"Seeded {len(SAMPLE_SYNONYMS)} synonyms")
        return True
    except Exception as e:
        logger.error(f"Seeding failed: {e}")
        return False

if __name__ == "__main__":
    seed_postgres()