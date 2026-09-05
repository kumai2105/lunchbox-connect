import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // .tsx too: the homepage claim test renders the component and asserts on
    // what a visitor actually receives, which needs JSX. A .ts-only glob
    // silently collected nothing and exited 0 files rather than failing.
    include: ['src/**/*.test.{ts,tsx}'],
    globals: false,
  },
});
