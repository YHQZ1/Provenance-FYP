import cv2
import numpy as np
from PIL import Image


def deskew_image(image: np.ndarray) -> np.ndarray:
    gray = cv2.cvtColor(image, cv2.COLOR_RGB2GRAY) if image.ndim == 3 else image
    edges = cv2.Canny(gray, 50, 150, apertureSize=3)
    contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return image

    contour = max(contours, key=cv2.contourArea)
    angle = cv2.minAreaRect(contour)[-1]
    if angle < -45:
        angle = -(90 + angle)
    elif angle > 45:
        angle = 90 - angle
    if abs(angle) <= 1:
        return image

    height, width = image.shape[:2]
    matrix = cv2.getRotationMatrix2D((width // 2, height // 2), angle, 1.0)
    return cv2.warpAffine(
        image,
        matrix,
        (width, height),
        flags=cv2.INTER_CUBIC,
        borderMode=cv2.BORDER_REPLICATE,
    )


def enhance_contrast(image: np.ndarray) -> np.ndarray:
    if image.ndim == 2:
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        return clahe.apply(image)

    lab = cv2.cvtColor(image, cv2.COLOR_RGB2LAB)
    lightness, a_channel, b_channel = cv2.split(lab)
    lightness = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8)).apply(lightness)
    enhanced = cv2.cvtColor(
        cv2.merge([lightness, a_channel, b_channel]), cv2.COLOR_LAB2RGB
    )
    return cv2.fastNlMeansDenoisingColored(enhanced, None, 10, 10, 7, 21)


def preprocess_image(image: Image.Image) -> Image.Image:
    rgb = np.array(image.convert("RGB"))
    return Image.fromarray(enhance_contrast(deskew_image(rgb)))
