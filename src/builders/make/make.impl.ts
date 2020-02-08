import { BuilderContext, BuilderOutput, createBuilder } from '@angular-devkit/architect';
import { JsonObject, workspaces } from '@angular-devkit/core';
import { NodeJsSyncHost } from '@angular-devkit/core/node';

import { build, Configuration, Platform, Arch, BeforeBuildContext, createTargets } from 'electron-builder';
import { writeFile, statSync, readFileSync } from 'fs';
import { join } from 'path';
import { promisify } from 'util';

import { Observable, from, of } from 'rxjs';
import { map, concatMap, catchError } from 'rxjs/operators';
import { normalizeMakingOptions } from '../../utils/normalize';
import { platform } from 'os';

try {
  require('dotenv').config();
} catch (e) {}

const writeFileAsync = (path: string, data: string) => promisify(writeFile)(path, data);

export interface MakeElectronBuilderOptions extends Configuration {
  name: string;
  frontendProject: string;
  platform: string | string[];
  arch: string;
  asar: boolean;
  root: string;
  out: string;
}

export interface MakeElectronBuilderOutput extends BuilderOutput {
  target?: any;
  outputPath: string | string[];
}

export default createBuilder<JsonObject & MakeElectronBuilderOptions>(run);

function run(options: JsonObject & MakeElectronBuilderOptions, context: BuilderContext): Observable<MakeElectronBuilderOutput> { 
  const baseConfig: Configuration = _createBaseConfig(options, context);
  const platforms: Platform[] = _createPlatforms(options.platform);
  const targets: Map<Platform, Map<Arch, string[]>> = _createTargets(platforms, null, options.arch);

  return from(getSourceRoot(context)).pipe(
    map(sourceRoot =>
      normalizeMakingOptions(options, context.workspaceRoot, sourceRoot)
    ),
    map(options => 
      mergePresetOptions(options)
    ),
    map(options => 
      addMissingDefaultOptions(options)
    ),
    concatMap(async (options) => {
      const config = _createConfigFromOptions(options, baseConfig);
      const outputPath = await build({ targets, config });

      return { success: true, outputPath };
    }),
    catchError(error => {
      console.error(error);

      return of({ success: false, outputPath: null });
    })
  );
}

function _createPlatforms(rawPlatforms: string | string[]): Platform[] {
  const platforms: Platform[] = [];

  if (!rawPlatforms) {
    const platformMap: Map<string, string> = new Map([['win32', 'windows'], ['darwin', 'mac'], ['linux', 'linux']]); 

    rawPlatforms = platformMap.get(platform());
  }

  if (typeof rawPlatforms === 'string') {
    rawPlatforms = [rawPlatforms];
  }

  if (Array.isArray(rawPlatforms)) {
    if (rawPlatforms.includes(Platform.WINDOWS.name)) {
      platforms.push(Platform.WINDOWS);
    }

    if (rawPlatforms.includes(Platform.MAC.name)) {
      platforms.push(Platform.MAC);
    }

    if (rawPlatforms.includes(Platform.LINUX.name)) {
      platforms.push(Platform.LINUX);
    }
  }

  return platforms;
}

function _createTargets(platforms: Platform[], type: string, arch: string): Map<Platform, Map<Arch, string[]>> {
  return createTargets(platforms, null, arch);
}

function _createBaseConfig(options: MakeElectronBuilderOptions, context: BuilderContext): Configuration {
  return {
    directories: {
      output: join(context.workspaceRoot, options.out)
    },
    files: [
      '**/package.json',
      {
          from: `./dist/apps/${options.frontendProject}`,
          to: options.frontendProject,
          filter: ['*.*']
      },
      {
          from: `./dist/apps/${options.name}`,
          to: options.name,
          filter: ['main.js']
      },
      {
          from: `./dist/apps/${options.name}`,
          to: '',
          filter: ['index.js']
      }
    ],
    asar: options.asar || false,
    beforeBuild: (buildContext: BeforeBuildContext) => promisify(writeFile)(            
      join(buildContext.appDir, 'dist', 'apps', options.name, 'index.js'),
      `const Main = require('./${options.name}/main.js');`,
      { encoding: 'utf8' }
    )
  };
}

function _createConfigFromOptions(options: MakeElectronBuilderOptions, baseConfig: Configuration): Configuration {
  const config = Object.assign(options, baseConfig);
      
  delete config.name;
  delete config.frontendProject;
  delete config.platform;
  delete config.arch;
  // delete config.asar;
  delete config.root;
  delete config['sourceRoot'];
  delete config['$schema'];
  delete config.out;

  return config;
}

async function getSourceRoot(context: BuilderContext) {
  const workspaceHost = workspaces.createWorkspaceHost(new NodeJsSyncHost());
  const { workspace } = await workspaces.readWorkspace(
    context.workspaceRoot,
    workspaceHost
  );

  if (workspace.projects.get(context.target.project).sourceRoot) {
    return workspace.projects.get(context.target.project).sourceRoot;
  } else {
    context.reportStatus('Error');
    const message = `${context.target.project} does not have a sourceRoot. Please define one.`;
    context.logger.error(message);
    throw new Error(message);
  }
}

function mergePresetOptions(options: MakeElectronBuilderOptions): MakeElectronBuilderOptions {
  // lead preset options file
  const externalOptionsPath: string = join(options.root, options['sourceRoot'], 'app', 'options', 'maker.options.json');

  if (statSync(externalOptionsPath).isFile()) {
    const rawData = readFileSync(externalOptionsPath, 'utf8')
    const externalOptions = JSON.parse(rawData);
    options = Object.assign(options, externalOptions);
  }

  return options;
}

function addMissingDefaultOptions(options: MakeElectronBuilderOptions): MakeElectronBuilderOptions {
  //todo: add appVersion

  // remove unset options (use electron packager default where possible)
  Object.keys(options).forEach((key) => (options[key] === '') && delete options[key]);

  return options;
}
