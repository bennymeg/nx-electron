import { ExecutorContext } from '@nx/devkit';
import { resolve } from 'path';
import * as fs from 'fs';
import {
  PackageElectronBuilderOptions,
  syncArtifactVersion,
  _createConfigFromOptions,
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

describe('syncArtifactVersion', () => {
  const packageJsonPath = resolve(
    '.',
    'dist/apps',
    'electron-app',
    'package.json',
  );

  const readMock = fs.readFileSync as jest.Mock;
  const existsMock = fs.existsSync as jest.Mock;
  const writeMock = fs.writeFileSync as jest.Mock;

  /** Convenience: the version that would be written to the bundled package.json. */
  const writtenVersion = (): string | undefined =>
    writeMock.mock.calls.length
      ? JSON.parse(writeMock.mock.calls[0][1]).version
      : undefined;

  beforeEach(() => {
    jest.clearAllMocks();
    // The bundled package.json exists and carries the build-time default.
    existsMock.mockReturnValue(true);
    readMock.mockReturnValue(
      JSON.stringify({ name: 'electron-app', version: '0.0.1' }),
    );
  });

  it('should reflect extraMetadata.version into the bundled package.json', () => {
    syncArtifactVersion(makeOptions({ extraMetadata: { version: '1.2.3' } }));

    expect(writeMock).toHaveBeenCalledTimes(1);
    expect(writeMock.mock.calls[0][0]).toEqual(packageJsonPath);
    expect(writtenVersion()).toEqual('1.2.3');
  });

  it('should preserve other package.json fields when updating the version', () => {
    syncArtifactVersion(makeOptions({ extraMetadata: { version: '1.2.3' } }));

    expect(JSON.parse(writeMock.mock.calls[0][1])).toEqual({
      name: 'electron-app',
      version: '1.2.3',
    });
  });

  it('should fall back to buildVersion when extraMetadata is absent', () => {
    syncArtifactVersion(makeOptions({ buildVersion: '4.5.6' }));

    expect(writtenVersion()).toEqual('4.5.6');
  });

  it('should prefer extraMetadata.version over buildVersion', () => {
    syncArtifactVersion(
      makeOptions({ extraMetadata: { version: '1.2.3' }, buildVersion: '4.5.6' }),
    );

    expect(writtenVersion()).toEqual('1.2.3');
  });

  it('should do nothing when no version override is provided', () => {
    syncArtifactVersion(makeOptions());

    expect(writeMock).not.toHaveBeenCalled();
  });

  it('should do nothing when the bundled package.json does not exist', () => {
    existsMock.mockReturnValue(false);

    expect(() =>
      syncArtifactVersion(makeOptions({ extraMetadata: { version: '1.2.3' } })),
    ).not.toThrow();
    expect(writeMock).not.toHaveBeenCalled();
  });

  it('should not rewrite the file when the version already matches', () => {
    readMock.mockReturnValue(
      JSON.stringify({ name: 'electron-app', version: '1.2.3' }),
    );

    syncArtifactVersion(makeOptions({ extraMetadata: { version: '1.2.3' } }));

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
