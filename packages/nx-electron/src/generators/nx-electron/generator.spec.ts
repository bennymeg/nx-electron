import { NxJsonConfiguration, readJson, Tree, getProjects } from '@nrwl/devkit';
import * as devkit from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';

// nx-ignore-next-line
import { applicationGenerator as angularApplicationGenerator } from '@nrwl/angular/generators';
import { Schema } from './schema';
import { generator as applicationGenerator } from './generator';
import { overrideCollectionResolutionForTesting } from '@nrwl/devkit/ngcli-adapter';
import { join } from 'path';
import { Linter } from '@nrwl/linter';

describe('app', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();

    overrideCollectionResolutionForTesting({
      '@nrwl/cypress': join(__dirname, '../../../../cypress/generators.json'),
      '@nrwl/jest': join(__dirname, '../../../../jest/generators.json'),
      '@nrwl/workspace': join(
        __dirname,
        '../../../../workspace/generators.json'
      ),
      '@nrwl/angular': join(__dirname, '../../../../angular/generators.json'),
    });
    jest.clearAllMocks();
  });

  afterEach(() => {
    overrideCollectionResolutionForTesting(null);
  });

  describe('not nested', () => {
    it('should update workspace.json', async () => {
      await applicationGenerator(tree, {
        name: 'electron-app',
        frontendProject: 'electron-web',
        addProxy: false,
        proxyPort: 3000,
        skipFormat: false,
        skipPackageJson: false,
        linter: Linter.None,
        standaloneConfig: false,
        unitTestRunner: 'none'
      });
      const workspaceJson = readJson(tree, '/workspace.json');
      const nxJson = readJson<NxJsonConfiguration>(tree, 'nx.json');
      const project = workspaceJson.projects['electron-app'];
      expect(project.root).toEqual('apps/electron-app');
      expect(project.architect).toEqual(
        expect.objectContaining({
          build: {
            builder: 'nx-electron:build',
            outputs: ['{options.outputPath}'],
            options: {
              outputPath: 'dist/apps/electron-app',
              main: 'apps/electron-app/src/main.ts',
              tsConfig: 'apps/electron-app/tsconfig.app.json',
              assets: ['apps/electron-app/src/assets'],
            },
            configurations: {
              production: {
                optimization: true,
                extractLicenses: true,
                inspect: false,
                fileReplacements: [
                  {
                    replace: 'apps/electron-app/src/environments/environment.ts',
                    with: 'apps/electron-app/src/environments/environment.prod.ts',
                  },
                ],
              },
            },
          },
          serve: {
            builder: 'nx-electron:execute',
            options: {
              buildTarget: 'electron-app:build',
            },
          },
        })
      );
      expect(workspaceJson.projects['electron-app'].architect.lint).toEqual({
        builder: '@nrwl/linter:eslint',
        outputs: ['{options.outputFile}'],
        options: {
          lintFilePatterns: ['apps/electron-app/**/*.ts'],
        },
      });
      expect(workspaceJson.projects['electron-app-e2e']).toBeUndefined();
      // expect(nxJson.defaultProject).toEqual('electron-app');
    });

    it('should update tags', async () => {
      await applicationGenerator(tree, {
        name: 'electron-app',
        frontendProject: 'electron-web',
        addProxy: false,
        proxyPort: 3000,
        skipFormat: false,
        skipPackageJson: false,
        linter: Linter.None,
        standaloneConfig: false,
        unitTestRunner: 'none',
        tags: 'one,two',
      });
      const projects = Object.fromEntries(getProjects(tree));
      expect(projects).toMatchObject({
        'electron-app': {
          tags: ['one', 'two'],
        },
      });
    });

    it('should generate files', async () => {
      await applicationGenerator(tree, {
        name: 'electron-app',
        frontendProject: 'electron-web',
        addProxy: false,
        proxyPort: 3000,
        skipFormat: false,
        skipPackageJson: false,
        linter: Linter.None,
        standaloneConfig: false,
        unitTestRunner: 'none',
      });
      expect(tree.exists(`apps/electron-app/jest.config.js`)).toBeTruthy();
      expect(tree.exists('apps/electron-app/src/main.ts')).toBeTruthy();

      const tsconfig = readJson(tree, 'apps/electron-app/tsconfig.json');
      expect(tsconfig).toMatchInlineSnapshot(`
        Object {
          "extends": "../../tsconfig.base.json",
          "files": Array [],
          "include": Array [],
          "references": Array [
            Object {
              "path": "./tsconfig.app.json",
            },
            Object {
              "path": "./tsconfig.spec.json",
            },
          ],
        }
      `);

      const tsconfigApp = readJson(tree, 'apps/electron-app/tsconfig.app.json');
      expect(tsconfigApp.compilerOptions.outDir).toEqual('../../dist/out-tsc');
      expect(tsconfigApp.extends).toEqual('./tsconfig.json');
      expect(tsconfigApp.exclude).toEqual(['**/*.spec.ts', '**/*.test.ts']);
      const eslintrc = readJson(tree, 'apps/electron-app/.eslintrc.json');
      expect(eslintrc).toMatchInlineSnapshot(`
        Object {
          "extends": Array [
            "../../.eslintrc.json",
          ],
          "ignorePatterns": Array [
            "!**/*",
          ],
          "overrides": Array [
            Object {
              "files": Array [
                "*.ts",
                "*.tsx",
                "*.js",
                "*.jsx",
              ],
              "rules": Object {},
            },
            Object {
              "files": Array [
                "*.ts",
                "*.tsx",
              ],
              "rules": Object {},
            },
            Object {
              "files": Array [
                "*.js",
                "*.jsx",
              ],
              "rules": Object {},
            },
          ],
        }
      `);
    });
  });

  describe('nested', () => {
    it('should update workspace.json', async () => {
      await applicationGenerator(tree, {
        name: 'electron-app',
        frontendProject: 'electron-web',
        addProxy: false,
        proxyPort: 3000,
        skipFormat: false,
        skipPackageJson: false,
        linter: Linter.None,
        standaloneConfig: false,
        unitTestRunner: 'none',
        directory: 'myDir',
      });
      const workspaceJson = readJson(tree, '/workspace.json');
      const nxJson = readJson<NxJsonConfiguration>(tree, 'nx.json');

      expect(workspaceJson.projects['my-dir-electron-app'].root).toEqual(
        'apps/my-dir/electron-app'
      );

      expect(
        workspaceJson.projects['my-dir-electron-app'].architect.lint
      ).toEqual({
        builder: '@nrwl/linter:eslint',
        outputs: ['{options.outputFile}'],
        options: {
          lintFilePatterns: ['apps/my-dir/electron-app/**/*.ts'],
        },
      });

      expect(workspaceJson.projects['my-dir-electron-app-e2e']).toBeUndefined();
      // expect(nxJson.defaultProject).toEqual('my-dir-electron-app');
    });

    it('should update tags', async () => {
      await applicationGenerator(tree, {
        name: 'electron-app',
        frontendProject: 'electron-web',
        addProxy: false,
        proxyPort: 3000,
        skipFormat: false,
        skipPackageJson: false,
        linter: Linter.None,
        standaloneConfig: false,
        unitTestRunner: 'none',
        directory: 'myDir',
        tags: 'one,two',
      });
      const projects = Object.fromEntries(getProjects(tree));
      expect(projects).toMatchObject({
        'my-dir-electron-app': {
          tags: ['one', 'two'],
        },
      });
    });

    it('should generate files', async () => {
      const hasJsonValue = ({ path, expectedValue, lookupFn }) => {
        const config = readJson(tree, path);

        expect(lookupFn(config)).toEqual(expectedValue);
      };
      await applicationGenerator(tree, {
        name: 'electron-app',
        frontendProject: 'electron-web',
        addProxy: false,
        proxyPort: 3000,
        skipFormat: false,
        skipPackageJson: false,
        linter: Linter.None,
        standaloneConfig: false,
        unitTestRunner: 'none',
        directory: 'myDir',
      });

      // Make sure these exist
      [
        `apps/my-dir/electron-app/jest.config.js`,
        'apps/my-dir/electron-app/src/main.ts',
      ].forEach((path) => {
        expect(tree.exists(path)).toBeTruthy();
      });

      // Make sure these have properties
      [
        {
          path: 'apps/my-dir/electron-app/tsconfig.app.json',
          lookupFn: (json) => json.compilerOptions.outDir,
          expectedValue: '../../../dist/out-tsc',
        },
        {
          path: 'apps/my-dir/electron-app/tsconfig.app.json',
          lookupFn: (json) => json.compilerOptions.types,
          expectedValue: ['node'],
        },
        {
          path: 'apps/my-dir/electron-app/tsconfig.app.json',
          lookupFn: (json) => json.exclude,
          expectedValue: ['**/*.spec.ts', '**/*.test.ts'],
        },
        {
          path: 'apps/my-dir/electron-app/.eslintrc.json',
          lookupFn: (json) => json.extends,
          expectedValue: ['../../../.eslintrc.json'],
        },
      ].forEach(hasJsonValue);
    });
  });

  describe('--unit-test-runner none', () => {
    it('should not generate test configuration', async () => {
      await applicationGenerator(tree, {
        name: 'electron-app',
        frontendProject: 'electron-web',
        addProxy: false,
        proxyPort: 3000,
        skipFormat: false,
        skipPackageJson: false,
        linter: Linter.None,
        standaloneConfig: false,
        unitTestRunner: 'none',
      });
      expect(tree.exists('jest.config.js')).toBeFalsy();
      expect(tree.exists('apps/electron-app/src/test-setup.ts')).toBeFalsy();
      expect(tree.exists('apps/electron-app/src/test.ts')).toBeFalsy();
      expect(tree.exists('apps/electron-app/tsconfig.spec.json')).toBeFalsy();
      expect(tree.exists('apps/electron-app/jest.config.js')).toBeFalsy();
      const workspaceJson = readJson(tree, 'workspace.json');
      expect(
        workspaceJson.projects['electron-app'].architect.test
      ).toBeUndefined();
      expect(workspaceJson.projects['electron-app'].architect.lint)
        .toMatchInlineSnapshot(`
        Object {
          "builder": "@nrwl/linter:eslint",
          "options": Object {
            "lintFilePatterns": Array [
              "apps/electron-app/**/*.ts",
            ],
          },
          "outputs": Array [
            "{options.outputFile}",
          ],
        }
      `);
    });
  });

  describe('--frontendProject', () => {
    it('should configure proxy', async () => {
      await angularApplicationGenerator(tree, { name: 'electron-web' });

      await applicationGenerator(tree, {
        name: 'electron-app',
        frontendProject: 'electron-web',
        addProxy: false,
        proxyPort: 3000,
        skipFormat: false,
        skipPackageJson: false,
        linter: Linter.None,
        standaloneConfig: false,
        unitTestRunner: 'none',
      });

      expect(tree.exists('apps/electron-web/proxy.conf.json')).toBeTruthy();
      const serve = readJson(tree, 'workspace.json').projects['electron-web']
        .architect.serve;
      expect(serve.options.proxyConfig).toEqual(
        'apps/electron-web/proxy.conf.json'
      );
    });

    it('should configure proxies for multiple node projects with the same frontend app', async () => {
      await angularApplicationGenerator(tree, { name: 'electron-web' });

      await applicationGenerator(tree, {
        name: 'cart',
        frontendProject: 'electron-web',
        addProxy: false,
        proxyPort: 3000,
        skipFormat: false,
        skipPackageJson: false,
        linter: Linter.None,
        standaloneConfig: false,
        unitTestRunner: 'none',
      });

      await applicationGenerator(tree, {
        name: 'billing',
        frontendProject: 'electron-web',
        addProxy: false,
        proxyPort: 3000,
        skipFormat: false,
        skipPackageJson: false,
        linter: Linter.None,
        standaloneConfig: false,
        unitTestRunner: 'none',
      });

      expect(tree.exists('apps/electron-web/proxy.conf.json')).toBeTruthy();

      expect(readJson(tree, 'apps/electron-web/proxy.conf.json')).toEqual({
        '/api': { target: 'http://localhost:3333', secure: false },
        '/billing-api': { target: 'http://localhost:3333', secure: false },
      });
    });

    it('should work with unnormalized project names', async () => {
      await angularApplicationGenerator(tree, { name: 'electronWeb' });

      await applicationGenerator(tree, {
        name: 'electron-app',
        frontendProject: 'electronWeb',
        addProxy: false,
        proxyPort: 3000,
        skipFormat: false,
        skipPackageJson: false,
        linter: Linter.None,
        standaloneConfig: false,
        unitTestRunner: 'none',
      });

      expect(tree.exists('apps/electron-web/proxy.conf.json')).toBeTruthy();
      const serve = readJson(tree, 'workspace.json').projects['electron-web']
        .architect.serve;
      expect(serve.options.proxyConfig).toEqual(
        'apps/electron-web/proxy.conf.json'
      );
    });
  });

    it('should update workspace.json', async () => {
      await applicationGenerator(tree, {
        name: 'electron-app',
        frontendProject: 'electron-web',
        addProxy: false,
        proxyPort: 3000,
        skipFormat: false,
        skipPackageJson: false,
        linter: Linter.None,
        standaloneConfig: false,
        unitTestRunner: 'none',
      } as Schema);
      const workspaceJson = readJson(tree, '/workspace.json');
      const project = workspaceJson.projects['electron-app'];
      const buildTarget = project.architect.build;

      expect(buildTarget.options.main).toEqual('apps/electron-app/src/main.js');
      expect(buildTarget.configurations.production.fileReplacements).toEqual([
        {
          replace: 'apps/electron-app/src/environments/environment.js',
          with: 'apps/electron-app/src/environments/environment.prod.js',
        },
      ]);
    });

  describe('--skipFormat', () => {
    it('should format files by default', async () => {
      jest.spyOn(devkit, 'formatFiles');

      await applicationGenerator(tree, {        
        name: 'electron-app',
        frontendProject: 'electron-web',
        addProxy: false,
        proxyPort: 3000,
        skipFormat: false,
        skipPackageJson: false,
        linter: Linter.None,
        standaloneConfig: false,
        unitTestRunner: 'none', 
      });

      expect(devkit.formatFiles).toHaveBeenCalled();
    });

    it('should not format files when --skipFormat=true', async () => {
      jest.spyOn(devkit, 'formatFiles');

      await applicationGenerator(tree, { 
        name: 'electron-app',
        frontendProject: 'electron-web',
        addProxy: false,
        proxyPort: 3000,
        skipFormat: false,
        skipPackageJson: false,
        linter: Linter.None,
        standaloneConfig: false,
        unitTestRunner: 'none',
      });

      expect(devkit.formatFiles).not.toHaveBeenCalled();
    });
  });
});
