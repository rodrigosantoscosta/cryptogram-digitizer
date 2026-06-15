"""
Shared Preprocessing Module

Common image preprocessing strategies used by both:
- ocr_engine.py (inference)
- generate_pseudo_labels.py (training data generation)

This eliminates code duplication and ensures consistency between
training and inference preprocessing.
"""

import cv2
import numpy as np
from typing import List, Tuple, Callable


def finalize_image(img: np.ndarray, target_height: int = 128) -> np.ndarray:
    """
    Common finalization: upscale, padding, convert to RGB.
    
    Args:
        img: Grayscale numpy array
        target_height: Target height for resizing (default: 128)
    
    Returns:
        RGB numpy array ready for OCR
    """
    aspect_ratio = img.shape[1] / img.shape[0]
    target_width = max(int(target_height * aspect_ratio), 64)
    
    resized = cv2.resize(
        img, 
        (target_width, target_height), 
        interpolation=cv2.INTER_LANCZOS4
    )
    
    pad_y = int(target_height * 0.3)
    pad_x = int(target_width * 0.3)
    
    padded = cv2.copyMakeBorder(
        resized, pad_y, pad_y, pad_x, pad_x,
        cv2.BORDER_CONSTANT, value=0
    )
    
    return cv2.cvtColor(padded, cv2.COLOR_GRAY2RGB)


def to_grayscale(image: np.ndarray) -> np.ndarray:
    """Convert image to grayscale if not already."""
    return image if image.ndim == 2 else cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)


def detect_edge_polarity(binary: np.ndarray) -> np.ndarray:
    """
    Detect and correct edge polarity.
    If edges are white (background), invert the image.
    """
    edge_pixels = np.concatenate([
        binary[0, :], binary[-1, :], binary[:, 0], binary[:, -1]
    ])
    if np.mean(edge_pixels) > 128:
        return cv2.bitwise_not(binary)
    return binary


def preprocess_binary_otsu(image: np.ndarray) -> np.ndarray:
    """
    Strategy 1: Binary + Otsu threshold.
    Good for clear, high-contrast images.
    """
    gray = to_grayscale(image)
    _, binary = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    binary = detect_edge_polarity(binary)
    return finalize_image(binary)


def preprocess_clahe_grayscale(image: np.ndarray) -> np.ndarray:
    """
    Strategy 2: CLAHE contrast enhancement + grayscale.
    Better for low-contrast or faded images.
    """
    gray = to_grayscale(image)
    clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
    enhanced = clahe.apply(gray)
    return finalize_image(enhanced)


def preprocess_adaptive_denoise(image: np.ndarray) -> np.ndarray:
    """
    Strategy 3: Adaptive threshold + aggressive denoising.
    Best for noisy or blurry images.
    """
    gray = to_grayscale(image)
    denoised = cv2.fastNlMeansDenoising(
        gray, h=10, templateWindowSize=7, searchWindowSize=21
    )
    adaptive = cv2.adaptiveThreshold(
        denoised, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY, 11, 2
    )
    adaptive = detect_edge_polarity(adaptive)
    return finalize_image(adaptive)


def get_all_strategies() -> List[Tuple[str, Callable]]:
    """Returns list of (name, preprocess_fn) tuples for all strategies."""
    return [
        ("binary_otsu", preprocess_binary_otsu),
        ("clahe_grayscale", preprocess_clahe_grayscale),
        ("adaptive_denoise", preprocess_adaptive_denoise),
    ]
