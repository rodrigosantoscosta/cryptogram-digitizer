import { useRef, useCallback, type ReactNode, type DragEvent, type HTMLAttributes } from 'react';
import { Upload } from 'lucide-react';

interface DropZoneProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onDrop'> {
  children?: ReactNode;
  onFileSelect: (file: File) => void;
  accept?: string;
  multiple?: boolean;
  iconSize?: number;
  isActive?: boolean;
}

export function DropZone({
  children,
  onFileSelect,
  accept = 'image/*',
  multiple = false,
  iconSize = 64,
  isActive = false,
  className = '',
  ...props
}: DropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) onFileSelect(file);
  }, [onFileSelect]);

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  }, []);

  const handleClick = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onFileSelect(file);
  }, [onFileSelect]);

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Clique ou arraste uma imagem aqui para fazer upload"
      className={[
        'border-2 border-dashed rounded-card p-14 text-center cursor-pointer',
        'transition-all duration-200',
        'bg-surface-page hover:border-primary hover:bg-primary-active',
        isActive ? 'border-primary bg-primary-active' : 'border-border',
        className,
      ].filter(Boolean).join(' ')}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={() => {}}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          inputRef.current?.click();
        }
      }}
      {...props}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        onChange={handleInputChange}
      />
      {children || (
        <div>
          <Upload size={iconSize} className="mx-auto mb-3 text-ink-faint" />
          <p className="text-lg text-ink font-medium mb-1.5">Arraste ou clique para selecionar</p>
          <p className="text-sm text-ink-faint">JPG, PNG, JPEG</p>
        </div>
      )}
    </div>
  );
}
