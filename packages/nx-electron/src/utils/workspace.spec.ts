import { ExecutorContext } from '@nx/devkit';
import { join } from 'path';
import * as fs from 'fs';
import { getSourceRoot } from './workspace';

jest.mock('fs', () => {
  const actualFs = jest.requireActual('fs');
  return {
    ...actualFs,
    existsSync: jest.fn(actualFs.existsSync),
  };
});

/** An executor context for the project `electron-app` with the given configuration. */
function makeContext(project: { root?: string; sourceRoot?: string }) {
  return {
    root: '/workspace',
    projectName: 'electron-app',
    projectGraph: {
      nodes: {
        'electron-app': {
          name: 'electron-app',
          type: 'app',
          data: { targets: {}, ...project },
        },
      },
      dependencies: {},
    },
  } as unknown as ExecutorContext;
}

describe('getSourceRoot', () => {
  const existsMock = fs.existsSync as jest.Mock;

  beforeEach(() => {
    existsMock.mockReset();
  });

  it('should return the configured sourceRoot', () => {
    expect(
      getSourceRoot(
        makeContext({
          root: 'apps/electron-app',
          sourceRoot: 'apps/electron-app/app',
        }),
      ),
    ).toEqual({
      sourceRoot: 'apps/electron-app/app',
      projectRoot: 'apps/electron-app',
    });
  });

  // Projects configured in package.json (the TS solution setup) usually have no
  // sourceRoot; Nx then uses <root>/src if it exists, otherwise <root>.
  it('should fall back to <root>/src when no sourceRoot is configured', () => {
    existsMock.mockImplementation(
      (path: string) => path === join('/workspace', 'apps/electron-app', 'src'),
    );

    expect(getSourceRoot(makeContext({ root: 'apps/electron-app' }))).toEqual({
      sourceRoot: 'apps/electron-app/src',
      projectRoot: 'apps/electron-app',
    });
  });

  it('should fall back to <root> when no sourceRoot is configured and there is no src folder', () => {
    existsMock.mockReturnValue(false);

    expect(getSourceRoot(makeContext({ root: 'apps/electron-app' }))).toEqual({
      sourceRoot: 'apps/electron-app',
      projectRoot: 'apps/electron-app',
    });
  });

  it('should throw when the project has no root', () => {
    expect(() => getSourceRoot(makeContext({}))).toThrow();
  });
});
