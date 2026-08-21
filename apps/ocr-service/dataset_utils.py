"""
Dataset Utilities for OCR Testing

Logic: Provides reusable functions for testing OCR on Hugging Face invoice dataset.
Includes functions for loading dataset, testing samples, batch processing, and saving results.
"""

from datasets import load_dataset
from engine.extraction.ocr import extract_ocr_tokens, extract_structured_text
from PIL import Image
import json
import os


def load_invoice_dataset():
    return load_dataset("AjitRawat/invoice")


def test_sample(dataset, sample_idx=0):
    sample = dataset[sample_idx]
    img = sample['image']
    ground_truth = sample['ground_truth']
    
    images = [img]
    tokens = extract_ocr_tokens(images)
    structured_content, _ = extract_structured_text(images)
    
    return {
        'image': img,
        'tokens': tokens,
        'structured_text': structured_content[0] if structured_content else "",
        'ground_truth': ground_truth,
        'sample_idx': sample_idx
    }


def batch_test(dataset, num_samples=5):
    results = []
    for i in range(min(num_samples, len(dataset))):
        result = test_sample(dataset, i)
        results.append(result)
    return results


def save_results(results, output_dir="results"):
    os.makedirs(output_dir, exist_ok=True)
    
    for result in results:
        sample_idx = result['sample_idx']
        
        with open(f"{output_dir}/sample_{sample_idx}_ocr.txt", "w", encoding="utf-8") as f:
            f.write(result['structured_text'])
        
        with open(f"{output_dir}/sample_{sample_idx}_ground_truth.json", "w", encoding="utf-8") as f:
            f.write(result['ground_truth'])
        
        with open(f"{output_dir}/sample_{sample_idx}_tokens.json", "w", encoding="utf-8") as f:
            json.dump(result['tokens'], f, indent=2, ensure_ascii=False)
        
        result['image'].save(f"{output_dir}/sample_{sample_idx}_image.jpg")
    
    print(f"Results saved to {output_dir}/")


def quick_test():
    print("Loading dataset...")
    ds = load_invoice_dataset()
    dataset = ds['train']
    
    print(f"Dataset size: {len(dataset)}")
    
    result = test_sample(dataset, 0)
    
    print(f"Sample {result['sample_idx']}:")
    print(f"  Tokens: {len(result['tokens'])}")
    print(f"  Avg confidence: {sum(t['conf'] for t in result['tokens']) / len(result['tokens']):.2f}")
    print(f"  Text preview: {result['structured_text'][:200]}...")
    
    return result


if __name__ == "__main__":
    quick_test()
