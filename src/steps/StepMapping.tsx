import { useState } from 'react';
import { useSymbolMapping } from '../hooks/useSymbolMapping';
import { SymbolMapperUI } from '../components/Mapping/SymbolMapperUI';
import type { ProcessedData } from '../types/index';
import type { SymbolMapping } from '../types/symbol';

interface Props {
  processedData: ProcessedData;
  onRestart: () => void;
  onSolve?: (mapping: SymbolMapping) => void;
}

export function StepMapping({ processedData, onRestart, onSolve }: Props) {
  const [
    , // unused local mapping — we read from hook
  ] = useState<SymbolMapping>({});

  const {
    mapping, suggestions, filteredSymbols,
    updateMapping, applyAutoMapping, progress, validation,
  } = useSymbolMapping(processedData.uniqueSymbols);

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(mapping, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'mapeamento.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={s.container}>
      <h1 style={s.title}>Mapeamento de Símbolos</h1>

      <div style={s.progressCard}>
        <div style={s.progressHeader}>
          <span>Progresso do mapeamento</span>
          <strong style={s.progressValue}>{progress.toFixed(0)}%</strong>
        </div>
        <div style={s.progressBar}>
          <div style={{ ...s.progressFill, width: `${progress}%` }} />
        </div>
      </div>

      {processedData.uniqueSymbols.length > 0 ? (
        <>
          {validation.isValid && (
            <div style={s.successBanner}>✅ Mapeamento completo e válido!</div>
          )}
          {validation.errors.length > 0 && (
            <div style={s.errorBanner}>
              <strong>Problemas encontrados</strong>
              <ul style={s.errorList}>
                {validation.errors.map((error: string) => <li key={error}>{error}</li>)}
              </ul>
            </div>
          )}

          <SymbolMapperUI
            uniqueSymbols={filteredSymbols}
            currentMapping={mapping}
            suggestions={suggestions}
            onMappingChange={updateMapping}
            onApplyAutoMapping={() => applyAutoMapping(0.7)}
          />

          <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
            {onSolve && (
              <button
                style={s.solveBtn}
                onClick={() => onSolve(mapping)}
              >
                🎮 Jogar Criptograma
              </button>
            )}
            <button style={s.exportBtn} onClick={handleExport}>
              💾 Exportar JSON
            </button>
            <button style={s.restartBtn} onClick={onRestart}>
              🔄 Novo Upload
            </button>
          </div>
        </>
      ) : (
        <div style={s.emptyState}>
          <div style={{ fontSize: 64, marginBottom: 16 }}>🔍</div>
          <h2 style={s.emptyTitle}>Nenhum símbolo para mapear</h2>
          <p style={s.emptyText}>Faça upload e processamento de um criptograma primeiro</p>
          <button style={s.exportBtn} onClick={onRestart}>Ir para Upload</button>
        </div>
      )}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  container:    { maxWidth: 1200, margin: '0 auto' },
  title:        { fontSize: 32, fontWeight: 'bold', marginBottom: 24, color: '#1a1a1a' },
  progressCard: { backgroundColor: '#fff', border: '1px solid #e0e0e0', borderRadius: 12, padding: 20, marginBottom: 24 },
  progressHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, fontSize: 14, color: '#666' },
  progressValue:  { fontSize: 20, color: '#667eea' },
  progressBar:  { width: '100%', height: 8, backgroundColor: '#e0e0e0', borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#667eea', transition: 'width 0.3s ease' },
  successBanner: { backgroundColor: '#d4edda', border: '1px solid #c3e6cb', borderRadius: 8, padding: 16, marginBottom: 24, color: '#155724', fontSize: 16, fontWeight: 500 },
  errorBanner:  { backgroundColor: '#f8d7da', border: '1px solid #f5c6cb', borderRadius: 8, padding: 16, marginBottom: 24, color: '#721c24' },
  errorList:    { margin: '8px 0 0 0', paddingLeft: 20 },
  emptyState:   { textAlign: 'center', padding: '80px 20px' },
  emptyTitle:   { fontSize: 24, fontWeight: 600, color: '#1a1a1a', marginBottom: 8 },
  emptyText:    { fontSize: 16, color: '#666', marginBottom: 24 },
  solveBtn:     { padding: '12px 24px', backgroundColor: '#10b981', color: '#fff', border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 600, cursor: 'pointer' },
  exportBtn:    { padding: '12px 24px', backgroundColor: '#667eea', color: '#fff', border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 600, cursor: 'pointer' },
  restartBtn:   { padding: '12px 24px', backgroundColor: '#fff', color: '#667eea', border: '2px solid #667eea', borderRadius: 8, fontSize: 15, fontWeight: 600, cursor: 'pointer' },
};
