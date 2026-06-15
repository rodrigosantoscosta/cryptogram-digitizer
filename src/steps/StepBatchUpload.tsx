import { useState, useRef, useCallback, useEffect } from 'react';
import { FolderOpen, X } from 'lucide-react';
import type { BatchImage } from '../types/batch';
import { loadOpenCV } from '@/lib/opencv/loadOpenCV';

interface Props {
  onImagesReady: (images: { id: string; imageData: ImageData; name: string }[]) => void;
}

export function StepBatchUpload({ onImagesReady }: Props) {
  const [images, setImages] = useState<BatchImage[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadOpenCV();
  }, []);

  const generateId = () => Math.random().toString(36).substring(2, 9);

  const addFiles = useCallback((files: FileList | File[]) => {
    const newImages: BatchImage[] = [];
    Array.from(files).forEach((file) => {
      if (!file.type.startsWith('image/')) return;
      const id = generateId();
      const reader = new FileReader();
      reader.onload = (e) => {
        newImages.push({
          id,
          file,
          name: file.name,
          preview: e.target?.result as string,
          status: 'pending',
          progress: 0,
          processedData: null,
          error: null,
        });
        setImages((prev) => [...prev, ...newImages]);
      };
      reader.readAsDataURL(file);
    });
  }, []);

  const removeImage = (id: string) => {
    setImages((prev) => prev.filter((img) => img.id !== id));
  };

  const handleProcess = async () => {
    if (images.length === 0) return;
    setIsLoading(true);

    const results: { id: string; imageData: ImageData; name: string }[] = [];

    for (const img of images) {
      try {
        const image = new Image();
        image.src = img.preview;
        await new Promise<void>((res, rej) => {
          image.onload = () => res();
          image.onerror = () => rej(new Error('Failed to load image'));
        });

        const canvas = document.createElement('canvas');
        canvas.width = image.width;
        canvas.height = image.height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(image, 0, 0);

        results.push({
          id: img.id,
          imageData: ctx.getImageData(0, 0, canvas.width, canvas.height),
          name: img.name,
        });
      } catch {
        // Skip failed images
      }
    }

    if (results.length > 0) {
      onImagesReady(results);
    }
    setIsLoading(false);
  };

  const validImages = images.filter((img) => img.status === 'pending');

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-1.5 text-ink">Carregar Criptogramas</h1>
      <p className="text-sm text-ink-muted mb-7">Faça upload de uma ou mais fotos de criptogramas para processar em lote</p>

      <div
        className={`
          border-2 border-dashed rounded-card p-14 text-center cursor-pointer transition-all duration-200 mb-6
          ${isDragging ? 'border-primary bg-primary-active' : 'border-border bg-surface-page'}
        `}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          if (e.dataTransfer.files.length > 0) addFiles(e.dataTransfer.files);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        tabIndex={0}
        role="button"
        aria-label="Clique ou arraste imagens aqui para fazer upload"
      >
        <FolderOpen size={64} className="mx-auto mb-3 text-ink-faint" />
        <p className="text-base text-ink font-medium mb-1.5">
          Arraste ou clique para selecionar múltiplas imagens
        </p>
        <p className="text-xs text-ink-faint m-0">JPG, PNG, JPEG — Múltiplos arquivos suportados</p>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) addFiles(e.target.files);
          }}
        />
      </div>

      {images.length > 0 && (
        <div className="bg-surface-card border border-border rounded-card p-5 mb-6">
          <div className="flex justify-between items-center mb-4">
            <strong className="text-base">{images.length} imagem(ns) selecionada(s)</strong>
            <button className="bg-none border-none text-error cursor-pointer text-sm hover:bg-error/10 px-2 py-1 rounded-input transition-colors" onClick={() => setImages([])}>Limpar tudo</button>
          </div>

          <div className="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-3 mb-5">
            {images.map((img) => (
              <div key={img.id} className="relative rounded-input overflow-hidden border border-border">
                <button
                  className="absolute top-1 right-1 w-5.5 h-5.5 rounded-full bg-black/60 text-white border-none cursor-pointer text-sm flex items-center justify-center hover:bg-black/80 transition-colors"
                  onClick={() => removeImage(img.id)}
                  aria-label="Remover imagem"
                >
                  <X size={12} />
                </button>
                <img src={img.preview} alt={img.name} className="w-full h-25 object-cover block" />
                <p className="text-xs px-2 py-1.5 m-0 whitespace-nowrap overflow-hidden text-ellipsis bg-surface-subtle" title={img.name}>{img.name}</p>
              </div>
            ))}
          </div>

          <button
            className={`
              w-full py-3.5 text-sm font-semibold text-white rounded-input cursor-pointer transition-all duration-200
              ${isLoading || validImages.length === 0 ? 'bg-ink-faint cursor-not-allowed' : 'bg-primary hover:bg-primary-hover'}
            `}
            onClick={handleProcess}
            disabled={isLoading || validImages.length === 0}
          >
            {isLoading ? 'Processando...' : `Processar ${validImages.length} criptograma(s)`}
          </button>
        </div>
      )}

      <div className="bg-surface-subtle border border-border rounded-input p-4.5 px-5">
        <strong className="block mb-2 text-sm">Dicas para processamento em lote</strong>
        <ul className="m-0 pl-4.5 text-xs text-ink-muted leading-relaxed">
          <li>Selecione todas as imagens de uma vez</li>
          <li>Imagens serão processadas sequencialmente</li>
          <li>Você poderá escolher qual criptograma resolver após o processamento</li>
        </ul>
      </div>
    </div>
  );
}
