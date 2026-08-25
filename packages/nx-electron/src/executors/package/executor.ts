import { ExecutorContext, logger, stripIndents } from '@nx/devkit';

import {
  build,
  Configuration,
  PublishOptions,
  Platform,
  Arch,
  createTargets,
  FileSet,
  CliOptions,
} from 'electron-builder';
import { writeFile, statSync, readFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import { promisify } from 'util';

import { getSourceRoot } from '../../utils/workspace';
import { normalizePackagingOptions } from '../../utils/normalize';

import { platform } from 'os';
import stripJsonComments from 'strip-json-comments';

const writeFileAsync = (path: string, data: string) =>
  promisify(writeFile)(path, data, { encoding: 'utf8' });

export interface PackageElectronBuilderOptions extends Configuration {
  name: string;
  frontendProject: string;
  extraProjects: string[];
  platform: string | string[];
  arch: string;
  root: string;
  prepackageOnly: boolean;
  sourcePath: string;
  outputPath: string;
  publishPolicy?: PublishOptions['publish'];
  makerOptionsPath?: string;
  /**
   * Fail the packaging when the source (`from`) of a configured copy step
   * (`files`, `extraResources`, `extraFiles`, `frontendProject`,
   * `extraProjects`) does not exist. Defaults to `true`; set to `false` to
   * only log a warning and let electron-builder silently skip the entry.
   */
  failOnMissingFiles?: boolean;
}

export interface PackageElectronBuilderOutput {
  target?: any;
  success: boolean;
  outputPath: string | string[];
}

export async function executor(
  rawOptions: PackageElectronBuilderOptions,
  context: ExecutorContext
): Promise<{ success: boolean }> {
  logger.warn(stripIndents`
  *********************************************************
  DO NOT FORGET TO REBUILD YOUR FRONTEND & BACKEND PROJECTS
  FOR PRODUCTION BEFORE PACKAGING / MAKING YOUR ARTIFACT!
  *********************************************************`);
  let success = false;

  try {
    const { sourceRoot, projectRoot } = getSourceRoot(context);

    let options = normalizePackagingOptions(
      rawOptions,
      context.root,
      sourceRoot
    );
    options = mergePresetOptions(options);
    options = addMissingDefaultOptions(options);

    const platforms: Platform[] = _createPlatforms(options.platform);
    const targets: Map<Platform, Map<Arch, string[]>> = _createTargets(
      platforms,
      null,
      options.arch
    );
    const baseConfig: Configuration = _createBaseConfig(options, context);
    const config: Configuration = _createConfigFromOptions(options, baseConfig);
    const normalizedOptions: CliOptions = _normalizeBuilderOptions(
      targets,
      config,
      rawOptions
    );

    await beforeBuild(options.root, options.sourcePath, options.name);
    await build(normalizedOptions);

    success = true;
  } catch (error) {
    logger.error(error);
  }

  return { success };
}

async function beforeBuild(
  projectRoot: string,
  sourcePath: string,
  appName: string
) {
  await writeFileAsync(
    join(projectRoot, sourcePath, appName, 'index.js'),
    `const Main = require('./${appName}/main.js');`
  );
}

function _createPlatforms(rawPlatforms: string | string[]): Platform[] {
  const platforms: Platform[] = [];

  if (!rawPlatforms) {
    const platformMap: Map<string, string> = new Map([
      ['win32', 'windows'],
      ['darwin', 'mac'],
      ['linux', 'linux'],
    ]);

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

function _createTargets(
  platforms: Platform[],
  type: string,
  arch: string
): Map<Platform, Map<Arch, string[]>> {
  return createTargets(platforms, null, arch);
}

export function _createBaseConfig(
  options: PackageElectronBuilderOptions,
  context: ExecutorContext
): Configuration {
  const outputPath = options.prepackageOnly
    ? options.outputPath.replace('executables', 'packages')
    : options.outputPath;
  let files: Array<FileSet | string> = options.files
    ? Array.isArray(options.files)
      ? options.files
      : [options.files]
    : Array<FileSet | string>();

  if (options.frontendProject && options.frontendProject != '') {
    files = files.concat([
      {
        from: resolve(options.sourcePath, options.frontendProject),
        to: options.frontendProject,
        filter: ['**/!(*.+(js|css).map)'],
      },
    ]);
  }

  if (options.extraProjects) {
    options.extraProjects.forEach((project) => {
      files = files.concat([
        {
          from: resolve(options.sourcePath, project.trim()),
          to: project,
          filter: ['**/!(*.+(js|css).map)'],
        },
      ]);
    });
  }

  files.forEach((file) => {
    if (file && typeof file === 'object' && file.from && file.from.length > 0) {
      file.from = resolve(options.sourcePath, file.from);
    }
  });

  validateFileSources(files, options);

  return {
    directories: {
      ...options.directories,
      output: join(context.root, outputPath),
    },
    files: files.concat([
      './package.json',
      {
        from: resolve(options.sourcePath, options.name),
        to: options.name,
        filter: ['main.js', '?(*.)preload.js', 'assets'],
      },
      {
        from: resolve(options.sourcePath, options.name),
        to: '',
        filter: ['index.js', 'package.json'],
      },
      '!(**/*.+(js|css).map)',
    ]),
  };
}

export function _createConfigFromOptions(
  options: PackageElectronBuilderOptions,
  baseConfig: Configuration
): Configuration {
  const config = Object.assign({}, options, baseConfig);

  delete config.name;
  delete config.frontendProject;
  delete config.extraProjects;
  delete config.platform;
  delete config.arch;
  delete config.root;
  delete config.prepackageOnly;
  delete config['sourceRoot'];
  delete config['$schema'];
  delete config['publishPolicy'];
  delete config.sourcePath;
  delete config.outputPath;
  delete config['makerOptionsPath'];
  delete config['failOnMissingFiles'];

  return config;
}

/** Matches glob syntax and electron-builder `${macro}` expansions. */
const NON_LITERAL_PATH = /[*?[\]{}!]|\$\{/;

function isLiteralPath(from: unknown): from is string {
  return (
    typeof from === 'string' && from.length > 0 && !NON_LITERAL_PATH.test(from)
  );
}

function toArray<T>(value: T | T[] | null | undefined): T[] {
  if (value == null) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

/**
 * Collects the absolute `from` paths of all explicitly configured copy steps
 * (`files` FileSets — including the ones derived from `frontendProject` and
 * `extraProjects` — as well as top-level `extraResources` / `extraFiles`)
 * whose source does not exist on disk.
 *
 * `files` entries are expected to be resolved already (see
 * `_createBaseConfig`); `extraResources` / `extraFiles` are resolved against
 * the workspace root, which is what electron-builder uses as project directory.
 * Plain string patterns, globs and entries containing macros are ignored since
 * their existence cannot be determined statically.
 */
export function findMissingFileSources(
  files: Array<FileSet | string>,
  options: PackageElectronBuilderOptions
): string[] {
  const sources = new Set<string>();

  files.forEach((file) => {
    if (file && typeof file === 'object' && isLiteralPath(file.from)) {
      sources.add(file.from);
    }
  });

  (['extraResources', 'extraFiles'] as const).forEach((key) => {
    toArray(options[key]).forEach((entry) => {
      if (entry && typeof entry === 'object' && isLiteralPath(entry.from)) {
        sources.add(resolve(options.root, entry.from));
      }
    });
  });

  return Array.from(sources).filter((source) => !existsSync(source));
}

/**
 * electron-builder silently skips (debug log only) `files` entries whose
 * `from` directory does not exist and merely warns for `extraResources` /
 * `extraFiles`. A typo in a path or a forgotten build step therefore yields a
 * "successful" artifact that is missing assets. Fail loudly instead, unless
 * `failOnMissingFiles` is explicitly set to `false`.
 */
export function validateFileSources(
  files: Array<FileSet | string>,
  options: PackageElectronBuilderOptions
): void {
  const missing = findMissingFileSources(files, options);

  if (missing.length === 0) {
    return;
  }

  const message = [
    'The following copy step source(s) configured for packaging do not exist:',
    ...missing.map((source) => `  - ${source}`),
    'Make sure the referenced projects / assets have been built before packaging, or fix the "from" path(s).',
    'Set "failOnMissingFiles": false to downgrade this error to a warning.',
  ].join('\n');

  if (options.failOnMissingFiles === false) {
    logger.warn(message);
    return;
  }

  throw new Error(message);
}

function _normalizeBuilderOptions(
  targets: Map<Platform, Map<Arch, string[]>>,
  config: Configuration,
  rawOptions: PackageElectronBuilderOptions
): CliOptions {
  const normalizedOptions: CliOptions = {
    config,
    publish: rawOptions.publishPolicy || null,
  };

  if (rawOptions.prepackageOnly) {
    normalizedOptions.dir = true;
  } else {
    normalizedOptions.targets = targets;
  }

  return normalizedOptions;
}

function mergePresetOptions(
  options: PackageElectronBuilderOptions
): PackageElectronBuilderOptions {
  // load preset options file
  const externalOptionsPath: string = options.makerOptionsPath
    ? resolve(options.root, options.makerOptionsPath)
    : join(
        options.root,
        options['sourceRoot'],
        'app',
        'options',
        'maker.options.json'
      );

  if (statSync(externalOptionsPath).isFile()) {
    const rawData = readFileSync(externalOptionsPath, 'utf8');
    const externalOptions = JSON.parse(stripJsonComments(rawData));
    options = Object.assign(options, externalOptions);
  }

  return options;
}

function addMissingDefaultOptions(
  options: PackageElectronBuilderOptions
): PackageElectronBuilderOptions {
  // remove unset options (use electron builder default values where possible)
  Object.keys(options).forEach(
    (key) => options[key] === '' && delete options[key]
  );

  return options;
}

export default executor;
