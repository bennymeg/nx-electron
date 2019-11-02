import { getElectronWebpackConfig } from './electron.config';
import { BannerPlugin } from 'webpack';
jest.mock('tsconfig-paths-webpack-plugin');
import TsConfigPathsPlugin from 'tsconfig-paths-webpack-plugin';
import { BuildElectronBuilderOptions } from '../builders/build/build.impl';

describe('getElectronPartial', () => {
  let input: BuildElectronBuilderOptions;
  beforeEach(() => {
    input = {
      main: 'main.ts',
      outputPath: 'dist',
      tsConfig: 'tsconfig.json',
      externalDependencies: 'all',
      fileReplacements: [],
      statsJson: false
    };
    (<any>TsConfigPathsPlugin).mockImplementation(
      function MockPathsPlugin() {}
    );
  });

  describe('unconditionally', () => {
    it('should target commonjs', () => {
      const result = getElectronWebpackConfig(input);
      expect(result.output.libraryTarget).toEqual('commonjs');
    });

    it('should target electron', () => {
      const result = getElectronWebpackConfig(input);

      expect(result.target).toEqual('electron');
    });

    it('should not polyfill electron apis', () => {
      const result = getElectronWebpackConfig(input);

      expect(result.electron).toEqual(false);
    });
  });

  describe('the optimization option when true', () => {
    it('should not minify', () => {
      const result = getElectronWebpackConfig({
        ...input,
        optimization: true
      });

      expect(result.optimization.minimize).toEqual(false);
    });

    it('should not concatenate modules', () => {
      const result = getElectronWebpackConfig({
        ...input,
        optimization: true
      });

      expect(result.optimization.concatenateModules).toEqual(false);
    });
  });

  describe('the externalDependencies option', () => {
    it('should change all electron_modules to commonjs imports', () => {
      const result = getElectronWebpackConfig(input);
      const callback = jest.fn();
      result.externals[0](null, '@nestjs/core', callback);
      expect(callback).toHaveBeenCalledWith(null, 'commonjs @nestjs/core');
    });

    it('should change given module names to commonjs imports but not others', () => {
      const result = getElectronWebpackConfig({
        ...input,
        externalDependencies: ['module1']
      });
      const callback = jest.fn();
      result.externals[0](null, 'module1', callback);
      expect(callback).toHaveBeenCalledWith(null, 'commonjs module1');
      result.externals[0](null, '@nestjs/core', callback);
      expect(callback).toHaveBeenCalledWith();
    });

    it('should not change any modules to commonjs imports', () => {
      const result = getElectronWebpackConfig({
        ...input,
        externalDependencies: 'none'
      });

      expect(result.externals).not.toBeDefined();
    });
  });
});
