# | Function              | What It Does        | Why We Need It                                |
# | --------------------- | ------------------- | --------------------------------------------- |
# | `__init__`            | Connects to Ollama  | HTTP client to Ollama container               |
# | `classify_material()` | Main classification | Sends prompt to LLM, gets structured response |
# | `_build_prompt()`     | Prompt engineering  | Crafts context-rich prompt with synonyms      |
# | `_parse_response()`   | Output parsing      | Extracts JSON from LLM text                   |
# | `test_connection()`   | Health check        | Verifies Ollama is running and model exists   |

# src/services/local_llm.py
"""
Ollama LLM client for material classification.
Handles 26 CPCB material codes with rigid/flexible detection.
"""

import json
import logging
import re
from typing import Dict, List, Optional, Any

import httpx
from tenacity import retry, stop_after_attempt, wait_exponential

from src.config import settings

logger = logging.getLogger(__name__)


# Complete CPCB material taxonomy
CPCB_MATERIALS = {
    "CATEGORY_I_RIGID": [
        ("PET_RIGID", "Polyethylene Terephthalate (Rigid)", "water bottles, soda bottles, rigid containers"),
        ("HDPE_RIGID", "High Density Polyethylene (Rigid)", "milk jugs, detergent bottles, rigid pipes"),
        ("PVC_RIGID", "Polyvinyl Chloride (Rigid)", "window frames, rigid pipes, fittings"),
        ("LDPE_RIGID", "Low Density Polyethylene (Rigid)", "rare, some rigid caps"),
        ("PP_RIGID", "Polypropylene (Rigid)", "bottle caps, yogurt containers, buckets"),
        ("PS_RIGID", "Polystyrene (Rigid)", "disposable cutlery, CD cases, rigid packaging"),
        ("OTHER_RIGID", "Other Rigid Plastics", "unspecified rigid plastics")
    ],
    "CATEGORY_II_FLEXIBLE": [
        ("LDPE_FLEX", "Low Density Polyethylene (Flexible)", "plastic bags, wraps, films"),
        ("PP_FLEX", "Polypropylene (Flexible)", "woven sacks, flexible packaging, tapes"),
        ("HDPE_FLEX", "High Density Polyethylene (Flexible)", "flexible containers, bags"),
        ("PET_FLEX", "Polyethylene Terephthalate (Flexible)", "films, sheets, flexible packaging"),
        ("PVC_FLEX", "Polyvinyl Chloride (Flexible)", "flexible pipes, hoses, sheets"),
        ("PS_FLEX", "Polystyrene (Flexible)", "foam packaging, flexible foam"),
        ("MLP_PLASTIC", "Multi-layer Plastic (All Plastic)", "chip bags, juice pouches")
    ],
    "CATEGORY_III_MULTILAYER": [
        ("MLP_TETRA", "Tetra Pak / Aseptic Cartons", "juice boxes, milk cartons"),
        ("MLP_LAM_TUBE", "Laminated Tubes", "toothpaste tubes, cosmetic tubes"),
        ("MLP_METALIZED", "Metalized Multi-layer", "snack packaging with foil"),
        ("MLP_PAPER_PLASTIC", "Paper-Plastic Combinations", "paper cups with plastic lining")
    ],
    "CATEGORY_IV_COMPOSTABLE": [
        ("COMPOST_PET", "Compostable PET (Bio-PET)", "biodegradable bottles"),
        ("COMPEST_BAG", "Compostable Carry Bags", "biodegradable shopping bags"),
        ("COMPOST_SHEET", "Compostable Sheets/Films", "biodegradable packaging films"),
        ("COMPOST_COMM", "Compostable Commodities", "other compostable items")
    ],
    "CATEGORY_V_BIODEGRADABLE": [
        ("BIO_PET", "Biodegradable PET", "bio-based bottles"),
        ("BIO_BAG", "Biodegradable Carry Bags", "bio-based shopping bags"),
        ("BIO_SHEET", "Biodegradable Sheets/Films", "bio-based films"),
        ("BIO_COMM", "Biodegradable Commodities", "other biodegradable items")
    ]
}

# Flatten for easy lookup
ALL_MATERIALS = []
for category, materials in CPCB_MATERIALS.items():
    for code, name, examples in materials:
        ALL_MATERIALS.append({
            "code": code,
            "name": name,
            "category": category,
            "examples": examples
        })


