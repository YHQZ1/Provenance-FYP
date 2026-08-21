"""
Image Preprocessing Pipeline for OCR

Logic: Prepares images for optimal OCR accuracy through 5 sequential steps:
1. DPI scaling - Ensures minimum 300 DPI for character detail
2. Deskewing - Corrects rotation using contour detection
3. Contrast enhancement - Uses CLAHE in LAB color space for adaptive improvement
4. Denoising - Removes noise while preserving edges using Non-Local Means
5. Color preservation - Maintains RGB throughout for visual cues

Key principle: Each step addresses specific image quality issues that degrade OCR accuracy.
Order matters: Scale first (resolution), then deskew (geometry), then enhance (contrast), then denoise (artifacts).
"""

import cv2
import numpy as np
from PIL import Image


def calculate_dpi(pil_image):
    width, height = pil_image.size
    standard_width_mm = 210
    standard_height_mm = 297
    
    dpi_width = (width / standard_width_mm) * 25.4
    dpi_height = (height / standard_height_mm) * 25.4
    return min(dpi_width, dpi_height)


def deskew_image(image):
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY) if len(image.shape) == 3 else image
    edges = cv2.Canny(gray, 50, 150, apertureSize=3)
    contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    if contours:
        largest_contour = max(contours, key=cv2.contourArea)
        rect = cv2.minAreaRect(largest_contour)
        angle = rect[-1]
        
        if angle < -45:
            angle = -(90 + angle)
        elif angle > 45:
            angle = 90 - angle
            
        if abs(angle) > 1:
            (h, w) = image.shape[:2]
            center = (w // 2, h // 2)
            M = cv2.getRotationMatrix2D(center, angle, 1.0)
            rotated = cv2.warpAffine(image, M, (w, h), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)
            return rotated
    
    return image


def enhance_contrast_denoise(image):
    if len(image.shape) == 3:
        lab = cv2.cvtColor(image, cv2.COLOR_BGR2LAB)
        l, a, b = cv2.split(lab)
        
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8,8))
        l = clahe.apply(l)
        
        enhanced = cv2.merge([l, a, b])
        enhanced = cv2.cvtColor(enhanced, cv2.COLOR_LAB2BGR)
        
        denoised = cv2.fastNlMeansDenoisingColored(enhanced, None, 10, 10, 7, 21)
        return denoised
    else:
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8,8))
        enhanced = clahe.apply(image)
        denoised = cv2.fastNlMeansDenoising(enhanced, None, 10, 7, 21)
        return denoised


def scale_to_300dpi(pil_image):
    current_dpi = calculate_dpi(pil_image)
    
    if current_dpi < 300:
        scale_factor = 300 / current_dpi
        new_width = int(pil_image.width * scale_factor)
        new_height = int(pil_image.height * scale_factor)
        resized = pil_image.resize((new_width, new_height), Image.Resampling.LANCZOS)
        return resized
    
    return pil_image


def preprocess_image(pil_image):
    scaled = scale_to_300dpi(pil_image)
    img = np.array(scaled)
    deskewed = deskew_image(img)
    enhanced = enhance_contrast_denoise(deskewed)
    return Image.fromarray(enhanced)