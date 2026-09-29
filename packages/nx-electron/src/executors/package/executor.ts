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

    syncArtifactMetadata(options);

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

function _createBaseConfig(
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

  return config;
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
  options: PackageElectronBuilderOptions
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

  const packageJsonPath = resolve(
    options.root,
    options['sourcePath'],
    options.name,
    'package.json'
  );

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
