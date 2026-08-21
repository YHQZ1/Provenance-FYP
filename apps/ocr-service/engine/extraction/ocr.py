"""
OCR Text Extraction Engine

Logic: Extracts text from images using PaddleOCR with layout preservation:
1. Initialize PaddleOCR with table/layout recognition enabled
2. Preprocess each image (DPI, deskew, enhance, denoise)
3. Run OCR to get text regions with bounding boxes and confidence scores
4. Normalize coordinates to 0-1 range for scale independence
5. Filter low-confidence results (confidence < 0.5)
6. Reconstruct reading order by sorting Y then X coordinates
7. Group tokens into lines using spatial proximity (2% tolerance)

Key principle: PaddleOCR provides superior accuracy on structured documents compared to Tesseract.
Structured reconstruction preserves document layout for downstream field extraction.
"""

from paddleocr import PaddleOCR
from engine.extraction.preprocess import preprocess_image
import numpy as np


def extract_ocr_tokens(images):
    tokens = []
    
    ocr = PaddleOCR(
        use_angle_cls=True,
        lang='en',
        show_log=False,
        use_gpu=False,
        det_db_thresh=0.3,
        det_db_box_thresh=0.5,
        rec_batch_num=6,
        drop_score=0.5,
        table=True,
        layout=True,
    )
    
    for page_num, img in enumerate(images):
        processed = preprocess_image(img)
        img_array = np.array(processed)
        result = ocr.ocr(img_array, cls=True)
        
        if result and result[0]:
            img_width, img_height = img.size
            
            for line in result[0]:
                if line and len(line) >= 2:
                    bbox = line[0]
                    text_info = line[1]
                    
                    if text_info and len(text_info) >= 2:
                        text = text_info[0].strip()
                        conf = float(text_info[1])
                        
                        if conf > 0 and text:
                            x_coords = [point[0] for point in bbox]
                            y_coords = [point[1] for point in bbox]
                            
                            x_min = min(x_coords) / img_width
                            y_min = min(y_coords) / img_height
                            x_max = max(x_coords) / img_width
                            y_max = max(y_coords) / img_height
                            
                            tokens.append({
                                "text": text,
                                "x": x_min,
                                "y": y_min,
                                "w": x_max - x_min,
                                "h": y_max - y_min,
                                "page": page_num,
                                "conf": conf,
                                "source": "paddleocr",
                                "bbox": bbox
                            })
    
    return tokens


def extract_structured_text(images):
    tokens = extract_ocr_tokens(images)
    structured_content = []
    
    for page_tokens in [tokens]:
        if not page_tokens:
            continue
            
        sorted_tokens = sorted(page_tokens, key=lambda t: (t['y'], t['x']))
        
        lines = []
        current_line = []
        last_y = None
        
        for token in sorted_tokens:
            if last_y is None or abs(token['y'] - last_y) < 0.02:
                current_line.append(token)
            else:
                if current_line:
                    current_line.sort(key=lambda t: t['x'])
                    lines.append(current_line)
                current_line = [token]
            last_y = token['y']
        
        if current_line:
            current_line.sort(key=lambda t: t['x'])
            lines.append(current_line)
        
        page_text = []
        for line in lines:
            line_text = " ".join([token['text'] for token in line])
            page_text.append(line_text)
        
        structured_content.append("\n".join(page_text))
    
    return structured_content, tokens