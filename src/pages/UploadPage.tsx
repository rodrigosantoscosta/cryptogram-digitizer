// src/pages/UploadPage.tsx
import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

export function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>('');
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const handleFileSelect = (selectedFile: File) => {
    if (!selectedFile.type.startsWith('image/')) {
      alert('Por favor, selecione uma imagem válida.');
      return;
    }

    setFile(selectedFile);

    // Criar preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreview(e.target?.result as string);
    };
    reader.readAsDataURL(selectedFile);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      handleFileSelect(selectedFile);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);

    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      handleFileSelect(droppedFile);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleProcess = async () => {
    if (!file) return;

    setIsLoading(true);

    try {
      // ✅ CORREÇÃO: Salvar apenas o preview (base64) ao invés de ImageData
      sessionStorage.setItem('uploadedImagePreview', preview);
      sessionStorage.setItem('uploadedImageName', file.name);

      // Navegar para página de processamento
      navigate('/processing');
    } catch (error) {
      console.error('Erro ao processar imagem:', error);

      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        alert(
          'Imagem muito grande para o armazenamento local.\n' +
          'Tente usar uma imagem menor ou com menor resolução.'
        );
      } else {
        alert('Erro ao processar a imagem. Tente novamente.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleClear = () => {
    setFile(null);
    setPreview('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>📸 Carregar Criptograma</h1>
      <p style={styles.subtitle}>
        Faça upload de uma foto do criptograma para começar o processamento
      </p>

      {!preview ? (
        <div
          style={{
            ...styles.dropZone,
            ...(isDragging ? styles.dropZoneActive : {}),
          }}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              fileInputRef.current?.click();
            }
          }}
          tabIndex={0}
          role="button"
          aria-label="Clique ou arraste uma imagem aqui para fazer upload"
        >
          <div style={styles.dropZoneContent}>
            <div style={styles.icon}>📁</div>
            <p style={styles.dropZoneText}>
              Arraste uma imagem aqui ou clique para selecionar
            </p>
            <p style={styles.dropZoneHint}>
              Formatos suportados: JPG, PNG, JPEG
            </p>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileInputChange}
            style={styles.hiddenInput}
          />
        </div>
      ) : (
        <div style={styles.previewContainer}>
          <div style={styles.previewHeader}>
            <h3 style={styles.previewTitle}>Preview da Imagem</h3>
            <button onClick={handleClear} style={styles.clearButton}>
              ✕ Remover
            </button>
          </div>

          <div style={styles.imageWrapper}>
            <img src={preview} alt="Preview" style={styles.previewImage} />
          </div>

          <div style={styles.fileInfo}>
            <p style={styles.fileName}>
              <strong>Arquivo:</strong> {file?.name}
            </p>
            <p style={styles.fileSize}>
              <strong>Tamanho:</strong> {formatFileSize(file?.size || 0)}
            </p>
          </div>

          <button
            onClick={handleProcess}
            disabled={isLoading}
            style={{
              ...styles.processButton,
              ...(isLoading ? styles.processButtonDisabled : {}),
            }}
          >
            {isLoading ? '⏳ Processando...' : '🚀 Processar Criptograma'}
          </button>
        </div>
      )}

      <div style={styles.tips}>
        <h3 style={styles.tipsTitle}>💡 Dicas para Melhor Resultado</h3>
        <ul style={styles.tipsList}>
          <li>Use boa iluminação ao fotografar</li>
          <li>Mantenha a câmera paralela ao criptograma</li>
          <li>Evite sombras e reflexos</li>
          <li>Capture toda a grade do criptograma</li>
          <li>Imagens com boa resolução funcionam melhor</li>
          <li><strong>⚠️ Prefira imagens com menos de 2MB</strong></li>
        </ul>
      </div>
    </div>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

const styles: Record<string, React.CSSProperties> = {
  container: { maxWidth: '800px', margin: '0 auto', padding: '40px 20px', fontFamily: 'system-ui, -apple-system, sans-serif' },
  title: { fontSize: '32px', fontWeight: 'bold', marginBottom: '8px', color: '#1a1a1a' },
  subtitle: { fontSize: '16px', color: '#666', marginBottom: '32px' },
  dropZone: { border: '3px dashed #ccc', borderRadius: '12px', padding: '60px 20px', textAlign: 'center', cursor: 'pointer', transition: 'all 0.3s ease', backgroundColor: '#fafafa', marginBottom: '32px' },
  dropZoneActive: { borderColor: '#667eea', backgroundColor: '#f0f4ff' },
  dropZoneContent: { pointerEvents: 'none' },
  icon: { fontSize: '64px', marginBottom: '16px' },
  dropZoneText: { fontSize: '18px', color: '#333', marginBottom: '8px', fontWeight: '500' },
  dropZoneHint: { fontSize: '14px', color: '#999' },
  hiddenInput: { display: 'none' },
  previewContainer: { backgroundColor: '#fff', border: '1px solid #e0e0e0', borderRadius: '12px', padding: '24px', marginBottom: '32px' },
  previewHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' },
  previewTitle: { fontSize: '18px', fontWeight: '600', color: '#1a1a1a', margin: 0 },
  clearButton: { background: 'none', border: 'none', color: '#dc3545', fontSize: '14px', cursor: 'pointer', padding: '8px 12px', borderRadius: '6px', transition: 'background 0.2s' },
  imageWrapper: { marginBottom: '16px', borderRadius: '8px', overflow: 'hidden', border: '1px solid #e0e0e0' },
  previewImage: { width: '100%', height: 'auto', display: 'block' },
  fileInfo: { backgroundColor: '#f8f9fa', padding: '12px 16px', borderRadius: '8px', marginBottom: '16px' },
  fileName: { fontSize: '14px', color: '#333', margin: '4px 0' },
  fileSize: { fontSize: '14px', color: '#666', margin: '4px 0' },
  processButton: { width: '100%', padding: '16px 24px', fontSize: '16px', fontWeight: '600', color: '#fff', backgroundColor: '#667eea', border: 'none', borderRadius: '8px', cursor: 'pointer', transition: 'all 0.3s' },
  processButtonDisabled: { backgroundColor: '#ccc', cursor: 'not-allowed' },
  tips: { backgroundColor: '#f8f9fa', padding: '24px', borderRadius: '12px', border: '1px solid #e0e0e0' },
  tipsTitle: { fontSize: '18px', fontWeight: '600', color: '#1a1a1a', marginBottom: '12px' },
  tipsList: { fontSize: '14px', color: '#666', lineHeight: '1.8', paddingLeft: '20px', margin: 0 },
};
