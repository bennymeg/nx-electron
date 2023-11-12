import {
  addDependenciesToPackageJson,
  formatFiles,
  GeneratorCallback,
  Tree,
  updateJson,
} from '@nx/devkit';
import { Schema } from './schema';
import { nxElectronVersion, electronVersion } from '../../utils/versions';
import { jestInitGenerator } from '@nx/jest';

function addDependencies(tree: Tree) {
  return addDependenciesToPackageJson(
    tree,
    {},
    {
      'nx-electron': nxElectronVersion,
      electron: electronVersion,
    }
  );
}

function addScripts(tree: Tree) {
  return updateJson(tree, 'package.json', (json) => {
    json.scripts = json.scripts || {};

    const postinstall = json.scripts['postinstall'];

    json.scripts['postinstall'] =
      postinstall && postinstall !== ''
        ? `${postinstall} && electron-builder install-app-deps`
        : 'electron-builder install-app-deps';

    return json;
  });
}

function normalizeOptions(schema: Schema) {
  return {
    ...schema,
    unitTestRunner: schema.unitTestRunner ?? 'jest',
  };
}

export async function generator(tree: Tree, schema: Schema) {
  const options = normalizeOptions(schema);

  let jestInstall: GeneratorCallback;
  if (options.unitTestRunner === 'jest') {
    jestInstall = await jestInitGenerator(tree, {});
  }

  const installTask = addDependencies(tree);

  if (!options.skipFormat) {
    await formatFiles(tree);
  }

  if (jestInstall) {
    await jestInstall();
  }

  addScripts(tree);
  await installTask();

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  return async () => {
  };
}

export default generator;
