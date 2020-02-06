import { BuilderContext, BuilderOutput, createBuilder } from '@angular-devkit/architect';
import { JsonObject, workspaces } from '@angular-devkit/core';
import { NodeJsSyncHost } from '@angular-devkit/core/node';

import { build, Configuration, Platform, Arch, archFromString } from 'electron-builder';
import { writeFile, statSync, readFileSync } from 'fs';
import { join } from 'path';
import { promisify } from 'util';

import { Observable, from } from 'rxjs';
import { map, concatMap } from 'rxjs/operators';
import { normalizeMakingOptions } from '../../utils/normalize';

try {
  require('dotenv').config();
} catch (e) {}

const writeFileAsync = (path: string, data: string) => promisify(writeFile)(path, data);

export interface MakeElectronBuilderOptions extends Configuration {
  name: string;
  frontendProject: string;
  platform: string;
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
  const targets: Map<Platform, Map<Arch, string[]>> = 
    options.arch ? _createTargets([options.platform], archFromString(options.arch)) : _createTargets([options.platform]);

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
      const config = Object.assign(options, baseConfig);

      await promisify(writeFile)(
        join(context.workspaceRoot, 'dist', 'apps', options.name, 'index.js'),
        `const Main = require('./${options.name}/main.js');`,
        { encoding: 'utf8' }
      );
      await build({ targets, config });

      return { success: true, outputPath: join(context.workspaceRoot, options.out) };
    })
  );
}

function _createTargets(platforms: string[], ...archs: Array<Arch>): Map<Platform, Map<Arch, string[]>> {
  const targets = new Map<Platform, Map<Arch, string[]>>();

  if (platforms.includes(Platform.WINDOWS.name)) {
    const target: Map<Platform, Map<Arch, string[]>> = 
      archs ? Platform.WINDOWS.createTarget(null, ...archs) : Platform.WINDOWS.createTarget();

    targets.set(
      target.entries().next().value[0],
      target.entries().next().value[1]
    );
  }

  if (platforms.includes(Platform.MAC.name)) {
    const target: Map<Platform, Map<Arch, string[]>> = 
      archs ? Platform.MAC.createTarget(null, ...archs): Platform.MAC.createTarget();

    targets.set(
      target.entries().next().value[0],
      target.entries().next().value[1]
    );
  }

  if (platforms.includes(Platform.LINUX.name)) {
    const target: Map<Platform, Map<Arch, string[]>> = 
      archs ? Platform.LINUX.createTarget(null, ...archs) : Platform.LINUX.createTarget();

    targets.set(
      target.entries().next().value[0],
      target.entries().next().value[1]
    );
  }

  return targets;
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
    asar: options.asar || false
  };
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
