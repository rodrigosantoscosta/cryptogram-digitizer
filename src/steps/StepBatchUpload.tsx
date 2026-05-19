import { useState, useRef, useCallback } from 'react';
import type { BatchImage } from '../types/batch';

interface Props {
  onImagesReady: (images: { id: string; imageData: ImageData; name: string }[]) => void;
}

export function StepBatchUpload({ onImagesReady }: Props) {
  const [images, setImages] = useState<BatchImage[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

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
    <div style={s.wrap}>
      <h1 style={s.title}>Carregar Criptogramas</h1>
      <p style={s.sub}>Faça upload de uma ou mais fotos de criptogramas para processar em lote</p>

      <div
        style={{ ...s.drop, ...(isDragging ? s.dropActive : {}) }}
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
        <div style={{ fontSize: 64, marginBottom: 12 }}>📁</div>
        <p style={{ fontSize: 17, color: '#333', margin: '0 0 6px' }}>
          Arraste ou clique para selecionar múltiplas imagens
        </p>
        <p style={{ fontSize: 13, color: '#999', margin: 0 }}>JPG, PNG, JPEG — Múltiplos arquivos suportados</p>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          style={{ display: 'none' }}
          onChange={(e) => {
            if (e.target.files) addFiles(e.target.files);
          }}
        />
      </div>

      {images.length > 0 && (
        <div style={s.list}>
          <div style={s.listHeader}>
            <strong style={{ fontSize: 16 }}>{images.length} imagem(ns) selecionada(s)</strong>
            <button style={s.clearBtn} onClick={() => setImages([])}>Limpar tudo</button>
          </div>

          <div style={s.grid}>
            {images.map((img) => (
              <div key={img.id} style={s.card}>
                <button style={s.removeBtn} onClick={() => removeImage(img.id)} aria-label="Remover imagem">×</button>
                <img src={img.preview} alt={img.name} style={s.thumb} />
                <p style={s.name} title={img.name}>{img.name}</p>
              </div>
            ))}
          </div>

          <button
            style={{ ...s.procBtn, ...(isLoading || validImages.length === 0 ? s.procBtnDisabled : {}) }}
            onClick={handleProcess}
            disabled={isLoading || validImages.length === 0}
          >
            {isLoading ? 'Processando...' : `Processar ${validImages.length} criptograma(s)`}
          </button>
        </div>
      )}

      <div style={s.tips}>
        <strong style={{ display: 'block', marginBottom: 8 }}>Dicas para processamento em lote</strong>
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: '#666', lineHeight: 1.8 }}>
          <li>Selecione todas as imagens de uma vez</li>
          <li>Imagens serão processadas sequencialmente</li>
          <li>Você poderá escolher qual criptograma resolver após o processamento</li>
        </ul>
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  wrap: { maxWidth: 900, margin: '0 auto' },
  title: { fontSize: 28, fontWeight: 700, marginBottom: 6, color: '#1a1a1a' },
  sub: { fontSize: 15, color: '#666', marginBottom: 28 },
  drop: {
    border: '2px dashed #ccc', borderRadius: 12, padding: '56px 24px', textAlign: 'center',
    cursor: 'pointer', background: '#fafafa', transition: 'all .2s', marginBottom: 24,
  },
  dropActive: { borderColor: '#667eea', background: '#f0f4ff' },
  list: { background: '#fff', border: '1px solid #e5e5e5', borderRadius: 12, padding: 20, marginBottom: 24 },
  listHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  clearBtn: { background: 'none', border: 'none', color: '#dc3545', cursor: 'pointer', fontSize: 13 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 12, marginBottom: 20 },
  card: { position: 'relative', borderRadius: 8, overflow: 'hidden', border: '1px solid #e5e5e5' },
  thumb: { width: '100%', height: 100, objectFit: 'cover', display: 'block' },
  name: { fontSize: 11, padding: '6px 8px', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', background: '#f8f9fa' },
  removeBtn: {
    position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: '50%',
    background: 'rgba(0,0,0,0.6)', color: '#fff', border: 'none', cursor: 'pointer',
    fontSize: 16, lineHeight: '20px', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  procBtn: {
    width: '100%', padding: 14, fontSize: 15, fontWeight: 600, color: '#fff',
    background: '#667eea', border: 'none', borderRadius: 8, cursor: 'pointer',
  },
  procBtnDisabled: { background: '#ccc', cursor: 'not-allowed' },
  tips: { background: '#f8f9fa', border: '1px solid #e5e5e5', borderRadius: 10, padding: '18px 20px' },
};
