import { BuilderContext, BuilderOutput, createBuilder } from '@angular-devkit/architect';
import { JsonObject } from '@angular-devkit/core';

import { build, Configuration, PublishOptions, Platform, Arch, createTargets, FileSet } from 'electron-builder';
import { writeFile, statSync, readFileSync } from 'fs';
import { join } from 'path';
import { promisify } from 'util';

import { getSourceRoot } from '../../utils/workspace';
import { normalizeMakingOptions } from '../../utils/normalize';

import { Observable, from, of } from 'rxjs';
import { map, concatMap, catchError } from 'rxjs/operators';
import { platform } from 'os';

import stripJsonComments from 'strip-json-comments';

try {
  require('dotenv').config();
} catch (e) {}

const writeFileAsync = (path: string, data: string) => promisify(writeFile)(path, data, { encoding: 'utf8' });

export interface MakeElectronBuilderOptions extends Configuration {
  name: string;
  frontendProject: string;
  platform: string | string[];
  arch: string;
  root: string;
  out: string;
  publishPolicy?: PublishOptions["publish"];
}

export interface MakeElectronBuilderOutput extends BuilderOutput {
  target?: any;
  outputPath: string | string[];
}

export default createBuilder<JsonObject & MakeElectronBuilderOptions>(run);

function run(rawOptions: JsonObject & MakeElectronBuilderOptions, context: BuilderContext): Observable<MakeElectronBuilderOutput> { 
  return from(getSourceRoot(context)).pipe(
    map(sourceRoot =>
      normalizeMakingOptions(rawOptions, context.workspaceRoot, sourceRoot)
    ),
    map(options => 
      mergePresetOptions(options)
    ),
    map(options => 
      addMissingDefaultOptions(options)
    ),
    concatMap(async (options) => {
      await beforeBuild(options.root, options.name);

      const platforms: Platform[] = _createPlatforms(options.platform);
      const targets: Map<Platform, Map<Arch, string[]>> = _createTargets(platforms, null, options.arch);
      const baseConfig: Configuration = _createBaseConfig(options, context);
      const config = _createConfigFromOptions(options, baseConfig);
      const outputPath = await build({ targets, config, publish: rawOptions.publishPolicy || null });

      return { success: true, outputPath };
    }),
    catchError(error => {
      console.error(error);

      return of({ success: false, outputPath: null });
    })
  );
}

async function beforeBuild(appDir: string, appName: string) {
  await writeFileAsync(join(appDir, 'dist', 'apps', appName, 'index.js'), `const Main = require('./${appName}/main.js');`);
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
  const files: Array<FileSet | string> = options.files ?
   (Array.isArray(options.files) ? options.files : [options.files] ): Array<FileSet | string>()

  return {
    directories: {
      ...options.directories,
      output: join(context.workspaceRoot, options.out)
    },
    files: files.concat([
      {
          from: `./dist/apps/${options.frontendProject}`,
          to: options.frontendProject,
          filter: ['**/!(*.js.map)', 'assets']
      },
      {
          from: `./dist/apps/${options.name}`,
          to: options.name,
          filter: ['main.js', 'assets']
      },
      {
          from: `./dist/apps/${options.name}`,
          to: '',
          filter: ['index.js']
      },      
      './package.json',
      '!(**/*.js.map)',
    ])
  };
}

function _createConfigFromOptions(options: MakeElectronBuilderOptions, baseConfig: Configuration): Configuration {
  const config = Object.assign({}, options, baseConfig);
      
  delete config.name;
  delete config.frontendProject;
  delete config.platform;
  delete config.arch;
  delete config.root;
  delete config['sourceRoot'];
  delete config['$schema'];
  delete config["publishPolicy"];
  delete config.out;

  return config;
}

function mergePresetOptions(options: MakeElectronBuilderOptions): MakeElectronBuilderOptions {
  // load preset options file
  const externalOptionsPath: string = join(options.root, options['sourceRoot'], 'app', 'options', 'maker.options.json');

  if (statSync(externalOptionsPath).isFile()) {
    const rawData = readFileSync(externalOptionsPath, 'utf8')
    const externalOptions = JSON.parse(stripJsonComments(rawData));
    options = Object.assign(options, externalOptions);
  }

  return options;
}

function addMissingDefaultOptions(options: MakeElectronBuilderOptions): MakeElectronBuilderOptions {
  // remove unset options (use electron builder default values where possible)
  Object.keys(options).forEach((key) => (options[key] === '') && delete options[key]);

  return options;
}
