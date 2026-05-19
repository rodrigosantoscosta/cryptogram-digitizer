# EasyOCR Custom Model Training for Cryptogram Digits

This directory contains everything needed to train a custom EasyOCR model for recognizing cryptogram digits (1-27).

## Overview

**Goal**: Replace the generic EasyOCR model with a custom-trained model optimized for cryptogram digit recognition.

**Expected Results**: 95-99% accuracy (up from 85.4%)

**Training Time**: 30-60 minutes on GPU (Google Colab)

---

## Quick Start

### Pipeline Completo (Fases 2-4)

O pipeline completo extrai células das fotos, gera pseudo-labels e combina com dados sintéticos:

```bash
# Na raiz do projeto
./run_pipeline.sh
```

Isso executa automaticamente:
1. **Fase 2**: Extrai células das 43 fotos em `samples/`
2. **Fase 3**: Gera pseudo-labels com EasyOCR
3. **Fase 4**: Combina células reais com dados sintéticos

**Opções**:
```bash
# Rebuild do container antes de executar
./run_pipeline.sh --rebuild

# Executar apenas uma fase específica
./run_pipeline.sh --phase 2  # Apenas extração
./run_pipeline.sh --phase 3  # Apenas pseudo-labeling
./run_pipeline.sh --phase 4  # Apenas combinação
```

### Pré-requisitos

- Docker Desktop rodando
- Container OCR service acessível via `docker-compose.ocr.yml`

### Execução Manual (Fase por Fase)

Se preferir executar cada fase separadamente:

```bash
# Iniciar o container
docker compose -f docker-compose.ocr.yml up -d

# Aguardar container ficar saudável
docker compose -f docker-compose.ocr.yml ps

# Fase 2: Extrair células
docker compose -f docker-compose.ocr.yml exec ocr-service \
  python training/batch_extract_cells.py

# Fase 3: Gerar pseudo-labels
docker compose -f docker-compose.ocr.yml exec ocr-service \
  python training/generate_pseudo_labels.py

# Fase 4: Combinar datasets
docker compose -f docker-compose.ocr.yml exec ocr-service \
  python training/hybrid_dataset.py
```

### Option 1: Google Colab (Recommended - Free GPU)

1. **Open Colab Notebook**:
   - Use: https://github.com/AbdullahButt2611/EasyOCR-Custom-Training
   - Or create a new notebook with the steps below

2. **Upload Training Data**:
   ```bash
   # First, generate synthetic data locally
   cd ocr-service/training
   docker build -t data-generator -f Dockerfile.train .
   docker run --rm -v $(pwd)/train_data:/app/train_data data-generator
   ```

3. **Upload to Colab**:
   - Upload the `train_data/` folder to Google Drive
   - Mount Drive in Colab

4. **Run Training**:
   ```python
   # In Colab
   !git clone https://github.com/JaidedAI/EasyOCR.git
   %cd EasyOCR/trainer
   
   # Configure training
   import yaml
   config = {
       'experiment_name': 'cryptogram_digits',
       'train_data': 'all_data',
       'valid_data': 'all_data/val',
       'saved_model': 'saved_models/english_g2.pth',
       'num_iter': 5000,
       'batch_size': 32,
       'lr': 0.0001,
       'optim': 'adam',
       'Transformation': 'None',
       'FeatureExtraction': 'VGG',
       'SequenceModeling': 'BiLSTM',
       'Prediction': 'CTC',
       'character': '0123456789',
       'imgH': 64,
       'imgW': 200,
   }
   
   # Run training
   !python train.py --config config.yaml
   ```

5. **Download Trained Model**:
   - Download `best_accuracy.pth` from Colab
   - Save to `ocr-service/models/cryptogram_digits.pth`

### Option 2: Local Training (Requires GPU)

1. **Install EasyOCR Trainer**:
   ```bash
   git clone https://github.com/JaidedAI/EasyOCR.git
   cd EasyOCR/trainer
   pip install -r requirements.txt
   ```

2. **Generate Training Data**:
   ```bash
   cd ocr-service/training
   python generate_synthetic_data.py
   ```

3. **Prepare Data**:
   ```bash
   python train.py
   ```

4. **Run Training**:
   ```bash
   python train.py --config config.yaml
   ```

---

## File Structure

```
ocr-service/training/
├── grid_detector.py              # Grid detection (Python port do TypeScript)
├── batch_extract_cells.py        # Fase 2: Extrai células das fotos
├── generate_pseudo_labels.py     # Fase 3: Pseudo-labeling via EasyOCR
├── hybrid_dataset.py             # Fase 4: Combina reais + sintéticos
├── generate_synthetic_data.py    # Generates 600 samples per digit (1-27)
├── train.py                      # Training pipeline orchestrator
├── config.yaml                   # EasyOCR training configuration
├── cryptogram_digits.py          # Model architecture (None-VGG-BiLSTM-CTC)
├── cryptogram_digits.yaml        # Model config for EasyOCR loading
├── Dockerfile.train              # Docker image for data generation
├── README.md                     # This file
├── train_data/                   # Generated synthetic data (after running generator)
│   ├── digit_1_0000.jpg
│   ├── digit_1_0001.jpg
│   ├── ...
│   └── gt.txt                    # Ground truth file
├── all_data/                     # Hybrid dataset (after running pipeline)
│   ├── train/
│   │   ├── *.png
│   │   └── gt.txt
│   └── val/
│       ├── *.png
│       └── gt.txt
└── saved_models/                 # Pretrained and trained models
    ├── english_g2.pth            # Pretrained model (download)
    └── cryptogram_digits.pth     # Your trained model (output)

# Diretórios de output (na raiz do projeto)
real_cells/                       # Células extraídas das fotos
  {foto_name}/
    cell_r{row}_c{col}.png
    _grid_overlay.png
pseudo_labeled/                   # Células com pseudo-labels
  high/
    {digit}/
      cell_0001.png
  med/
    {digit}/
      cell_0001.png
```

