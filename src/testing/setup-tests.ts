import * as matchers from '@testing-library/jest-dom/matchers';
import { expect, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Estender expect com matchers do jest-dom (toBeInTheDocument, toHaveValue, etc.)
expect.extend(matchers);

// Limpar o DOM após cada teste para evitar vazamento de estado
afterEach(() => {
  cleanup();
});
