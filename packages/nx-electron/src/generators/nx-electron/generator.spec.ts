import {
  addProjectConfiguration,
  readJson,
  readProjectConfiguration,
  Tree,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';

import { Schema } from './schema';
import { generator as applicationGenerator } from './generator';
import { Linter } from '@nx/eslint';

fdescribe('app', () => {
  let tree: Tree;

  let projectJson: any;
  let options: Schema;

  beforeEach(() => {
    jest.spyOn(console, 'warn').mockImplementation();

    tree = createTreeWithEmptyWorkspace();

    options = {
      name: 'electron-app',
      addProxy: false,
      proxyPort: 4000,
      skipFormat: false,
      skipPackageJson: false,
      linter: Linter.None,
      unitTestRunner: 'none',
    };

    jest.clearAllMocks();
  });

  describe('when the default options are provided', () => {
    beforeEach(async () => {
      await applicationGenerator(tree, options);
      projectJson = readProjectConfiguration(tree, 'electron-app');
    });

    it('should generate the project json with the correct source root', () => {
      expect(projectJson.sourceRoot).toBe('electron-app/src');
    });

    it('should generate the main.ts file', () => {
      expect(tree.exists(`electron-app/src/main.ts`)).toBeTruthy();
    });

    it('should generate the tsconfig.json file', () => {
      expect(readJson(tree, 'electron-app/tsconfig.json')).toEqual({
        compilerOptions: {
          types: ['node'],
        },
        extends: '../tsconfig.base.json',
        include: ['**/*.ts'],
      });
    });

    it('should generate the tsconfig.app.json file', () => {
      expect(readJson(tree, 'electron-app/tsconfig.app.json')).toEqual({
        extends: './tsconfig.json',
        compilerOptions: {
          outDir: '../dist/out-tsc',
          types: ['node'],
        },
        exclude: ['**/*.spec.ts', '**/*.test.ts'],
        include: ['**/*.ts'],
      });
    });

    it('should generate the project json with the correct build target', () => {
      expect(projectJson.targets.build).toEqual({
        executor: 'nx-electron:build',
        outputs: ['{options.outputPath}'],
        options: {
          assets: ['electron-app/src/assets'],
          outputPath: 'dist/electron-app',
          main: 'electron-app/src/main.ts',
          tsConfig: 'electron-app/tsconfig.app.json',
        },
        configurations: {
          production: {
            optimization: true,
            extractLicenses: true,
            inspect: false,
            fileReplacements: [
              {
                replace: 'electron-app/src/environments/environment.ts',
                with: 'electron-app/src/environments/environment.prod.ts',
              },
            ],
          },
        },
      });
    });

    it('should generate the project json with the correct serve target', () => {
      expect(projectJson.targets.serve).toEqual({
        executor: 'nx-electron:execute',
        options: {
          buildTarget: 'electron-app:build',
        },
      });
    });

    it('should generate the project json with the correct package target', () => {
      expect(projectJson.targets.package).toEqual({
        executor: 'nx-electron:package',
        options: {
          name: 'electron-app',
          frontendProject: '',
          sourcePath: 'dist/apps',
          outputPath: 'dist/packages',
          prepackageOnly: true,
        },
      });
    });

    it('should generate the project json with the correct make target', () => {
      expect(projectJson.targets.make).toEqual({
        executor: 'nx-electron:make',
        options: {
          name: 'electron-app',
          frontendProject: '',
          sourcePath: 'dist/apps',
          outputPath: 'dist/executables',
        },
      });
    });
  });

  describe('when the lint option is provided as eslint', () => {
    beforeEach(async () => {
      options.linter = Linter.EsLint;
      await applicationGenerator(tree, options);
      projectJson = readProjectConfiguration(tree, 'electron-app');
    });

    it('should generate the project json with the correct lint target', () => {
      expect(projectJson.targets.lint).toEqual({
        executor: '@nx/eslint:lint',
        options: {
          lintFilePatterns: ['electron-app/**/*.ts'],
        },
      });
    });
  });

  describe('when the unitTestRunner option is provided as jest', () => {
    beforeEach(async () => {
      options.unitTestRunner = 'jest';
      await applicationGenerator(tree, options);
      projectJson = readProjectConfiguration(tree, 'electron-app');
    });

    it('should generate the project json with the correct test target', () => {
      expect(projectJson.targets.test).toEqual({
        executor: '@nx/jest:jest',
        outputs: ['{workspaceRoot}/coverage/{projectRoot}'],
        options: {
          jestConfig: 'electron-app/jest.config.cts',
        },
      });
    });

    it('should create the jest config', () => {
      expect(tree.exists(`electron-app/jest.config.cts`)).toBeTruthy();
    });
  });

  // TODO: Reimplement tags option
  // describe('when the tags option is provided', () => {
  //   beforeEach(async () => {
  //     options.tags = 'example';
  //     await applicationGenerator(tree, options);
  //     projectJson = readJson(tree, 'electron-app/project.json');
  //   });

  //   it('should generate the project json with the correct tag', () => {
  //     expect(projectJson.tags).toBe('example');
  //   });
  // });

  describe('when the frontendProject option is provided', () => {
    beforeEach(async () => {
      addProjectConfiguration(tree, 'electron-frontend', {
        root: 'apps/electron-frontend',
        sourceRoot: 'apps/electron-frontend/src',
        projectType: 'application',
        targets: {
          serve: {
            executor: '@nx/angular:serve',
            options: {},
          },
        },
      });
      options.frontendProject = 'electron-frontend';
      await applicationGenerator(tree, options);
      projectJson = readProjectConfiguration(tree, 'electron-app');
    });

    it('should generate the proxy.conf.json file', () => {
      expect(
        tree.exists('apps/electron-frontend/proxy.conf.json'),
      ).toBeTruthy();
    });

    it('should add the proxy config to the frontend project', () => {
      expect(
        readProjectConfiguration(tree, 'electron-frontend').targets.serve
          .options.proxyConfig,
      ).toBe('apps/electron-frontend/proxy.conf.json');
    });
  });

  describe('when the directory option is provided', () => {
    beforeEach(async () => {
      options.directory = 'directory';
      await applicationGenerator(tree, options);
      projectJson = readProjectConfiguration(tree, 'directory-electron-app');
    });

    it('should generate the project json with the correct source root', () => {
      expect(projectJson.sourceRoot).toBe('directory/electron-app/src');
    });

    it('should generate the main.ts file', () => {
      expect(tree.exists(`directory/electron-app/src/main.ts`)).toBeTruthy();
    });
  });
});