---

## Data Generation

The synthetic data generator creates realistic training samples with:

- **29 different fonts** (Arial, Times, Courier, Verdana, etc.)
- **600 samples per digit** (16,200 total images)
- **Augmentations**:
  - Random rotation (-5° to 5°)
  - Random scaling (0.9x to 1.1x)
  - Gaussian noise
  - Blur
  - Contrast/brightness variation
  - Erosion/dilation
  - Speckle noise

### Run Data Generation:

```bash
cd ocr-service/training

# Option 1: Using Docker (recommended)
docker build -t data-generator -f Dockerfile.train .
docker run --rm -v $(pwd)/train_data:/app/train_data data-generator

# Option 2: Using Python directly (if Python is installed)
python generate_synthetic_data.py
```

---

## Training Configuration

Key parameters in `config.yaml`:

| Parameter | Value | Description |
|-----------|-------|-------------|
| `num_iter` | 5000 | Training iterations |
| `batch_size` | 32 | Batch size (adjust for GPU memory) |
| `lr` | 0.0001 | Learning rate (low for fine-tuning) |
| `optim` | adam | Optimizer |
| `saved_model` | english_g2.pth | Pretrained model to fine-tune |
| `imgH` | 64 | Input image height |
| `imgW` | 200 | Input image width |
| `character` | 0123456789 | Character set (digits only) |

### Architecture: None-VGG-BiLSTM-CTC

- **Transformation**: None (no rectification needed)
- **Feature Extraction**: VGG (proven for OCR)
- **Sequence Modeling**: BiLSTM (captures context)
- **Prediction**: CTC (connectionist temporal classification)

---

## Model Integration

After training completes:

### 1. Copy Model Files

```bash
# Trained weights
cp saved_models/best_accuracy.pth ../models/cryptogram_digits.pth

# Model architecture (already in this directory)
# cryptogram_digits.py -> ~/.EasyOCR/user_network/
# cryptogram_digits.yaml -> ~/.EasyOCR/user_network/
```

### 2. Update Dockerfile

The OCR service Dockerfile already includes the custom model configuration:

```dockerfile
# In ocr-service/Dockerfile
# The recog_network is set to 'cryptogram_digits' in ocr_engine.py
```

### 3. Rebuild and Deploy

```bash
cd ../..
docker compose up -d --build
```

### 4. Test

```bash
# Test health endpoint
curl http://localhost:5000/health

# Test with cryptogram image via frontend
# Open http://localhost:5174 and upload image
```

---

## Expected Results

| Metric | Before | After (Expected) |
|--------|--------|------------------|
| Accuracy | 85.4% (82/96) | 95-99% (91-95/96) |
| Coverage | 100% | 100% |
| Errors | 14 cells | 1-5 cells |

### Common Error Reduction:

| Error Pattern | Before | After |
|---------------|--------|-------|
| 13 → 7 | 3 occurrences | 0-1 |
| 26 → 17/4/11 | 3 occurrences | 0-1 |
| 1 → 4/7 | 2 occurrences | 0 |
| 3 → 4/8 | 2 occurrences | 0-1 |
| 27 → 7 | 1 occurrence | 0 |

---

## Troubleshooting

### Training Loss Not Decreasing

- Check learning rate (should be low: 0.0001)
- Verify data format (gt.txt format: `filename,label`)
- Ensure pretrained model is loaded correctly

### Model Not Loading in EasyOCR

- Verify `recog_network` matches filename (without extension)
- Check that `.py`, `.yaml`, and `.pth` files are in correct locations
- Ensure character_list in yaml matches training config

### Poor Accuracy After Training

- Increase `num_iter` (try 10000)
- Add more training data (increase SAMPLES_PER_DIGIT)
- Check validation accuracy during training
- Verify data augmentations match real-world conditions

---

## Resources

- **EasyOCR Custom Models**: https://deepwiki.com/JaidedAI/EasyOCR/8.1-custom-models
- **Training Tutorial**: https://www.youtube.com/watch?v=-j3TbyceShY
- **Colab Notebook**: https://github.com/AbdullahButt2611/EasyOCR-Custom-Training
- **EasyOCR Trainer**: https://github.com/JaidedAI/EasyOCR/tree/master/trainer
- **Official Docs**: https://github.com/JaidedAI/EasyOCR/blob/master/custom_model.md

---

## Next Steps

1. ✅ Synthetic data generation script created
2. ✅ GridDetector Python port com correção de perspectiva
3. ✅ Batch cell extraction script (Fase 2)
4. ✅ Pseudo-labeling script (Fase 3)
5. ✅ Hybrid dataset builder (Fase 4)
6. ✅ Pipeline automation script (`run_pipeline.sh`)
7. ⏳ **Your action**: Run pipeline (`./run_pipeline.sh`)
8. ⏳ **Your action**: Run training (Google Colab recommended)
9. ⏳ **Your action**: Deploy trained model
10. ⏳ **Your action**: Test and validate accuracy
