import { ExecutorContext } from '@nx/devkit';
import { of } from 'rxjs';
import executor, { BuildElectronBuilderOptions } from './executor';

jest.mock('@nx/js', () => {
  const actual = jest.requireActual('@nx/js');
  return {
    ...actual,
    readTsConfig: jest.fn(() => ({ options: { target: 99 } })),
  };
});

jest.mock('tsconfig-paths-webpack-plugin', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({})),
}));

jest.mock('../../utils/run-webpack', () => ({
  runWebpack: jest.fn(),
}));

import { runWebpack } from '../../utils/run-webpack';

describe('ElectronBuildBuilder', () => {
  let context: ExecutorContext;
  let options: BuildElectronBuilderOptions;

  beforeEach(() => {
    (<any>runWebpack).mockReturnValue(of({ hasErrors: () => false }));

    context = {
      root: '/root',
      cwd: '/root',
      projectName: 'my-app',
      targetName: 'build',
      projectGraph: {
        nodes: {
          'my-app': {
            name: 'my-app',
            type: 'app',
            data: {
              root: 'apps/electron-app',
              sourceRoot: 'apps/electron-app',
            },
          },
        },
        dependencies: {},
      },
      projectsConfigurations: {
        version: 2,
        projects: {},
      },
      nxJsonConfiguration: {},
      isVerbose: false,
    };

    options = {
      main: 'apps/electron-app/src/main.ts',
      tsConfig: 'apps/electron-app/tsconfig.json',
      outputPath: 'dist/apps/electron-app',
      externalDependencies: 'all',
      implicitDependencies: [],
      buildLibsFromSource: true,
      fileReplacements: [],
      assets: [],
      statsJson: false,
      extraMetadata: { version: '0.0.0' },
    };
  });

  afterEach(() => jest.clearAllMocks());

  it('should call webpack', async () => {
    await executor(options, context);

    expect(runWebpack).toHaveBeenCalledWith(
      expect.objectContaining({
        output: expect.objectContaining({
          filename: expect.any(Function),
          libraryTarget: 'commonjs',
          path: '/root/dist/apps/electron-app',
        }),
      }),
    );
  });

  it('should use outputFileName if passed in', async () => {
    await executor({ ...options, outputFileName: 'index.js' }, context);

    expect(runWebpack).toHaveBeenCalledWith(
      expect.objectContaining({
        output: expect.objectContaining({
          filename: expect.any(Function),
          libraryTarget: 'commonjs',
          path: '/root/dist/apps/electron-app',
        }),
      }),
    );
  });

  describe('webpackConfig', () => {
    it('should handle custom path', async () => {
      jest.mock(
        '/root/config.js',
        () => (options) => ({ ...options, prop: 'my-val' }),
        { virtual: true },
      );
      await executor({ ...options, webpackConfig: 'config.js' }, context);

      expect(runWebpack).toHaveBeenCalledWith(
        expect.objectContaining({
          output: expect.objectContaining({
            filename: expect.any(Function),
            libraryTarget: 'commonjs',
            path: '/root/dist/apps/electron-app',
          }),
          prop: 'my-val',
        }),
      );
    });
  });
});
