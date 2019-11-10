import { Tree } from '@angular-devkit/schematics';
import * as stripJsonComments from 'strip-json-comments';
import { createEmptyWorkspace, getFileContent } from '@nrwl/workspace/testing';
import { runSchematic } from '../../utils/testing';
import { NxJson, readJsonInTree } from '@nrwl/workspace';
import { createApp } from '../../utils/testing.angular';

describe('app', () => {
  let appTree: Tree;

  beforeEach(() => {
    appTree = Tree.empty();
    appTree = createEmptyWorkspace(appTree);
  });

  describe('not nested', () => {
    it('should update workspace.json', async () => {
      const tree = await runSchematic('app', { name: 'myElectronApp' }, appTree);
      const workspaceJson = readJsonInTree(tree, '/workspace.json');
      const project = workspaceJson.projects['my-electron-app'];
      expect(project.root).toEqual('apps/my-electron-app');
      expect(project.architect).toEqual(
        jasmine.objectContaining({
          build: {
            builder: 'nx-electron:build',
            options: {
              outputPath: 'dist/apps/my-electron-app',
              main: 'apps/my-electron-app/src/main.ts',
              tsConfig: 'apps/my-electron-app/tsconfig.app.json',
              assets: ['apps/my-electron-app/src/assets']
            },
            configurations: {
              production: {
                optimization: true,
                extractLicenses: true,
                inspect: false,
                fileReplacements: [
                  {
                    replace: 'apps/my-electron-app/src/environments/environment.ts',
                    with:
                      'apps/my-electron-app/src/environments/environment.prod.ts'
                  }
                ]
              }
            }
          },
          serve: {
            builder: 'nx-electron:execute',
            options: {
              buildTarget: 'my-electron-app:build'
            }
          }
        })
      );
      expect(workspaceJson.projects['my-electron-app'].architect.lint).toEqual({
        builder: '@angular-devkit/build-angular:tslint',
        options: {
          tsConfig: [
            'apps/my-electron-app/tsconfig.app.json',
            'apps/my-electron-app/tsconfig.spec.json'
          ],
          exclude: ['**/node_modules/**', '!apps/my-electron-app/**']
        }
      });
      expect(workspaceJson.projects['my-electron-app-e2e']).toBeUndefined();
      expect(workspaceJson.defaultProject).toEqual('my-electron-app');
    });

    it('should update nx.json', async () => {
      const tree = await runSchematic(
        'app',
        { name: 'myElectronApp', tags: 'one,two' },
        appTree
      );
      const nxJson = readJsonInTree<NxJson>(tree, '/nx.json');
      expect(nxJson).toEqual({
        npmScope: 'proj',
        projects: {
          'my-electron-app': {
            tags: ['one', 'two']
          }
        }
      });
    });

    it('should generate files', async () => {
      const tree = await runSchematic('app', { name: 'myElectronApp' }, appTree);
      expect(tree.exists(`apps/my-electron-app/jest.config.js`)).toBeTruthy();
      expect(tree.exists('apps/my-electron-app/src/main.ts')).toBeTruthy();

      const tsconfig = readJsonInTree(tree, 'apps/my-electron-app/tsconfig.json');
      expect(tsconfig.extends).toEqual('../../tsconfig.json');
      expect(tsconfig.compilerOptions.types).toContain('node');
      expect(tsconfig.compilerOptions.types).toContain('jest');

      const tsconfigApp = JSON.parse(
        stripJsonComments(
          getFileContent(tree, 'apps/my-electron-app/tsconfig.app.json')
        )
      );
      expect(tsconfigApp.compilerOptions.outDir).toEqual('../../dist/out-tsc');
      expect(tsconfigApp.extends).toEqual('./tsconfig.json');

      const tslintJson = JSON.parse(
        stripJsonComments(getFileContent(tree, 'apps/my-electron-app/tslint.json'))
      );
      expect(tslintJson.extends).toEqual('../../tslint.json');
    });
  });

  describe('nested', () => {
    it('should update workspace.json', async () => {
      const tree = await runSchematic(
        'app',
        { name: 'myElectronApp', directory: 'myDir' },
        appTree
      );
      const workspaceJson = readJsonInTree(tree, '/workspace.json');

      expect(workspaceJson.projects['my-dir-my-electron-app'].root).toEqual(
        'apps/my-dir/my-electron-app'
      );

      expect(
        workspaceJson.projects['my-dir-my-electron-app'].architect.lint
      ).toEqual({
        builder: '@angular-devkit/build-angular:tslint',
        options: {
          tsConfig: [
            'apps/my-dir/my-electron-app/tsconfig.app.json',
            'apps/my-dir/my-electron-app/tsconfig.spec.json'
          ],
          exclude: ['**/node_modules/**', '!apps/my-dir/my-electron-app/**']
        }
      });

      expect(workspaceJson.projects['my-dir-my-electron-app-e2e']).toBeUndefined();
      expect(workspaceJson.defaultProject).toEqual('my-dir-my-electron-app');
    });

    it('should update nx.json', async () => {
      const tree = await runSchematic(
        'app',
        { name: 'myElectronApp', directory: 'myDir', tags: 'one,two' },
        appTree
      );
      const nxJson = readJsonInTree<NxJson>(tree, '/nx.json');
      expect(nxJson).toEqual({
        npmScope: 'proj',
        projects: {
          'my-dir-my-electron-app': {
            tags: ['one', 'two']
          }
        }
      });
    });

    it('should generate files', async () => {
      const hasJsonValue = ({ path, expectedValue, lookupFn }) => {
        const content = getFileContent(tree, path);
        const config = JSON.parse(stripJsonComments(content));

        expect(lookupFn(config)).toEqual(expectedValue);
      };
      const tree = await runSchematic(
        'app',
        { name: 'myElectronApp', directory: 'myDir' },
        appTree
      );

      // Make sure these exist
      [
        `apps/my-dir/my-electron-app/jest.config.js`,
        'apps/my-dir/my-electron-app/src/main.ts'
      ].forEach(path => {
        expect(tree.exists(path)).toBeTruthy();
      });

      // Make sure these have properties
      [
        {
          path: 'apps/my-dir/my-electron-app/tsconfig.json',
          lookupFn: json => json.extends,
          expectedValue: '../../../tsconfig.json'
        },
        {
          path: 'apps/my-dir/my-electron-app/tsconfig.app.json',
          lookupFn: json => json.compilerOptions.outDir,
          expectedValue: '../../../dist/out-tsc'
        },
        {
          path: 'apps/my-dir/my-electron-app/tsconfig.app.json',
          lookupFn: json => json.compilerOptions.types,
          expectedValue: ['node']
        },
        {
          path: 'apps/my-dir/my-electron-app/tslint.json',
          lookupFn: json => json.extends,
          expectedValue: '../../../tslint.json'
        }
      ].forEach(hasJsonValue);
    });
  });

  describe('--unit-test-runner none', () => {
    it('should not generate test configuration', async () => {
      const tree = await runSchematic(
        'app',
        { name: 'myElectronApp', unitTestRunner: 'none' },
        appTree
      );
      expect(tree.exists('apps/my-electron-app/src/test-setup.ts')).toBeFalsy();
      expect(tree.exists('apps/my-electron-app/src/test.ts')).toBeFalsy();
      expect(tree.exists('apps/my-electron-app/tsconfig.spec.json')).toBeFalsy();
      expect(tree.exists('apps/my-electron-app/jest.config.js')).toBeFalsy();
      const workspaceJson = readJsonInTree(tree, 'workspace.json');
      expect(
        workspaceJson.projects['my-electron-app'].architect.test
      ).toBeUndefined();
      expect(
        workspaceJson.projects['my-electron-app'].architect.lint.options.tsConfig
      ).toEqual(['apps/my-electron-app/tsconfig.app.json']);
    });
  });

  describe('frontendProject', () => {
    it('should configure proxy', async () => {
      appTree = createApp(appTree, 'my-frontend');

      const tree = await runSchematic(
        'app',
        { name: 'myElectronApp', frontendProject: 'my-frontend' },
        appTree
      );

      expect(tree.exists('apps/my-frontend/proxy.conf.json')).toBeTruthy();
      const serve = JSON.parse(tree.readContent('workspace.json')).projects[
        'my-frontend'
      ].architect.serve;
      expect(serve.options.proxyConfig).toEqual(
        'apps/my-frontend/proxy.conf.json'
      );
    });

    it('should work with unnormalized project names', async () => {
      appTree = createApp(appTree, 'myFrontend');

      const tree = await runSchematic(
        'app',
        { name: 'myElectronApp', frontendProject: 'myFrontend' },
        appTree
      );

      expect(tree.exists('apps/my-frontend/proxy.conf.json')).toBeTruthy();
      const serve = JSON.parse(tree.readContent('workspace.json')).projects[
        'my-frontend'
      ].architect.serve;
      expect(serve.options.proxyConfig).toEqual(
        'apps/my-frontend/proxy.conf.json'
      );
    });
  });
});
