import {
  addProjectConfiguration,
  formatFiles,
  generateFiles,
  GeneratorCallback,
  getWorkspaceLayout,
  joinPathFragments,
  names,
  offsetFromRoot,
  ProjectConfiguration,
  readProjectConfiguration,
  readWorkspaceConfiguration,
  stripIndents,
  TargetConfiguration,
  Tree,
  updateProjectConfiguration,
  updateWorkspaceConfiguration,
} from '@nrwl/devkit';

import { join } from 'path';

import { Linter, lintProjectGenerator } from '@nrwl/linter';
import { jestProjectGenerator } from '@nrwl/jest';
import { runTasksInSerial } from '@nrwl/workspace/src/utilities/run-tasks-in-serial';

import { Schema } from './schema';
import { generator as initGenerator } from '../init/generator';

export interface NormalizedSchema extends Schema {
  appProjectRoot: string;
  parsedTags: string[];
}

function getBuildConfig(
  project: ProjectConfiguration,
  options: NormalizedSchema
): TargetConfiguration {
  return {
    executor: 'nx-electron:build',
    outputs: ['{options.outputPath}'],
    options: {
      outputPath: joinPathFragments('dist', options.appProjectRoot),
      main: joinPathFragments(project.sourceRoot, 'main.ts'),
      tsConfig: joinPathFragments(options.appProjectRoot, 'tsconfig.app.json'),
      assets: [joinPathFragments(project.sourceRoot, 'assets')],
    },
    configurations: {
      production: {
        optimization: true,
        extractLicenses: true,
        inspect: false,
        fileReplacements: [
          {
            replace: joinPathFragments(
              project.sourceRoot,
              'environments/environment.ts'
            ),
            with: joinPathFragments(
              project.sourceRoot,
              'environments/environment.prod.ts'
            ),
          },
        ],
      },
    },
  };
}

function getServeConfig(options: NormalizedSchema): TargetConfiguration {
  return {
    executor: 'nx-electron:execute',
    options: {
      buildTarget: `${options.name}:build`,
    },
  };
}

function getPackageConfig(options: NormalizedSchema): TargetConfiguration {
  return {
    executor: 'nx-electron:package',
    options: {
      name: options.name,
      frontendProject: options.frontendProject,
      outputPath: 'dist/packages',
      prepackageOnly: true,
    },
  };
}

function getMakeConfig(options: NormalizedSchema): TargetConfiguration {
  return {
    executor: 'nx-electron:make',
    options: {
      name: options.name,
      frontendProject: options.frontendProject,
      outputPath: 'dist/executables',
    },
  };
}

function addProject(tree: Tree, options: NormalizedSchema) {
  const project: ProjectConfiguration = {
    root: options.appProjectRoot,
    sourceRoot: joinPathFragments(options.appProjectRoot, 'src'),
    projectType: 'application',
    targets: {},
    // tags: options.parsedTags,
  };
  project.targets.build = getBuildConfig(project, options);
  project.targets.serve = getServeConfig(options);
  project.targets.package = getPackageConfig(options);
  project.targets.make = getMakeConfig(options);

  addProjectConfiguration(
    tree,
    options.name,
    project,
    options.standaloneConfig
  );

  const workspace = readWorkspaceConfiguration(tree);

  if (!workspace.defaultProject) {
    workspace.defaultProject = options.name;
    updateWorkspaceConfiguration(tree, workspace);
  }
}

function updateConstantsFile(tree: Tree, options: NormalizedSchema) {
  tree.write(
    join(options.appProjectRoot, 'src/app/constants.ts'),
    stripIndents`export const rendererAppPort = 4200;
    export const rendererAppName = '${
      options.frontendProject || options.name.split('-')[0] + '-web'
    }';
    export const electronAppName = '${options.name}';
    export const updateServerUrl = 'https://deployment-server-url.com';         // TODO: insert your update server url here
    `
  );
}

