import { addDependenciesToPackageJson, convertNxGenerator, formatFiles, GeneratorCallback, Tree, updateJson } from '@nrwl/devkit';
import { Schema } from './schema';
import { nxElectronVersion, electronVersion, electronBuilderVersion, rimrafVersion, exitZeroVersion } from '../../utils/versions';
import { setDefaultCollection } from '@nrwl/workspace/src/utilities/set-default-collection';
import { jestInitGenerator } from '@nrwl/jest';


function addDependencies(tree: Tree) {
  return addDependenciesToPackageJson(
    tree,
    {},
    {
      'nx-electron': nxElectronVersion,
      'electron': electronVersion,
      'exitzero': exitZeroVersion,
      // 'electron-builder': electronBuilderVersion,
      // 'rimraf': rimrafVersion
    }
  );
}

function moveDependency(tree: Tree) {
  return updateJson(tree, 'package.json', json => {
    json.dependencies = json.dependencies || {};

    delete json.dependencies['nx-electron'];
    delete json.dependencies['electron'];
    // delete json.dependencies['electron-builder'];
    // delete json.dependencies['rimraf'];

    return json;
  });
}

function addScripts(tree: Tree) {
  return updateJson(tree, 'package.json', json => {
    json.scripts = json.scripts || {};

    json.scripts["postinstall"] = "exitzero electron-builder install-app-deps";

    return json;
  });
}

function normalizeOptions(schema: Schema) {
  return {
    ...schema,
    unitTestRunner: schema.unitTestRunner ?? 'jest',
  };
}

export async function initGenerator(tree: Tree, schema: Schema) {
  const options = normalizeOptions(schema);

  setDefaultCollection(tree, 'nx-electron');

  let jestInstall: GeneratorCallback;
  if (options.unitTestRunner === 'jest') {
    jestInstall = await jestInitGenerator(tree, {});
  }

  const installTask = await addDependencies(tree);

  if (!options.skipFormat) {
    await formatFiles(tree);
  }

  return async () => {
    if (jestInstall) {
      await jestInstall();
    }

    await addScripts(tree);
    await installTask();
    await moveDependency(tree);
  };
}

export default initGenerator;
export const initSchematic = convertNxGenerator(initGenerator);
