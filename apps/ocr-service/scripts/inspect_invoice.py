"""
Universal Invoice Test Script - Images & PDFs

Logic: One script to test any invoice (image or PDF) with visual output and technical debugging.
Features:
- Supports JPG, PNG, PDF files
- Side-by-side visual comparison (image/PDF page + extracted text)
- Technical debugging mode (detailed token info, coordinates, confidence)
- PDF handling (native text extraction or OCR fallback)

Usage: 
  python test_new_invoice.py [filename] [--debug]
  python test_new_invoice.py invoice.jpg
  python test_new_invoice.py document.pdf --debug
"""

from ocr_service.pipeline.extraction.image import extract_ocr_tokens
from ocr_service.pipeline.extraction.pdf import extract_pdf_tokens, render_pdf_pages
from ocr_service.pipeline.parsing import tokens_to_text
from pdf2image import convert_from_path
from PIL import Image
import matplotlib.pyplot as plt
import os
import sys

def debug_tokens(tokens, max_display=20):
    print(f"\nTECHNICAL DEBUG - First {max_display} tokens:")
    print("-" * 80)
    print(f"{'#':<4} {'Text':<30} {'Conf':<6} {'Position (x,y)':<20} {'Size (w,h)':<15}")
    print("-" * 80)
    
    for i, t in enumerate(tokens[:max_display]):
        text = t['text'][:28] + ".." if len(t['text']) > 30 else t['text']
        pos = f"({t['x']:.3f}, {t['y']:.3f})"
        size = f"({t['w']:.3f}, {t['h']:.3f})"
        print(f"{i+1:<4} {text:<30} {t['conf']:<6.2f} {pos:<20} {size:<15}")
    
    if len(tokens) > max_display:
        print(f"... and {len(tokens) - max_display} more tokens")
    print("-" * 80)


def extract_images_from_pdf_fixed(pdf_path, dpi=150):
    """Extract PDF images using Poppler available on PATH."""
    return render_pdf_pages(pdf_path, dpi=dpi)


def test_pdf(file_path, debug=False):
    print(f"Processing PDF: {os.path.basename(file_path)}")
    
    print("Attempting native text extraction...")
    tokens, page_count = extract_pdf_tokens(file_path)
    
    if tokens and len(tokens) > 0:
        print(f"Native PDF text extraction successful!")
        print(f"   Pages: {page_count}")
        print(f"   Tokens: {len(tokens)}")
        
        page_0_tokens = [t for t in tokens if t['page'] == 0]
        page_0_tokens.sort(key=lambda t: (t['y'], t['x']))
        text_output = tokens_to_text(page_0_tokens)
        
        # ALWAYS show extracted text in console
        print(f"\nEXTRACTED TEXT (Page 1):")
        print("-" * 60)
        preview_text = text_output[:500] + "..." if len(text_output) > 500 else text_output
        print(preview_text)
        print("-" * 60)
        print(f"   (Showing first 500 chars of {len(text_output)} total characters)")
        
        if debug:
            debug_tokens(tokens)
        
        # Try to show visual display
        try:
            images = extract_images_from_pdf_fixed(file_path, dpi=150)
            if images:
                img = images[0]
                fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(16, 10))
                
                ax1.imshow(img)
                ax1.set_title(f'PDF Page 1 of {page_count}', fontsize=14)
                ax1.axis('off')
                
                ax2.axis('off')
                ax2.text(0.05, 0.95, text_output[:2000], transform=ax2.transAxes, 
                        fontsize=10, verticalalignment='top', fontfamily='monospace')
                ax2.set_title(f'Extracted Text ({len(tokens)} tokens)', fontsize=14)
                
                plt.tight_layout()
                plt.show()
        except Exception as e:
            print(f"PDF visual display skipped: {e}")
            print("   (Text already displayed above in console)")
        
        return {
            'type': 'pdf',
            'pages': page_count,
            'tokens': len(tokens),
            'text': text_output
        }
    else:
        print("No native text found, falling back to OCR...")
        images = extract_images_from_pdf_fixed(file_path)
        if images:
            return test_image_from_array(images[0], os.path.basename(file_path), debug)
        else:
            print("Could not process PDF")
            return None


