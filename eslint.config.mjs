import nx from '@nx/eslint-plugin';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['**/dist', '**/node_modules', '**/.nx', '**/coverage', '**/*.config.*'],
  },
  ...nx.configs['flat/base'],
  ...nx.configs['flat/typescript'],
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    rules: {
      '@nx/enforce-module-boundaries': [
        'error',
        {
          enforceBuildableLibDependency: true,
          allow: [],
          depConstraints: [
            // core depends on nothing internal
            { sourceTag: 'scope:core', onlyDependOnLibsWithTags: ['scope:core'] },
            // cli may depend on core
            {
              sourceTag: 'scope:cli',
              onlyDependOnLibsWithTags: ['scope:cli', 'scope:core', 'scope:fixtures'],
            },
            // ui may depend on core (types only)
            { sourceTag: 'scope:ui', onlyDependOnLibsWithTags: ['scope:ui', 'scope:core'] },
            // fixtures depends on nothing internal (or core types)
            {
              sourceTag: 'scope:fixtures',
              onlyDependOnLibsWithTags: ['scope:fixtures', 'scope:core'],
            },
            { sourceTag: 'scope:e2e', onlyDependOnLibsWithTags: ['*'] },
          ],
        },
      ],
    },
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    // Tests may reach for fixtures across boundaries; production code may not.
    files: ['**/*.test.ts', '**/*.spec.ts', '**/*.test.tsx', '**/*.spec.tsx'],
    rules: {
      '@nx/enforce-module-boundaries': 'off',
    },
  },
);
