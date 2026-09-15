/* eslint-disable */

// Generator tests assert tree contents, not formatter integration. Nx 23 otherwise
// tries to load the ESM-only oxfmt package through Jest's CommonJS runtime.
process.env.NX_SKIP_FORMAT = 'true';

export default {
  displayName: 'nx-electron',
  preset: '../../jest.preset.js',
  globals: {},
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]sx?$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.spec.json',
      },
    ],
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  coverageDirectory: '../../coverage/packages/nx-electron',
};
