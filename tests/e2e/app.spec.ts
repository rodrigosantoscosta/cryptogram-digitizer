import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Não espera recursos pesados (OpenCV.js WASM) — só o DOM inicial
const GOTO_OPTS = { waitUntil: 'domcontentloaded' as const, timeout: 15_000 };

test.describe('CryptogramSolver — carregamento e fluxo básico', () => {
  test('página principal carrega e exibe botão de upload', async ({ page }) => {
    await page.goto('/', GOTO_OPTS);

    // Aguarda o React montar (body não pode estar vazio)
    await expect(page.locator('body')).not.toBeEmpty();

    // Verifica que o texto de upload está visível
    await expect(
      page.getByText(/Carregar Criptograma/i)
    ).toBeVisible({ timeout: 15_000 });
  });

  test('input de arquivo está presente e aceitável', async ({ page }) => {
    await page.goto('/', GOTO_OPTS);

    // O input de arquivo deve existir no DOM (pode estar visualmente oculto)
    const fileInput = page.locator('input[type="file"]');
    await expect(fileInput).toHaveCount(1, { timeout: 10_000 });
  });

  test('upload de imagem inicia o processamento sem erro imediato', async ({ page }) => {
    await page.goto('/', GOTO_OPTS);

    const fileInput = page.locator('input[type="file"]');
    await expect(fileInput).toHaveCount(1, { timeout: 10_000 });

    // Usa a imagem de sample do projeto
    const sampleImage = path.resolve(__dirname, '../../public/samples/test.jpg');
    await fileInput.setInputFiles(sampleImage);

    // Após o upload, a página não deve exibir erro imediato
    await page.waitForTimeout(1000);
    await expect(page.locator('body')).not.toContainText('Erro fatal');
  });

  test('rota /ground-truth carrega sem erro', async ({ page }) => {
    await page.goto('/ground-truth', GOTO_OPTS);
    await expect(page.locator('body')).not.toBeEmpty();
    await expect(
      page.getByText(/Ground Truth Validator/i)
    ).toBeVisible({ timeout: 10_000 });
  });
});
