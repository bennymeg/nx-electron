import {
  addProjectConfiguration,
  formatFiles,
  generateFiles,
  GeneratorCallback,
  joinPathFragments,
  names,
  offsetFromRoot,
  ProjectConfiguration,
  readProjectConfiguration,
  stripIndents,
  TargetConfiguration,
  Tree,
  updateJson,
  updateProjectConfiguration,
  runTasksInSerial,
  writeJson,
} from '@nx/devkit';
import {
  addBuildTargetDefaults,
  determineProjectNameAndRootOptions,
  ensureRootProjectName,
} from '@nx/devkit/internal';
import {
  addProjectToTsSolutionWorkspace,
  isUsingTsSolutionSetup,
  TS_SOLUTION_SETUP_TSCONFIG_INPUT,
  updateTsconfigFiles,
} from '@nx/js/internal';

import { join } from 'path';

import { Linter, lintProjectGenerator } from '@nx/eslint';
import { configurationGenerator } from '@nx/jest';

import { Schema } from './schema';
import { generator as initGenerator } from '../init/generator';

export interface NormalizedSchema extends Schema {
  name: string;
  appProjectRoot: string;
  importPath: string;
  outputPath: string;
  parsedTags: string[];
  isUsingTsSolutionConfig: boolean;
  useProjectJson: boolean;
}

