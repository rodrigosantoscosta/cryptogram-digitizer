import { useState, useRef } from 'react';

interface Props {
  onImageReady: (imageData: ImageData) => void;
}

export function StepUpload({ onImageReady }: Props) {
  const [preview, setPreview] = useState<string>('');
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

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
      onImageReady(ctx.getImageData(0, 0, canvas.width, canvas.height));
    } catch {
      alert('Erro ao carregar a imagem. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={s.wrap}>
      <h1 style={s.title}>Carregar Criptograma</h1>
      <p style={s.sub}>Faça upload de uma foto do criptograma para começar</p>

      {!preview ? (
        <div
          style={{ ...s.drop, ...(isDragging ? s.dropActive : {}) }}
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
          <div style={{ fontSize: 64, marginBottom: 12 }}>🖼️</div>
          <p style={{ fontSize: 17, color: '#333', margin: '0 0 6px' }}>Arraste ou clique para selecionar</p>
          <p style={{ fontSize: 13, color: '#999', margin: 0 }}>JPG, PNG, JPEG</p>
          <input ref={inputRef} type="file" accept="image/*" style={{ display: 'none' }}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
        </div>
      ) : (
        <div style={s.preview}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <strong style={{ fontSize: 16 }}>Pré-visualização</strong>
            <button style={s.removeBtn} onClick={() => { setPreview(''); setFile(null); }}>Remover</button>
          </div>
          <img src={preview} alt="preview" style={s.img} />
          <div style={s.meta}>
            <span>{file?.name}</span>
            <span style={{ color: '#999' }}>{formatSize(file?.size ?? 0)}</span>
          </div>
          <button
            style={{ ...s.procBtn, ...(isLoading ? s.procBtnDisabled : {}) }}
            onClick={handleProcess}
            disabled={isLoading}
          >
            {isLoading ? 'Carregando...' : 'Processar Criptograma'}
          </button>
        </div>
      )}

      <div style={s.tips}>
        <strong style={{ display: 'block', marginBottom: 8 }}>Dicas para melhor resultado</strong>
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: '#666', lineHeight: 1.8 }}>
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

const s: Record<string, React.CSSProperties> = {
  wrap:         { maxWidth: 720, margin: '0 auto' },
  title:        { fontSize: 28, fontWeight: 700, marginBottom: 6, color: '#1a1a1a' },
  sub:          { fontSize: 15, color: '#666', marginBottom: 28 },
  drop:         { border: '2px dashed #ccc', borderRadius: 12, padding: '56px 24px', textAlign: 'center',
                  cursor: 'pointer', background: '#fafafa', transition: 'all .2s', marginBottom: 24 },
  dropActive:   { borderColor: '#667eea', background: '#f0f4ff' },
  preview:      { background: '#fff', border: '1px solid #e5e5e5', borderRadius: 12, padding: 20, marginBottom: 24 },
  img:          { width: '100%', height: 'auto', borderRadius: 8, display: 'block', marginBottom: 12, border: '1px solid #e5e5e5' },
  meta:         { display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#333',
                  background: '#f8f9fa', padding: '8px 12px', borderRadius: 6, marginBottom: 14 },
  removeBtn:    { background: 'none', border: 'none', color: '#dc3545', cursor: 'pointer', fontSize: 13 },
  procBtn:      { width: '100%', padding: 14, fontSize: 15, fontWeight: 600, color: '#fff',
                  background: '#667eea', border: 'none', borderRadius: 8, cursor: 'pointer' },
  procBtnDisabled: { background: '#ccc', cursor: 'not-allowed' },
  tips:         { background: '#f8f9fa', border: '1px solid #e5e5e5', borderRadius: 10, padding: '18px 20px' },
};