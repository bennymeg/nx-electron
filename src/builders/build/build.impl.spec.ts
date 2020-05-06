import { normalize, JsonObject, workspaces } from '@angular-devkit/core';
import { join, resolve } from 'path';
jest.mock('tsconfig-paths-webpack-plugin');
import TsConfigPathsPlugin from 'tsconfig-paths-webpack-plugin';
import { BuildElectronBuilderOptions } from './build.impl';
import { of } from 'rxjs';
import * as buildWebpack from '@angular-devkit/build-webpack';
import { Architect } from '@angular-devkit/architect';
import { getTestArchitect } from '../../utils/testing';

describe('ElectronBuildBuilder', () => {
  let testOptions: BuildElectronBuilderOptions & JsonObject;
  let architect: Architect;
  let runWebpack: jest.Mock;

  beforeEach(async () => {
    [architect] = await getTestArchitect();

    testOptions = {
      main: 'apps/electron-app/src/main.ts',
      tsConfig: 'apps/electron-app/tsconfig.app.json',
      outputPath: 'dist/apps/electron-app',
      externalDependencies: 'all',
      fileReplacements: [
        {
          replace: 'apps/environment/environment.ts',
          with: 'apps/environment/environment.prod.ts'
        },
        {
          replace: 'module1.ts',
          with: 'module2.ts'
        }
      ],
      assets: [],
      statsJson: false,
      root: join(normalize(resolve(__dirname).replace(/build.*$/, '')), 'apps', 'electron-app', 'src')
    };
    runWebpack = jest.fn().mockImplementation((config, context, options) => {
      options.logging({
        toJson: () => ({
          stats: 'stats'
        })
      });
      return of({ success: true });
    });
    (buildWebpack as any).runWebpack = runWebpack;
    spyOn(workspaces, 'readWorkspace').and.returnValue({
      workspace: {
        projects: {
          get: () => ({
            sourceRoot: join(normalize(resolve(__dirname).replace(/build.*$/, '')), 'apps', 'electron-app', 'src')
          })
        }
      }
    });
    (<any>TsConfigPathsPlugin).mockImplementation(
      function MockPathsPlugin() {}
    );
  });

  describe('run', () => {
    it('should call runWebpack', async () => {
      const run = await architect.scheduleBuilder(
        'nx-electron:build',
        testOptions
      );
      await run.output.toPromise();

      await run.stop();

      expect(runWebpack).toHaveBeenCalled();
    });

    it('should emit the outfile along with success', async () => {
      const run = await architect.scheduleBuilder(
        'nx-electron:build',
        testOptions
      );
      const output = await run.output.toPromise();

      await run.stop();

      expect(output.success).toEqual(true);
      expect(output.outfile).toEqual(join(normalize(resolve(__dirname).replace(/build.*$/, '')), 'dist', 'apps', 'electron-app', 'main.js'));
    });

    describe('webpackConfig option', () => {
      it('should require the specified function and use the return value', async () => {
        const mockFunction = jest.fn(config => ({
          config: 'config'
        }));
        jest.mock(
          join(normalize(resolve(__dirname).replace(/build.*$/, '')), 'apps', 'electron-app', 'webpack.config.js'),
          () => mockFunction,
          {
            virtual: true
          }
        );
        testOptions.webpackConfig = 'apps/electron-app/webpack.config.js';
        const run = await architect.scheduleBuilder(
          'nx-electron:build',
          testOptions
        );
        await run.output.toPromise();

        await run.stop();

        expect(mockFunction).toHaveBeenCalled();
        expect(runWebpack).toHaveBeenCalledWith(
          {
            config: 'config'
          },
          jasmine.anything(),
          jasmine.anything()
        );
        // expect(runWebpack.calls.first().args[0]).toEqual({
        //   config: 'config'
        // });
      });
    });
  });
});
