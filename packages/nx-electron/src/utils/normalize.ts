/* eslint-disable @typescript-eslint/no-explicit-any */
import { resolve, dirname, relative, basename } from 'path';
import { AdditionalEntryPoint } from './types';
import {
  BuildElectronBuilderOptions,
  NormalizedBuildElectronBuilderOptions,
} from '../executors/build/executor';
import { PackageElectronBuilderOptions } from '../executors/package/executor';
import { statSync } from 'fs';

export interface FileReplacement {
  replace: string;
  with: string;
}

export function normalizeBuildOptions(
  options: BuildElectronBuilderOptions,
  root: string,
  sourceRoot: string,
  projectRoot: string
): NormalizedBuildElectronBuilderOptions {
  return {
    ...options,
    root,
    sourceRoot,
    projectRoot,
    main: resolve(root, options.main),
    outputPath: resolve(root, options.outputPath),
    tsConfig: resolve(root, options.tsConfig),
    fileReplacements: normalizeFileReplacements(root, options.fileReplacements),
    assets: normalizeAssets(options.assets, root, sourceRoot),
    webpackConfig: options.webpackConfig
      ? resolve(root, options.webpackConfig)
      : options.webpackConfig,
    additionalEntryPoints: normalizeAdditionalEntries(
      root,
      options.additionalEntryPoints ?? []
    ),
    outputFileName: options.outputFileName ?? 'main.js',
  };
}

export function normalizePackagingOptions<
  T extends PackageElectronBuilderOptions
>(options: T, root: string, sourceRoot: string): T {
  return {
    ...options,
    root,
    sourceRoot,
  };
}

function normalizeAssets(
  assets: any[],
  root: string,
  sourceRoot: string
): any[] {
  if (!Array.isArray(assets)) {
    return [];
  }
  return assets.map((asset) => {
    if (typeof asset === 'string') {
      const resolvedAssetPath = resolve(root, asset);
      const resolvedSourceRoot = resolve(root, sourceRoot);

      if (!resolvedAssetPath.startsWith(resolvedSourceRoot)) {
        throw new Error(
          `The ${resolvedAssetPath} asset path must start with the project source root: ${sourceRoot}`
        );
      }

      const isDirectory = statSync(resolvedAssetPath).isDirectory();
      const input = isDirectory
        ? resolvedAssetPath
        : dirname(resolvedAssetPath);
      const output = relative(resolvedSourceRoot, resolve(root, input));
      const glob = isDirectory ? '**/*' : basename(resolvedAssetPath);
      return {
        input,
        output,
        glob,
      };
    } else {
      if (asset.output.startsWith('..')) {
        throw new Error(
          'An asset cannot be written to a location outside of the output path.'
        );
      }

      const resolvedAssetPath = resolve(root, asset.input);
      return {
        ...asset,
        input: resolvedAssetPath,
        // Now we remove starting slash to make Webpack place it from the output root.
        output: asset.output.replace(/^\//, ''),
      };
    }
  });
}

function normalizeFileReplacements(
  root: string,
  fileReplacements: FileReplacement[]
): FileReplacement[] {
  return fileReplacements.map((fileReplacement) => ({
    replace: resolve(root, fileReplacement.replace),
    with: resolve(root, fileReplacement.with),
  }));
}

function normalizePluginPath(path: string, root: string) {
  try {
    return require.resolve(path);
  } catch {
    return resolve(root, path);
  }
}

function normalizeAdditionalEntries(
  root: string,
  additionalEntries: AdditionalEntryPoint[]
) {
  return additionalEntries.map(
    ({ entryName, entryPath }) =>
      ({
        entryName,
        entryPath: resolve(root, entryPath),
      } as AdditionalEntryPoint)
  );
}
