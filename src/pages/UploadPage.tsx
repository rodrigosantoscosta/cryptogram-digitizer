// src/pages/UploadPage.tsx
import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, FolderOpen, X, Rocket, Loader2, Lightbulb, AlertTriangle } from 'lucide-react';
import { useImageStore } from '@/store/useImageStore';

export function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>('');
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const setImageData = useImageStore((s) => s.setImageData);

  const handleFileSelect = (selectedFile: File) => {
    if (!selectedFile.type.startsWith('image/')) {
      alert('Por favor, selecione uma imagem válida.');
      return;
    }

    setFile(selectedFile);

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
    if (!file || !preview) return;

    setIsLoading(true);

    try {
      const img = new Image();
      img.src = preview;
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Erro ao carregar imagem'));
      });

      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Não foi possível criar contexto 2D');
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

      setImageData(imageData);
      navigate('/processing');
    } catch (error) {
      console.error('Erro ao processar imagem:', error);
      alert('Erro ao processar a imagem. Tente novamente.');
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
    <div className="max-w-3xl mx-auto py-10 px-5 font-sans">
      <h1 className="text-3xl font-bold mb-2 text-ink flex items-center">
        <Camera size={28} className="mr-2" />Carregar Criptograma
      </h1>
      <p className="text-base text-ink-muted mb-8">
        Faça upload de uma foto do criptograma para começar o processamento
      </p>

      {!preview ? (
        <div
          className={`
            border-2 border-dashed rounded-card p-14 text-center cursor-pointer transition-all duration-200
            ${isDragging ? 'border-primary bg-primary-active' : 'border-border bg-surface-page'}
          `}
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
          <FolderOpen size={64} className="mx-auto mb-4 text-ink-faint" />
          <p className="text-lg text-ink font-medium mb-2">
            Arraste uma imagem aqui ou clique para selecionar
          </p>
          <p className="text-sm text-ink-faint">
            Formatos suportados: JPG, PNG, JPEG
          </p>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileInputChange}
            className="hidden"
          />
        </div>
      ) : (
        <div className="bg-surface-card border border-border-light rounded-card p-6 mb-8">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-ink">Preview da Imagem</h3>
            <button
              onClick={handleClear}
              className="bg-none border-none text-error text-sm cursor-pointer px-3 py-2 rounded-input hover:bg-error/10 transition-colors"
            >
              <X size={14} className="inline mr-1" />Remover
            </button>
          </div>

          <div className="mb-4 rounded-input overflow-hidden border border-border">
            <img src={preview} alt="Preview" className="w-full h-auto block" />
          </div>

          <div className="bg-surface-subtle p-3 rounded-input mb-4">
            <p className="text-sm text-ink mb-1">
              <strong>Arquivo:</strong> {file?.name}
            </p>
            <p className="text-sm text-ink-muted">
              <strong>Tamanho:</strong> {formatFileSize(file?.size || 0)}
            </p>
          </div>

          <button
            onClick={handleProcess}
            disabled={isLoading}
            className={`
              w-full py-4 text-base font-semibold text-white rounded-input transition-all duration-200
              flex items-center justify-center
              ${isLoading
                ? 'bg-ink-faint cursor-not-allowed'
                : 'bg-primary hover:bg-primary-hover active:bg-primary-hover'}
            `}
          >
            {isLoading
              ? <><Loader2 size={18} className="mr-2 animate-spin" />Processando...</>
              : <><Rocket size={18} className="mr-2" />Processar Criptograma</>
            }
          </button>
        </div>
      )}

      <div className="bg-surface-subtle p-6 rounded-card border border-border-light">
        <h3 className="text-lg font-semibold text-ink mb-3 flex items-center">
          <Lightbulb size={18} className="mr-2" />Dicas para Melhor Resultado
        </h3>
        <ul className="text-sm text-ink-muted leading-relaxed pl-5 m-0 space-y-0.5">
          <li>Use boa iluminação ao fotografar</li>
          <li>Mantenha a câmera paralela ao criptograma</li>
          <li>Evite sombras e reflexos</li>
          <li>Capture toda a grade do criptograma</li>
          <li>Imagens com boa resolução funcionam melhor</li>
          <li>
            <strong className="flex items-center gap-1">
              <AlertTriangle size={14} />Prefira imagens com menos de 2MB
            </strong>
          </li>
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
