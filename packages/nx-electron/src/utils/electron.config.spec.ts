import { BuildElectronBuilderOptions } from '../executors/build/executor';
import { getElectronWebpackConfig } from './electron.config';

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

describe('getElectronPartial', () => {
  let options: BuildElectronBuilderOptions;

  beforeEach(() => {
    options = {
      main: 'main.ts',
      outputPath: 'dist',
      tsConfig: 'tsconfig.json',
      root: '/root',
      externalDependencies: 'all',
      implicitDependencies: [],
      fileReplacements: [],
      statsJson: false,
      extraMetadata: { version: '0.0.0' },
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
      expect(result.externals[0]).toEqual(expect.any(Function));
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
