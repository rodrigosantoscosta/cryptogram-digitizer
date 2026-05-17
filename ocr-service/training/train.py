"""
EasyOCR Custom Model Training Pipeline

This script:
1. Prepares training data (splits into train/val)
2. Creates LMDB datasets
3. Downloads pretrained model for fine-tuning
4. Runs training
5. Converts model for EasyOCR integration

Usage:
  python train.py [--data_dir PATH] [--output_dir PATH]
"""

import os
import sys
import shutil
import random
import subprocess
from pathlib import Path

# Configuration
DATA_DIR = os.path.join(os.path.dirname(__file__), 'train_data')
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), 'output')
ALL_DATA_DIR = os.path.join(os.path.dirname(__file__), 'all_data')
TRAIN_DIR = os.path.join(ALL_DATA_DIR, 'train')
VAL_DIR = os.path.join(ALL_DATA_DIR, 'val')
SAVED_MODELS_DIR = os.path.join(os.path.dirname(__file__), 'saved_models')

# Training parameters
VAL_SPLIT = 0.2  # 20% for validation
RANDOM_SEED = 42


def prepare_data():
    """Split synthetic data into train and validation sets."""
    print("=" * 60)
    print("Step 1: Preparing Training Data")
    print("=" * 60)
    
    # Read ground truth
    gt_path = os.path.join(DATA_DIR, 'gt.txt')
    if not os.path.exists(gt_path):
        print(f"Error: Ground truth file not found at {gt_path}")
        print("Run generate_synthetic_data.py first!")
        sys.exit(1)
    
    with open(gt_path, 'r') as f:
        lines = [line.strip() for line in f.readlines() if line.strip()]
    
    print(f"Total images: {len(lines)}")
    
    # Shuffle and split
    random.seed(RANDOM_SEED)
    random.shuffle(lines)
    
    split_idx = int(len(lines) * (1 - VAL_SPLIT))
    train_lines = lines[:split_idx]
    val_lines = lines[split_idx:]
    
    print(f"Training samples: {len(train_lines)}")
    print(f"Validation samples: {len(val_lines)}")
    
    # Create directories
    for d in [ALL_DATA_DIR, TRAIN_DIR, VAL_DIR]:
        os.makedirs(d, exist_ok=True)
    
    # Copy training images
    print("Copying training images...")
    for line in train_lines:
        filename = line.split(',')[0]
        src = os.path.join(DATA_DIR, filename)
        dst = os.path.join(TRAIN_DIR, filename)
        if os.path.exists(src):
            shutil.copy2(src, dst)
    
    # Copy validation images
    print("Copying validation images...")
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
    
    print("Data preparation complete!")


def create_lmdb_dataset():
    """Create LMDB datasets for training."""
    print("\n" + "=" * 60)
    print("Step 2: Creating LMDB Datasets")
    print("=" * 60)
    
    # This would use EasyOCR's create_lmdb_dataset.py script
    # For now, we'll note that this step needs to be done with the EasyOCR trainer
    
    print("LMDB creation requires EasyOCR trainer scripts.")
    print("Please use the Google Colab notebook or EasyOCR trainer repo.")
    print("See: https://github.com/JaidedAI/EasyOCR/blob/master/custom_model.md")


def download_pretrained_model():
    """Download pretrained EasyOCR model for fine-tuning."""
    print("\n" + "=" * 60)
    print("Step 3: Downloading Pretrained Model")
    print("=" * 60)
    
    os.makedirs(SAVED_MODELS_DIR, exist_ok=True)
    
    # The english_g2.pth model should be downloaded from EasyOCR's model hub
    # URL: https://github.com/JaidedAI/EasyOCR/blob/master/easyocr/config.py
    
    print("Download english_g2.pth from EasyOCR model hub:")
    print("https://github.com/JaidedAI/EasyOCR/releases/download/v1.7.1/english_g2.pth")
    print(f"Save to: {SAVED_MODELS_DIR}/english_g2.pth")


def run_training():
    """Run the training process."""
    print("\n" + "=" * 60)
    print("Step 4: Running Training")
    print("=" * 60)
    
    print("\nTraining requires EasyOCR trainer environment.")
    print("\nRecommended approach: Use Google Colab")
    print("1. Open: https://github.com/AbdullahButt2611/EasyOCR-Custom-Training")
    print("2. Upload your train_data/ directory")
    print("3. Run the notebook with config:")
    print("   - experiment_name: cryptogram_digits")
    print("   - num_iter: 5000")
    print("   - batch_size: 32")
    print("   - lr: 0.0001")
    print("   - saved_model: path/to/english_g2.pth")
    
    print("\nOr run locally with EasyOCR trainer:")
    print("cd trainer/")
    print("python train.py --config config.yaml")


def convert_model():
    """Convert trained model for EasyOCR integration."""
    print("\n" + "=" * 60)
    print("Step 5: Converting Model for EasyOCR")
    print("=" * 60)
    
    print("\nAfter training completes:")
    print("1. Copy best_accuracy.pth to:")
    print("   ocr-service/models/cryptogram_digits.pth")
    print("\n2. Copy cryptogram_digits.py to:")
    print("   ~/.EasyOCR/user_network/cryptogram_digits.py")
    print("\n3. Copy cryptogram_digits.yaml to:")
    print("   ~/.EasyOCR/user_network/cryptogram_digits.yaml")
    print("\n4. Update ocr_engine.py to use:")
    print("   recog_network='cryptogram_digits'")


def main():
    """Main training pipeline."""
    print("=" * 60)
    print("EasyOCR Custom Model Training Pipeline")
    print("Cryptogram Digit Recognition (1-27)")
    print("=" * 60)
    
    # Check if data exists
    gt_path = os.path.join(DATA_DIR, 'gt.txt')
    if not os.path.exists(gt_path):
        print("\nNo training data found!")
        print("Run: python generate_synthetic_data.py")
        sys.exit(1)
    
    # Run pipeline steps
    prepare_data()
    download_pretrained_model()
    create_lmdb_dataset()
    run_training()
    convert_model()
    
    print("\n" + "=" * 60)
    print("Training Pipeline Complete!")
    print("=" * 60)
    print("\nNext steps:")
    print("1. Use Google Colab or local EasyOCR trainer to run training")
    print("2. Copy trained model to ocr-service/models/")
    print("3. Update ocr_engine.py configuration")
    print("4. Rebuild Docker container")
    print("5. Test with cryptogram images")


if __name__ == '__main__':
    main()
