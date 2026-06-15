import { useState, useRef, useEffect } from 'react';
import { Image as ImageIcon } from 'lucide-react';
import { loadOpenCV } from '@/lib/opencv/loadOpenCV';

interface Props {
  onImageReady: (imageData: ImageData, fileName?: string) => void;
}

export function StepUpload({ onImageReady }: Props) {
  const [preview, setPreview] = useState<string>('');
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadOpenCV();
  }, []);

  const handleFile = (f: File) => {
    if (!f.type.startsWith('image/')) { alert('Selecione uma imagem válida.'); return; }
    setFile(f);
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(f);
  };

  const handleProcess = async () => {
    if (!preview) return;
    setIsLoading(true);
    try {
      const img = new Image();
      img.src = preview;
      await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = () => rej(); });
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      onImageReady(ctx.getImageData(0, 0, canvas.width, canvas.height), file?.name);
    } catch {
      alert('Erro ao carregar a imagem. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-1.5 text-ink">Carregar Criptograma</h1>
      <p className="text-sm text-ink-muted mb-7">Faça upload de uma foto do criptograma para começar</p>

      {!preview ? (
        <div
          className={`
            border-2 border-dashed rounded-card p-14 text-center cursor-pointer transition-all duration-200 mb-6
            ${isDragging ? 'border-primary bg-primary-active' : 'border-border bg-surface-page'}
          `}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => { e.preventDefault(); setIsDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              inputRef.current?.click();
            }
          }}
          tabIndex={0}
          role="button"
          aria-label="Clique ou arraste uma imagem aqui para fazer upload"
        >
          <ImageIcon size={64} className="mx-auto mb-3 text-ink-faint" />
          <p className="text-base text-ink font-medium mb-1.5">Arraste ou clique para selecionar</p>
          <p className="text-xs text-ink-faint m-0">JPG, PNG, JPEG</p>
          <input ref={inputRef} type="file" accept="image/*" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
        </div>
      ) : (
        <div className="bg-surface-card border border-border rounded-card p-5 mb-6">
          <div className="flex justify-between items-center mb-3">
            <strong className="text-base">Pré-visualização</strong>
            <button className="bg-none border-none text-error cursor-pointer text-sm hover:bg-error/10 px-2 py-1 rounded-input transition-colors" onClick={() => { setPreview(''); setFile(null); }}>Remover</button>
          </div>
          <img src={preview} alt="preview" className="w-full h-auto rounded-input block mb-3 border border-border" />
          <div className="flex justify-between text-xs text-ink bg-surface-subtle px-3 py-2 rounded-input mb-3.5">
            <span>{file?.name}</span>
            <span className="text-ink-faint">{formatSize(file?.size ?? 0)}</span>
          </div>
          <button
            className={`
              w-full py-3.5 text-sm font-semibold text-white rounded-input cursor-pointer transition-all duration-200
              ${isLoading ? 'bg-ink-faint cursor-not-allowed' : 'bg-primary hover:bg-primary-hover'}
            `}
            onClick={handleProcess}
            disabled={isLoading}
          >
            {isLoading ? 'Carregando...' : 'Processar Criptograma'}
          </button>
        </div>
      )}

      <div className="bg-surface-subtle border border-border rounded-input p-4.5 px-5">
        <strong className="block mb-2 text-sm">Dicas para melhor resultado</strong>
        <ul className="m-0 pl-4.5 text-xs text-ink-muted leading-relaxed">
          <li>Use boa iluminação e evite sombras</li>
          <li>Câmera paralela ao criptograma</li>
          <li>Capture a grade completa</li>
          <li>Prefira imagens com menos de 2 MB</li>
        </ul>
      </div>
    </div>
  );
}

function formatSize(b: number) {
  if (!b) return '';
  const k = 1024, sizes = ['B', 'KB', 'MB'];
  const i = Math.floor(Math.log(b) / Math.log(k));
  return `${Math.round(b / Math.pow(k, i) * 100) / 100} ${sizes[i]}`;
}
