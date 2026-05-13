// src/pages/MappingPage.tsx
import { useState, useEffect} from 'react';

import { useSymbolMapping } from '@/hooks';
import { SymbolMapperUI } from '@/components';
import type { UniqueSymbol } from '@/types';



export function MappingPage() {
  const [uniqueSymbols, setUniqueSymbols] = useState<UniqueSymbol[]>([]);

  useEffect(() => {
    // Recuperar símbolos do processamento
    const stored = sessionStorage.getItem('processedSymbols');

    if (stored) {
      try {
        const symbols: UniqueSymbol[] = JSON.parse(stored);
        setUniqueSymbols(symbols);
        console.log('Símbolos carregados:', symbols.length);
      } catch (error) {
        console.error('Erro ao carregar símbolos:', error);
      }
    }
  }, []);

  const {
    mapping,
    suggestions,
    filteredSymbols,
    updateMapping,
    applyAutoMapping,
    progress,
    validation,
  } = useSymbolMapping(uniqueSymbols);

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>📋 Mapeamento de Símbolos</h1>

      <div style={styles.progressCard}>
        <div style={styles.progressHeader}>
          <span>Progresso do mapeamento</span>
          <strong style={styles.progressValue}>{progress.toFixed(0)}%</strong>
        </div>
        <div style={styles.progressBar}>
          <div 
            style={{
              ...styles.progressFill,
              width: `${progress}%`,
            }}
          />
        </div>
      </div>

      {uniqueSymbols.length > 0 ? (
        <>
          {validation.isValid && (
            <div style={styles.successBanner}>
              ✅ Mapeamento completo e válido!
            </div>
          )}

          {validation.errors.length > 0 && (
          <div style={styles.errorBanner}>
            <strong>⚠️ Problemas encontrados:</strong>
            <ul style={styles.errorList}>
              {validation.errors.map((error: string) => (
                <li key={error}>{error}</li>
              ))}
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
        </>
      ) : (
        <div style={styles.emptyState}>
          <div style={styles.emptyIcon}>📭</div>
          <h2 style={styles.emptyTitle}>Nenhum símbolo para mapear</h2>
          <p style={styles.emptyText}>
            Faça upload e processamento de um criptograma primeiro
          </p>
          <a href="/" style={styles.emptyButton}>
            📸 Ir para Upload
          </a>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '40px 20px',
  },
  title: {
    fontSize: '32px',
    fontWeight: 'bold',
    marginBottom: '24px',
    color: '#1a1a1a',
  },
  progressCard: {
    backgroundColor: '#fff',
    border: '1px solid #e0e0e0',
    borderRadius: '12px',
    padding: '20px',
    marginBottom: '24px',
  },
  progressHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px',
    fontSize: '14px',
    color: '#666',
  },
  progressValue: {
    fontSize: '20px',
    color: '#667eea',
  },
  progressBar: {
    width: '100%',
    height: '8px',
    backgroundColor: '#e0e0e0',
    borderRadius: '4px',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#667eea',
    transition: 'width 0.3s ease',
  },
  successBanner: {
    backgroundColor: '#d4edda',
    border: '1px solid #c3e6cb',
    borderRadius: '8px',
    padding: '16px',
    marginBottom: '24px',
    color: '#155724',
    fontSize: '16px',
    fontWeight: '500',
  },
  errorBanner: {
    backgroundColor: '#f8d7da',
    border: '1px solid #f5c6cb',
    borderRadius: '8px',
    padding: '16px',
    marginBottom: '24px',
    color: '#721c24',
  },
  errorList: {
    margin: '8px 0 0 0',
    paddingLeft: '20px',
  },
  emptyState: {
    textAlign: 'center',
    padding: '80px 20px',
  },
  emptyIcon: {
    fontSize: '64px',
    marginBottom: '16px',
  },
  emptyTitle: {
    fontSize: '24px',
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: '8px',
  },
  emptyText: {
    fontSize: '16px',
    color: '#666',
    marginBottom: '24px',
  },
  emptyButton: {
    display: 'inline-block',
    padding: '12px 24px',
    backgroundColor: '#667eea',
    color: '#fff',
    textDecoration: 'none',
    borderRadius: '8px',
    fontSize: '16px',
    fontWeight: '600',
    transition: 'all 0.3s',
  },
};
