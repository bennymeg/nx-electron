import { ExecutorContext } from '@nrwl/devkit';
import * as projectGraph from '@nrwl/workspace/src/core/project-graph';
import type { ProjectGraph } from '@nrwl/workspace/src/core/project-graph';
import { of } from 'rxjs';
import executor, { BuildElectronBuilderOptions } from './executor';

jest.mock('../../utils/run-webpack', () => ({
  runWebpack: jest.fn(),
}));

import { runWebpack } from '../../utils/run-webpack';

describe('ElectronBuildBuilder', () => {
  let context: ExecutorContext;
  let options: BuildElectronBuilderOptions;

  beforeEach(async () => {
    jest
      .spyOn(projectGraph, 'readCachedProjectGraph')
      .mockReturnValue({} as ProjectGraph);

    (<any>runWebpack).mockReturnValue(of({ hasErrors: () => false }));

    context = {
      root: '/root',
      cwd: '/root',
      projectName: 'my-app',
      targetName: 'build',
      workspace: {
        version: 2,
        projects: {
          'my-app': <any>{
            root: 'apps/electron-app',
            sourceRoot: 'apps/electron-app',
          },
        },
      },
      isVerbose: false,
    };

    options = {
      main: 'apps/electron-app/src/main.ts',
      tsConfig: 'apps/electron-app/tsconfig.ts',
      outputPath: 'dist/apps/electron-app',
      externalDependencies: 'all',
      implicitDependencies: [],
      buildLibsFromSource: true,
      fileReplacements: [],
      assets: [],
      statsJson: false,
    };

    afterEach(() => jest.clearAllMocks());

    it('should call webpack', async () => {
      await executor(options, context).next();

      expect(runWebpack).toHaveBeenCalledWith(
        expect.objectContaining({
          output: expect.objectContaining({
            filename: 'main.js',
            libraryTarget: 'commonjs',
            path: '/root/dist/apps/electron-app',
          }),
        })
      );
    });

    it('should use outputFileName if passed in', async () => {
      await executor(
        { ...options, outputFileName: 'index.js' },
        context
      ).next();

      expect(runWebpack).toHaveBeenCalledWith(
        expect.objectContaining({
          output: expect.objectContaining({
            filename: 'index.js',
            libraryTarget: 'commonjs',
            path: '/root/dist/apps/wibble',
          }),
        })
      );
    });

    describe('webpackConfig', () => {
      it('should handle custom path', async () => {
        jest.mock(
          '/root/config.js',
          () => (options) => ({ ...options, prop: 'my-val' }),
          { virtual: true }
        );
        await executor(
          { ...options, webpackConfig: 'config.js' },
          context
        ).next();

        expect(runWebpack).toHaveBeenCalledWith(
          expect.objectContaining({
            output: expect.objectContaining({
              filename: 'main.js',
              libraryTarget: 'commonjs',
              path: '/root/dist/apps/wibble',
            }),
            prop: 'my-val',
          })
        );
      });
    });
  });
});
