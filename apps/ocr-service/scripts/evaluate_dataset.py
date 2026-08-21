"""
OCR Accuracy Evaluation against Ground Truth

Logic: Compares OCR output with ground truth annotations from Hugging Face dataset.
Extracts invoice numbers and dates using regex patterns, calculates similarity scores.
Provides quantitative metrics on OCR accuracy for field extraction tasks.
"""

from datasets import load_dataset
from ocr_service.pipeline.extraction.image import extract_ocr_tokens
from ocr_service.pipeline.parsing import tokens_to_text
from PIL import Image
import json
import re
from difflib import SequenceMatcher


def extract_field_from_ground_truth(ground_truth, field_name):
    try:
        gt_data = json.loads(ground_truth)
        gt_parse = gt_data.get('gt_parse', {})
        
        if 'header' in gt_parse and field_name in gt_parse['header']:
            return gt_parse['header'][field_name]
        elif field_name in gt_parse:
            return gt_parse[field_name]
        else:
            return None
    except:
        return None


def extract_field_from_ocr_text(text, field_patterns):
    for pattern in field_patterns:
        match = re.search(pattern, text, re.IGNORECASE | re.MULTILINE)
        if match:
            return match.group(1).strip()
    return None


def evaluate_ocr_accuracy():
    print("Loading Hugging Face invoice dataset for evaluation...")
    
    ds = load_dataset("AjitRawat/invoice")
    dataset = ds['train']
    
    field_patterns = {
        'invoice_no': [
            r'Invoice\s*No\.?\s*[:\-]?\s*([A-Z0-9/]+)',
            r'Invoice\s*#?\s*[:\-]?\s*([A-Z0-9/]+)',
            r'No\.?\s*[:\-]?\s*([A-Z0-9/]+)',
            r'([A-Z0-9]{2,}/[0-9]+)'
        ],
        'invoice_date': [
            r'Date\s*[:\-]?\s*([0-9]{1,2}[-/][0-9]{1,2}[-/][0-9]{2,4})',
            r'Invoice\s*Date\s*[:\-]?\s*([0-9]{1,2}[-/][0-9]{1,2}[-/][0-9]{2,4})',
            r'([0-9]{1,2}[-/][0-9]{1,2}[-/][0-9]{2,4})'
        ],
        'company_name': [
            r'([A-Z][a-zA-Z\s&]+(?:Ltd\.|Pvt\.|Corp\.|Inc\.|LLC)?)',
            r'([A-Z][a-zA-Z\s&]+(?:Services|Solutions|Technologies)?)'
        ]
    }
    
    results = []
    
    for i in range(min(5, len(dataset))):
        print(f"\n{'='*60}")
        print(f"Evaluating Sample {i+1}")
        print(f"{'='*60}")
        
        sample = dataset[i]
        img = sample['image']
        ground_truth = sample['ground_truth']
        
        images = [img]
        tokens = extract_ocr_tokens(images)
        ocr_text = tokens_to_text(tokens)
        
        print(f"Image size: {img.size}")
        print(f"Tokens extracted: {len(tokens)}")
        print(f"OCR confidence avg: {sum(t['conf'] for t in tokens) / len(tokens):.2f}")
        
        gt_invoice_no = extract_field_from_ground_truth(ground_truth, 'invoice_no')
        gt_invoice_date = extract_field_from_ground_truth(ground_truth, 'invoice_date')
        
        print(f"\nGround Truth:")
        print(f"  Invoice No: {gt_invoice_no}")
        print(f"  Invoice Date: {gt_invoice_date}")
        
        ocr_invoice_no = extract_field_from_ocr_text(ocr_text, field_patterns['invoice_no'])
        ocr_invoice_date = extract_field_from_ocr_text(ocr_text, field_patterns['invoice_date'])
        
        print(f"\nOCR Extracted:")
        print(f"  Invoice No: {ocr_invoice_no}")
        print(f"  Invoice Date: {ocr_invoice_date}")
        
        invoice_no_similarity = 0
        if gt_invoice_no and ocr_invoice_no:
            invoice_no_similarity = SequenceMatcher(None, gt_invoice_no, ocr_invoice_no).ratio()
            
        date_similarity = 0
        if gt_invoice_date and ocr_invoice_date:
            date_similarity = SequenceMatcher(None, gt_invoice_date, ocr_invoice_date).ratio()
        
        print(f"\nSimilarity Scores:")
        print(f"  Invoice No: {invoice_no_similarity:.2f}")
        print(f"  Invoice Date: {date_similarity:.2f}")
        
        print(f"\nOCR Text Preview:")
        print(ocr_text[:300] + "..." if len(ocr_text) > 300 else ocr_text)
        
        results.append({
            'sample': i+1,
            'tokens': len(tokens),
            'avg_confidence': sum(t['conf'] for t in tokens) / len(tokens),
            'invoice_no_similarity': invoice_no_similarity,
            'date_similarity': date_similarity,
            'gt_invoice_no': gt_invoice_no,
            'ocr_invoice_no': ocr_invoice_no,
            'gt_invoice_date': gt_invoice_date,
            'ocr_invoice_date': ocr_invoice_date
        })
    
    print(f"\n{'='*60}")
    print("EVALUATION SUMMARY")
    print(f"{'='*60}")
    
    avg_tokens = sum(r['tokens'] for r in results) / len(results)
    avg_confidence = sum(r['avg_confidence'] for r in results) / len(results)
    avg_invoice_similarity = sum(r['invoice_no_similarity'] for r in results if r['invoice_no_similarity'] > 0) / len([r for r in results if r['invoice_no_similarity'] > 0])
    avg_date_similarity = sum(r['date_similarity'] for r in results if r['date_similarity'] > 0) / len([r for r in results if r['date_similarity'] > 0])
    
    print(f"Average tokens per image: {avg_tokens:.1f}")
    print(f"Average OCR confidence: {avg_confidence:.2f}")
    print(f"Average invoice number similarity: {avg_invoice_similarity:.2f}")
    print(f"Average date similarity: {avg_date_similarity:.2f}")
    
    successful_invoice_no = len([r for r in results if r['invoice_no_similarity'] > 0.5])
    successful_date = len([r for r in results if r['date_similarity'] > 0.5])
    
    print(f"Successful invoice number extraction: {successful_invoice_no}/{len(results)} ({successful_invoice_no/len(results)*100:.1f}%)")
    print(f"Successful date extraction: {successful_date}/{len(results)} ({successful_date/len(results)*100:.1f}%)")
    
    return results


if __name__ == "__main__":
    evaluate_ocr_accuracy()
