# Invoice OCR Service

An advanced OCR pipeline for extracting structured text from invoice images and PDFs using PaddleOCR with intelligent preprocessing.

## Overview

This project extracts text from invoice documents (images and PDFs) with high accuracy using:
- **PaddleOCR**: Deep learning-based OCR with layout preservation
- **Advanced Preprocessing**: Auto-deskew, contrast enhancement, denoising, DPI scaling
- **Dual PDF Support**: Native text extraction for digital PDFs, OCR fallback for scanned PDFs
- **Visual Comparison**: Side-by-side display of original document and extracted text

## Installation

### 1. Clone/Setup Project
```bash
cd document-ocr-service
```

### 2. Install Python Dependencies
```bash
pip install -r requirements.txt
```

### 3. Verify Poppler (Windows)
Poppler is already included in `poppler/` folder for PDF-to-image conversion.

## Usage

**Step 1: Put your invoice (JPG, PNG, or PDF) in the data folder**
```bash
copy "your_invoice.pdf" data\
```

**Step 2: Run the test script**
```bash
# Test default file (data/image.png)
python test_new_invoice.py

# Test specific file
python test_new_invoice.py your_invoice.pdf
python test_new_invoice.py invoice.jpg

# Test with debug info (shows token details)
python test_new_invoice.py invoice.pdf --debug
```

### OUTPUT

1. **Console Output**:
   - Processing status
   - Token count and confidence scores
   - Extracted text preview (first 500 characters)

2. **Visual Display** (if matplotlib available):
   - Left: Original invoice image/PDF page
   - Right: Extracted text formatted for readability

## How It Works

### 1. Image Preprocessing (`engine/extraction/preprocess.py`)

### 2. OCR Extraction (`engine/extraction/ocr.py`)

### 3. PDF Processing (`engine/extraction/pdf.py`)

### Evaluate Against Ground Truth
```bash
python evaluate_huggingface_dataset.py
```


```
