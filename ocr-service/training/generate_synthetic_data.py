"""
Synthetic Data Generator for EasyOCR Custom Training

Generates 500+ samples per digit (1-27) with variations:
- Multiple fonts
- Different sizes and scales
- Rotation and skew
- Noise and blur
- Contrast variations

Output format:
train_data/
├── image_0001.jpg
├── image_0002.jpg
├── ...
└── gt.txt  # Format: image_XXXX.jpg,label
"""

import os
import random
import numpy as np
from PIL import Image, ImageDraw, ImageFont
import cv2

# Configuration
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), 'train_data')
SAMPLES_PER_DIGIT = 600
IMAGE_HEIGHT = 64
IMAGE_WIDTH = 200

# Digits to generate (1-27)
DIGITS = list(range(1, 28))

# Fonts to use (Linux fonts - DejaVu and Liberation)
FONT_PATHS = [
    '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
    '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
    '/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf',
    '/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf',
    '/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf',
    '/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf',
    '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf',
    '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf',
    '/usr/share/fonts/truetype/liberation/LiberationSans-Italic.ttf',
    '/usr/share/fonts/truetype/liberation/LiberationSans-BoldItalic.ttf',
    '/usr/share/fonts/truetype/liberation/LiberationMono-Regular.ttf',
    '/usr/share/fonts/truetype/liberation/LiberationMono-Bold.ttf',
    '/usr/share/fonts/truetype/liberation/LiberationSerif-Regular.ttf',
    '/usr/share/fonts/truetype/liberation/LiberationSerif-Bold.ttf',
]

# Filter fonts that exist
AVAILABLE_FONTS = [f for f in FONT_PATHS if os.path.exists(f)]
print(f"Available fonts: {len(AVAILABLE_FONTS)}")


def generate_digit_image(digit: int, font_size: int = 48) -> Image.Image:
    """Generate a single digit image with random font and style."""
    # Create white background
    img = Image.new('L', (IMAGE_WIDTH, IMAGE_HEIGHT), 255)
    draw = ImageDraw.Draw(img)
    
    # Random font
    font_path = random.choice(AVAILABLE_FONTS)
    try:
        font = ImageFont.truetype(font_path, font_size)
    except:
        font = ImageFont.load_default()
    
    # Get text bounding box
    text = str(digit)
    bbox = draw.textbbox((0, 0), text, font=font)
    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]
    
    # Center text
    x = (IMAGE_WIDTH - text_width) // 2 - bbox[0]
    y = (IMAGE_HEIGHT - text_height) // 2 - bbox[1]
    
    # Random text color (dark gray to black)
    text_color = random.randint(0, 80)
    draw.text((x, y), text, fill=text_color, font=font)
    
    return img


def apply_augmentations(img: Image.Image) -> np.ndarray:
    """Apply random augmentations to simulate real-world conditions."""
    # Convert to numpy
    img_array = np.array(img)
    
    # 1. Random rotation (-5 to 5 degrees)
    if random.random() > 0.5:
        angle = random.uniform(-5, 5)
        h, w = img_array.shape
        center = (w // 2, h // 2)
        M = cv2.getRotationMatrix2D(center, angle, 1.0)
        img_array = cv2.warpAffine(img_array, M, (w, h), 
                                   borderMode=cv2.BORDER_CONSTANT, borderValue=255)
    
    # 2. Random scaling (0.9 to 1.1)
    if random.random() > 0.5:
        scale = random.uniform(0.9, 1.1)
        h, w = img_array.shape
        new_h, new_w = int(h * scale), int(w * scale)
        img_array = cv2.resize(img_array, (new_w, new_h))
        # Center crop/pad
        result = np.full((h, w), 255, dtype=np.uint8)
        y_offset = max(0, (h - new_h) // 2)
        x_offset = max(0, (w - new_w) // 2)
        h_crop = min(new_h, h)
        w_crop = min(new_w, w)
        result[y_offset:y_offset+h_crop, x_offset:x_offset+w_crop] = \
            img_array[max(0, (new_h-h)//2):max(0, (new_h-h)//2)+h_crop,
                     max(0, (new_w-w)//2):max(0, (new_w-w)//2)+w_crop]
        img_array = result
    
    # 3. Random noise (Gaussian)
    if random.random() > 0.5:
        noise = np.random.normal(0, random.uniform(5, 15), img_array.shape)
        img_array = np.clip(img_array.astype(np.float32) + noise, 0, 255).astype(np.uint8)
    
    # 4. Random blur
    if random.random() > 0.6:
        kernel_size = random.choice([3, 5])
        img_array = cv2.GaussianBlur(img_array, (kernel_size, kernel_size), 0)
    
    # 5. Random contrast/brightness
    if random.random() > 0.5:
        alpha = random.uniform(0.8, 1.5)  # Contrast
        beta = random.uniform(-20, 20)    # Brightness
        img_array = np.clip(alpha * img_array + beta, 0, 255).astype(np.uint8)
    
    # 6. Random erosion/dilation
    if random.random() > 0.7:
        kernel = np.ones((2, 2), np.uint8)
        if random.random() > 0.5:
            img_array = cv2.erode(img_array, kernel, iterations=1)
        else:
            img_array = cv2.dilate(img_array, kernel, iterations=1)
    
    # 7. Add random speckle noise
    if random.random() > 0.6:
        speckle_count = random.randint(10, 50)
        h, w = img_array.shape
        for _ in range(speckle_count):
            x = random.randint(0, w-1)
            y = random.randint(0, h-1)
            img_array[y, x] = random.choice([0, 255])
    
    return img_array


def generate_dataset():
    """Generate the complete training dataset."""
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    
    gt_lines = []
    image_count = 0
    
    print(f"Generating {SAMPLES_PER_DIGIT} samples per digit for {len(DIGITS)} digits...")
    print(f"Total images: {SAMPLES_PER_DIGIT * len(DIGITS)}")
    
    for digit in DIGITS:
        print(f"Generating digit {digit}...")
        
        for i in range(SAMPLES_PER_DIGIT):
            # Random font size variation
            font_size = random.randint(36, 60)
            
            # Generate base image
            img = generate_digit_image(digit, font_size)
            
            # Apply augmentations
            img_array = apply_augmentations(img)
            
            # Save image
            filename = f"digit_{digit}_{i:04d}.jpg"
            filepath = os.path.join(OUTPUT_DIR, filename)
            
            # Convert to RGB for JPEG
            img_rgb = cv2.cvtColor(img_array, cv2.COLOR_GRAY2RGB)
            cv2.imwrite(filepath, img_rgb, [cv2.IMWRITE_JPEG_QUALITY, 95])
            
            # Add to ground truth
            gt_lines.append(f"{filename},{digit}")
            image_count += 1
    
    # Write ground truth file
    gt_path = os.path.join(OUTPUT_DIR, 'gt.txt')
    with open(gt_path, 'w') as f:
        f.write('\n'.join(gt_lines))
    
    print(f"\nDataset generation complete!")
    print(f"Total images: {image_count}")
    print(f"Ground truth file: {gt_path}")
    print(f"Output directory: {OUTPUT_DIR}")


if __name__ == '__main__':
    generate_dataset()
