/**
 * Testes unitários para PuzzleCell.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PuzzleCell } from '@/components/PuzzleCell/PuzzleCell';
import type { GridCell } from '@/types';

function makeCell(overrides: Partial<GridCell> = {}): GridCell {
  return {
    row: 0,
    col: 0,
    isClue: false,
    symbolId: 'sym_0_0',
    userValue: '',
    ...overrides,
  };
}

function makeProps(overrides: Partial<React.ComponentProps<typeof PuzzleCell>> = {}): React.ComponentProps<typeof PuzzleCell> {
  return {
    cell: makeCell(),
    symbolImageData: null,
    isActive: false,
    isHighlighted: false,
    isCorrect: false,
    onFocus: vi.fn(),
    onChange: vi.fn(),
    onKeyDown: vi.fn(),
    ...overrides,
  };
}

// ─── Rendering paths ─────────────────────────────────────────────────────────

describe('PuzzleCell rendering paths', () => {
  it('deve renderizar como espaçador quando sem symbolId e não é pista', () => {
    const { container } = render(
      <PuzzleCell {...makeProps({ cell: makeCell({ symbolId: undefined }) })} />
    );
    const el = container.querySelector('.puzzle-cell--empty');
    expect(el).toBeInTheDocument();
  });

  it('deve renderizar como pista quando isClue=true', () => {
    const { container } = render(
      <PuzzleCell {...makeProps({ cell: makeCell({ isClue: true, symbolId: undefined, userValue: 'O GATO' }) })} />
    );
    const el = container.querySelector('.puzzle-cell--clue');
    expect(el).toBeInTheDocument();
    expect(screen.getByText('O GATO')).toBeInTheDocument();
  });

  it('deve renderizar como símbolo quando tem symbolId', () => {
    const { container } = render(
      <PuzzleCell {...makeProps()} />
    );
    const el = container.querySelector('.puzzle-cell--symbol');
    expect(el).toBeInTheDocument();
  });
});

// ─── Input sanitization ──────────────────────────────────────────────────────

describe('PuzzleCell input sanitization', () => {
  it('deve permitir letras maiúsculas A-Z', () => {
    const onChange = vi.fn();
    render(<PuzzleCell {...makeProps({ onChange })} />);
    const input = screen.getByRole('textbox');

    fireEvent.change(input, { target: { value: 'A' } });
    expect(onChange).toHaveBeenCalledWith(0, 0, 'A');
  });

  it('deve permitir letras acentuadas', () => {
    const onChange = vi.fn();
    render(<PuzzleCell {...makeProps({ onChange })} />);
    const input = screen.getByRole('textbox');

    fireEvent.change(input, { target: { value: 'Á' } });
    expect(onChange).toHaveBeenCalledWith(0, 0, 'Á');
  });

  it('deve rejeitar números', () => {
    const onChange = vi.fn();
    render(<PuzzleCell {...makeProps({ onChange })} />);
    const input = screen.getByRole('textbox');

    fireEvent.change(input, { target: { value: '5' } });
    expect(onChange).toHaveBeenCalledWith(0, 0, '');
  });

  it('deve rejeitar caracteres especiais', () => {
    const onChange = vi.fn();
    render(<PuzzleCell {...makeProps({ onChange })} />);
    const input = screen.getByRole('textbox');

    fireEvent.change(input, { target: { value: '@' } });
    expect(onChange).toHaveBeenCalledWith(0, 0, '');
  });

  it('deve converter para uppercase', () => {
    const onChange = vi.fn();
    render(<PuzzleCell {...makeProps({ onChange })} />);
    const input = screen.getByRole('textbox');

    fireEvent.change(input, { target: { value: 'a' } });
    expect(onChange).toHaveBeenCalledWith(0, 0, 'A');
  });

  it('deve pegar apenas o último caractere (slice(-1))', () => {
    const onChange = vi.fn();
    render(<PuzzleCell {...makeProps({ onChange })} />);
    const input = screen.getByRole('textbox');

    fireEvent.change(input, { target: { value: 'AB' } });
    expect(onChange).toHaveBeenCalledWith(0, 0, 'B');
  });
});

// ─── Focus & interaction ─────────────────────────────────────────────────────

describe('PuzzleCell focus & interaction', () => {
  it('deve chamar onFocus ao focar no input', () => {
    const onFocus = vi.fn();
    render(<PuzzleCell {...makeProps({ onFocus })} />);
    const input = screen.getByRole('textbox');

    fireEvent.focus(input);
    expect(onFocus).toHaveBeenCalledWith(0, 0);
  });

  it('deve chamar onKeyDown ao pressionar tecla', () => {
    const onKeyDown = vi.fn();
    render(<PuzzleCell {...makeProps({ onKeyDown })} />);
    const input = screen.getByRole('textbox');

    fireEvent.keyDown(input, { key: 'ArrowRight' });
    expect(onKeyDown).toHaveBeenCalledWith(expect.any(Object), 0, 0);
  });

  it('deve ter aria-label com posição 1-indexada', () => {
    render(<PuzzleCell {...makeProps({ cell: makeCell({ row: 2, col: 3 }) })} />);
    const input = screen.getByRole('textbox');
    expect(input).toHaveAttribute('aria-label', 'Célula linha 3, coluna 4');
  });
});

// ─── CSS classes ─────────────────────────────────────────────────────────────

describe('PuzzleCell CSS classes', () => {
  it('deve aplicar classe --active quando isActive=true', () => {
    const { container } = render(
      <PuzzleCell {...makeProps({ isActive: true })} />
    );
    expect(container.querySelector('.puzzle-cell--active')).toBeInTheDocument();
  });

  it('deve aplicar classe --highlighted quando isHighlighted=true', () => {
    const { container } = render(
      <PuzzleCell {...makeProps({ isHighlighted: true })} />
    );
    expect(container.querySelector('.puzzle-cell--highlighted')).toBeInTheDocument();
  });

  it('deve aplicar classe --correct quando isCorrect=true', () => {
    const { container } = render(
      <PuzzleCell {...makeProps({ isCorrect: true })} />
    );
    expect(container.querySelector('.puzzle-cell--correct')).toBeInTheDocument();
  });

  it('deve aplicar classe --empty-input quando sem userValue', () => {
    const { container } = render(
      <PuzzleCell {...makeProps()} />
    );
    expect(container.querySelector('.puzzle-cell--empty-input')).toBeInTheDocument();
  });

  it('deve aplicar classe --filled quando com userValue', () => {
    const { container } = render(
      <PuzzleCell {...makeProps({ cell: makeCell({ userValue: 'A' }) })} />
    );
    expect(container.querySelector('.puzzle-cell--filled')).toBeInTheDocument();
  });
});