class LocalLLMService:
    """Client for Ollama local LLM inference."""
    
    def __init__(self):
        self.base_url = settings.ollama_host.rstrip("/")
        self.model = settings.ollama_model
        self.timeout = settings.ollama_timeout
        self.client = httpx.Client(timeout=self.timeout)
        logger.info(f"LLM Service initialized: {self.model}")
    
    def test_connection(self) -> Dict[str, Any]:
        """Health check for Ollama."""
        try:
            response = self.client.get(f"{self.base_url}/api/tags")
            response.raise_for_status()
            data = response.json()
            models = [m["name"] for m in data.get("models", [])]
            model_available = any(self.model in m for m in models)
            
            return {
                "status": "healthy" if model_available else "model_missing",
                "available_models": models,
                "required_model": self.model,
                "model_available": model_available
            }
        except httpx.ConnectError:
            return {"status": "unreachable", "error": f"Cannot connect to {self.base_url}"}
        except Exception as e:
            return {"status": "error", "error": str(e)}
    
    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
    def classify_material(
        self,
        text: str,
        candidate_materials: List[Dict[str, Any]],
        extracted_quantity: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Classify plastic material using local LLM with rigidity detection.
        """
        prompt = self._build_prompt(text, candidate_materials, extracted_quantity)
        
        try:
            logger.debug(f"Sending classification request")
            
            response = self.client.post(
                f"{self.base_url}/api/generate",
                json={
                    "model": self.model,
                    "prompt": prompt,
                    "stream": False,
                    "options": {
                        "temperature": 0.1,
                        "top_p": 0.9,
                        "num_predict": 400,
                        "stop": ["\n\n", "```"]
                    }
                }
            )
            response.raise_for_status()
            
            result = response.json()
            raw_output = result.get("response", "")
            classification = self._parse_response(raw_output)
            
            # Enrich with category info
            material_info = next(
                (m for m in ALL_MATERIALS if m["code"] == classification["material_code"]),
                None
            )
            if material_info:
                classification["cpcb_category"] = material_info["category"]
                classification["material_name"] = material_info["name"]
            
            logger.info(f"Classified: {classification['material_code']} ({classification.get('cpcb_category')})")
            return classification
            
        except Exception as e:
            logger.error(f"Classification failed: {e}")
            raise
    
    def _build_prompt(
        self,
        text: str,
        candidates: List[Dict[str, Any]],
        quantity: Optional[str] = None
    ) -> str:
        """Build comprehensive prompt with rigidity detection."""
        
        # Build material list
        materials_text = ""
        for category, mats in CPCB_MATERIALS.items():
            materials_text += f"\n{category}:\n"
            for code, name, examples in mats:
                materials_text += f"  - {code}: {name} (e.g., {examples})\n"
        
        # Build candidates context
        candidates_text = "\n".join([
            f"- {c['synonym']} → {c['material_code']} (similarity: {c['similarity_score']})"
            for c in candidates[:3]
        ]) if candidates else "No similar materials found."
        
        quantity_context = f"\nExtracted Quantity: {quantity}" if quantity else ""
        
        prompt = f"""You are an expert in Indian EPR (Extended Producer Responsibility) plastic classification.
Your task is to classify plastic materials according to CPCB (Central Pollution Control Board) categories.

CLASSIFICATION RULES:
1. Determine base material (PET, HDPE, PVC, LDPE, PP, PS, MLP, COMPOST, BIO)
2. Determine rigidity/form:
   - RIGID: Bottles, containers, pipes, frames, caps, rigid packaging
   - FLEXIBLE: Bags, films, wraps, sheets, woven sacks, flexible packaging
   - MULTILAYER: Tetra Pak, laminated tubes, metalized films, paper-plastic combos
   - COMPOSTABLE/BIO: Biodegradable variants (must explicitly mention compostable/bio/oxo-biodegradable)
3. Select exact code from list below

AVAILABLE MATERIALS:{materials_text}

RIGIDITY DETECTION GUIDE:
- "bottle grade", "bottles", "containers", "jugs", "pipes", "frames" → RIGID
- "film", "bags", "wraps", "sheets", "sacks", "flexible" → FLEXIBLE
- "tetra", "carton", "laminated tube", "foil", "metalized" → MULTILAYER
- "compostable", "bio-", "biodegradable", "oxo-biodegradable" → COMPOSTABLE/BIO

EXAMPLES:
Input: "Reliance POLYPET 3020 bottle grade resin"
Analysis: POLYPET = PET trade name, "bottle grade" = RIGID
Output: {{"material_code": "PET_RIGID", "confidence": 0.95, "reasoning": "POLYPET is trade name for PET, bottle grade indicates rigid form", "cpcb_category": "CATEGORY_I_RIGID", "needs_human_review": false}}

Input: "High-density polyethylene bags 50kg"
Analysis: HDPE + "bags" = FLEXIBLE
Output: {{"material_code": "HDPE_FLEX", "confidence": 0.92, "reasoning": "HDPE explicitly mentioned, bags indicate flexible form", "cpcb_category": "CATEGORY_II_FLEXIBLE", "needs_human_review": false}}

Input: "Tetra Pak juice boxes 200ml"
Analysis: Tetra Pak = specific multilayer type
Output: {{"material_code": "MLP_TETRA", "confidence": 0.96, "reasoning": "Tetra Pak is specific multilayer packaging", "cpcb_category": "CATEGORY_III_MULTILAYER", "needs_human_review": false}}

Input: "Compostable carry bags for shopping"
Analysis: "compostable" + "bags" = COMPOSTABLE category, bag form
Output: {{"material_code": "COMPEST_BAG", "confidence": 0.88, "reasoning": "Compostable material in bag form", "cpcb_category": "CATEGORY_IV_COMPOSTABLE", "needs_human_review": false}}

Now classify:
Input: "{text}"{quantity_context}

Similar materials from database:
{candidates_text}

Respond with ONLY this JSON format:
{{"material_code": "EXACT_CODE", "confidence": 0.0-1.0, "cpcb_category": "CATEGORY_X_NAME", "reasoning": "brief explanation", "needs_human_review": true/false}}
"""
        return prompt
    
    def _parse_response(self, raw_output: str) -> Dict[str, Any]:
        """Extract and validate JSON from LLM output."""
        # Try markdown code block
        json_match = re.search(r'```(?:json)?\s*(\{.*?\})\s*```', raw_output, re.DOTALL)
        if json_match:
            json_str = json_match.group(1)
        else:
            # Try raw JSON
            json_match = re.search(r'(\{.*\})', raw_output, re.DOTALL)
            json_str = json_match.group(1) if json_match else raw_output
        
        # Clean
        json_str = json_str.strip()
        json_str = re.sub(r',\s*}', '}', json_str)
        json_str = re.sub(r',\s*]', ']', json_str)
        
        try:
            result = json.loads(json_str)
            
            # Validate code exists
            valid_codes = [m["code"] for m in ALL_MATERIALS]
            code = result.get("material_code", "UNKNOWN").upper().strip()
            
            if code not in valid_codes and code != "UNKNOWN":
                # Try to fix common mistakes
                if code == "PET" and "bottle" in result.get("reasoning", "").lower():
                    code = "PET_RIGID"
                elif code == "PET" and "film" in result.get("reasoning", "").lower():
                    code = "PET_FLEX"
                else:
                    code = "UNKNOWN"
            
            # Normalize
            confidence = float(result.get("confidence", 0))
            needs_review = result.get("needs_human_review", True)
            
            # Auto-flag if confidence low or unknown code
            if confidence < settings.confidence_threshold or code == "UNKNOWN":
                needs_review = True
            
            return {
                "material_code": code,
                "confidence": min(max(confidence, 0.0), 1.0),
                "reasoning": result.get("reasoning", "No reasoning provided"),
                "cpcb_category": result.get("cpcb_category", "UNKNOWN"),
                "needs_human_review": needs_review
            }
            
        except json.JSONDecodeError:
            logger.error(f"JSON parse failed: {raw_output[:200]}...")
            return {
                "material_code": "UNKNOWN",
                "confidence": 0.0,
                "reasoning": f"Parse error. Raw: {raw_output[:100]}...",
                "cpcb_category": "UNKNOWN",
                "needs_human_review": True
            }
    
    def pull_model(self) -> bool:
        """Download model from Ollama."""
        try:
            logger.info(f"Pulling {self.model}...")
            response = self.client.post(
                f"{self.base_url}/api/pull",
                json={"name": self.model},
                timeout=300
            )
            response.raise_for_status()
            return True
        except Exception as e:
            logger.error(f"Failed to pull model: {e}")
            return False


# Singleton
_llm_service: Optional[LocalLLMService] = None

def get_llm_service() -> LocalLLMService:
    global _llm_service
    if _llm_service is None:
        _llm_service = LocalLLMService()
    return _llm_service
