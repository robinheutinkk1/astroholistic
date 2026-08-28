import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

/**
 * Separate config: the tenant-isolation suite needs a running database, so it
 * must not fail the unit run when Docker or Postgres is not up.
 */
export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/security/**/*.test.ts'],
    // RLS assertions share one connection and mutate role state; running them
    // in parallel would make failures non-deterministic.
    fileParallelism: false,
    sequence: { concurrent: false },
  },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
});
