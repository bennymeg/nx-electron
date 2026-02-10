import { ExecutorContext } from '@nx/devkit';
import { PackageElectronBuilderOptions } from './executor';

jest.mock('glob');

jest.mock('fs-extra');

describe('MakeElectronBuilder', () => {
  let context: ExecutorContext;
  let options: PackageElectronBuilderOptions;

  beforeEach(async () => {
    options = {
      root: '.',
      platform: 'windows',
      extraProjects: [],
      arch: 'x64',
      name: 'electron-app',
      frontendProject: 'frontend',
      prepackageOnly: false,
      sourcePath: 'dist/apps',
      outputPath: 'dist/packages',
    };
  });

  describe('run', () => {
    it('should find a way to test application packaging', async () => {
      expect(true).toEqual(true);
    });
  });
});
