import { ExecutorContext, logger } from '@nx/devkit';
import { resolve } from 'path';
import * as fs from 'fs';
import {
  PackageElectronBuilderOptions,
  syncArtifactMetadata,
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
    readFileSync: jest.fn(actualFs.readFileSync),
    writeFileSync: jest.fn(),
  };
});

/**
 * `extraMetadata` / `buildVersion` are read-only on electron-builder's
 * `Configuration`, so overrides are supplied via an object literal rather than
 * mutated after the fact.
 */
function makeOptions(
  overrides: Partial<PackageElectronBuilderOptions> = {},
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

describe('syncArtifactMetadata', () => {
  const packageJsonPath = resolve(
    '.',
    'dist/apps',
    'electron-app',
    'package.json',
  );

  const readMock = fs.readFileSync as jest.Mock;
  const existsMock = fs.existsSync as jest.Mock;
  const writeMock = fs.writeFileSync as jest.Mock;

  /** Convenience: the package.json that would be written to the bundle. */
  const written = (): Record<string, unknown> | undefined =>
    writeMock.mock.calls.length
      ? JSON.parse(writeMock.mock.calls[0][1])
      : undefined;

  beforeEach(() => {
    jest.clearAllMocks();
    // The bundled package.json exists and carries the build-time defaults
    // (the Nx project name and the placeholder version).
    existsMock.mockReturnValue(true);
    readMock.mockReturnValue(
      JSON.stringify({ name: 'electron-app', version: '0.0.1' }),
    );
  });

  it('should reflect extraMetadata.version into the bundled package.json', () => {
    syncArtifactMetadata(makeOptions({ extraMetadata: { version: '1.2.3' } }));

    expect(writeMock).toHaveBeenCalledTimes(1);
    expect(writeMock.mock.calls[0][0]).toEqual(packageJsonPath);
    expect(written().version).toEqual('1.2.3');
  });

  it('should reflect extraMetadata.name into the bundled package.json', () => {
    // The bundled name drives app.name and thereby Electron's default
    // userData path (%APPDATA%/<name>).
    syncArtifactMetadata(makeOptions({ extraMetadata: { name: 'my-app' } }));

    expect(written()).toEqual({ name: 'my-app', version: '0.0.1' });
  });

  it('should deep-merge nested extraMetadata objects', () => {
    readMock.mockReturnValue(
      JSON.stringify({
        name: 'electron-app',
        version: '0.0.1',
        author: { name: 'Old Author', email: 'old@example.com' },
      }),
    );

    syncArtifactMetadata(
      makeOptions({ extraMetadata: { author: { name: 'New Author' } } }),
    );

    expect(written().author).toEqual({
      name: 'New Author',
      email: 'old@example.com',
    });
  });

  it('should remove a field when its extraMetadata value is null', () => {
    syncArtifactMetadata(
      makeOptions({ extraMetadata: { version: null } as never }),
    );

    expect(written()).toEqual({ name: 'electron-app' });
  });

  it('should preserve other package.json fields when updating the version', () => {
    syncArtifactMetadata(makeOptions({ extraMetadata: { version: '1.2.3' } }));

    expect(written()).toEqual({
      name: 'electron-app',
      version: '1.2.3',
    });
  });

  it('should fall back to buildVersion when extraMetadata is absent', () => {
    syncArtifactMetadata(makeOptions({ buildVersion: '4.5.6' }));

    expect(written().version).toEqual('4.5.6');
  });

  it('should prefer extraMetadata.version over buildVersion', () => {
    syncArtifactMetadata(
      makeOptions({ extraMetadata: { version: '1.2.3' }, buildVersion: '4.5.6' }),
    );

    expect(written().version).toEqual('1.2.3');
  });

  it('should do nothing when no metadata override is provided', () => {
    syncArtifactMetadata(makeOptions());

    expect(writeMock).not.toHaveBeenCalled();
  });

  it('should do nothing when the bundled package.json does not exist', () => {
    existsMock.mockReturnValue(false);

    expect(() =>
      syncArtifactMetadata(makeOptions({ extraMetadata: { version: '1.2.3' } })),
    ).not.toThrow();
    expect(writeMock).not.toHaveBeenCalled();
  });

  it('should not rewrite the file when the metadata already matches', () => {
    readMock.mockReturnValue(
      JSON.stringify({ name: 'my-app', version: '1.2.3' }),
    );

    syncArtifactMetadata(
      makeOptions({ extraMetadata: { name: 'my-app', version: '1.2.3' } }),
    );

    expect(writeMock).not.toHaveBeenCalled();
  });
});

describe('installer version override', () => {
  // The installer file name is produced by electron-builder from the version in
  // its config metadata (`extraMetadata.version` / `buildVersion`). Exercising
  // the real file name would require a full electron-builder run, so instead we
  // guard the contract that feeds it: the version override must survive into the
  // config object that is handed to electron-builder.

  it('should pass extraMetadata.version through to the electron-builder config', () => {
    const config = _createConfigFromOptions(
      makeOptions({ extraMetadata: { version: '1.2.3' } }),
      {},
    );

    expect((config.extraMetadata as { version?: string }).version).toEqual(
      '1.2.3',
    );
  });

  it('should pass buildVersion through to the electron-builder config', () => {
    const config = _createConfigFromOptions(
      makeOptions({ buildVersion: '4.5.6' }),
      {},
    );

    expect(config.buildVersion).toEqual('4.5.6');
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
