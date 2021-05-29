import { ProjectGraph, readJsonFile } from '@nrwl/workspace';
import { BuildElectronBuilderOptions } from '../builders/build/build.impl';
import { writeJsonFile } from '@nrwl/workspace/src/utilities/fileutils';
import { INDEX_OUTPUT_FILENAME } from './config';

/**
 * Creates a package.json in the output directory for support  to install dependencies within containers.
 *
 * If a package.json exists in the project, it will reuse that.
 *
 * @param projectName
 * @param graph
 * @param options
 * @constructor
 */
export function generatePackageJson(
  projectName: string,
  graph: ProjectGraph,
  options: BuildElectronBuilderOptions
) {
  // default package.json if one does not exist
  let packageJson = {
    name: projectName,
    version: '0.0.1',
    main: INDEX_OUTPUT_FILENAME,
    dependencies: {},
  };

  try {
    // try loading local project package json
    packageJson = readJsonFile(`${options.projectRoot}/package.json`);
    if (!packageJson.dependencies) {
      packageJson.dependencies = {};
    }
  } catch (e) {}

  const rootPackageJson = readJsonFile(`${options.root}/package.json`);
  const npmDeps = findAllNpmDeps(projectName, graph);
  const implicitDeps = findAllNpmImplicitDeps(rootPackageJson, options.implicitDependencies);
  const dependencies = Object.assign({}, implicitDeps, npmDeps);

  packageJson.version = rootPackageJson.version || '0.0.0';
  packageJson['author'] = rootPackageJson.author || '';
  packageJson['description'] = rootPackageJson.description || '';
  packageJson['license'] = rootPackageJson.license || 'UNLICENSED';
  packageJson['private'] = rootPackageJson.private || true;

  // update dependencies
  Object.entries(dependencies).forEach(([packageName, version]) => {
    // don't include devDeps
    if (rootPackageJson.devDependencies?.[packageName]) {
      return;
    }

    packageJson.dependencies[packageName] = version;
  });

  writeJsonFile(`${options.outputPath}/package.json`, packageJson);
}

function findAllNpmDeps(
  projectName: string,
  graph: ProjectGraph,
  list: { [packageName: string]: string } = {},
  seen = new Set<string>()
) {
  if (seen.has(projectName)) {
    return list;
  }

  seen.add(projectName);

  const node = graph.nodes[projectName];

  if (node.type === 'npm') {
    list[node.data.packageName] = node.data.version;
  }
  graph.dependencies[projectName]?.forEach((dep) => {
    findAllNpmDeps(dep.target, graph, list, seen);
  });

  return list;
}

 function findAllNpmImplicitDeps(packageJson, implicitDeps: Array<string>) {

  const dependencies = implicitDeps.reduce((acc, dep) => {
    acc[dep] = packageJson.dependencies[dep];
    return acc;
  }, {});

  return dependencies;
}
