# EasyOCR Custom Training - Google Colab Notebook
# Run this in Google Colab: https://colab.research.google.com/

# ============================================================
# CELL 1: Setup and Installation
# ============================================================

# Install required packages
!pip install easyocr torch torchvision pillow opencv-python lmdb pyyaml

# Clone EasyOCR for trainer scripts
!git clone https://github.com/JaidedAI/EasyOCR.git
%cd EasyOCR/trainer

# Create directories
!mkdir -p all_data/train all_data/val saved_models

print("✅ Setup complete!")


# ============================================================
# CELL 2: Upload Training Data
# ============================================================

# Option 1: Upload from local machine
from google.colab import files
import os
import zipfile

print("Upload your train_data.zip file...")
uploaded = files.upload()

# Extract uploaded data
for filename in uploaded.keys():
    if filename.endswith('.zip'):
        !unzip -o {filename} -d ../training/
        print(f"✅ Extracted {filename}")

# Option 2: Use Google Drive
# from google.colab import drive
# drive.mount('/content/drive')
# !cp -r /content/drive/MyDrive/cryptogram-training/train_data/* ../training/train_data/

print("✅ Data uploaded!")


# ============================================================
# CELL 3: Prepare Data
# ============================================================

import os
import random
import shutil

DATA_DIR = '../training/train_data'
ALL_DATA_DIR = 'all_data'
TRAIN_DIR = os.path.join(ALL_DATA_DIR, 'train')
VAL_DIR = os.path.join(ALL_DATA_DIR, 'val')

# Read ground truth
gt_path = os.path.join(DATA_DIR, 'gt.txt')
with open(gt_path, 'r') as f:
    lines = [line.strip() for line in f.readlines() if line.strip()]

print(f"Total images: {len(lines)}")

# Shuffle and split (80/20)
random.seed(42)
random.shuffle(lines)
split_idx = int(len(lines) * 0.8)
train_lines = lines[:split_idx]
val_lines = lines[split_idx:]

print(f"Training: {len(train_lines)}")
print(f"Validation: {len(val_lines)}")

# Copy training images
for line in train_lines:
    filename = line.split(',')[0]
    src = os.path.join(DATA_DIR, filename)
    dst = os.path.join(TRAIN_DIR, filename)
    if os.path.exists(src):
        shutil.copy2(src, dst)

# Copy validation images
for line in val_lines:
    filename = line.split(',')[0]
    src = os.path.join(DATA_DIR, filename)
    dst = os.path.join(VAL_DIR, filename)
    if os.path.exists(src):
        shutil.copy2(src, dst)

# Write ground truth files
with open(os.path.join(TRAIN_DIR, 'gt.txt'), 'w') as f:
    f.write('\n'.join(train_lines))

with open(os.path.join(VAL_DIR, 'gt.txt'), 'w') as f:
    f.write('\n'.join(val_lines))

print("✅ Data prepared!")


# ============================================================
# CELL 4: Download Pretrained Model
# ============================================================

# Download english_g2.pth for fine-tuning
!wget -O saved_models/english_g2.pth https://github.com/JaidedAI/EasyOCR/releases/download/v1.7.1/english_g2.pth

print("✅ Pretrained model downloaded!")


# ============================================================
# CELL 5: Training Configuration
# ============================================================

import yaml

config = {
    'experiment_name': 'cryptogram_digits',
    'train_data': 'all_data',
    'valid_data': 'all_data/val',
    'manualSeed': 1111,
    'workers': 4,
    'batch_size': 32,
    'num_iter': 5000,
    'valInterval': 100,
    'saved_model': 'saved_models/english_g2.pth',
    'FT': True,
    'optim': 'adam',
    'lr': 0.0001,
    'beta1': 0.9,
    'rho': 0.95,
    'eps': 0.00000001,
    'grad_clip': 5,
    'select_data': 'train',
    'batch_ratio': '1',
    'total_data_usage_ratio': 1.0,
    'batch_max_length': 2,
    'imgH': 64,
    'imgW': 200,
    'rgb': False,
    'contrast_adjust': False,
    'sensitive': True,
    'PAD': True,
    'data_filtering_off': False,
    'Transformation': 'None',
    'FeatureExtraction': 'VGG',
    'SequenceModeling': 'BiLSTM',
    'Prediction': 'CTC',
    'num_fiducial': 20,
    'input_channel': 1,
    'output_channel': 256,
    'hidden_size': 256,
    'decode': 'greedy',
    'new_prediction': False,
    'freeze_FeatureFxtraction': False,
    'freeze_SequenceModeling': False,
    'number': '0123456789',
    'symbol': '',
    'lang_char': '',
}

# Save config
with open('config_files/cryptogram_digits_config.yaml', 'w') as f:
    yaml.dump(config, f)

print("✅ Configuration saved!")
print(f"Config: {config['experiment_name']}")
print(f"Iterations: {config['num_iter']}")
print(f"Batch size: {config['batch_size']}")
print(f"Learning rate: {config['lr']}")


# ============================================================
# CELL 6: Run Training
# ============================================================

# This will take 30-60 minutes on GPU
!python train.py --config config_files/cryptogram_digits_config.yaml

print("✅ Training complete!")


# ============================================================
# CELL 7: Test Trained Model
# ============================================================

import easyocr
import cv2
import numpy as np
from PIL import Image

# Initialize reader with custom model
reader = easyocr.Reader(
    ['en'],
    gpu=True,
    recog_network='cryptogram_digits',
    model_storage_directory='./custom_model'
)

# Test on sample images
import glob
test_images = glob.glob('all_data/val/*.jpg')[:10]

correct = 0
total = 0

for img_path in test_images:
    # Get expected label
    filename = os.path.basename(img_path)
    expected = filename.split('_')[1]  # Extract digit from filename
    
    # Run OCR
    image = cv2.imread(img_path)
    results = reader.readtext(image, detail=1, paragraph=False)
    
    if results:
        best = max(results, key=lambda x: x[2])
        text = best[1]
        # Extract digits
        import re
        digits = re.sub(r'[^0-9]', '', text)
        if digits:
            predicted = digits
            if predicted == expected:
                correct += 1
            total += 1
            print(f"Expected: {expected}, Predicted: {predicted} {'✅' if predicted == expected else '❌'}")

if total > 0:
    accuracy = correct / total * 100
    print(f"\n📊 Test Accuracy: {accuracy:.1f}% ({correct}/{total})")
else:
    print("No test results")


# ============================================================
# CELL 8: Download Trained Model
# ============================================================

# Download the trained model
from google.colab import files

model_path = 'saved_models/cryptogram_digits/best_accuracy.pth'
if os.path.exists(model_path):
    files.download(model_path)
    print("✅ Model downloaded!")
    print("\nNext steps:")
    print("1. Save cryptogram_digits.pth to ocr-service/models/")
    print("2. Copy cryptogram_digits.py to ~/.EasyOCR/user_network/")
    print("3. Copy cryptogram_digits.yaml to ~/.EasyOCR/user_network/")
    print("4. Rebuild Docker: docker compose up -d --build")
else:
    print("Model not found. Check training logs for errors.")
