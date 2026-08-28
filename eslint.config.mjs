import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import nextPlugin from '@next/eslint-plugin-next';
import prettierConfig from 'eslint-config-prettier';

/**
 * Lint rules that encode the architecture rules from docs/ARCHITECTURE.md.
 *
 * The point of the boundary rules below is that "business logic must not leak
 * into React components" (masterprompt §44) is enforced by CI rather than by
 * remembering it during review.
 */
/**
 * The service-role client bypasses RLS completely. Only its own module may
 * import it (docs/SECURITY.md §7, threat T11).
 */
const ADMIN_CLIENT_RESTRICTION = {
  group: ['**/lib/supabase/admin', '@/lib/supabase/admin'],
  message:
    'The service-role client bypasses RLS. Import it only inside a server-only service that filters by organization_id explicitly.',
};

/** Components must not reach past the service layer into the data layer. */
const REPOSITORY_RESTRICTION = {
  group: ['**/repository', '**/repository.ts', '../repository'],
  message:
    'Components must not call the repository directly. Go through the feature service so permission checks and audit logging are not bypassed.',
};

export default tseslint.config(
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'coverage/**',
      'next-env.d.ts',
      'supabase/.temp/**',
      'supabase/.branches/**',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,

  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },

  {
    plugins: { '@next/next': nextPlugin },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs['core-web-vitals'].rules,
    },
  },

  {
    rules: {
      // §67.9 — no `any`. Escaping this needs an inline disable with a reason,
      // which makes it visible in review instead of invisible in a diff.
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unsafe-assignment': 'error',
      '@typescript-eslint/no-unsafe-member-access': 'error',
      '@typescript-eslint/no-unsafe-call': 'error',
      '@typescript-eslint/no-unsafe-return': 'error',
      '@typescript-eslint/no-unsafe-argument': 'error',

      // Unhandled promises in server actions silently swallow failures (§45).
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/require-await': 'error',

      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],

      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-restricted-syntax': [
        'error',
        {
          // §67.3/§67.4 — no hardcoded organisation identifiers anywhere.
          selector:
            'Literal[value=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/]',
          message:
            'Hardcoded UUID detected. Organisation and tenant identifiers must come from data, never from source (see docs/ARCHITECTURE.md §1).',
        },
      ],
    },
  },

  // Import boundaries.
  //
  // NOTE: `no-restricted-imports` is a single rule, so a later config block that
  // sets it REPLACES an earlier one rather than adding to it. Both restrictions
  // are therefore composed into one rule per file set — an earlier version of
  // this config silently lost the service-role ban that way.
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/lib/supabase/admin.ts'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [ADMIN_CLIENT_RESTRICTION] }],
    },
  },

  // React components must go through the service layer, never straight to the
  // data layer (docs/ARCHITECTURE.md §4).
  {
    files: ['src/features/*/components/**/*.{ts,tsx}', 'src/components/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: [ADMIN_CLIENT_RESTRICTION, REPOSITORY_RESTRICTION] },
      ],
    },
  },

  // Config files in .mjs/.mts live outside the TypeScript project, so the
  // type-aware rules cannot run on them.
  {
    files: ['**/*.mjs', '**/*.mts', '**/*.js'],
    extends: [tseslint.configs.disableTypeChecked],
  },

  // Test and config files are held to a looser standard on purpose.
  {
    files: ['**/*.test.{ts,tsx}', '**/__tests__/**', 'tests/**', '*.config.{ts,mts,mjs}'],
    rules: {
      // Security fixtures address seeded rows by id on purpose; that is data
      // under test, not a hardcoded tenant in production code.
      'no-restricted-syntax': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      'no-console': 'off',
    },
  },

  prettierConfig,
);
