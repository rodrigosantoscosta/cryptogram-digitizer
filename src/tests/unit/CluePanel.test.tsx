/**
 * Testes unitários para CluePanel.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CluePanel } from '@/components/CluePanel/CluePanel';
import type { ClueResult } from '@/types';

function makeClue(row: number, text: string, confidence: number): ClueResult {
  return { row, text, confidence, rawText: text };
}

describe('CluePanel', () => {
  const clues: ClueResult[] = [
    makeClue(0, 'O gato preto', 0.95),
    makeClue(1, 'Cachorro bravo', 0.40),
    makeClue(2, '', 0.0),
  ];

  it('deve renderizar número correto de linhas', () => {
    render(<CluePanel clues={clues} activeRow={null} cellSize={40} rowCount={3} />);
    const items = screen.getAllByRole('generic', { hidden: true });
    const clueItems = items.filter(el => el.className?.includes('clue-panel__item'));
    expect(clueItems.length).toBe(3);
  });

  it('deve mostrar números de linha 1-indexados', () => {
    render(<CluePanel clues={clues} activeRow={null} cellSize={40} rowCount={3} />);
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('deve mostrar texto da pista quando disponível', () => {
    render(<CluePanel clues={clues} activeRow={null} cellSize={40} rowCount={3} />);
    expect(screen.getByText('O gato preto')).toBeInTheDocument();
    expect(screen.getByText('Cachorro bravo')).toBeInTheDocument();
  });

  it('deve mostrar placeholder para pista ausente', () => {
    render(<CluePanel clues={[]} activeRow={null} cellSize={40} rowCount={2} />);
    expect(screen.getAllByText('—').length).toBe(2);
  });

  it('deve aplicar classe --active na linha ativa', () => {
    const { container } = render(<CluePanel clues={clues} activeRow={1} cellSize={40} rowCount={3} />);
    const activeItem = container.querySelector('.clue-panel__item--active');
    expect(activeItem).toBeInTheDocument();
  });

  it('deve definir aria-current na linha ativa', () => {
    const { container } = render(<CluePanel clues={clues} activeRow={0} cellSize={40} rowCount={3} />);
    const activeItem = container.querySelector('[aria-current="true"]');
    expect(activeItem).toBeInTheDocument();
  });

  it('deve mostrar warning de confiança para confiança < 0.6', () => {
    const { container } = render(<CluePanel clues={clues} activeRow={null} cellSize={40} rowCount={3} />);
    const warning = container.querySelector('.clue-panel__confidence-warn');
    expect(warning).toBeInTheDocument();
    expect(warning?.getAttribute('aria-label')).toBe('Leitura incerta');
  });

  it('deve NÃO mostrar warning para confiança >= 0.6', () => {
    const highConfClues: ClueResult[] = [
      makeClue(0, 'Test', 0.80),
    ];
    const { container } = render(<CluePanel clues={highConfClues} activeRow={null} cellSize={40} rowCount={1} />);
    const warning = container.querySelector('.clue-panel__confidence-warn');
    expect(warning).toBeNull();
  });

  it('deve aplicar classe --empty para pistas ausentes', () => {
    const { container } = render(<CluePanel clues={[]} activeRow={null} cellSize={40} rowCount={1} />);
    const emptyItem = container.querySelector('.clue-panel__item--empty');
    expect(emptyItem).toBeInTheDocument();
  });

  it('deve usar cellSize para minHeight', () => {
    const { container } = render(<CluePanel clues={clues} activeRow={null} cellSize={50} rowCount={3} />);
    const firstItem = container.querySelector('.clue-panel__item');
    expect(firstItem).toHaveStyle({ minHeight: '50px' });
  });
});
