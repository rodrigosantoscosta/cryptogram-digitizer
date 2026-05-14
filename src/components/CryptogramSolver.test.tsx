import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { CryptogramSolver } from './CryptogramSolver';
import { makeProcessedData, makeUniqueSymbol } from '@/testing/test-utils';

const fakeProcessedData = makeProcessedData([makeUniqueSymbol('symbol_1')]);

vi.mock('../steps/StepUpload', () => ({
  StepUpload: ({ onImageReady }: { onImageReady: (d: ImageData) => void }) => (
    <button onClick={() => onImageReady(new ImageData(10, 10))}>Upload</button>
  ),
}));

vi.mock('../steps/StepProcessing', () => ({
  StepProcessing: ({ onDone }: { onDone: (d: any) => void }) => (
    <button onClick={() => onDone(fakeProcessedData)}>Processar</button>
  ),
}));

vi.mock('../steps/StepMapping', () => ({
  StepMapping: ({ onSolve }: { onSolve?: (m: any) => void }) => (
    <button onClick={() => onSolve?.({ symbol_1: 'A' })}>Mapear</button>
  ),
}));

vi.mock('../steps/StepSolution', () => ({
  StepSolution: () => <div>Solução Final</div>,
}));

describe('CryptogramSolver — fluxo completo', () => {
  it('começa no step de Upload', () => {
    render(<CryptogramSolver />);
    expect(screen.getByRole('button', { name: /upload/i })).toBeInTheDocument();
  });

  it('avança para Processamento após upload', async () => {
    const user = userEvent.setup();
    render(<CryptogramSolver />);

    await user.click(screen.getByRole('button', { name: /upload/i }));

    expect(screen.getByRole('button', { name: /processar/i })).toBeInTheDocument();
  });

  it('avança para Mapeamento após processamento', async () => {
    const user = userEvent.setup();
    render(<CryptogramSolver />);

    await user.click(screen.getByRole('button', { name: /upload/i }));
    await user.click(screen.getByRole('button', { name: /processar/i }));

    expect(screen.getByRole('button', { name: /mapear/i })).toBeInTheDocument();
  });

  it('avança para Solução após mapeamento', async () => {
    const user = userEvent.setup();
    render(<CryptogramSolver />);

    await user.click(screen.getByRole('button', { name: /upload/i }));
    await user.click(screen.getByRole('button', { name: /processar/i }));
    await user.click(screen.getByRole('button', { name: /mapear/i }));

    expect(screen.getByText('Solução Final')).toBeInTheDocument();
  });
});
