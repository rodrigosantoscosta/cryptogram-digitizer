# Guia de Treinamento no Google Colab

## Dataset Preparado

O dataset híbrido já está pronto em `ocr-service/training/all_data/`:

| Split | Imagens | Arquivo |
|-------|---------|---------|
| Train | 21,744 | `all_data/train/gt.txt` |
| Val | 5,436 | `all_data/val/gt.txt` |
| **Total** | **27,180** | |

Composição:
- **10,980 células reais** (pseudo-labeled com validação de mismatch)
- **16,200 células sintéticas** (600 por dígito × 27 dígitos)

---

## Passo a Passo no Google Colab

### 1. Abrir Colab
Acesse: https://colab.research.google.com/

### 2. Criar Novo Notebook e Colar as Células

#### Célula 1: Setup
```python
# Instalar dependências
!pip install easyocr torch torchvision pillow opencv-python lmdb pyyaml

# Clonar EasyOCR para scripts de treino
!git clone https://github.com/JaidedAI/EasyOCR.git
%cd EasyOCR/trainer

# Criar diretórios
!mkdir -p all_data/train all_data/val saved_models

print("✅ Setup complete!")
```

#### Célula 2: Upload do Dataset
```python
from google.colab import files
import zipfile
import os

print("Faça upload do arquivo all_data.zip...")
print("Crie o zip localmente com:")
print("  cd ocr-service/training")
print("  zip -r all_data.zip all_data/")
print("  # Depois faça upload no Colab")

uploaded = files.upload()

for filename in uploaded.keys():
    if filename.endswith('.zip'):
        !unzip -o {filename}
        print(f"✅ Extracted {filename}")

print("✅ Data uploaded!")
```

#### Célula 3: Download Modelo Pré-treinado
```python
# Download do modelo base para fine-tuning
!wget -O saved_models/english_g2.pth https://github.com/JaidedAI/EasyOCR/releases/download/v1.7.1/english_g2.pth

print("✅ Pretrained model downloaded!")
```

#### Célula 4: Configuração de Treino
```python
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

# Salvar config
!mkdir -p config_files
with open('config_files/cryptogram_digits_config.yaml', 'w') as f:
    yaml.dump(config, f)

print("✅ Configuration saved!")
print(f"Experiment: {config['experiment_name']}")
print(f"Iterations: {config['num_iter']}")
print(f"Batch size: {config['batch_size']}")
```

#### Célula 5: Treinar Modelo
```python
# Treinamento - leva 30-60 minutos com GPU
!python train.py --config config_files/cryptogram_digits_config.yaml

print("✅ Training complete!")
```

#### Célula 6: Download do Modelo Treinado
```python
from google.colab import files
import os

model_path = 'saved_models/cryptogram_digits/best_accuracy.pth'
if os.path.exists(model_path):
    files.download(model_path)
    print("✅ Model downloaded!")
    print("\nPróximos passos:")
    print("1. Salvar como cryptogram_digits.pth em ocr-service/models/")
    print("2. Copiar cryptogram_digits.py para ~/.EasyOCR/user_network/")
    print("3. Copiar cryptogram_digits.yaml para ~/.EasyOCR/user_network/")
    print("4. Rebuild Docker: docker compose up -d --build")
else:
    print("Model not found. Check training logs.")
```

---

## Após o Treinamento

### 1. Colocar Modelo no Projeto
```bash
# Salvar o modelo baixado
mv best_accuracy.pth ocr-service/models/cryptogram_digits.pth

# Copiar arquivos de configuração do modelo
cp ocr-service/training/cryptogram_digits.py ~/.EasyOCR/user_network/
cp ocr-service/training/cryptogram_digits.yaml ~/.EasyOCR/user_network/
```

### 2. Rebuild do Container
```bash
docker compose -f docker-compose.ocr.yml up -d --build
```

### 3. Testar
```bash
curl http://localhost:5000/health
```

---

## Configurações de Treino

| Parâmetro | Valor | Descrição |
|-----------|-------|-----------|
| `num_iter` | 5000 | Iterações de treino |
| `batch_size` | 32 | Tamanho do batch (ajuste para GPU) |
| `lr` | 0.0001 | Learning rate (baixo para fine-tuning) |
| `imgH` / `imgW` | 64 / 200 | Dimensões da imagem |
| Architecture | None-VGG-BiLSTM-CTC | Arquitetura do modelo |

---

## Resultados Esperados

| Métrica | Antes | Após (Esperado) |
|---------|-------|-----------------|
| Acurácia | ~85% | 95-99% |
| Células reais | 4,950 | 1,130 (validadas) |
| Células sintéticas | 0 | 16,200 |
| Dataset total | - | 27,180 |
