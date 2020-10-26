import { apply, chain, externalSchematic, mergeWith, move, noop, SchematicContext, template, Tree, url, Rule } from '@angular-devkit/schematics';
import { join, normalize, Path } from '@angular-devkit/core';
import { Schema } from './schema';
import { updateJsonInTree, updateWorkspaceInTree, generateProjectLint, addLintFiles } from '@nrwl/workspace';
import { toFileName } from '@nrwl/workspace';
import { getProjectConfig } from '@nrwl/workspace';
import { offsetFromRoot } from '@nrwl/workspace';
import init from '../init/init';

interface NormalizedSchema extends Schema {
  appProjectRoot: Path;
  parsedTags: string[];
}

function updateNxJson(options: NormalizedSchema): Rule {
  return updateJsonInTree(`/nx.json`, json => {
    return {
      ...json,
      projects: {
        ...json.projects,
        [options.name]: { tags: options.parsedTags }
      }
    };
  });
}

function getBuildConfig(project: any, options: NormalizedSchema) {
  return {
    builder: 'nx-electron:build',
    options: {
      outputPath: join(normalize('dist'), options.appProjectRoot),
      main: join(project.sourceRoot, 'main.ts'),
      tsConfig: join(options.appProjectRoot, 'tsconfig.app.json'),
      assets: [join(project.sourceRoot, 'assets')]
    },
    configurations: {
      production: {
        optimization: true,
        extractLicenses: true,
        inspect: false,
        fileReplacements: [
          {
            replace: join(project.sourceRoot, 'environments/environment.ts'),
            with: join(project.sourceRoot, 'environments/environment.prod.ts')
          }
        ]
      }
    }
  };
}

function getServeConfig(options: NormalizedSchema) {
  return {
    builder: 'nx-electron:execute',
    options: {
      buildTarget: `${options.name}:build`
    }
  };
}

function getPackageConfig(options: NormalizedSchema) {
  return {
    builder: 'nx-electron:package',
    options: {
      name: options.name,
      frontendProject: options.frontendProject,
      out: 'dist/packages'
    }
  };
}

function getMakeConfig(options: NormalizedSchema) {
  return {
    builder: 'nx-electron:make',
    options: {
      name: options.name,
      frontendProject: options.frontendProject,
      out: 'dist/executables'
    }
  };
}

function updateWorkspaceJson(options: NormalizedSchema): Rule {
  return updateWorkspaceInTree(workspaceJson => {
    const project = {
      root: options.appProjectRoot,
      sourceRoot: join(options.appProjectRoot, 'src'),
      projectType: 'application',
      prefix: options.name,
      schematics: {},
      architect: <any>{}
    };

    project.architect.build = getBuildConfig(project, options);
    project.architect.serve = getServeConfig(options);
    project.architect.package = getPackageConfig(options);
    project.architect.make = getMakeConfig(options);
    project.architect.lint = generateProjectLint(
      normalize(project.root),
      join(normalize(project.root), 'tsconfig.app.json'),
      options.linter,
      [`${options.appProjectRoot}/**/*.ts`]
    );

    workspaceJson.projects[options.name] = project;

    workspaceJson.defaultProject = workspaceJson.defaultProject || options.name;

    return workspaceJson;
  });
}

function updateConstantsFile(options: NormalizedSchema): Rule {
  return (host: Tree) => {
    host.overwrite(
      join(options.appProjectRoot, 'src/app/constants.ts'),
`export const rendererAppPort = 4200;
export const rendererAppName = '${options.frontendProject || options.name.split('-')[0] + '-web'}';
export const electronAppName = '${options.name}';
export const updateServerUrl = 'https://deployment-server-url.com';         // TODO: insert your update server url here
`
    );
  };
}

function addAppFiles(options: NormalizedSchema): Rule {
  return mergeWith(
    apply(url(`./files/app`), [
      template({
        tmpl: '',
        name: options.name,
        root: options.appProjectRoot,
        offset: offsetFromRoot(options.appProjectRoot)
      }),
      move(options.appProjectRoot)
    ])
  );
}

function addProxy(options: NormalizedSchema): Rule {
  return (host: Tree, context: SchematicContext) => {
    const projectConfig = getProjectConfig(host, options.frontendProject);
    if (projectConfig.architect && projectConfig.architect.serve) {
      const pathToProxyFile = `${projectConfig.root}/proxy.conf.json`;
      host.create(
        pathToProxyFile,
        JSON.stringify(
          {
            '/api': {
              target: `http://localhost:${options.proxyPort || 3000}`,
              secure: false
            }
          },
          null,
          2
        )
      );

      updateWorkspaceInTree(json => {
        projectConfig.architect.serve.options.proxyConfig = pathToProxyFile;
        json.projects[options.frontendProject] = projectConfig;
        return json;
      })(host, context);
    }
  };
}

export default function(schema: Schema): Rule {
  return (host: Tree, context: SchematicContext) => {
    const options = normalizeOptions(schema);
    return chain([
      init({
        skipFormat: true
      }),
      addLintFiles(options.appProjectRoot, options.linter),
      addAppFiles(options),
      updateConstantsFile(options),
      updateWorkspaceJson(options),
      updateNxJson(options),
      options.unitTestRunner === 'jest'
        ? externalSchematic('@nrwl/jest', 'jest-project', {
            project: options.name,
            setupFile: 'none',
            skipSerializers: true
          })
        : noop(),
      options.addProxy ? addProxy(options) : noop()
    ])(host, context);
  };
}

function normalizeOptions(options: Schema): NormalizedSchema {
  const appDirectory = options.directory
    ? `${toFileName(options.directory)}/${toFileName(options.name)}`
    : toFileName(options.name);

  const appProjectName = appDirectory.replace(new RegExp('/', 'g'), '-');

  const appProjectRoot = join(normalize('apps'), appDirectory);

  const parsedTags = options.tags
    ? options.tags.split(',').map(s => s.trim())
    : [];

  return {
    ...options,
    name: toFileName(appProjectName),
    frontendProject: options.frontendProject
      ? toFileName(options.frontendProject)
      : undefined,
    appProjectRoot,
    parsedTags
  };
}
