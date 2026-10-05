import {
  addProjectConfiguration,
  readJson,
  readNxJson,
  readProjectConfiguration,
  Tree,
  updateJson,
  writeJson,
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

    // The Nx 23 test workspace defaults to the oxfmt formatter. The jest
    // configuration generator then installs oxfmt into a temp directory and
    // loads it, which Jest cannot parse (ES module); prettier 3 cannot be
    // loaded inside Jest either. The specs read the generated files as JSON,
    // so they don't need a formatter.
    tree = createTreeWithEmptyWorkspace({ formatter: 'none' });

    options = {
      directory: 'electron-app',
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

    it('should generate the assets folder with a .gitkeep file', () => {
      expect(tree.exists(`electron-app/src/assets/.gitkeep`)).toBeTruthy();
      expect(tree.children('electron-app/src/assets')).toEqual(['.gitkeep']);
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
        continuous: true,
        options: {
          buildTarget: 'electron-app:build',
        },
      });
    });

    it('should generate the project json with the correct package target', () => {
      expect(projectJson.targets.package).toEqual({
        executor: 'nx-electron:package',
        dependsOn: ['build'],
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
        dependsOn: ['build'],
        options: {
          name: 'electron-app',
          frontendProject: '',
          sourcePath: 'dist/apps',
          outputPath: 'dist/executables',
        },
      });
    });
  });

  describe('the nx.json changes', () => {
    beforeEach(async () => {
      await applicationGenerator(tree, options);
    });

    it('should add cacheable target defaults for the nx-electron:build executor', () => {
      expect(readNxJson(tree).targetDefaults['nx-electron:build']).toEqual(
        expect.objectContaining({ cache: true, dependsOn: ['^build'] }),
      );
    });

    it('should not set the defaultProject', () => {
      expect(readNxJson(tree).defaultProject).toBeUndefined();
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

  describe('when the tags option is provided', () => {
    beforeEach(async () => {
      options.tags = 'electron, desktop';
      await applicationGenerator(tree, options);
      projectJson = readProjectConfiguration(tree, 'electron-app');
    });

    it('should add the tags to the project', () => {
      expect(projectJson.tags).toEqual(['electron', 'desktop']);
    });
  });

  describe('when the skipPackageJson option is provided', () => {
    beforeEach(async () => {
      options.skipPackageJson = true;
      await applicationGenerator(tree, options);
    });

    it('should not add dependencies to the root package.json', () => {
      const { dependencies = {}, devDependencies = {} } = readJson(
        tree,
        'package.json',
      );
      expect(Object.keys({ ...dependencies, ...devDependencies })).not.toEqual(
        expect.arrayContaining(['nx-electron']),
      );
      expect(Object.keys({ ...dependencies, ...devDependencies })).not.toEqual(
        expect.arrayContaining(['electron']),
      );
    });
  });

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

    it('should build the frontend project before packaging', () => {
      const frontendBuild = {
        projects: ['electron-frontend'],
        target: 'build',
      };
      expect(projectJson.targets.package.dependsOn).toEqual([
        'build',
        frontendBuild,
      ]);
      expect(projectJson.targets.make.dependsOn).toEqual([
        'build',
        frontendBuild,
      ]);
    });

    it('should add the proxy config to the frontend project by default', () => {
      expect(
        readProjectConfiguration(tree, 'electron-frontend').targets.serve
          .options.proxyConfig,
      ).toBe('apps/electron-frontend/proxy.conf.json');
    });
  });

  describe('when addProxy is false', () => {
    beforeEach(async () => {
      addProjectConfiguration(tree, 'electron-frontend', {
        root: 'apps/electron-frontend',
        projectType: 'application',
        targets: { serve: { executor: '@nx/angular:serve', options: {} } },
      });
      options.frontendProject = 'electron-frontend';
      options.addProxy = false;
      await applicationGenerator(tree, options);
    });

    it('should not add a proxy config to the frontend project', () => {
      expect(tree.exists('apps/electron-frontend/proxy.conf.json')).toBeFalsy();
      expect(
        readProjectConfiguration(tree, 'electron-frontend').targets.serve
          .options.proxyConfig,
      ).toBeUndefined();
    });
  });

  describe('when the directory is a nested path', () => {
    beforeEach(async () => {
      options.directory = 'apps/desktop/shell';
      await applicationGenerator(tree, options);
      projectJson = readProjectConfiguration(tree, 'shell');
    });

    it('should use the last path segment as project name', () => {
      expect(projectJson.root).toBe('apps/desktop/shell');
    });

    it('should generate the project json with the correct source root', () => {
      expect(projectJson.sourceRoot).toBe('apps/desktop/shell/src');
    });

    it('should generate the main.ts file', () => {
      expect(tree.exists(`apps/desktop/shell/src/main.ts`)).toBeTruthy();
    });

    it('should write the build output to dist/<directory>', () => {
      expect(projectJson.targets.build.options.outputPath).toBe(
        'dist/apps/desktop/shell',
      );
    });

    it('should reference the project name in the package and make targets', () => {
      expect(projectJson.targets.package.options.name).toBe('shell');
      expect(projectJson.targets.make.options.name).toBe('shell');
    });
  });

  describe('when a name is provided in addition to the directory', () => {
    beforeEach(async () => {
      options.directory = 'apps/desktop/shell';
      options.name = 'desktop-shell';
      await applicationGenerator(tree, options);
    });

    it('should use the provided name as project name', () => {
      expect(readProjectConfiguration(tree, 'desktop-shell').root).toBe(
        'apps/desktop/shell',
      );
    });
  });

  describe('when the workspace uses the TS solution setup', () => {
    beforeEach(() => {
      updateJson(tree, 'package.json', (json) => ({
        ...json,
        workspaces: ['packages/*'],
      }));
      writeJson(tree, 'tsconfig.base.json', {
        compilerOptions: { composite: true, declaration: true },
      });
      writeJson(tree, 'tsconfig.json', {
        extends: './tsconfig.base.json',
        files: [],
        references: [],
      });
    });

    describe('with the default options', () => {
      beforeEach(async () => {
        await applicationGenerator(tree, options);
        projectJson = readProjectConfiguration(tree, '@proj/electron-app');
      });

      it('should use the scoped import path as project name', () => {
        expect(projectJson.root).toBe('electron-app');
      });

      it('should write the project configuration to package.json', () => {
        expect(tree.exists('electron-app/project.json')).toBeFalsy();
        const packageJson = readJson(tree, 'electron-app/package.json');
        expect(packageJson.name).toBe('@proj/electron-app');
        expect(packageJson.private).toBe(true);
        expect(Object.keys(packageJson.nx.targets)).toEqual(
          expect.arrayContaining(['build', 'serve', 'package', 'make']),
        );
      });

      it('should write the build output into the project', () => {
        expect(projectJson.targets.build.options.outputPath).toBe(
          'electron-app/dist',
        );
      });

      it('should reference the project name in the package and make targets', () => {
        expect(projectJson.targets.package.options.name).toBe(
          '@proj/electron-app',
        );
        expect(projectJson.targets.make.options.name).toBe(
          '@proj/electron-app',
        );
        expect(projectJson.targets.serve.options.buildTarget).toBe(
          '@proj/electron-app:build',
        );
      });

      it('should add the project to the package manager workspaces', () => {
        expect(readJson(tree, 'package.json').workspaces).toEqual([
          'packages/*',
          'electron-app',
        ]);
      });

      it('should add the project to the root tsconfig.json references', () => {
        expect(readJson(tree, 'tsconfig.json').references).toEqual([
          { path: './electron-app' },
        ]);
      });

      it('should generate a solution style tsconfig.json', () => {
        expect(readJson(tree, 'electron-app/tsconfig.json')).toEqual({
          extends: '../tsconfig.base.json',
          files: [],
          include: [],
          references: [{ path: './tsconfig.app.json' }],
        });
      });

      // TypeScript 6 requires an explicit rootDir (TS5011) and the TS solution
      // setup's tsconfig.base.json does not define one.
      it('should configure the tsconfig.app.json file for the TS solution setup', () => {
        const tsconfigApp = readJson(tree, 'electron-app/tsconfig.app.json');
        expect(tsconfigApp.extends).toBe('../tsconfig.base.json');
        expect(tsconfigApp.compilerOptions).toEqual(
          expect.objectContaining({
            outDir: 'dist',
            rootDir: 'src',
            tsBuildInfoFile: 'dist/tsconfig.app.tsbuildinfo',
            types: ['node'],
          }),
        );
      });
    });

    describe('with a name', () => {
      beforeEach(async () => {
        options.name = 'desktop';
        await applicationGenerator(tree, options);
      });

      it('should use the provided name as project name', () => {
        expect(readProjectConfiguration(tree, 'desktop').root).toBe(
          'electron-app',
        );
        expect(readJson(tree, 'electron-app/package.json').nx.name).toBe(
          'desktop',
        );
      });
    });

    describe('with tags', () => {
      beforeEach(async () => {
        options.tags = 'electron';
        await applicationGenerator(tree, options);
      });

      it('should add the tags to the package.json nx configuration', () => {
        expect(readJson(tree, 'electron-app/package.json').nx.tags).toEqual([
          'electron',
        ]);
      });
    });

    describe('with useProjectJson', () => {
      beforeEach(async () => {
        options.useProjectJson = true;
        await applicationGenerator(tree, options);
      });

      it('should write the project configuration to project.json', () => {
        expect(tree.exists('electron-app/project.json')).toBeTruthy();
        expect(readJson(tree, 'electron-app/package.json').nx).toBeUndefined();
      });
    });
  });
});
