import { useState } from 'react';
import { Hash, AlertTriangle, CheckCircle, Gamepad2, Download, RotateCcw, SearchX } from 'lucide-react';
import { useSymbolMapping } from '../hooks/useSymbolMapping';
import { SymbolMapperUI } from '../components/Mapping/SymbolMapperUI';
import { CellNumberOverlay } from '../components/CellNumberOverlay';
import type { ProcessedData } from '@/types/puzzle';
import type { SymbolMapping } from '../types/symbol';

interface Props {
  processedData: ProcessedData;
  onRestart: () => void;
  onSolve?: (mapping: SymbolMapping) => void;
  puzzleId?: string;
  originalImage?: ImageData;
}

export function StepMapping({ processedData, onRestart, onSolve, puzzleId = 'puzzle', originalImage }: Props) {
  const [showDiagnostics, setShowDiagnostics] = useState(false);

  const {
    mapping, suggestions, filteredSymbols,
    updateMapping, applyAutoMapping, progress, validation,
  } = useSymbolMapping(processedData.uniqueSymbols);

  const { cellNumbers, grid } = processedData;
  const hasNumbers = cellNumbers !== null && cellNumbers.total > 0;
  const coverage = hasNumbers
    ? Math.round((cellNumbers.recognized / cellNumbers.total) * 100)
    : 0;

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
    <div className="max-w-5xl mx-auto">
      <h1 className="text-3xl font-bold mb-6 text-ink">Mapeamento de Símbolos</h1>

      {/* Barra de progresso */}
      <div className="bg-surface-card border border-border-light rounded-card p-5 mb-4">
        <div className="flex justify-between items-center mb-3 text-sm text-ink-muted">
          <span>Progresso do mapeamento</span>
          <strong className="text-xl text-primary">{progress.toFixed(0)}%</strong>
        </div>
        <div className="w-full h-2 bg-border rounded-full overflow-hidden">
          <div className="h-full bg-primary transition-all duration-300 ease-in-out" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {/* Banner de detecção numérica */}
      {hasNumbers && (
        <div className={`
          flex items-center justify-between gap-4 rounded-input p-3.5 mb-4 flex-wrap
          ${coverage >= 70 ? 'bg-emerald-50 border border-emerald-300' : 'bg-amber-50 border border-amber-200'}
        `}>
          <div className="flex items-start gap-3 flex-1">
            <span className="text-xl leading-none mt-0.5">
              {coverage >= 70 ? <Hash size={22} /> : <AlertTriangle size={22} />}
            </span>
            <div>
              <strong>
                {coverage >= 70
                  ? `Números detectados — modo numérico ativo (${coverage}% de cobertura)`
                  : `Detecção parcial de números (${coverage}% de cobertura) — usando pHash visual`}
              </strong>
              <p className="text-xs text-ink-muted mt-1 mb-0">
                {cellNumbers.recognized} de {cellNumbers.total} células reconhecidas
                · {Object.keys(cellNumbers.bySymbol).length} símbolos únicos
              </p>
            </div>
          </div>
          <button
            className="px-3.5 py-1.5 bg-surface-card border border-border rounded-md text-sm cursor-pointer whitespace-nowrap font-medium hover:bg-surface-subtle transition-colors"
            onClick={() => setShowDiagnostics(!showDiagnostics)}
          >
            {showDiagnostics ? 'Ocultar diagnóstico' : 'Ver diagnóstico'}
          </button>
        </div>
      )}

      {/* Painel de diagnóstico */}
      {showDiagnostics && hasNumbers && (
        <div className="bg-slate-50 border border-slate-200 rounded-card p-5 mb-5">
          <CellNumberOverlay
            cellNumbers={cellNumbers}
            grid={grid}
            backgroundImage={originalImage}
            imagePosition="side"
            puzzleId={puzzleId}
          />
        </div>
      )}

      {processedData.uniqueSymbols.length > 0 ? (
        <>
          {validation.isValid && (
            <div className="bg-success-bg border border-success-border rounded-input p-4 mb-6 text-success-text text-base font-medium flex items-center">
              <CheckCircle size={18} className="mr-1.5 flex-shrink-0" />Mapeamento completo e válido!
            </div>
          )}
          {validation.errors.length > 0 && (
            <div className="bg-error-bg border border-error-border rounded-input p-4 mb-6 text-error-text">
              <strong>Problemas encontrados</strong>
              <ul className="mt-2 pl-5">
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

          <div className="flex gap-3 mt-6 flex-wrap">
            {onSolve && (
              <button
                className="px-6 py-3 bg-emerald-500 text-white border-none rounded-input text-sm font-semibold cursor-pointer hover:bg-emerald-600 transition-colors flex items-center"
                onClick={() => onSolve(mapping)}
              >
                <Gamepad2 size={16} className="mr-1.5" />Jogar Criptograma
              </button>
            )}
            <button
              className="px-6 py-3 bg-primary text-white border-none rounded-input text-sm font-semibold cursor-pointer hover:bg-primary-hover transition-colors flex items-center"
              onClick={handleExport}
            >
              <Download size={16} className="mr-1.5" />Exportar JSON
            </button>
            <button
              className="px-6 py-3 bg-surface-card text-primary border-2 border-primary rounded-input text-sm font-semibold cursor-pointer hover:bg-primary-active transition-colors flex items-center"
              onClick={onRestart}
            >
              <RotateCcw size={16} className="mr-1.5" />Novo Upload
            </button>
          </div>
        </>
      ) : (
        <div className="text-center py-20 px-5">
          <SearchX size={64} className="mx-auto mb-4 text-ink-faint" />
          <h2 className="text-2xl font-semibold text-ink mb-2">Nenhum símbolo para mapear</h2>
          <p className="text-base text-ink-muted mb-6">Faça upload e processamento de um criptograma primeiro</p>
          <button
            className="px-6 py-3 bg-primary text-white border-none rounded-input text-sm font-semibold cursor-pointer hover:bg-primary-hover transition-colors"
            onClick={onRestart}
          >
            Ir para Upload
          </button>
        </div>
      )}
    </div>
  );
}
