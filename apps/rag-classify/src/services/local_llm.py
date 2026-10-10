import json
import logging
import re
import time
from typing import Dict, List, Optional, Any

import httpx
from prometheus_client import Histogram
from tenacity import retry, retry_if_exception_type, stop_after_attempt, wait_exponential

from src.config import settings

logger = logging.getLogger(__name__)

LLM_CALL = Histogram(
    "llm_call_duration_seconds",
    "Language model call duration",
    ["outcome"],
    buckets=(0.5, 1, 2, 5, 10, 20, 30, 60, 120, 180),
)


from src.services.taxonomy import CANONICAL_NAMES, CPCB_MATERIALS, DETAILED, resolve


def _first_json_object(text: str) -> Optional[Dict[str, Any]]:
    decoder = json.JSONDecoder()
    cleaned = re.sub(r",\s*([}\]])", r"\1", text)
    for match in re.finditer(r"\{", cleaned):
        try:
            value, _ = decoder.raw_decode(cleaned, match.start())
        except json.JSONDecodeError:
            continue
        if isinstance(value, dict) and "material_code" in value:
            return value
    return None


class LocalLLMService:

    def __init__(self):
        self.base_url = settings.ollama_host.rstrip("/")
        self.model = settings.ollama_model
        self.timeout = settings.ollama_timeout
        self.client = httpx.Client(timeout=self.timeout)
        logger.info(f"LLM Service initialized: {self.model}")

    def test_connection(self) -> Dict[str, Any]:
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
                "model_available": model_available,
            }
        except httpx.ConnectError:
            return {"status": "unreachable", "error": f"Cannot connect to {self.base_url}"}
        except Exception as e:
            return {"status": "error", "error": str(e)}

    @retry(
        retry=retry_if_exception_type((httpx.TransportError, httpx.HTTPStatusError)),
        stop=stop_after_attempt(2),
        wait=wait_exponential(multiplier=1, min=1, max=4),
        reraise=True,
    )
    def classify_material(
        self,
        text: str,
        candidate_materials: List[Dict[str, Any]],
        extracted_quantity: Optional[str] = None,
    ) -> Dict[str, Any]:
        prompt = self._build_prompt(text, candidate_materials, extracted_quantity)

        try:
            logger.debug(f"Sending classification request")

            started = time.perf_counter()
            outcome = "error"
            try:
                response = self.client.post(
                    f"{self.base_url}/api/generate",
                    json={
                        "model": self.model,
                        "prompt": prompt,
                        "stream": False,
                        "options": {"temperature": 0.1, "top_p": 0.9, "num_predict": 400},
                    },
                )
                response.raise_for_status()
                outcome = "ok"
            finally:
                LLM_CALL.labels(outcome).observe(time.perf_counter() - started)

            result = response.json()
            raw_output = result.get("response", "")
            classification = self._parse_response(raw_output, text)

            logger.info(
                f"Classified: {classification['material_code']} ({classification.get('cpcb_category')})"
            )
            return classification

        except Exception as e:
            logger.error(f"Classification failed: {e}")
            raise

    def _build_prompt(
        self, text: str, candidates: List[Dict[str, Any]], quantity: Optional[str] = None
    ) -> str:

        materials_text = ""
        for category, mats in CPCB_MATERIALS.items():
            materials_text += f"\n{category}:\n"
            for code, name, examples in mats:
                materials_text += f"  - {code}: {name} (e.g., {examples})\n"

        candidates_text = (
            "\n".join(
                [
                    f"- {c['synonym']} → {c['material_code']} (similarity: {c['similarity_score']})"
                    for c in candidates[:3]
                ]
            )
            if candidates
            else "No similar materials found."
        )

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
Output: {{"material_code": "COMPOST_BAG", "confidence": 0.88, "reasoning": "Compostable material in bag form", "cpcb_category": "CATEGORY_IV_COMPOSTABLE", "needs_human_review": false}}

Now classify:
Input: "{text}"{quantity_context}

Similar materials from database:
{candidates_text}

Respond with ONLY this JSON format:
{{"material_code": "EXACT_CODE", "confidence": 0.0-1.0, "cpcb_category": "CATEGORY_X_NAME", "reasoning": "brief explanation", "needs_human_review": true/false}}
"""
        return prompt

    def _parse_response(self, raw_output: str, text: str = "") -> Dict[str, Any]:
        result = _first_json_object(raw_output)
        if result is None:
            logger.error(f"JSON parse failed: {raw_output[:200]}...")
            return self._unclassified(
                "The model's answer could not be read. Choose the material manually.", text
            )

        material, category, detailed, disagreement = resolve(
            str(result.get("material_code", "UNKNOWN")), text
        )
        try:
            confidence = min(max(float(result.get("confidence", 0)), 0.0), 1.0)
        except (TypeError, ValueError):
            confidence = 0.0

        reasoning = str(result.get("reasoning") or "No reasoning provided")
        if disagreement:
            reasoning += " The packaging form in the description suggests a different CPCB category; please confirm."
        if material is None and category in ("CATEGORY_IV", "BIODEGRADABLE"):
            reasoning += " Compostable and biodegradable plastics have no base polymer code; confirm how to record this line."

        needs_review = (
            bool(result.get("needs_human_review", False))
            or confidence < settings.confidence_threshold
            or material is None
            or category is None
            or disagreement
        )

        return {
            "material_code": material or "UNKNOWN",
            "material_name": DETAILED.get(detailed, {}).get("name")
            or CANONICAL_NAMES.get(material or ""),
            "detailed_code": detailed,
            "cpcb_category": category,
            "confidence": confidence if material else 0.0,
            "reasoning": reasoning,
            "needs_human_review": needs_review,
        }

    def _unclassified(self, reasoning: str, text: str = "") -> Dict[str, Any]:
        _, category, _, _ = resolve("UNKNOWN", text)
        return {
            "material_code": "UNKNOWN",
            "material_name": None,
            "detailed_code": None,
            "cpcb_category": category,
            "confidence": 0.0,
            "reasoning": reasoning,
            "needs_human_review": True,
        }

    def pull_model(self) -> bool:
        try:
            logger.info(f"Pulling {self.model}...")
            response = self.client.post(
                f"{self.base_url}/api/pull", json={"name": self.model}, timeout=300
            )
            response.raise_for_status()
            return True
        except Exception as e:
            logger.error(f"Failed to pull model: {e}")
            return False


_llm_service: Optional[LocalLLMService] = None


def get_llm_service() -> LocalLLMService:
    global _llm_service
    if _llm_service is None:
        _llm_service = LocalLLMService()
    return _llm_service
