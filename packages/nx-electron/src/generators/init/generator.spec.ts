import { readJson, Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';

import { electronVersion, nxElectronVersion } from '../../utils/versions';
import { generator as initGenerator } from './generator';

describe('init', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should add dependencies', async () => {
    await initGenerator(tree, { skipFormat: false });

    const packageJson = readJson(tree, 'package.json');

    expect(packageJson.devDependencies['nx-electron']).toBe(nxElectronVersion);
    expect(packageJson.devDependencies['electron']).toBe(electronVersion);
  });

  it('should not add jest config if unitTestRunner is none', async () => {
    await initGenerator(tree, { skipFormat: false, unitTestRunner: 'none' });
    expect(tree.exists('jest.config.js')).toEqual(false);
  });

  it('should add an nxe:package:app script that runs make with --prepackageOnly', async () => {
    // the application generator passes its own options (incl. the app name) on
    const options = { skipFormat: false, name: 'electron-app' };
    await initGenerator(tree, options);

    const packageJson = readJson(tree, 'package.json');

    expect(packageJson.scripts['nxe:package:app']).toBe(
      'nx run electron-app:make --prepackageOnly',
    );
  });
});
