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
import {
  writeFile,
  statSync,
  readFileSync,
  existsSync,
  writeFileSync,
} from 'fs';
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

    const appSourcePath = resolveAppSourcePath(options, context);

    syncArtifactMetadata(options, appSourcePath);

    const platforms: Platform[] = _createPlatforms(options.platform);
    const targets: Map<Platform, Map<Arch, string[]>> = _createTargets(
      platforms,
      null,
      options.arch
    );
    const baseConfig: Configuration = _createBaseConfig(
      options,
      context,
      appSourcePath
    );
    const config: Configuration = _createConfigFromOptions(options, baseConfig);
    const normalizedOptions: CliOptions = _normalizeBuilderOptions(
      targets,
      config,
      rawOptions
    );

    await beforeBuild(appSourcePath, options.name);
    await build(normalizedOptions);

    success = true;
  } catch (error) {
    logger.error(error);
  }

  return { success };
}

/**
 * Returns the build output directory of the electron app, as configured on
 * its `nx-electron:build` target. `<sourcePath>/<name>` only matches it for
 * apps directly in the apps directory (not with `--directory` or in the TS
 * solution setup), so it is used as fallback only.
 */
export function resolveAppSourcePath(
  options: PackageElectronBuilderOptions,
  context: ExecutorContext
): string {
  const targets = context.projectGraph?.nodes[options.name]?.data.targets;
  const buildTarget = Object.values(targets ?? {}).find(
    (target) => target.executor === 'nx-electron:build'
  );
  const outputPath: unknown = buildTarget?.options?.outputPath;

  return typeof outputPath === 'string' && outputPath.length > 0
    ? resolve(options.root, outputPath)
    : resolve(options.root, options.sourcePath, options.name);
}

async function beforeBuild(appSourcePath: string, appName: string) {
  await writeFileAsync(
    join(appSourcePath, 'index.js'),
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
  context: ExecutorContext,
  appSourcePath: string
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
        from: appSourcePath,
        to: options.name,
        filter: ['main.js', '?(*.)preload.js', 'assets'],
      },
      {
        from: appSourcePath,
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

/**
 * Mirrors `extraMetadata` (plus a `--buildVersion` fallback for the version)
 * into the app's generated `package.json` that is bundled into the artifact.
 *
 * electron-builder applies `extraMetadata` to the metadata it uses for naming
 * the installer, but nx-electron ships a pre-generated `package.json` (produced
 * by the `build` executor and copied verbatim from the build output), so those
 * overrides never reach the `package.json` embedded inside the artifact. As a
 * result `app.getVersion()`, `app.name` — and therefore Electron's default
 * `userData` path (`%APPDATA%/<name>`) — stayed on the build-time values (e.g.
 * `0.0.1` / the Nx project name) even though the installer was named correctly.
 *
 * Follows electron-builder's `extraMetadata` semantics: nested objects are
 * deep-merged and a `null` value removes the field.
 */
export function syncArtifactMetadata(
  options: PackageElectronBuilderOptions,
  appSourcePath = resolve(options.root, options.sourcePath, options.name)
): void {
  const metadata: Record<string, unknown> = {
    ...(options.extraMetadata as Record<string, unknown> | undefined),
  };

  if (
    metadata.version === undefined &&
    typeof options.buildVersion === 'string' &&
    options.buildVersion.length > 0
  ) {
    metadata.version = options.buildVersion;
  }

  if (Object.keys(metadata).length === 0) {
    return;
  }

  const packageJsonPath = resolve(appSourcePath, 'package.json');

  if (!existsSync(packageJsonPath)) {
    return;
  }

  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));

  if (!applyExtraMetadata(packageJson, metadata)) {
    return;
  }

  writeFileSync(
    packageJsonPath,
    JSON.stringify(packageJson, null, 2) + '\n',
    'utf8'
  );

  logger.info(
    `Applied extraMetadata (${Object.keys(metadata).join(
      ', '
    )}) to the bundled package.json of "${options.name}".`
  );
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Deep-merges `source` into `target`; returns whether anything changed. */
function applyExtraMetadata(
  target: Record<string, unknown>,
  source: Record<string, unknown>
): boolean {
  let changed = false;

  for (const [key, value] of Object.entries(source)) {
    if (value === undefined) {
      continue;
    }

    if (value === null) {
      if (key in target) {
        delete target[key];
        changed = true;
      }
    } else if (isPlainObject(value) && isPlainObject(target[key])) {
      changed =
        applyExtraMetadata(target[key] as Record<string, unknown>, value) ||
        changed;
    } else if (JSON.stringify(target[key]) !== JSON.stringify(value)) {
      target[key] = value;
      changed = true;
    }
  }

  return changed;
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
