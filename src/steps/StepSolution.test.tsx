import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { StepSolution } from './StepSolution';
import { makeProcessedData, makeUniqueSymbol } from '@/testing/test-utils';

// Mockar componentes pesados que dependem de canvas/OpenCV
vi.mock('../components/PuzzleGrid', () => ({
  PuzzleGrid: () => <div data-testid="puzzle-grid">Grid</div>,
}));

vi.mock('../components/CluePanel', () => ({
  CluePanel: ({ clues }: { clues: any[] }) => (
    <div data-testid="clue-panel">{clues.length} pistas</div>
  ),
}));

const mapping = { symbol_1: 'A', symbol_2: 'B' };
const processedData = makeProcessedData([
  makeUniqueSymbol('symbol_1', 0, 1),
  makeUniqueSymbol('symbol_2', 1, 1),
]);

describe('StepSolution', () => {
  it('renderiza sem erros', () => {
    render(
      <StepSolution
        processedData={processedData}
        mapping={mapping}
        onBack={() => {}}
        onRestart={() => {}}
      />
    );
    expect(screen.getByTestId('puzzle-grid')).toBeInTheDocument();
  });

  it('mostra CluePanel com as pistas do processedData', () => {
    render(
      <StepSolution
        processedData={processedData}
        mapping={mapping}
        onBack={() => {}}
        onRestart={() => {}}
      />
    );
    expect(screen.getByTestId('clue-panel')).toHaveTextContent('2 pistas');
  });

  it('mostra os chips do mapeamento ativo', () => {
    render(
      <StepSolution
        processedData={processedData}
        mapping={mapping}
        onBack={() => {}}
        onRestart={() => {}}
      />
    );
    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.getByText('B')).toBeInTheDocument();
  });

  it('chama onBack ao clicar em Mapeamento', async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();
    render(
      <StepSolution
        processedData={processedData}
        mapping={mapping}
        onBack={onBack}
        onRestart={() => {}}
      />
    );
    await user.click(screen.getByRole('button', { name: /mapeamento/i }));
    expect(onBack).toHaveBeenCalledOnce();
  });

  it('exibe progresso inicial 0%', () => {
    render(
      <StepSolution
        processedData={processedData}
        mapping={mapping}
        onBack={() => {}}
        onRestart={() => {}}
      />
    );
    expect(screen.getByText('0%')).toBeInTheDocument();
  });

  it('exibe "Mapeamento ativo" no footer', () => {
    render(
      <StepSolution
        processedData={processedData}
        mapping={mapping}
        onBack={() => {}}
        onRestart={() => {}}
      />
    );
    expect(screen.getByText(/mapeamento ativo/i)).toBeInTheDocument();
  });
});
