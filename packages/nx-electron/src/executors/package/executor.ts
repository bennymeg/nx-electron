import { ExecutorContext, logger, stripIndents } from '@nrwl/devkit';

import { build, Configuration, PublishOptions, Platform, Arch, createTargets, FileSet, CliOptions } from 'electron-builder';
import { writeFile, statSync, readFileSync } from 'fs';
import { join, resolve } from 'path';
import { promisify } from 'util';

import { getSourceRoot } from '../../utils/workspace';
import { normalizePackagingOptions } from '../../utils/normalize';

import { Observable, from, of } from 'rxjs';
import { map, tap, concatMap, catchError } from 'rxjs/operators';
import { platform } from 'os';

import stripJsonComments from 'strip-json-comments';

try {
  require('dotenv').config();
} catch (e) {}

const writeFileAsync = (path: string, data: string) => promisify(writeFile)(path, data, { encoding: 'utf8' });

export interface PackageElectronBuilderOptions extends Configuration {
  name: string;
  frontendProject: string;
  platform: string | string[];
  arch: string;
  root: string;
  prepackageOnly: boolean;
  sourcePath: string;
  outputPath: string;
  publishPolicy?: PublishOptions["publish"];
  makerOptionsPath?: string;
}

export interface PackageElectronBuilderOutput {
  target?: any;
  success: boolean;
  outputPath: string | string[];
}

export async function executor(rawOptions: PackageElectronBuilderOptions, context: ExecutorContext): Promise<{ success: boolean; }> { 
  logger.warn(stripIndents`
  *********************************************************
  DO NOT FORGET TO REBUILD YOUR FRONTEND & BACKEND PROJECTS
  FOR PRODUCTION BEFORE PACKAGING / MAKING YOUR ARTIFACT!
  *********************************************************`);
  let success: boolean = false;

  try {
    const { sourceRoot, projectRoot } = getSourceRoot(context);
  
    let options = normalizePackagingOptions(rawOptions, context.root, sourceRoot);
    options = mergePresetOptions(options);
    options = addMissingDefaultOptions(options);
  
    const platforms: Platform[] = _createPlatforms(options.platform);
    const targets: Map<Platform, Map<Arch, string[]>> = _createTargets(platforms, null, options.arch);
    const baseConfig: Configuration = _createBaseConfig(options, context);
    const config: Configuration = _createConfigFromOptions(options, baseConfig);
    const normalizedOptions: CliOptions = _normalizeBuilderOptions(targets, config, rawOptions);

    await beforeBuild(options.root, options.sourcePath, options.name);
    await build(normalizedOptions);

    success = true;
  } catch (error) {
    logger.error(error);
  }
  
  return { success };
}

async function beforeBuild(projectRoot: string, sourcePath: string, appName: string) {
  await writeFileAsync(join(projectRoot, sourcePath, appName, 'index.js'), `const Main = require('./${appName}/main.js');`);
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

function _createBaseConfig(options: PackageElectronBuilderOptions, context: ExecutorContext): Configuration {
  const files: Array<FileSet | string> = options.files ?
   (Array.isArray(options.files) ? options.files : [options.files] ): Array<FileSet | string>()
  const outputPath = options.prepackageOnly ? 
    options.outputPath.replace('executables', 'packages') : options.outputPath;

  return {
    directories: {
      ...options.directories,
      output: join(context.root, outputPath)
    },
    files: files.concat([
      {
          from: resolve(options.sourcePath, options.frontendProject),
          to: options.frontendProject,
          filter: ['**/!(*.+(js|css).map)', 'assets']
      },
      {
          from: resolve(options.sourcePath, options.name),
          to: options.name,
          filter: ['main.js', '?(*.)preload.js', 'assets']
      },
      {
          from: resolve(options.sourcePath, options.name),
          to: '',
          filter: ['index.js', 'package.json']
      },      
      './package.json',
      '!(**/*.+(js|css).map)',
    ])
  };
}

function _createConfigFromOptions(options: PackageElectronBuilderOptions, baseConfig: Configuration): Configuration {
  const config = Object.assign({}, options, baseConfig);
      
  delete config.name;
  delete config.frontendProject;
  delete config.platform;
  delete config.arch;
  delete config.root;
  delete config.prepackageOnly;
  delete config['sourceRoot'];
  delete config['$schema'];
  delete config["publishPolicy"];
  delete config.sourcePath;
  delete config.outputPath;
  delete config["makerOptionsPath"];

  return config;
}

function _normalizeBuilderOptions(targets: Map<Platform, Map<Arch, string[]>>, config: Configuration, rawOptions: PackageElectronBuilderOptions): CliOptions {
  let normalizedOptions: CliOptions = { config, publish: rawOptions.publishPolicy || null };

  if (rawOptions.prepackageOnly) {
    normalizedOptions.dir = true;
  } else {
    normalizedOptions.targets = targets
  }

  return normalizedOptions;
}

function mergePresetOptions(options: PackageElectronBuilderOptions): PackageElectronBuilderOptions {
  // load preset options file
  const externalOptionsPath: string = options.makerOptionsPath ?
    resolve(options.root, options.makerOptionsPath) : 
    join(options.root, options['sourceRoot'], 'app', 'options', 'maker.options.json');

  if (statSync(externalOptionsPath).isFile()) {
    const rawData = readFileSync(externalOptionsPath, 'utf8')
    const externalOptions = JSON.parse(stripJsonComments(rawData));
    options = Object.assign(options, externalOptions);
  }

  return options;
}

function addMissingDefaultOptions(options: PackageElectronBuilderOptions): PackageElectronBuilderOptions {
  // remove unset options (use electron builder default values where possible)
  Object.keys(options).forEach((key) => (options[key] === '') && delete options[key]);

  return options;
}

export default executor;
