import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { StepMapping } from './StepMapping';
import { makeProcessedData, makeUniqueSymbol } from '@/testing/test-utils';

// Mockar SymbolMapperUI para não depender de canvas/ImageData
vi.mock('../components/Mapping/SymbolMapperUI', () => ({
  SymbolMapperUI: ({
    uniqueSymbols,
    currentMapping,
    onMappingChange,
  }: {
    uniqueSymbols: any[];
    currentMapping: Record<string, string>;
    onMappingChange: (id: string, letter: string) => void;
  }) => (
    <div>
      {uniqueSymbols.map((s: any) => (
        <div key={s.symbolId}>
          <input
            placeholder="?"
            value={currentMapping[s.symbolId] ?? ''}
            onChange={(e) => onMappingChange(s.symbolId, e.target.value.toUpperCase())}
          />
        </div>
      ))}
    </div>
  ),
}));

describe('StepMapping', () => {
  it('renderiza o título da página', () => {
    render(
      <StepMapping
        processedData={makeProcessedData()}
        onRestart={() => {}}
      />
    );
    expect(screen.getByText(/mapeamento de símbolos/i)).toBeInTheDocument();
  });

  it('mostra barra de progresso zerada quando não há mapeamento', () => {
    render(
      <StepMapping
        processedData={makeProcessedData([makeUniqueSymbol('symbol_1')])}
        onRestart={() => {}}
      />
    );
    expect(screen.getByText('0%')).toBeInTheDocument();
  });

  it('mostra estado vazio quando não há símbolos únicos', () => {
    render(
      <StepMapping
        processedData={makeProcessedData([])}
        onRestart={() => {}}
      />
    );
    expect(screen.getByText(/nenhum símbolo para mapear/i)).toBeInTheDocument();
  });

  it('chama onRestart ao clicar em Novo Upload', async () => {
    const user = userEvent.setup();
    const onRestart = vi.fn();
    render(
      <StepMapping
        processedData={makeProcessedData([])}
        onRestart={onRestart}
      />
    );
    await user.click(screen.getByRole('button', { name: /ir para upload/i }));
    expect(onRestart).toHaveBeenCalledOnce();
  });

  it('chama onSolve com o mapeamento atual ao clicar em Jogar', async () => {
    const user = userEvent.setup();
    const onSolve = vi.fn();

    render(
      <StepMapping
        processedData={makeProcessedData([makeUniqueSymbol('symbol_1')])}
        onRestart={() => {}}
        onSolve={onSolve}
      />
    );

    const input = screen.getByPlaceholderText('?');
    await user.type(input, 'A');

    await user.click(screen.getByRole('button', { name: /jogar criptograma/i }));

    expect(onSolve).toHaveBeenCalledWith(
      expect.objectContaining({ symbol_1: 'A' })
    );
  });

  it('botão exportar JSON está presente quando há símbolos', () => {
    render(
      <StepMapping
        processedData={makeProcessedData([makeUniqueSymbol('symbol_1')])}
        onRestart={() => {}}
      />
    );
    expect(
      screen.getByRole('button', { name: /exportar json/i })
    ).toBeInTheDocument();
  });
});
