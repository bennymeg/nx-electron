import { join } from 'path';
import { BuildElectronBuilderOptions } from '../executors/build/executor';
import { getElectronWebpackConfig } from './electron.config';

jest.mock('./webpack/plugins/tsconfig-paths/tsconfig-paths.plugin');
jest.mock('@nrwl/tao/src/utils/app-root', () => ({
  get appRootPath() {
    return join(__dirname, '../../../..');
  },
}));

describe('getElectronPartial', () => {
  let options: BuildElectronBuilderOptions;

  beforeEach(() => {
    options = {
      main: 'main.ts',
      outputPath: 'dist',
      tsConfig: 'tsconfig.json',
      externalDependencies: 'all',
      implicitDependencies: [],
      fileReplacements: [],
      statsJson: false,
    };
  });

  describe('unconditionally', () => {
    it('should target commonjs', () => {
      const result = getElectronWebpackConfig(options);
      expect(result.output.libraryTarget).toEqual('commonjs');
    });

    it('should target electron', () => {
      const result = getElectronWebpackConfig(options);

      expect(result.target).toEqual('electron-main');
    });

    it('should not polyfill node apis', () => {
      const result = getElectronWebpackConfig(options);

      expect(result.node).toEqual(false);
    });
  });

  describe('the optimization option when true', () => {
    it('should not minify', () => {
      const result = getElectronWebpackConfig({
        ...options,
        optimization: true,
      });

      expect(result.optimization.minimize).toEqual(false);
    });

    it('should not concatenate modules', () => {
      const result = getElectronWebpackConfig({
        ...options,
        optimization: true,
      });

      expect(result.optimization.concatenateModules).toEqual(false);
    });
  });

  describe('the externalDependencies option', () => {
    it('should change all electron_modules to commonjs imports', () => {
      const result = getElectronWebpackConfig(options);
      const callback = jest.fn();
      result.externals[0](null, '@nestjs/core', callback);
      expect(callback).toHaveBeenCalledWith(null, 'commonjs @nestjs/core');
    });

    it('should change given module names to commonjs imports but not others', () => {
      const result = getElectronWebpackConfig({
        ...options,
        externalDependencies: ['module1'],
      });
      const callback = jest.fn();

      result.externals[0]({ request: 'module1' }, callback);
      expect(callback).toHaveBeenCalledWith(null, 'commonjs module1');

      result.externals[0]({ request: '@nestjs/core' }, callback);
      expect(callback).toHaveBeenCalledWith();
    });

    it('should not change any modules to commonjs imports', () => {
      const result = getElectronWebpackConfig({
        ...options,
        externalDependencies: 'none',
      });

      expect(result.externals).not.toBeDefined();
    });
  });
});
