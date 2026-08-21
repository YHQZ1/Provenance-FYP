"""
Interactive Invoice OCR Test with Visualization

Logic: Displays invoice images side-by-side with extracted text using matplotlib.
Loads samples from Hugging Face dataset, runs OCR, and creates visual comparison.
Shows ground truth vs extracted data for manual verification of OCR accuracy.
"""

from datasets import load_dataset
from ocr_service.pipeline.extraction.image import extract_ocr_tokens
from ocr_service.pipeline.parsing import tokens_to_text
from PIL import Image
import matplotlib.pyplot as plt
import json


def show_invoice_with_extraction(sample_idx=0):
    print("Loading Hugging Face invoice dataset...")
    ds = load_dataset("AjitRawat/invoice")
    dataset = ds['train']
    
    print(f"Dataset loaded: {len(dataset)} invoices available")
    print(f"Showing invoice #{sample_idx + 1}")
    
    sample = dataset[sample_idx]
    img = sample['image']
    ground_truth = sample['ground_truth']
    
    print("Processing with OCR...")
    images = [img]
    tokens = extract_ocr_tokens(images)
    structured_content = tokens_to_text(tokens)
    
    print(f"\n{'='*80}")
    print(f"INVOICE #{sample_idx + 1} RESULTS")
    print(f"{'='*80}")
    print(f"Image size: {img.size}")
    print(f"Tokens extracted: {len(tokens)}")
    print(f"Average confidence: {sum(t['conf'] for t in tokens) / len(tokens):.2f}")
    
    try:
        gt_data = json.loads(ground_truth)
        gt_parse = gt_data.get('gt_parse', {})
        header = gt_parse.get('header', {})
        
        print(f"\nGROUND TRUTH:")
        if 'invoice_no' in header:
            print(f"  Invoice No: {header['invoice_no']}")
        if 'invoice_date' in header:
            print(f"  Invoice Date: {header['invoice_date']}")
        if 'company_name' in header:
            print(f"  Company: {header['company_name']}")
    except:
        print("  Ground truth parsing failed")
    
    print(f"\nEXTRACTED TEXT:")
    print("-" * 40)
    if structured_content:
        print(structured_content)
    else:
        print("No text extracted")
    
    print(f"\nSAMPLE TOKENS (first 10):")
    print("-" * 40)
    for i, token in enumerate(tokens[:10]):
        print(f"{i+1:2d}. '{token['text']}' (conf: {token['conf']:.2f})")
    
    try:
        fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(16, 10))
        
        ax1.imshow(img)
        ax1.set_title(f'Invoice #{sample_idx + 1}', fontsize=14)
        ax1.axis('off')
        
        ax2.axis('off')
        text_content = structured_content or "No text extracted"
        ax2.text(0.05, 0.95, text_content, transform=ax2.transAxes, 
                fontsize=10, verticalalignment='top', fontfamily='monospace')
        ax2.set_title('Extracted Text', fontsize=14)
        
        plt.tight_layout()
        plt.show()
        
    except Exception as e:
        print(f"Display error: {e}")
        print("Image display requires matplotlib. Install with: pip install matplotlib")
    
    return {
        'sample_idx': sample_idx,
        'image': img,
        'tokens': tokens,
        'structured_text': structured_content[0] if structured_content else "",
        'ground_truth': ground_truth
    }


def test_multiple_invoices(start_idx=0, count=3):
    ds = load_dataset("AjitRawat/invoice")
    dataset = ds['train']
    
    print(f"Testing {count} invoices starting from #{start_idx + 1}")
    
    for i in range(start_idx, min(start_idx + count, len(dataset))):
        print(f"\n{'='*80}")
        print(f"PROCESSING INVOICE #{i + 1}")
        print(f"{'='*80}")
        
        result = show_invoice_with_extraction(i)
        
        if i < min(start_idx + count - 1, len(dataset) - 1):
            user_input = input("\nPress Enter to continue to next invoice, or 'q' to quit: ")
            if user_input.lower() == 'q':
                break
    
    print(f"\n{'='*80}")
    print("TESTING COMPLETE")
    print(f"{'='*80}")


if __name__ == "__main__":
    print("Invoice OCR Interactive Test")
    print("=" * 50)
    
    print("\n1. Testing single invoice (sample #0)")
    result = show_invoice_with_extraction(0)
    
    user_input = input("\nWould you like to test more invoices? (y/n): ")
    if user_input.lower() == 'y':
        start_idx = input("Enter starting invoice number (0-21): ")
        count = input("Enter number of invoices to test: ")
        
        try:
            start_idx = int(start_idx)
            count = int(count)
            test_multiple_invoices(start_idx, count)
        except:
            print("Invalid input. Testing first 3 invoices...")
            test_multiple_invoices(0, 3)