function getBuildConfig(
  project: ProjectConfiguration,
  options: NormalizedSchema,
): TargetConfiguration {
  return {
    executor: 'nx-electron:build',
    outputs: ['{options.outputPath}'],
    options: {
      outputPath: options.outputPath,
      main: joinPathFragments(project.sourceRoot, 'main.ts'),
      tsConfig: joinPathFragments(options.appProjectRoot, 'tsconfig.app.json'),
      assets: [joinPathFragments(project.sourceRoot, 'assets')],
    },
    configurations: {
      production: {
        optimization: true,
        extractLicenses: true,
        fileReplacements: [
          {
            replace: joinPathFragments(
              project.sourceRoot,
              'environments/environment.ts',
            ),
            with: joinPathFragments(
              project.sourceRoot,
              'environments/environment.prod.ts',
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
    continuous: true,
    options: {
      buildTarget: `${options.name}:build`,
    },
  };
}

function getPackagingDependsOn(
  options: NormalizedSchema,
): TargetConfiguration['dependsOn'] {
  return options.frontendProject
    ? ['build', { projects: [options.frontendProject], target: 'build' }]
    : ['build'];
}

function getPackageConfig(options: NormalizedSchema): TargetConfiguration {
  return {
    executor: 'nx-electron:package',
    dependsOn: getPackagingDependsOn(options),
    options: {
      name: options.name,
      frontendProject: options.frontendProject || '',
      sourcePath: 'dist/apps',
      outputPath: 'dist/packages',
      prepackageOnly: true,
    },
  };
}

function getMakeConfig(options: NormalizedSchema): TargetConfiguration {
  return {
    executor: 'nx-electron:make',
    dependsOn: getPackagingDependsOn(options),
    options: {
      name: options.name,
      frontendProject: options.frontendProject || '',
      sourcePath: 'dist/apps',
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
    tags: options.parsedTags.length ? options.parsedTags : undefined,
  };
  project.targets.build = getBuildConfig(project, options);
  project.targets.serve = getServeConfig(options);
  project.targets.package = getPackageConfig(options);
  project.targets.make = getMakeConfig(options);

  const packageJson: Record<string, unknown> = {
    name: options.importPath,
    version: '0.0.1',
    private: true,
  };

  if (options.useProjectJson) {
    addProjectConfiguration(tree, options.name, project);
  } else {
    packageJson.nx = {
      name: options.name !== options.importPath ? options.name : undefined,
      targets: project.targets,
      tags: project.tags,
    };
  }

  if (!options.useProjectJson || options.isUsingTsSolutionConfig) {
    writeJson(
      tree,
      joinPathFragments(options.appProjectRoot, 'package.json'),
      packageJson,
    );
  }

  addBuildTargetDefaults(tree, 'nx-electron:build', 'build', [
    TS_SOLUTION_SETUP_TSCONFIG_INPUT,
  ]);
}

function updateConstantsFile(tree: Tree, options: NormalizedSchema) {
  const rendererAppName = !options.frontendProject
    ? ''
    : options.frontendProject;

  tree.write(
    join(options.appProjectRoot, 'src/app/constants.ts'),
    stripIndents`export const rendererAppPort = 4200;
    export const rendererAppName = '${rendererAppName}';                        // options.name.split('-')[0] + '-web'
    export const electronAppName = '${options.name}';
    export const updateServerUrl = 'https://deployment-server-url.com';         // TODO: insert your update server url here
    `,
  );
}

function addAppFiles(tree: Tree, options: NormalizedSchema) {
  generateFiles(tree, join(__dirname, './files/app'), options.appProjectRoot, {
    tmpl: '',
    name: options.name,
    root: options.appProjectRoot,
    offset: offsetFromRoot(options.appProjectRoot),
  });

  if (options.isUsingTsSolutionConfig) {
    // solution style tsconfig.json, as generated by the Nx application generators
    writeJson(
      tree,
      joinPathFragments(options.appProjectRoot, 'tsconfig.json'),
      {
        extends: joinPathFragments(
          offsetFromRoot(options.appProjectRoot),
          'tsconfig.base.json',
        ),
        files: [],
        include: [],
        references: [{ path: './tsconfig.app.json' }],
      },
    );
    updateJson(
      tree,
      joinPathFragments(options.appProjectRoot, 'tsconfig.app.json'),
      (json) => ({ ...json, include: ['src/**/*.ts'] }),
    );
  }
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
          2,
        ),
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

async function addLintingToApplication(
  tree: Tree,
  options: NormalizedSchema,
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
  const options = await normalizeOptions(tree, schema);

  const tasks: GeneratorCallback[] = [];
  const initTask = await initGenerator(tree, {
    ...options,
    skipFormat: true,
  });
  tasks.push(initTask);

  addAppFiles(tree, options);
  updateConstantsFile(tree, options);
  addProject(tree, options);

  if (options.isUsingTsSolutionConfig) {
    await addProjectToTsSolutionWorkspace(tree, options.appProjectRoot);
  }

  if (options.linter !== Linter.None) {
    const lintTask = await addLintingToApplication(tree, {
      ...options,
      skipFormat: true,
    });
    tasks.push(lintTask);
  }

  if (options.unitTestRunner === 'jest') {
    const jestTask = await configurationGenerator(tree, {
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

  if (options.frontendProject && options.addProxy) {
    addProxy(tree, options);
  }

  // Sets rootDir, which TypeScript 6 requires and the TS solution setup's
  // tsconfig.base.json does not define, and adds the root tsconfig.json reference.
  updateTsconfigFiles(
    tree,
    options.appProjectRoot,
    'tsconfig.app.json',
    {},
    options.linter === Linter.EsLint
      ? ['eslint.config.js', 'eslint.config.cjs', 'eslint.config.mjs']
      : undefined,
  );

  if (!options.skipFormat) {
    await formatFiles(tree);
  }

  return runTasksInSerial(...tasks);
}

async function normalizeOptions(
  host: Tree,
  options: Schema,
): Promise<NormalizedSchema> {
  await ensureRootProjectName(options, 'application');
  const {
    projectName,
    projectRoot: appProjectRoot,
    importPath,
  } = await determineProjectNameAndRootOptions(host, {
    name: options.name,
    projectType: 'application',
    directory: options.directory,
  });

  const parsedTags = options.tags
    ? options.tags.split(',').map((s) => s.trim())
    : [];

  const isUsingTsSolutionConfig = isUsingTsSolutionSetup(host);

  return {
    ...options,
    name: !isUsingTsSolutionConfig || options.name ? projectName : importPath,
    frontendProject: options.frontendProject
      ? names(options.frontendProject).fileName
      : undefined,
    appProjectRoot,
    importPath,
    outputPath: isUsingTsSolutionConfig
      ? joinPathFragments(appProjectRoot, 'dist')
      : joinPathFragments('dist', appProjectRoot),
    parsedTags,
    addProxy: options.addProxy ?? true,
    isUsingTsSolutionConfig,
    useProjectJson: options.useProjectJson ?? !isUsingTsSolutionConfig,
    linter: options.linter ?? Linter.EsLint,
    unitTestRunner: options.unitTestRunner ?? 'jest',
  };
}

export default generator;
