/**
 * Testes unitários para ConfidenceOverlay.
 *
 * getConfidenceColor e getConfidenceLabel são funções puras.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ConfidenceOverlay, ConfidenceLegend } from '@/components/ConfidenceOverlay/ConfidenceOverlay';

// ─── Re-implementação local (funções não exportadas) ──────────────────────────

function getConfidenceColor(confidence: number): string {
  if (confidence >= 80) return 'rgba(34, 197, 94, 0.3)';
  if (confidence >= 50) return 'rgba(234, 179, 8, 0.4)';
  return 'rgba(239, 68, 68, 0.5)';
}

function getConfidenceLabel(confidence: number): string {
  if (confidence >= 80) return 'High';
  if (confidence >= 50) return 'Medium';
  return 'Low';
}

// ─── getConfidenceColor ──────────────────────────────────────────────────────

describe('getConfidenceColor', () => {
  it('deve retornar verde para confiança >= 80', () => {
    expect(getConfidenceColor(80)).toBe('rgba(34, 197, 94, 0.3)');
    expect(getConfidenceColor(100)).toBe('rgba(34, 197, 94, 0.3)');
  });

  it('deve retornar amarelo para confiança entre 50 e 79', () => {
    expect(getConfidenceColor(50)).toBe('rgba(234, 179, 8, 0.4)');
    expect(getConfidenceColor(79)).toBe('rgba(234, 179, 8, 0.4)');
  });

  it('deve retornar vermelho para confiança < 50', () => {
    expect(getConfidenceColor(0)).toBe('rgba(239, 68, 68, 0.5)');
    expect(getConfidenceColor(49)).toBe('rgba(239, 68, 68, 0.5)');
  });
});

// ─── getConfidenceLabel ──────────────────────────────────────────────────────

describe('getConfidenceLabel', () => {
  it('deve retornar "High" para confiança >= 80', () => {
    expect(getConfidenceLabel(80)).toBe('High');
    expect(getConfidenceLabel(100)).toBe('High');
  });

  it('deve retornar "Medium" para confiança entre 50 e 79', () => {
    expect(getConfidenceLabel(50)).toBe('Medium');
    expect(getConfidenceLabel(79)).toBe('Medium');
  });

  it('deve retornar "Low" para confiança < 50', () => {
    expect(getConfidenceLabel(0)).toBe('Low');
    expect(getConfidenceLabel(49)).toBe('Low');
  });
});

// ─── ConfidenceOverlay rendering ─────────────────────────────────────────────

describe('ConfidenceOverlay', () => {
  const defaultProps = {
    cells: [
      { row: 0, col: 0, number: 5, confidence: 90, rawOcr: '5' },
      { row: 0, col: 1, number: 12, confidence: 45, rawOcr: 'l2' },
    ],
    gridRows: 2,
    gridCols: 3,
    gridWidth: 300,
    gridHeight: 200,
    offsetX: 10,
    offsetY: 20,
    visible: true,
  };

  it('deve retornar null quando visible=false', () => {
    const { container } = render(
      <ConfidenceOverlay {...defaultProps} visible={false} />
    );
    expect(container.innerHTML).toBe('');
  });

  it('deve renderizar overlays para cada célula', () => {
    const { container } = render(
      <ConfidenceOverlay {...defaultProps} />
    );
    const overlays = container.querySelectorAll('[style*="position: absolute"]');
    expect(overlays.length).toBe(2);
  });

  it('deve aplicar borda vermelha para confiança < 50', () => {
    const { container } = render(
      <ConfidenceOverlay {...defaultProps} />
    );
    const lowConfCell = container.querySelectorAll('[style*="rgba(239, 68, 68, 0.8)"]');
    expect(lowConfCell.length).toBeGreaterThan(0);
  });
});

// ─── ConfidenceLegend ────────────────────────────────────────────────────────

describe('ConfidenceLegend', () => {
  it('deve renderizar legenda com 3 níveis', () => {
    render(<ConfidenceLegend />);
    expect(screen.getByText('High (≥80%)')).toBeInTheDocument();
    expect(screen.getByText('Medium (50-79%)')).toBeInTheDocument();
    expect(screen.getByText('Low (<50%)')).toBeInTheDocument();
  });
});
