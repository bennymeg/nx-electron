import {
  addDependenciesToPackageJson,
  NxJsonConfiguration,
  readJson,
  Tree,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';

import { nxVersion } from '../../utils/versions';
import { generator as initGenerator } from './generator';

describe('init', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should add dependencies', async () => {
    const existing = 'existing';
    const existingVersion = '1.0.0';

    addDependenciesToPackageJson(
      tree,
      {
        '@nx/node': nxVersion,
        [existing]: existingVersion,
      },
      {
        [existing]: existingVersion,
      }
    );
    await initGenerator(tree, { skipFormat: false });

    const packageJson = readJson(tree, 'package.json');
    expect(packageJson.dependencies['@nx/node']).toBeUndefined();
    expect(packageJson.dependencies['tslib']).toBeDefined();
    expect(packageJson.dependencies[existing]).toBeDefined();
    expect(packageJson.devDependencies['@nx/node']).toBeDefined();
    expect(packageJson.devDependencies[existing]).toBeDefined();
  });

  // describe('defaultCollection', () => {
  //   it('should be set if none was set before', async () => {
  //     await initGenerator(tree, {});
  //     const nxJson = readJson<NxJsonConfiguration>(tree, 'nx.json');
  //     expect(nxJson.cli.defaultCollection).toEqual('@nx/node');
  //   });
  // });

  it('should not add jest config if unitTestRunner is none', async () => {
    await initGenerator(tree, { skipFormat: false });
    expect(tree.exists('jest.config.js')).toEqual(false);
  });
});
