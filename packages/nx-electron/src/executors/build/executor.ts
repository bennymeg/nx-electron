import { join, parse, resolve } from 'path';
import { map, tap } from 'rxjs/operators';
// eslint-disable-next-line @nx/enforce-module-boundaries
import { eachValueFrom } from 'rxjs-for-await';
import { readdirSync } from 'fs';

import { ExecutorContext } from '@nx/devkit';
import { runWebpack } from '../../utils/run-webpack';
import {
  calculateProjectDependencies,
  checkDependentProjectsHaveBeenBuilt,
  createTmpTsConfig,
} from '@nx/js/src/utils/buildable-libs-utils';

import { getElectronWebpackConfig } from '../../utils/electron.config';
import { normalizeBuildOptions } from '../../utils/normalize';
import { BuildBuilderOptions } from '../../utils/types';
import { getSourceRoot } from '../../utils/workspace';
import { MAIN_OUTPUT_FILENAME } from '../../utils/config';
import { createPackageJson } from '@nx/js';

export type ElectronBuildEvent = {
  outfile: string;
  success: boolean;
};

export interface BuildElectronBuilderOptions extends BuildBuilderOptions {
  optimization?: boolean;
  sourceMap?: boolean;
  buildLibsFromSource?: boolean;
  generatePackageJson?: boolean;
  implicitDependencies: Array<string>;
  externalDependencies: 'all' | 'none' | Array<string>;
}

export interface NormalizedBuildElectronBuilderOptions
  extends BuildElectronBuilderOptions {
  webpackConfig: string;
}

export function executor(
  rawOptions: BuildElectronBuilderOptions,
  context: ExecutorContext
): AsyncIterableIterator<ElectronBuildEvent> {
  const { sourceRoot, projectRoot } = getSourceRoot(context);
  const normalizedOptions = normalizeBuildOptions(
    rawOptions,
    context.root,
    sourceRoot,
    projectRoot
  );
  const projGraph = context.projectGraph;

  if (!normalizedOptions.buildLibsFromSource) {
    const { target, dependencies } = calculateProjectDependencies(
      projGraph,
      context.root,
      context.projectName,
      context.targetName,
      context.configurationName
    );

    normalizedOptions.tsConfig = createTmpTsConfig(
      normalizedOptions.tsConfig,
      context.root,
      target.data.root,
      dependencies
    );

    if (
      !checkDependentProjectsHaveBeenBuilt(
        context.root,
        context.projectName,
        context.targetName,
        dependencies
      )
    ) {
      return { success: false } as any;
    }
  }

  if (normalizedOptions.generatePackageJson) {
    createPackageJson(context.projectName, projGraph, { ...normalizedOptions, 'isProduction': true });
  }

  let config = getElectronWebpackConfig(normalizedOptions);
  if (normalizedOptions.webpackConfig) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    config = require(normalizedOptions.webpackConfig)(config, {
      normalizedOptions,
      configuration: context.configurationName,
    });
  }

  try {
    const preloadFilesDirectory = join(normalizedOptions.sourceRoot, 'app/api');
    readdirSync(preloadFilesDirectory, { withFileTypes: true })
      .filter(
        (entry) => entry.isFile() && entry.name.match(/(.+[.])?preload.ts/)
      )
      .forEach(
        (entry) =>
          (config.entry[parse(entry.name).name] = resolve(
            preloadFilesDirectory,
            entry.name
          ))
      );
  } catch (error) {
    console.warn('Failed to load preload scripts');
  }

  return eachValueFrom(
    runWebpack(config).pipe(
      tap((stats) => {
        console.info(stats.toString(config.stats));
      }),
      map((stats) => {
        return {
          success: !stats.hasErrors(),
          outfile: resolve(
            context.root,
            normalizedOptions.outputPath,
            MAIN_OUTPUT_FILENAME
          ),
        } as ElectronBuildEvent;
      })
    )
  );
}

export default executor;