def test_image_from_array(img, filename, debug=False):
    print(f"Processing: {filename}")
    images = [img]
    
    print("Running OCR...")
    tokens = extract_ocr_tokens(images)
    structured_content = tokens_to_text(tokens)
    
    print(f"Results:")
    print(f"   Tokens extracted: {len(tokens)}")
    if tokens:
        print(f"   Average confidence: {sum(t['conf'] for t in tokens) / len(tokens):.2f}")
    print(f"   Image size: {img.size}")
    
    text_output = structured_content or "No text extracted"
    
    print(f"\nFirst 300 characters of extracted text:")
    print("-" * 50)
    print(text_output[:300] + "..." if len(text_output) > 300 else text_output)
    print("-" * 50)
    
    if debug and tokens:
        debug_tokens(tokens)
    
    try:
        fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(16, 10))
        
        ax1.imshow(img)
        ax1.set_title(f'Original: {filename}', fontsize=14)
        ax1.axis('off')
        
        ax2.axis('off')
        display_text = text_output[:3000] if len(text_output) > 3000 else text_output
        ax2.text(0.05, 0.95, display_text, transform=ax2.transAxes, 
                fontsize=10, verticalalignment='top', fontfamily='monospace')
        ax2.set_title(f'OCR Output ({len(tokens)} tokens)', fontsize=14)
        
        plt.tight_layout()
        plt.show()
        
    except Exception as e:
        print(f"Could not display image: {e}")
    
    return {
        'type': 'image',
        'filename': filename,
        'tokens': len(tokens),
        'confidence': sum(t['conf'] for t in tokens) / len(tokens) if tokens else 0,
        'text': text_output
    }


def test_file(filename, debug=False):
    fixture_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "tests", "fixtures"))
    file_path = os.path.join(fixture_root, filename)
    if not os.path.exists(file_path):
        for root, _, files in os.walk(fixture_root):
            if filename in files:
                file_path = os.path.join(root, filename)
                break
    
    if not os.path.exists(file_path):
        print(f"File not found: {file_path}")
        print("Available fixture files:")
        fixture_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "tests", "fixtures"))
        for root, _, files in os.walk(fixture_root):
            for f in files:
                print(f"  - {os.path.relpath(os.path.join(root, f), fixture_root)}")
        return None
    
    ext = os.path.splitext(filename)[1].lower()
    
    if ext == '.pdf':
        return test_pdf(file_path, debug)
    elif ext in ['.jpg', '.jpeg', '.png', '.bmp', '.tiff']:
        img = Image.open(file_path)
        return test_image_from_array(img, filename, debug)
    else:
        print(f"Unsupported file type: {ext}")
        print("   Supported: .pdf, .jpg, .jpeg, .png, .bmp, .tiff")
        return None


if __name__ == "__main__":
    debug_mode = False
    filename = "image.png"
    
    if len(sys.argv) > 1:
        if sys.argv[1] in ['--debug', '-d']:
            debug_mode = True
            if len(sys.argv) > 2:
                filename = sys.argv[2]
        elif sys.argv[1] in ['--help', '-h']:
            print("Usage: python test_new_invoice.py [filename] [--debug]")
            print("  filename: Image or PDF file in data/ folder")
            print("  --debug: Show detailed token information")
            print("\nExamples:")
            print("  python test_new_invoice.py invoice.jpg")
            print("  python test_new_invoice.py document.pdf --debug")
            sys.exit(0)
        else:
            filename = sys.argv[1]
            if len(sys.argv) > 2 and sys.argv[2] in ['--debug', '-d']:
                debug_mode = True
    
    print("=" * 60)
    print("Universal Invoice OCR Test")
    print("=" * 60)
    print(f"\nFile: tests/fixtures/{filename}")
    print(f"Debug mode: {'ON' if debug_mode else 'OFF'}")
    print("-" * 60 + "\n")
    
    result = test_file(filename, debug=debug_mode)
    
    if result:
        print(f"\nTest complete!")
        if result['type'] == 'image':
            print(f"   Type: Image | Tokens: {result['tokens']} | Confidence: {result['confidence']:.2f}")
        else:
            print(f"   Type: PDF | Pages: {result['pages']} | Tokens: {result['tokens']}")
