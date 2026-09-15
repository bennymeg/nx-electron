import nxEslintPlugin from '@nx/eslint-plugin';

export default [
  {
    ignores: ['**/dist'],
  },
  { plugins: { '@nx': nxEslintPlugin } },
  {
    languageOptions: {
      parserOptions: {
        ecmaVersion: 6,
      },
    },
  },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    rules: {
      '@nx/enforce-module-boundaries': [
        'error',
        {
          enforceBuildableLibDependency: true,
          allow: [],
          depConstraints: [
            {
              sourceTag: '*',
              onlyDependOnLibsWithTags: ['*'],
            },
          ],
        },
      ],
    },
  },
  ...nxEslintPlugin.configs['flat/typescript'],
  ...nxEslintPlugin.configs['flat/javascript'],
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    rules: {
      // Newly enabled by the Nx 23 ESLint presets; neither rule was explicitly configured before the upgrade.
      'no-async-promise-executor': 'off',
      'no-empty': 'off',
    },
  },
  {
    files: ['**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        '@nx/workspace',
        '@angular-devkit/core',
        '@angular-devkit/architect',
        '@angular-devkit/schematics',
      ],
    },
    ignores: ['./src/migrations/**'],
  },
  {
    ignores: ['node_modules\r'],
  },
];
