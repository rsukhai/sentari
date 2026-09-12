import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // tsconfig має jsx: "preserve" (цього вимагає Next), тому JSX для тестів
  // трансформуємо явно — інакше Vite не розпарсить .tsx.
  oxc: {
    jsx: {
      runtime: 'automatic',
      importSource: 'react',
    },
  },
  resolve: {
    // Той самий аліас, що й у tsconfig.json ("@/*": ["./*"]) — без нього
    // Vitest (на відміну від Next і tsc) не вміє резолвити імпорти `@/...`.
    alias: {
      '@': fileURLToPath(new URL('.', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    // Лише unit-тести. Playwright-специфікації (*.spec.ts) сюди не потрапляють.
    include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
    exclude: ['node_modules/**', '.next/**', 'tests/**/*.spec.ts'],
    reporters: ['default'],
  },
});
