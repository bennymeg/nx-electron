import { ExecutorContext, logger } from '@nx/devkit';
import { resolve } from 'path';
import * as fs from 'fs';
import {
  PackageElectronBuilderOptions,
  _createBaseConfig,
  _createConfigFromOptions,
  findMissingFileSources,
  validateFileSources,
} from './executor';

jest.mock('glob');

jest.mock('fs-extra');

jest.mock('fs', () => {
  const actualFs = jest.requireActual('fs');
  return {
    ...actualFs,
    existsSync: jest.fn(actualFs.existsSync),
  };
});

function makeOptions(
  overrides: Partial<PackageElectronBuilderOptions> = {}
): PackageElectronBuilderOptions {
  return {
    root: '.',
    platform: 'windows',
    extraProjects: [],
    arch: 'x64',
    name: 'electron-app',
    frontendProject: 'frontend',
    prepackageOnly: false,
    sourcePath: 'dist/apps',
    outputPath: 'dist/packages',
    ...overrides,
  };
}

describe('MakeElectronBuilder', () => {
  let context: ExecutorContext;
  let options: PackageElectronBuilderOptions;

  beforeEach(async () => {
    options = makeOptions();
  });

  describe('run', () => {
    it('should find a way to test application packaging', async () => {
      expect(true).toEqual(true);
    });
  });
});

describe('copy step source validation', () => {
  const existsMock = fs.existsSync as jest.Mock;
  const context = { root: '.' } as ExecutorContext;

  /** Pretends that exactly the given absolute paths exist on disk. */
  const existing = (...paths: string[]) => {
    const set = new Set(paths.map((path) => resolve(path)));
    existsMock.mockImplementation((path: string) => set.has(resolve(path)));
  };

  const frontendDir = resolve('dist/apps', 'frontend');
  const appDir = resolve('dist/apps', 'electron-app');

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(logger, 'warn').mockImplementation(() => undefined);
    existing(frontendDir, appDir);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('findMissingFileSources', () => {
    it('reports FileSet sources that do not exist', () => {
      const missing = resolve('dist/apps', 'does-not-exist');

      expect(
        findMissingFileSources(
          [{ from: frontendDir, to: 'frontend' }, { from: missing, to: 'x' }],
          makeOptions()
        )
      ).toEqual([missing]);
    });

    it('ignores plain string patterns, globs and macros', () => {
      existsMock.mockReturnValue(false);

      expect(
        findMissingFileSources(
          [
            './package.json',
            '!(**/*.+(js|css).map)',
            { from: resolve('dist/apps/**/assets'), to: 'assets' },
            { from: resolve('dist/apps/?(a|b)'), to: 'ab' },
            { from: 'build/${os}/${arch}', to: 'bin' },
            { to: 'no-from-means-app-dir' },
          ],
          makeOptions()
        )
      ).toEqual([]);
      expect(existsMock).not.toHaveBeenCalled();
    });

    it('resolves extraResources / extraFiles against the workspace root', () => {
      expect(
        findMissingFileSources(
          [],
          makeOptions({
            root: '/workspace',
            extraResources: [
              { from: 'assets/db', to: 'db' },
              'assets/**/*.json',
            ],
            extraFiles: { from: 'bin/tool.exe', to: 'tool.exe' },
          })
        )
      ).toEqual([
        resolve('/workspace', 'assets/db'),
        resolve('/workspace', 'bin/tool.exe'),
      ]);
    });

    it('lists every missing source only once', () => {
      existsMock.mockReturnValue(false);
      const missing = resolve('dist/apps', 'shared');

      expect(
        findMissingFileSources(
          [
            { from: missing, to: 'a' },
            { from: missing, to: 'b' },
          ],
          makeOptions()
        )
      ).toEqual([missing]);
    });
  });

  describe('validateFileSources', () => {
    it('throws a descriptive error by default', () => {
      const missing = resolve('dist/apps', 'does-not-exist');

      expect(() =>
        validateFileSources([{ from: missing, to: 'x' }], makeOptions())
      ).toThrow(
        expect.objectContaining({
          message: expect.stringContaining(missing),
        })
      );
      expect(() =>
        validateFileSources([{ from: missing, to: 'x' }], makeOptions())
      ).toThrow(/failOnMissingFiles/);
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it('only warns when failOnMissingFiles is false', () => {
      const missing = resolve('dist/apps', 'does-not-exist');

      expect(() =>
        validateFileSources(
          [{ from: missing, to: 'x' }],
          makeOptions({ failOnMissingFiles: false })
        )
      ).not.toThrow();
      expect(logger.warn).toHaveBeenCalledTimes(1);
      expect((logger.warn as jest.Mock).mock.calls[0][0]).toContain(missing);
    });

    it('does nothing when every source exists', () => {
      expect(() =>
        validateFileSources([{ from: frontendDir, to: 'frontend' }], makeOptions())
      ).not.toThrow();
      expect(logger.warn).not.toHaveBeenCalled();
    });
  });

  describe('_createBaseConfig', () => {
    it('fails when the frontend project has not been built', () => {
      existing(appDir);

      expect(() => _createBaseConfig(makeOptions(), context)).toThrow(
        new RegExp(escapeRegExp(frontendDir))
      );
    });

    it('fails when an extra project is missing', () => {
      expect(() =>
        _createBaseConfig(
          makeOptions({ extraProjects: ['shared-lib'] }),
          context
        )
      ).toThrow(new RegExp(escapeRegExp(resolve('dist/apps', 'shared-lib'))));
    });

    it('fails for a user supplied FileSet whose (sourcePath relative) source is missing', () => {
      expect(() =>
        _createBaseConfig(
          makeOptions({
            files: [{ from: 'worker/scripts', to: 'scripts' }],
          }),
          context
        )
      ).toThrow(
        new RegExp(escapeRegExp(resolve('dist/apps', 'worker/scripts')))
      );
    });

    it('succeeds when all copy step sources exist', () => {
      const scripts = resolve('dist/apps', 'worker/scripts');
      existing(frontendDir, appDir, scripts);

      const config = _createBaseConfig(
        makeOptions({ files: [{ from: 'worker/scripts', to: 'scripts' }] }),
        context
      );

      expect(config.files).toEqual(
        expect.arrayContaining([
          { from: scripts, to: 'scripts' },
          {
            from: frontendDir,
            to: 'frontend',
            filter: ['**/!(*.+(js|css).map)'],
          },
        ])
      );
    });
  });

  describe('_createConfigFromOptions', () => {
    it('does not leak failOnMissingFiles into the electron-builder config', () => {
      const config = _createConfigFromOptions(
        makeOptions({ failOnMissingFiles: false }),
        { files: [] }
      );

      expect(config).not.toHaveProperty('failOnMissingFiles');
    });
  });
});

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