function addAppFiles(tree: Tree, options: NormalizedSchema) {
  generateFiles(tree, join(__dirname, './files/app'), options.appProjectRoot, {
    tmpl: '',
    name: options.name,
    root: options.appProjectRoot,
    offset: offsetFromRoot(options.appProjectRoot),
  });
}

function addProxy(tree: Tree, options: NormalizedSchema) {
  const projectConfig = readProjectConfiguration(tree, options.frontendProject);
  if (projectConfig.targets && projectConfig.targets.serve) {
    const pathToProxyFile = `${projectConfig.root}/proxy.conf.json`;
    projectConfig.targets.serve.options = {
      ...projectConfig.targets.serve.options,
      proxyConfig: pathToProxyFile,
    };

    if (!tree.exists(pathToProxyFile)) {
      tree.write(
        pathToProxyFile,
        JSON.stringify(
          {
            '/api': {
              target: `http://localhost:${options.proxyPort || 3000}`,
              secure: false,
            },
          },
          null,
          2
        )
      );
    } else {
      //add new entry to existing config
      const proxyFileContent = tree.read(pathToProxyFile).toString();

      const proxyModified = {
        ...JSON.parse(proxyFileContent),
        [`/${options.name}-api`]: {
          target: `http://localhost:${options.proxyPort || 3000}`,
          secure: false,
        },
      };

      tree.write(pathToProxyFile, JSON.stringify(proxyModified, null, 2));
    }

    updateProjectConfiguration(tree, options.frontendProject, projectConfig);
  }
}

export async function addLintingToApplication(
  tree: Tree,
  options: NormalizedSchema
): Promise<GeneratorCallback> {
  const lintTask = await lintProjectGenerator(tree, {
    linter: options.linter,
    project: options.name,
    tsConfigPaths: [
      joinPathFragments(options.appProjectRoot, 'tsconfig.app.json'),
    ],
    eslintFilePatterns: [`${options.appProjectRoot}/**/*.ts`],
    skipFormat: true,
    setParserOptionsProject: options.setParserOptionsProject,
  });

  return lintTask;
}

export async function generator(tree: Tree, schema: Schema) {
  const options = normalizeOptions(tree, schema);

  const tasks: GeneratorCallback[] = [];
  const initTask = await initGenerator(tree, {
    ...options,
    skipFormat: true,
  });
  tasks.push(initTask);

  addAppFiles(tree, options);
  updateConstantsFile(tree, options);
  addProject(tree, options);

  if (options.linter !== Linter.None) {
    const lintTask = await addLintingToApplication(tree, {
      ...options,
      skipFormat: true,
    });
    tasks.push(lintTask);
  }

  if (options.unitTestRunner === 'jest') {
    const jestTask = await jestProjectGenerator(tree, {
      project: options.name,
      setupFile: 'none',
      skipSerializers: true,
      supportTsx: false,
      babelJest: false,
      testEnvironment: 'node',
      skipFormat: true,
    });
    tasks.push(jestTask);
  }

  if (options.frontendProject) {
    addProxy(tree, options);
  }

  if (!options.skipFormat) {
    await formatFiles(tree);
  }

  return runTasksInSerial(...tasks);
}

function normalizeOptions(host: Tree, options: Schema): NormalizedSchema {
  const { appsDir } = getWorkspaceLayout(host);

  const appDirectory = options.directory
    ? `${names(options.directory).fileName}/${names(options.name).fileName}`
    : names(options.name).fileName;

  const appProjectName = appDirectory.replace(new RegExp('/', 'g'), '-');

  const appProjectRoot = joinPathFragments(appsDir, appDirectory);

  const parsedTags = options.tags
    ? options.tags.split(',').map((s) => s.trim())
    : [];

  return {
    ...options,
    name: names(appProjectName).fileName,
    frontendProject: options.frontendProject
      ? names(options.frontendProject).fileName
      : undefined,
    appProjectRoot,
    parsedTags,
    linter: options.linter ?? Linter.EsLint,
    unitTestRunner: options.unitTestRunner ?? 'jest',
  };
}

export default generator;
