import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import App from './App';

// Mockar StepUpload para isolar o App do pipeline de imagem
vi.mock('./steps/StepUpload', () => ({
  StepUpload: ({ onImageReady }: { onImageReady: (d: ImageData) => void }) => (
    <div>
      <h1>Carregar Criptograma</h1>
      <p>Dicas para melhor resultado</p>
      <button onClick={() => onImageReady(new ImageData(10, 10))}>mock-upload</button>
    </div>
  ),
}));

vi.mock('./steps/StepProcessing', () => ({
  StepProcessing: () => <div>Processando...</div>,
}));

vi.mock('./steps/StepMapping', () => ({
  StepMapping: () => <div>Mapeamento</div>,
}));

vi.mock('./steps/StepSolution', () => ({
  StepSolution: () => <div>Solução</div>,
}));

vi.mock('./components/CryptogramSolver', async (importOriginal) => {
  return importOriginal();
});

describe('App', () => {
  it('renderiza sem erros', () => {
    render(<App />);
    expect(document.body).toBeTruthy();
  });

  it('mostra a tela inicial de upload', () => {
    render(<App />);
    expect(screen.getByText('Carregar Criptograma')).toBeInTheDocument();
  });

  it('mostra dicas de upload na tela inicial', () => {
    render(<App />);
    expect(screen.getByText('Dicas para melhor resultado')).toBeInTheDocument();
  });
});
