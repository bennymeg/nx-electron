import {
  addDependenciesToPackageJson,
  formatFiles,
  GeneratorCallback,
  Tree,
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

  return async () => {
    if (jestInstall) {
      await jestInstall();
    }

    await installTask();
  };
}

export default generator;
